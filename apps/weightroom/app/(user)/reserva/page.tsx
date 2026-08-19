"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as z from "zod/v4";
import { CREATE_SUPABASE_BROWSER_CLIENT } from "@gusm/database/client";
import {
  UserCalendarBanner,
  WeekIndicator,
  getWeekDates,
  getSantiagoToday,
  isBookingDateAvailable,
  isSameDay,
  MIN_WEEK_OFFSET,
  MAX_WEEK_OFFSET,
} from "@/components/UserCalendarBanner";
import type { ActiveBooking } from "@/components/ActiveBookingsPanel";
import { BlockCard, type UserBlock, type UserBookingStatus } from "@/components/BlockCard";
import { BookingPanel } from "@/components/BookingPanel";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────

const CURRENT_USER_SCHEMA = z.object({
  userName: z.string().min(1),
  role: z.enum(["student", "u_staff", "gym_staff", "admin"]),
  streakWeeks: z.number().int().nonnegative(),
});

type CurrentUser = z.infer<typeof CURRENT_USER_SCHEMA>;

const ACTIVE_BOOKINGS_RESPONSE_SCHEMA = z.object({
  bookings: z.array(
    z.object({
      bookingId: z.string().uuid(),
      bookingDate: z.string().date(),
      status: z.enum(["reserved", "confirmed"]),
      timeRange: z.string().min(1),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
    }),
  ),
});

/** TODO: SELECT capacity FROM gym_rules LIMIT 1 */
const MOCK_TOTAL_SPOTS = 15;

const BASE_BLOCKS = [
  { id: 1, timeRange: "08:50 · 09:40", startTime: "08:50" },
  { id: 2, timeRange: "09:40 · 11:05", startTime: "09:40" },
  { id: 3, timeRange: "11:05 · 12:15", startTime: "11:05" },
  { id: 4, timeRange: "12:15 · 13:40", startTime: "12:15" },
  { id: 5, timeRange: "14:40 · 15:50", startTime: "14:40" },
  { id: 6, timeRange: "15:50 · 17:15", startTime: "15:50" },
  { id: 7, timeRange: "17:15 · 18:40", startTime: "17:15" },
  { id: 8, timeRange: "18:40 · 19:40", startTime: "18:40" },
  { id: 9, timeRange: "19:40 · 21:05", startTime: "19:40" },
] as const;

const SANTIAGO_TIME_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Santiago",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// ─────────────────────────────────────────────────────────────────────────────
/** Generador determinista para mock — eliminar cuando haya datos reales */
function seededRand(seed: number): number {
  const x = Math.sin(seed + 1.618) * 10000;
  return x - Math.floor(x);
}

/**
 * TODO: reemplazar con useBlocks(dayIdx, weekOffset) + useBookings(blockId, day)
 * Genera ocupación mock determinista por día y semana.
 */
function getMockBlocksBase(dayIdx: number, weekOffset: number): UserBlock[] {
  return BASE_BLOCKS.map((b) => {
    const seed = dayIdx * 137 + weekOffset * 97 + b.id * 31;
    const taken = Math.min(Math.round(seededRand(seed) * 13) + 1, MOCK_TOTAL_SPOTS);
    return { ...b, taken, userStatus: "none" as const };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Booking state (per day)
// ─────────────────────────────────────────────────────────────────────────────

type BookingCalendarKey = `${number}-${number}`;
type BookingEntry = {
  blockId: number;
  status: Exclude<UserBookingStatus, "none">;
  bookingDate: Date;
};

function getBookingCalendarKey(weekOffset: number, dayIndex: number): BookingCalendarKey {
  return `${weekOffset}-${dayIndex}`;
}

async function getActiveBookings(): Promise<ActiveBooking[]> {
  const response = await fetch("/api/bookings/active", { cache: "no-store" });
  const payload: unknown = await response.json();
  const parsedPayload = ACTIVE_BOOKINGS_RESPONSE_SCHEMA.safeParse(payload);

  if (!response.ok || !parsedPayload.success) {
    throw new Error("Active bookings request was rejected.");
  }

  return parsedPayload.data.bookings.map((booking) => ({
    bookingKey: booking.bookingId,
    date: new Date(`${booking.bookingDate}T12:00:00`),
    timeRange: booking.timeRange,
    status: booking.status,
    isConfirmationAvailable: isConfirmationWindowActive(
      new Date(`${booking.bookingDate}T12:00:00`),
      booking.startTime,
    ),
    isCancellationLocked:
      booking.status === "confirmed" &&
      isConfirmedBookingCancellationLocked(
        new Date(`${booking.bookingDate}T12:00:00`),
        booking.startTime,
      ),
  }));
}

function getTimePart(parts: Intl.DateTimeFormatPart[], type: "hour" | "minute"): number {
  const part = parts.find((candidate) => candidate.type === type);
  if (!part) throw new Error(`Missing ${type} from formatted time.`);
  return Number(part.value);
}

function isConfirmationWindowActive(date: Date, startTime: string): boolean {
  if (!isSameDay(date, getSantiagoToday())) return false;

  const [startHourText, startMinuteText] = startTime.split(":");
  if (startHourText === undefined || startMinuteText === undefined) return false;

  const startMinutes = Number(startHourText) * 60 + Number(startMinuteText);
  const nowParts = SANTIAGO_TIME_FORMATTER.formatToParts(new Date());
  const nowMinutes = getTimePart(nowParts, "hour") * 60 + getTimePart(nowParts, "minute");

  return nowMinutes >= startMinutes - 240 && nowMinutes < startMinutes - 60;
}

function isFinalHourBeforeBlock(date: Date, startTime: string): boolean {
  if (!isSameDay(date, getSantiagoToday())) return false;

  const [startHourText, startMinuteText] = startTime.split(":");
  if (startHourText === undefined || startMinuteText === undefined) return false;

  const startMinutes = Number(startHourText) * 60 + Number(startMinuteText);
  const nowParts = SANTIAGO_TIME_FORMATTER.formatToParts(new Date());
  const nowMinutes = getTimePart(nowParts, "hour") * 60 + getTimePart(nowParts, "minute");

  return nowMinutes >= startMinutes - 60 && nowMinutes < startMinutes;
}

function isConfirmedBookingCancellationLocked(date: Date, startTime: string): boolean {
  return isFinalHourBeforeBlock(date, startTime);
}

function isStandardBookingAvailable(date: Date, startTime: string): boolean {
  if (!isBookingDateAvailable(date)) return false;
  if (!isSameDay(date, getSantiagoToday())) return true;

  const [startHourText, startMinuteText] = startTime.split(":");
  if (startHourText === undefined || startMinuteText === undefined) return false;

  const startMinutes = Number(startHourText) * 60 + Number(startMinuteText);
  const nowParts = SANTIAGO_TIME_FORMATTER.formatToParts(new Date());
  const nowMinutes = getTimePart(nowParts, "hour") * 60 + getTimePart(nowParts, "minute");

  return nowMinutes < startMinutes;
}

function getDefaultCalendarSelection() {
  const currentWeek = getWeekDates(0);
  const currentWeekDayIndex = currentWeek.findIndex(isBookingDateAvailable);
  if (currentWeekDayIndex >= 0) {
    return { weekOffset: 0, dayIndex: currentWeekDayIndex };
  }

  const nextWeek = getWeekDates(1);
  const nextWeekDayIndex = nextWeek.findIndex(isBookingDateAvailable);
  if (nextWeekDayIndex < 0) throw new Error("No booking date is available.");

  return { weekOffset: 1, dayIndex: nextWeekDayIndex };
}

// ─────────────────────────────────────────────────────────────────────────────
// BookingPage
// ─────────────────────────────────────────────────────────────────────────────

export default function BookingPage() {
  const router = useRouter();
  const defaultCalendarSelection = getDefaultCalendarSelection();

  const [dayIdx, setDayIdx] = useState(defaultCalendarSelection.dayIndex);
  const [weekOffset, setWeekOffset] = useState(defaultCalendarSelection.weekOffset);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [bookings, setBookings] = useState<Map<BookingCalendarKey, BookingEntry>>(new Map());
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [activeBookings, setActiveBookings] = useState<ActiveBooking[]>([]);

  const dayKey = getBookingCalendarKey(weekOffset, dayIdx);
  const booking = bookings.get(dayKey) ?? null;
  const selectedDate = getWeekDates(weekOffset)[dayIdx]!;
  const isSelectedDateAvailable = isBookingDateAvailable(selectedDate);

  const blocks = useMemo<UserBlock[]>(() => {
    const base = getMockBlocksBase(dayIdx, weekOffset);
    if (!booking) return base;
    return base.map((b) =>
      b.id === booking.blockId
        ? {
            ...b,
            userStatus: booking.status,
            taken: Math.min(b.taken + 1, MOCK_TOTAL_SPOTS),
          }
        : b,
    );
  }, [dayIdx, weekOffset, booking]);

  const selectedBlock = blocks.find((b) => b.id === selectedId) ?? null;
  const userBookedBlock = booking ? (blocks.find((b) => b.id === booking.blockId) ?? null) : null;
  const selectedTimeBlock = selectedBlock
    ? BASE_BLOCKS.find((timeBlock) => timeBlock.id === selectedBlock.id)
    : null;
  const isSelectedCancellationLocked =
    selectedBlock?.userStatus === "confirmed" &&
    selectedTimeBlock !== undefined &&
    selectedTimeBlock !== null &&
    isConfirmedBookingCancellationLocked(selectedDate, selectedTimeBlock.startTime);
  const isSelectedBookingAvailable =
    selectedTimeBlock !== undefined &&
    selectedTimeBlock !== null &&
    isStandardBookingAvailable(selectedDate, selectedTimeBlock.startTime);
  const isSelectedBookingAutoConfirmed =
    selectedTimeBlock !== undefined &&
    selectedTimeBlock !== null &&
    isFinalHourBeforeBlock(selectedDate, selectedTimeBlock.startTime);
  useEffect(() => {
    const controller = new AbortController();

    async function loadCurrentUser() {
      try {
        const response = await fetch("/api/current-user", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Current user request was rejected.");
        }

        const payload: unknown = await response.json();
        const parsedCurrentUser = CURRENT_USER_SCHEMA.safeParse(payload);
        if (!parsedCurrentUser.success) {
          throw new Error("Current user response is invalid.");
        }

        setCurrentUser(parsedCurrentUser.data);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;

        console.error("[RESERVA] could not load the topbar context.", error);
      }
    }

    void loadCurrentUser();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadActiveBookings() {
      try {
        const nextActiveBookings = await getActiveBookings();
        if (!isCancelled) setActiveBookings(nextActiveBookings);
      } catch (error) {
        if (!isCancelled) console.error("[RESERVA] could not load active bookings.", error);
      }
    }

    void loadActiveBookings();
    return () => {
      isCancelled = true;
    };
  }, []);

  // ── Handlers de calendario ────────────────────────────────────────────────

  function handleSelectDay(index: number) {
    setDayIdx(index);
    const nextBooking = bookings.get(getBookingCalendarKey(weekOffset, index));
    setSelectedId(nextBooking ? nextBooking.blockId : null);
  }

  function handleWeekChange(offset: number) {
    const clamped = Math.max(MIN_WEEK_OFFSET, Math.min(MAX_WEEK_OFFSET, offset));
    const nextDayIndex = clamped < 0 ? 0 : getWeekDates(clamped).findIndex(isBookingDateAvailable);
    setWeekOffset(clamped);
    setDayIdx(nextDayIndex);
    const nextBooking = bookings.get(getBookingCalendarKey(clamped, nextDayIndex));
    setSelectedId(nextBooking ? nextBooking.blockId : null);
  }

  function handleGoToday() {
    setWeekOffset(defaultCalendarSelection.weekOffset);
    setDayIdx(defaultCalendarSelection.dayIndex);
    const nextBooking = bookings.get(
      getBookingCalendarKey(defaultCalendarSelection.weekOffset, defaultCalendarSelection.dayIndex),
    );
    setSelectedId(nextBooking ? nextBooking.blockId : null);
  }

  // ── Handlers de reserva ───────────────────────────────────────────────────

  function handleInscribe() {
    if (!selectedId || !isSelectedDateAvailable || !isSelectedBookingAvailable) return;
    setBookings((prev) => {
      const next = new Map(prev);
      next.set(dayKey, {
        blockId: selectedId,
        status: isSelectedBookingAutoConfirmed ? "confirmed" : "inscribed",
        bookingDate: selectedDate,
      });
      return next;
    });
  }

  function handleCancel() {
    setBookings((prev) => {
      const next = new Map(prev);
      next.delete(dayKey);
      return next;
    });
  }

  function handleConfirm() {
    if (!booking) return;
    setBookings((prev) => {
      const next = new Map(prev);
      next.set(dayKey, { ...booking, status: "confirmed" });
      return next;
    });
  }

  async function handleActiveBookingAction(bookingKey: string, action: "confirm" | "cancel") {
    const response = await fetch("/api/bookings/action", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: bookingKey, action }),
    });

    if (!response.ok) {
      console.error("[RESERVA] active booking action was rejected.");
      return;
    }

    try {
      setActiveBookings(await getActiveBookings());
    } catch (error) {
      console.error("[RESERVA] could not refresh active bookings.", error);
    }
  }

  function handleConfirmActiveBooking(bookingKey: string) {
    return handleActiveBookingAction(bookingKey, "confirm");
  }

  function handleCancelActiveBooking(bookingKey: string) {
    return handleActiveBookingAction(bookingKey, "cancel");
  }

  function handleGoProfile() {
    router.push("/perfil");
  }

  function handleGoCheckIn() {
    router.push("/qr");
  }

  async function handleSignOut() {
    const supabase = CREATE_SUPABASE_BROWSER_CLIENT();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("[RESERVA] could not sign out.", error);
      return;
    }

    router.replace("/login");
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-svh w-full justify-center bg-bg">
      <div className="relative flex h-svh gusm-app-shell flex-col overflow-hidden select-none">
        {/* ── Banner con calendario + identidad del usuario ──────────── */}
        <UserCalendarBanner
          userName={currentUser?.userName ?? ""}
          role={currentUser?.role ?? "student"}
          streakWeeks={currentUser?.streakWeeks ?? 0}
          selectedDay={dayIdx}
          weekOffset={weekOffset}
          onSelectDay={handleSelectDay}
          onWeekChange={handleWeekChange}
          onGoToday={handleGoToday}
          onGoProfile={handleGoProfile}
          onGoCheckIn={handleGoCheckIn}
          onSignOut={handleSignOut}
          activeBookings={activeBookings}
          onConfirmBooking={handleConfirmActiveBooking}
          onCancelBooking={handleCancelActiveBooking}
        />

        {/* ── Indicador de semana ────────────────────────────────────── */}
        <WeekIndicator weekOffset={weekOffset} onWeekChange={handleWeekChange} />

        {/* ── Lista de bloques scrolleable ──────────────────────────── */}
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-4 py-3">
          {blocks.map((block) => (
            <BlockCard
              key={block.id}
              block={block}
              totalSpots={MOCK_TOTAL_SPOTS}
              isSelected={block.id === selectedId}
              isBookingDateAvailable={isSelectedDateAvailable}
              onSelect={() => setSelectedId(block.id)}
            />
          ))}
          <div className="h-2" />
        </div>

        {/* ── Panel de acción fijo en la parte inferior ─────────────── */}
        <BookingPanel
          selectedBlock={selectedBlock}
          totalSpots={MOCK_TOTAL_SPOTS}
          userBookedBlock={userBookedBlock}
          selectedDate={selectedDate}
          isBookingAvailable={isSelectedBookingAvailable}
          isCancellationLocked={isSelectedCancellationLocked}
          onInscribe={handleInscribe}
          onCancel={handleCancel}
          onConfirm={handleConfirm}
        />
      </div>
    </div>
  );
}
