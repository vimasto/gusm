"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  UserCalendarBanner,
  WeekIndicator,
  getWeekDates,
  sameDay,
  MIN_WEEK_OFFSET,
  MAX_WEEK_OFFSET,
} from "@/components/UserCalendarBanner";
import { BlockCard, type UserBlock, type UserBookingStatus } from "@/components/BlockCard";
import { BookingPanel } from "@/components/BookingPanel";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TODO: reemplazar con useUser()
 * SELECT first_name, last_name, streak_weeks FROM users/user_stats WHERE id = auth.uid()
 */
const MOCK_USER = { firstName: "Elsa", lastName: "Polindo", streakWeeks: 7 };

/** TODO: SELECT capacity FROM gym_rules LIMIT 1 */
const MOCK_TOTAL_SPOTS = 15;

const BASE_BLOCKS = [
  { id: 1, timeRange: "07:00 · 07:45", startHour: 7, startMin: 0 },
  { id: 2, timeRange: "08:00 · 08:45", startHour: 8, startMin: 0 },
  { id: 3, timeRange: "09:15 · 10:00", startHour: 9, startMin: 15 },
  { id: 4, timeRange: "10:15 · 11:00", startHour: 10, startMin: 15 },
  { id: 5, timeRange: "12:00 · 12:45", startHour: 12, startMin: 0 },
  { id: 6, timeRange: "13:45 · 14:25", startHour: 13, startMin: 45 },
  { id: 7, timeRange: "17:30 · 18:15", startHour: 17, startMin: 30 },
  { id: 8, timeRange: "18:30 · 19:15", startHour: 18, startMin: 30 },
  { id: 9, timeRange: "19:30 · 20:15", startHour: 19, startMin: 30 },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getInitials(first: string, last: string) {
  return `${first[0]}${last[0]}`.toUpperCase();
}

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

type DayKey = string; // `${weekOffset}-${dayIdx}`
type BookingEntry = {
  blockId: number;
  status: Exclude<UserBookingStatus, "none">;
};

// ─────────────────────────────────────────────────────────────────────────────
// BookingPage
// ─────────────────────────────────────────────────────────────────────────────

export default function UserView() {
  const router = useRouter();
  const today = new Date();

  const initialWeek = getWeekDates(0);
  const todayIdx = initialWeek.findIndex((d) => sameDay(d, today));
  const defaultDay = todayIdx >= 0 ? todayIdx : 0;

  const [dayIdx, setDayIdx] = useState(defaultDay);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [bookings, setBookings] = useState<Map<DayKey, BookingEntry>>(new Map());

  const dayKey = `${weekOffset}-${dayIdx}` as DayKey;
  const booking = bookings.get(dayKey) ?? null;

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

  // ── Handlers de calendario ────────────────────────────────────────────────

  const handleSelectDay = useCallback(
    (i: number) => {
      setDayIdx(i);
      const key: DayKey = `${weekOffset}-${i}`;
      const b = bookings.get(key);
      setSelectedId(b ? b.blockId : null);
    },
    [weekOffset, bookings],
  );

  const handleWeekChange = useCallback(
    (offset: number) => {
      const clamped = Math.max(MIN_WEEK_OFFSET, Math.min(MAX_WEEK_OFFSET, offset));
      setWeekOffset(clamped);
      setDayIdx(0);
      const key: DayKey = `${clamped}-0`;
      const b = bookings.get(key);
      setSelectedId(b ? b.blockId : null);
    },
    [bookings],
  );

  const handleGoToday = useCallback(() => {
    setWeekOffset(0);
    setDayIdx(defaultDay);
    const key: DayKey = `0-${defaultDay}`;
    const b = bookings.get(key);
    setSelectedId(b ? b.blockId : null);
  }, [defaultDay, bookings]);

  // ── Handlers de reserva ───────────────────────────────────────────────────

  const handleInscribe = useCallback(() => {
    if (!selectedId) return;
    setBookings((prev) => {
      const next = new Map(prev);
      next.set(dayKey, { blockId: selectedId, status: "inscribed" });
      return next;
    });
  }, [selectedId, dayKey]);

  const handleCancel = useCallback(() => {
    setBookings((prev) => {
      const next = new Map(prev);
      next.delete(dayKey);
      return next;
    });
  }, [dayKey]);

  const handleConfirm = useCallback(() => {
    if (!booking) return;
    setBookings((prev) => {
      const next = new Map(prev);
      next.set(dayKey, { ...booking, status: "confirmed" });
      return next;
    });
  }, [booking, dayKey]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen justify-center bg-black">
      <div className="relative flex h-svh w-full max-w-[520px] flex-col overflow-hidden bg-black select-none">
        {/* ── Banner con calendario + identidad del usuario ──────────── */}
        <UserCalendarBanner
          userName={MOCK_USER.firstName}
          initials={getInitials(MOCK_USER.firstName, MOCK_USER.lastName)}
          streakWeeks={MOCK_USER.streakWeeks}
          onBack={() => router.back()}
          selectedDay={dayIdx}
          weekOffset={weekOffset}
          onSelectDay={handleSelectDay}
          onWeekChange={handleWeekChange}
          onGoToday={handleGoToday}
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
          selectedDate={getWeekDates(weekOffset)[dayIdx]!}
          onInscribe={handleInscribe}
          onCancel={handleCancel}
          onConfirm={handleConfirm}
        />
      </div>
    </div>
  );
}
