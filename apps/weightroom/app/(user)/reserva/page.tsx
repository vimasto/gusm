"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
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
import type { StaffWeekBookingDay } from "@/components/StaffWeekBookingList";
import { UserTopBar } from "@/components/UserTopBar";
import type { ActiveBooking } from "@/components/ActiveBookingsPanel";
import { BlockCard, type UserBlock, type UserBookingStatus } from "@/components/BlockCard";
import { ReservationSuccessOverlay } from "@/components/ReservationSuccessOverlay";
import { STAFF_BOOKING_LAYOUT_PREVIEW_ENABLED } from "@/lib/booking/presentation-preview";
import {
  bookingAvailabilityTopic,
  bookingWeekAvailabilityQueryKey,
  getBookingWeekAvailability,
  type BookingWeekAvailability,
} from "@/lib/booking/availability";
import { getCurrentUser } from "@/lib/current-user";
import { clearProfileCache } from "@/lib/profile-cache";
import { CURRENT_USER_QUERY_KEY } from "@/lib/query-keys";
import { applyThemePreference } from "@/lib/theme";

const StaffWeekBookingList = dynamic(
  () => import("@/components/StaffWeekBookingList").then((module) => module.StaffWeekBookingList),
  {
    loading: function StaffWeekBookingListLoading() {
      return (
        <div className="flex flex-1 flex-col gap-2 px-4 py-3" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="gusm-control-height rounded-xl border border-divider bg-input"
            />
          ))}
        </div>
      );
    },
    ssr: false,
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────

const BOOKING_CLOSURES_SCHEMA = z.object({
  closures: z.array(
    z.object({
      date: z.string().date(),
      timeBlockId: z.number().int().positive(),
      reason: z.string().min(3).max(240),
    }),
  ),
});

const MOCK_TOTAL_SPOTS = 15;

const BASE_BLOCKS = [
  { id: 1, timeRange: "08:50 · 09:40", startTime: "08:50", endTime: "09:40" },
  { id: 2, timeRange: "09:40 · 11:05", startTime: "09:40", endTime: "11:05" },
  { id: 3, timeRange: "11:05 · 12:15", startTime: "11:05", endTime: "12:15" },
  { id: 4, timeRange: "12:15 · 13:40", startTime: "12:15", endTime: "13:40" },
  { id: 5, timeRange: "14:40 · 15:50", startTime: "14:40", endTime: "15:50" },
  { id: 6, timeRange: "15:50 · 17:15", startTime: "15:50", endTime: "17:15" },
  { id: 7, timeRange: "17:15 · 18:40", startTime: "17:15", endTime: "18:40" },
  { id: 8, timeRange: "18:40 · 19:40", startTime: "18:40", endTime: "19:40" },
  { id: 9, timeRange: "19:40 · 21:05", startTime: "19:40", endTime: "21:05" },
] as const;

const SANTIAGO_TIME_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Santiago",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const SPANISH_NUMBER_FORMATTER = new Intl.NumberFormat("es-CL");

// ─────────────────────────────────────────────────────────────────────────────

function seededRand(seed: number): number {
  const value = Math.sin(seed + 1.618) * 10_000;
  return value - Math.floor(value);
}

function getMockTaken(date: Date, timeBlockId: number): number {
  const daySeed = Math.trunc(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
  const seed = daySeed * 137 + timeBlockId * 31;

  return Math.min(Math.round(seededRand(seed) * 13) + 1, MOCK_TOTAL_SPOTS);
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Booking state (per day)
// ─────────────────────────────────────────────────────────────────────────────

type BookingEntry = {
  bookingId: string;
  blockId: number;
  isOvercapacity: boolean;
  status: "reserved" | "confirmed";
  bookingDate: Date;
};
type BookingClosure = z.infer<typeof BOOKING_CLOSURES_SCHEMA>["closures"][number];

function getBookingDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function getWeekStartDateKey(date: Date) {
  const weekStart = new Date(date);
  const dayOfWeek = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  return getBookingDateKey(weekStart);
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

function isCurrentBlockAdmissionWindow(date: Date, startTime: string, endTime: string): boolean {
  if (!isSameDay(date, getSantiagoToday())) return false;

  const [startHourText, startMinuteText] = startTime.split(":");
  const [endHourText, endMinuteText] = endTime.split(":");
  if (
    startHourText === undefined ||
    startMinuteText === undefined ||
    endHourText === undefined ||
    endMinuteText === undefined
  ) {
    return false;
  }

  const startMinutes = Number(startHourText) * 60 + Number(startMinuteText);
  const endMinutes = Number(endHourText) * 60 + Number(endMinuteText);
  const nowParts = SANTIAGO_TIME_FORMATTER.formatToParts(new Date());
  const nowMinutes = getTimePart(nowParts, "hour") * 60 + getTimePart(nowParts, "minute");

  return nowMinutes >= startMinutes && nowMinutes < endMinutes;
}

function isConfirmedBookingCancellationLocked(date: Date, startTime: string): boolean {
  return isFinalHourBeforeBlock(date, startTime);
}

function isTimeBlockPast(date: Date, startTime: string): boolean {
  const today = getSantiagoToday();
  if (date < today) return true;
  if (date > today) return false;

  const [startHourText, startMinuteText] = startTime.split(":");
  if (startHourText === undefined || startMinuteText === undefined) return false;

  const startMinutes = Number(startHourText) * 60 + Number(startMinuteText);
  const nowParts = SANTIAGO_TIME_FORMATTER.formatToParts(new Date());
  const nowMinutes = getTimePart(nowParts, "hour") * 60 + getTimePart(nowParts, "minute");

  return nowMinutes >= startMinutes;
}

function isStandardBookingAvailable(date: Date, startTime: string): boolean {
  return isBookingDateAvailable(date) && !isTimeBlockPast(date, startTime);
}

function getMinutesUntilConfirmationOpens(date: Date, startTime: string): number {
  const [startHourText, startMinuteText] = startTime.split(":");
  if (startHourText === undefined || startMinuteText === undefined) return 0;

  const today = getSantiagoToday();
  const dateDifference = Math.round(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) /
      86_400_000,
  );
  const nowParts = SANTIAGO_TIME_FORMATTER.formatToParts(new Date());
  const nowMinutes = getTimePart(nowParts, "hour") * 60 + getTimePart(nowParts, "minute");
  const startMinutes = Number(startHourText) * 60 + Number(startMinuteText);

  return Math.max(0, dateDifference * 1_440 + startMinutes - 240 - nowMinutes);
}

function getConfirmationReminder(block: UserBlock | null, date: Date): string {
  if (!block) return "La confirmación abre 4 h antes y cierra 1 h antes del inicio.";

  const minutes = getMinutesUntilConfirmationOpens(date, block.startTime);
  return `La confirmación de este bloque abre en ${SPANISH_NUMBER_FORMATTER.format(minutes)} minutos y cierra 1 h antes del inicio.`;
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
  const [reservationSuccessTitle, setReservationSuccessTitle] = useState<string | null>(null);
  const [reservationError, setReservationError] = useState<string | null>(null);
  const [isAdmissionRequested, setIsAdmissionRequested] = useState(false);
  const [closures, setClosures] = useState<BookingClosure[]>([]);
  const [closureNotice, setClosureNotice] = useState<string | null>(null);

  const selectedDate = getWeekDates(weekOffset)[dayIdx]!;
  const queryClient = useQueryClient();
  const currentUserQuery = useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: getCurrentUser,
    refetchOnMount: "always",
  });
  const currentUser = currentUserQuery.data ?? null;
  const isStaffBookingView =
    currentUser?.role === "u_staff" || STAFF_BOOKING_LAYOUT_PREVIEW_ENABLED;

  const bookingAvailabilityQueries = useQueries({
    queries: [MIN_WEEK_OFFSET, 0, MAX_WEEK_OFFSET].map((offset) => {
      const weekStart = getBookingDateKey(getWeekDates(offset)[0]!);
      return {
        queryKey: bookingWeekAvailabilityQueryKey(weekStart),
        queryFn: () => getBookingWeekAvailability(weekStart),
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: Number.POSITIVE_INFINITY,
      };
    }),
  });

  const bookingAvailabilityByCell = useMemo(() => {
    const cells = new Map<string, BookingWeekAvailability[number]>();

    for (const query of bookingAvailabilityQueries) {
      for (const cell of query.data ?? []) {
        cells.set(`${cell.booking_date}:${cell.time_block_id}`, cell);
      }
    }

    return cells;
  }, [bookingAvailabilityQueries]);

  const selectedDateKey = getBookingDateKey(selectedDate);
  const selectedWeekAvailability = bookingAvailabilityQueries[weekOffset + 1]?.data;
  const isSelectedWeekAvailabilityReady = selectedWeekAvailability !== undefined;
  const totalSpots = selectedWeekAvailability?.[0]?.standard_capacity ?? MOCK_TOTAL_SPOTS;

  const bookingEntries = useMemo<BookingEntry[]>(() => {
    const entries: BookingEntry[] = [];

    for (const cell of bookingAvailabilityByCell.values()) {
      if (
        cell.current_booking_id === null ||
        (cell.current_booking_status !== "reserved" && cell.current_booking_status !== "confirmed")
      ) {
        continue;
      }

      const [yearText, monthText, dayText] = cell.booking_date.split("-");
      if (!yearText || !monthText || !dayText) continue;

      entries.push({
        bookingId: cell.current_booking_id,
        blockId: cell.time_block_id,
        isOvercapacity: cell.current_booking_is_overcapacity ?? false,
        status: cell.current_booking_status,
        bookingDate: new Date(Number(yearText), Number(monthText) - 1, Number(dayText)),
      });
    }

    return entries;
  }, [bookingAvailabilityByCell]);

  const booking =
    bookingEntries.find(
      (entry) =>
        getBookingDateKey(entry.bookingDate) === selectedDateKey && entry.blockId === selectedId,
    ) ?? null;
  const blocks = useMemo<UserBlock[]>(() => {
    return BASE_BLOCKS.map((block) => {
      const currentBooking = bookingEntries.find(
        (entry) =>
          getBookingDateKey(entry.bookingDate) === selectedDateKey && entry.blockId === block.id,
      );
      const userStatus: UserBookingStatus =
        currentBooking?.status === "confirmed"
          ? "confirmed"
          : currentBooking?.status === "reserved"
            ? isConfirmationWindowActive(selectedDate, block.startTime)
              ? "confirming"
              : "inscribed"
            : "none";

      return {
        ...block,
        taken: Math.min(
          getMockTaken(selectedDate, block.id) + (currentBooking ? 1 : 0),
          MOCK_TOTAL_SPOTS,
        ),
        userStatus,
      };
    });
  }, [bookingEntries, selectedDate, selectedDateKey]);

  const selectedBlock = blocks.find((b) => b.id === selectedId) ?? null;
  const confirmationReminder = getConfirmationReminder(selectedBlock, selectedDate);

  const staffWeekBookingDays = useMemo<StaffWeekBookingDay[]>(() => {
    return getWeekDates(weekOffset).map((date) => {
      const dateKey = getBookingDateKey(date);
      const availability = bookingAvailabilityByCell.get(`${dateKey}:7`);
      const bookingEntry = bookingEntries.find(
        (entry) => getBookingDateKey(entry.bookingDate) === dateKey && entry.blockId === 7,
      );
      const userStatus: UserBookingStatus =
        bookingEntry?.status === "confirmed"
          ? "confirmed"
          : bookingEntry?.status === "reserved"
            ? isConfirmationWindowActive(date, "17:15")
              ? "confirming"
              : "inscribed"
            : "none";
      const block: UserBlock = {
        ...BASE_BLOCKS[6]!,
        taken: Math.min(
          getMockTaken(date, BASE_BLOCKS[6]!.id) + (bookingEntry ? 1 : 0),
          MOCK_TOTAL_SPOTS,
        ),
        userStatus,
      };
      const closureReason = closures.find(
        (closure) => closure.date === dateKey && closure.timeBlockId === block.id,
      )?.reason;

      return {
        block,
        closureReason,
        date,
        isBookingAvailable:
          availability !== undefined && isStandardBookingAvailable(date, block.startTime),
        isCancellationLocked: isConfirmedBookingCancellationLocked(date, block.startTime),
        isConfirmationWindowActive: isConfirmationWindowActive(date, block.startTime),
        isCurrentBlockAdmissionWindow: isCurrentBlockAdmissionWindow(
          date,
          block.startTime,
          block.endTime,
        ),
        isTimeBlockPast: isTimeBlockPast(date, block.startTime),
      };
    });
  }, [bookingAvailabilityByCell, bookingEntries, closures, weekOffset]);

  const activeBookings = useMemo<ActiveBooking[]>(() => {
    const result: ActiveBooking[] = [];
    const today = getSantiagoToday();

    for (const entry of bookingEntries) {
      if (entry.isOvercapacity || entry.bookingDate < today) continue;
      const block = BASE_BLOCKS.find((candidate) => candidate.id === entry.blockId);
      if (!block) continue;

      result.push({
        bookingKey: entry.bookingId,
        date: entry.bookingDate,
        timeRange: block.timeRange,
        status: entry.status,
        isConfirmationAvailable:
          entry.status === "reserved" &&
          isConfirmationWindowActive(entry.bookingDate, block.startTime),
        isCancellationLocked:
          entry.status === "confirmed" &&
          isConfirmedBookingCancellationLocked(entry.bookingDate, block.startTime),
      });
    }

    return result.sort((left, right) => left.date.getTime() - right.date.getTime()).slice(0, 7);
  }, [bookingEntries]);

  useEffect(() => {
    if (!currentUser) return;
    applyThemePreference(currentUser.themePreference);
  }, [currentUser]);

  useEffect(() => {
    const controller = new AbortController();
    const rangeStart = getBookingDateKey(getWeekDates(MIN_WEEK_OFFSET)[0]!);
    const rangeEnd = getBookingDateKey(getWeekDates(MAX_WEEK_OFFSET)[4]!);

    async function loadClosures() {
      try {
        const response = await fetch(`/api/booking-closures?start=${rangeStart}&end=${rangeEnd}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) throw new Error("Booking closures request was rejected.");

        const payload: unknown = await response.json();
        const parsedClosures = BOOKING_CLOSURES_SCHEMA.safeParse(payload);
        if (!parsedClosures.success) throw new Error("Booking closures response is invalid.");

        setClosures(parsedClosures.data.closures);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;

        console.error("[RESERVA] could not load booking closures.", error);
      }
    }

    void loadClosures();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (weekOffset !== 0 || !isSameDay(selectedDate, getSantiagoToday())) return;

    const supabase = CREATE_SUPABASE_BROWSER_CLIENT();
    const channels: ReturnType<typeof supabase.channel>[] = [];
    let isDisposed = false;

    async function subscribeToTodayAvailability() {
      const { data } = await supabase.auth.getSession();
      if (!data.session || isDisposed) return;

      supabase.realtime.setAuth(data.session.access_token);

      for (const block of BASE_BLOCKS) {
        const channel = supabase
          .channel(bookingAvailabilityTopic(selectedDateKey, block.id), {
            config: { private: true },
          })
          .on("broadcast", { event: "invalidate" }, () => {
            void queryClient.invalidateQueries({
              queryKey: bookingWeekAvailabilityQueryKey(getWeekStartDateKey(selectedDate)),
            });
          })
          .subscribe();

        channels.push(channel);
      }
    }

    void subscribeToTodayAvailability();

    return () => {
      isDisposed = true;
      for (const channel of channels) {
        void supabase.removeChannel(channel);
      }
    };
  }, [queryClient, selectedDate, selectedDateKey, weekOffset]);

  // ── Handlers de calendario ────────────────────────────────────────────────

  function handleSelectDay(index: number) {
    setDayIdx(index);
    setIsAdmissionRequested(false);
    const date = getWeekDates(weekOffset)[index];
    const nextBooking = date
      ? bookingEntries.find(
          (entry) => getBookingDateKey(entry.bookingDate) === getBookingDateKey(date),
        )
      : undefined;
    setSelectedId(nextBooking?.blockId ?? null);
  }

  function handleSelectBlock(blockId: number) {
    const closureReason = closures.find(
      (closure) =>
        closure.date === getBookingDateKey(selectedDate) && closure.timeBlockId === blockId,
    )?.reason;

    if (closureReason) {
      setClosureNotice(closureReason);
      return;
    }

    setSelectedId((currentBlockId) => (currentBlockId === blockId ? null : blockId));
    setIsAdmissionRequested(false);
  }

  function handleWeekChange(offset: number) {
    const clamped = Math.max(MIN_WEEK_OFFSET, Math.min(MAX_WEEK_OFFSET, offset));
    const firstAvailableDayIndex = getWeekDates(clamped).findIndex(isBookingDateAvailable);
    const nextDayIndex = clamped < 0 || firstAvailableDayIndex < 0 ? 4 : firstAvailableDayIndex;
    setWeekOffset(clamped);
    setIsAdmissionRequested(false);
    setDayIdx(nextDayIndex);
    const nextDate = getWeekDates(clamped)[nextDayIndex];
    const nextBooking = nextDate
      ? bookingEntries.find(
          (entry) => getBookingDateKey(entry.bookingDate) === getBookingDateKey(nextDate),
        )
      : undefined;
    setSelectedId(nextBooking?.blockId ?? null);
  }

  function handleGoToday() {
    setWeekOffset(defaultCalendarSelection.weekOffset);
    setIsAdmissionRequested(false);
    setDayIdx(defaultCalendarSelection.dayIndex);
    const date = getWeekDates(defaultCalendarSelection.weekOffset)[
      defaultCalendarSelection.dayIndex
    ];
    const nextBooking = date
      ? bookingEntries.find(
          (entry) => getBookingDateKey(entry.bookingDate) === getBookingDateKey(date),
        )
      : undefined;
    setSelectedId(nextBooking?.blockId ?? null);
  }

  async function refreshBookingWeek(bookingDate: Date) {
    await queryClient.invalidateQueries({
      queryKey: bookingWeekAvailabilityQueryKey(getWeekStartDateKey(bookingDate)),
    });
  }

  async function createBooking(bookingDate: Date, timeBlockId: number) {
    setReservationError(null);
    const supabase = CREATE_SUPABASE_BROWSER_CLIENT();
    const { data, error } = await supabase.rpc("create_booking", {
      p_booking_date: getBookingDateKey(bookingDate),
      p_time_block_id: timeBlockId,
    });

    if (error) {
      setReservationError(
        "No fue posible crear la reserva. Actualiza la disponibilidad e inténtalo otra vez.",
      );
      return;
    }

    if (data.status === "confirmed") setReservationSuccessTitle("Reserva confirmada");
    else setReservationSuccessTitle("Reserva creada");
    await refreshBookingWeek(bookingDate);
  }

  async function cancelBooking(bookingEntry: BookingEntry) {
    setReservationError(null);
    const supabase = CREATE_SUPABASE_BROWSER_CLIENT();
    const { error } = await supabase.rpc("cancel_booking", {
      p_booking_id: bookingEntry.bookingId,
    });

    if (error) {
      setReservationError("No fue posible cancelar la reserva. Su estado pudo haber cambiado.");
      return;
    }

    await refreshBookingWeek(bookingEntry.bookingDate);
  }

  async function confirmBooking(bookingEntry: BookingEntry) {
    setReservationError(null);
    const supabase = CREATE_SUPABASE_BROWSER_CLIENT();
    const { error } = await supabase.rpc("confirm_booking", {
      p_booking_id: bookingEntry.bookingId,
    });

    if (error) {
      setReservationError(
        "No fue posible confirmar la asistencia. Revisa que la ventana siga abierta.",
      );
      return;
    }

    setReservationSuccessTitle("Reserva confirmada");
    await refreshBookingWeek(bookingEntry.bookingDate);
  }

  // ── Handlers de reserva ───────────────────────────────────────────────────

  function handleInscribe() {
    if (
      !selectedBlock ||
      !isSelectedWeekAvailabilityReady ||
      !isStandardBookingAvailable(selectedDate, selectedBlock.startTime)
    ) {
      return;
    }

    void createBooking(selectedDate, selectedBlock.id);
  }

  function handleCancel() {
    if (!booking) return;
    void cancelBooking(booking);
  }

  function handleConfirm() {
    if (!booking || booking.status !== "reserved") return;
    void confirmBooking(booking);
  }

  function handleCreateStaffBooking(dayIndex: number) {
    const staffDay = staffWeekBookingDays[dayIndex];
    if (
      !staffDay ||
      staffDay.closureReason ||
      staffDay.block.userStatus !== "none" ||
      !staffDay.isBookingAvailable ||
      staffDay.block.taken >= totalSpots
    ) {
      return;
    }

    setDayIdx(dayIndex);
    setSelectedId(staffDay.block.id);
    setIsAdmissionRequested(false);
    void createBooking(staffDay.date, staffDay.block.id);
  }

  function handleConfirmStaffAttendance(dayIndex: number) {
    const staffDay = staffWeekBookingDays[dayIndex];
    const bookingEntry = staffDay
      ? bookingEntries.find(
          (entry) =>
            entry.blockId === staffDay.block.id &&
            getBookingDateKey(entry.bookingDate) === getBookingDateKey(staffDay.date),
        )
      : undefined;

    if (
      !staffDay ||
      !bookingEntry ||
      bookingEntry.status !== "reserved" ||
      !staffDay.isConfirmationWindowActive
    ) {
      return;
    }

    void confirmBooking(bookingEntry);
  }

  function handleCancelStaffBooking(dayIndex: number) {
    const staffDay = staffWeekBookingDays[dayIndex];
    const bookingEntry = staffDay
      ? bookingEntries.find(
          (entry) =>
            entry.blockId === staffDay.block.id &&
            getBookingDateKey(entry.bookingDate) === getBookingDateKey(staffDay.date),
        )
      : undefined;

    if (
      !staffDay ||
      !bookingEntry ||
      staffDay.isTimeBlockPast ||
      (bookingEntry.status === "confirmed" && staffDay.isCancellationLocked)
    ) {
      return;
    }

    if (dayIndex === dayIdx) setSelectedId(null);
    void cancelBooking(bookingEntry);
  }

  async function handleRequestStaffAdmission(dayIndex: number) {
    const staffDay = staffWeekBookingDays[dayIndex];
    if (!staffDay || !staffDay.isCurrentBlockAdmissionWindow || isAdmissionRequested) return;

    setDayIdx(dayIndex);
    setSelectedId(staffDay.block.id);

    if (STAFF_BOOKING_LAYOUT_PREVIEW_ENABLED) {
      setIsAdmissionRequested(true);
      return;
    }

    try {
      const response = await fetch("/api/block/request", { method: "POST" });
      if (!response.ok) throw new Error("Admission request was rejected.");

      setIsAdmissionRequested(true);
    } catch (error) {
      console.error("[RESERVA] current-block admission request failed.", error);
    }
  }

  function handleShowStaffClosureReason(dayIndex: number) {
    const staffDay = staffWeekBookingDays[dayIndex];
    if (!staffDay?.closureReason) return;

    setClosureNotice(staffDay.closureReason);
  }

  function handleDismissReservationSuccess() {
    setReservationSuccessTitle(null);
  }

  async function handleRequestAdmission() {
    if (
      !selectedBlock ||
      !isCurrentBlockAdmissionWindow(
        selectedDate,
        selectedBlock.startTime,
        selectedBlock.endTime,
      ) ||
      isAdmissionRequested
    ) {
      return;
    }

    if (STAFF_BOOKING_LAYOUT_PREVIEW_ENABLED) {
      setIsAdmissionRequested(true);
      return;
    }

    try {
      const response = await fetch("/api/block/request", { method: "POST" });
      if (!response.ok) throw new Error("Admission request was rejected.");

      setIsAdmissionRequested(true);
    } catch (error) {
      console.error("[RESERVA] current-block admission request failed.", error);
    }
  }

  function handleConfirmActiveBooking(bookingKey: string) {
    const bookingEntry = bookingEntries.find((entry) => entry.bookingId === bookingKey);
    if (!bookingEntry || bookingEntry.status !== "reserved") return;

    const block = BASE_BLOCKS.find((candidate) => candidate.id === bookingEntry.blockId);
    if (!block || !isConfirmationWindowActive(bookingEntry.bookingDate, block.startTime)) return;

    void confirmBooking(bookingEntry);
  }

  function handleCancelActiveBooking(bookingKey: string) {
    const bookingEntry = bookingEntries.find((entry) => entry.bookingId === bookingKey);
    if (!bookingEntry) return;

    if (
      getBookingDateKey(bookingEntry.bookingDate) === selectedDateKey &&
      bookingEntry.blockId === selectedId
    ) {
      setSelectedId(null);
    }

    void cancelBooking(bookingEntry);
  }

  function handleGoProfile() {
    router.push("/perfil");
  }

  function handleGoCheckIn() {
    router.push("/qr");
  }

  function handleGoCurrentBlock() {
    router.push("/bloque");
  }

  function handleGoSettings() {
    router.push("/configuracion");
  }

  async function handleSignOut() {
    const supabase = CREATE_SUPABASE_BROWSER_CLIENT();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("[RESERVA] could not sign out.", error);
      return;
    }

    clearProfileCache();
    router.replace("/login");
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-svh w-full justify-center bg-bg">
      <div className="relative flex h-svh gusm-app-shell flex-col overflow-hidden select-none">
        {isStaffBookingView ? (
          <header className="sticky top-0 z-20 border-b border-divider bg-surface select-none">
            <UserTopBar
              userName={currentUser?.userName}
              role={currentUser?.role ?? "u_staff"}
              streakWeeks={currentUser?.streakWeeks}
              onGoProfile={handleGoProfile}
              onGoCheckIn={handleGoCheckIn}
              onSignOut={handleSignOut}
              activeBookings={activeBookings}
              onConfirmBooking={handleConfirmActiveBooking}
              onCancelBooking={handleCancelActiveBooking}
            />
            <WeekIndicator compact weekOffset={weekOffset} onWeekChange={handleWeekChange} />
          </header>
        ) : (
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
            onGoOvercapacity={handleGoCurrentBlock}
            onGoSettings={handleGoSettings}
            onSignOut={handleSignOut}
            activeBookings={activeBookings}
            onConfirmBooking={handleConfirmActiveBooking}
            onCancelBooking={handleCancelActiveBooking}
            weekSelector={<WeekIndicator weekOffset={weekOffset} onWeekChange={handleWeekChange} />}
            confirmationReminder={
              <p className="text-xs leading-4 text-dim" aria-live="polite">
                {confirmationReminder}
              </p>
            }
          />
        )}

        {/* ── Lista de bloques scrolleable ──────────────────────────── */}
        {isStaffBookingView ? (
          <StaffWeekBookingList
            days={staffWeekBookingDays}
            totalSpots={totalSpots}
            onCancelBooking={handleCancelStaffBooking}
            onConfirmAttendance={handleConfirmStaffAttendance}
            onCreateBooking={handleCreateStaffBooking}
            onRequestAdmission={handleRequestStaffAdmission}
            onShowClosureReason={handleShowStaffClosureReason}
          />
        ) : (
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-4 pt-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
            {blocks.map((block) => (
              <BlockCard
                key={block.id}
                block={block}
                totalSpots={totalSpots}
                isSelected={block.id === selectedId}
                isBookingAvailable={
                  isSelectedWeekAvailabilityReady &&
                  isStandardBookingAvailable(selectedDate, block.startTime)
                }
                isCancellationLocked={isConfirmedBookingCancellationLocked(
                  selectedDate,
                  block.startTime,
                )}
                isConfirmationWindowActive={isConfirmationWindowActive(
                  selectedDate,
                  block.startTime,
                )}
                isTimeBlockPast={isTimeBlockPast(selectedDate, block.startTime)}
                isCurrentBlockAdmissionWindow={isCurrentBlockAdmissionWindow(
                  selectedDate,
                  block.startTime,
                  block.endTime,
                )}
                closureReason={
                  closures.find(
                    (closure) =>
                      closure.date === getBookingDateKey(selectedDate) &&
                      closure.timeBlockId === block.id,
                  )?.reason
                }
                onSelect={() => handleSelectBlock(block.id)}
                onDismissActions={() => setSelectedId(null)}
                onCancelBooking={handleCancel}
                onConfirmAttendance={handleConfirm}
                onCreateBooking={handleInscribe}
                onRequestAdmission={handleRequestAdmission}
                onShowClosureReason={() => {
                  const closureReason = closures.find(
                    (closure) =>
                      closure.date === getBookingDateKey(selectedDate) &&
                      closure.timeBlockId === block.id,
                  )?.reason;
                  if (closureReason) setClosureNotice(closureReason);
                }}
              />
            ))}
            <div className="h-2" />
          </div>
        )}

        <ReservationSuccessOverlay
          isOpen={reservationSuccessTitle !== null}
          title={reservationSuccessTitle ?? "Reserva creada"}
          onDismiss={handleDismissReservationSuccess}
        />

        {reservationError && (
          <div
            role="alert"
            className="fixed inset-x-4 top-4 z-40 mx-auto max-w-md rounded-xl border border-red-500/35 bg-surface px-4 py-3 text-sm text-foreground shadow-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <p>{reservationError}</p>
              <button
                type="button"
                onClick={() => setReservationError(null)}
                className="shrink-0 text-base text-red-400 active:scale-[0.98]"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {closureNotice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay px-5">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="closure-notice-title"
              className="w-full max-w-sm rounded-2xl border border-rose-500/30 bg-surface p-5 shadow-xl"
            >
              <p className="text-sm font-medium tracking-widest text-rose-400">
                BLOQUE INHABILITADO
              </p>
              <h2 id="closure-notice-title" className="mt-2 text-xl font-semibold text-foreground">
                No está disponible para reserva
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted">{closureNotice}</p>
              <button
                type="button"
                onClick={() => setClosureNotice(null)}
                className="mt-5 w-full rounded-xl bg-accent-fill py-3 text-base text-accent-foreground active:scale-[0.98]"
              >
                Entendido
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
