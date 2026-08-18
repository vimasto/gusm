import { useEffect, useRef } from "react";
import clsx from "clsx";
import type { ActiveBooking } from "@/components/ActiveBookingsPanel";
import { type AppRole, UserTopBar } from "@/components/UserTopBar";

const DAY_LETTERS = ["L", "M", "X", "J", "V"];
const SWIPE_THRESHOLD = 42;
const SANTIAGO_TIME_ZONE = "America/Santiago";
const SANTIAGO_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: SANTIAGO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const MIN_WEEK_OFFSET = -1;
export const MAX_WEEK_OFFSET = 1;

function getDatePart(parts: Intl.DateTimeFormatPart[], type: "day" | "month" | "year"): number {
  const part = parts.find((candidate) => candidate.type === type);
  if (!part) throw new Error(`Missing ${type} from formatted date.`);
  return Number(part.value);
}

export function getSantiagoToday(): Date {
  const parts = SANTIAGO_DATE_FORMATTER.formatToParts(new Date());
  const year = getDatePart(parts, "year");
  const month = getDatePart(parts, "month");
  const day = getDatePart(parts, "day");

  return new Date(year, month - 1, day);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

export function getWeekDates(weekOffset: number): Date[] {
  const today = getSantiagoToday();
  const dayOfWeek = today.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysFromMonday + weekOffset * 7);

  return Array.from({ length: 5 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });
}

export function isBookingDateAvailable(date: Date): boolean {
  const today = getSantiagoToday();
  const latestBookingDate = new Date(today);
  latestBookingDate.setDate(today.getDate() + 7);

  return date >= today && date <= latestBookingDate;
}

type UserCalendarBannerProps = {
  userName: string;
  role: AppRole;
  streakWeeks: number;
  selectedDay: number;
  weekOffset: number;
  onSelectDay: (index: number) => void;
  onWeekChange: (offset: number) => void;
  onGoToday: () => void;
  onGoProfile: () => void;
  onGoCheckIn?: () => void;
  onGoOvercapacity?: () => void;
  onGoInformation?: () => void;
  onGoSettings?: () => void;
  onSignOut: () => void | Promise<void>;
  activeBookings: ActiveBooking[];
  onConfirmBooking: (bookingKey: string) => void;
  onCancelBooking: (bookingKey: string) => void;
};

type SelectionPillProps = {
  isActive: boolean;
};

function SelectionPill({ isActive }: SelectionPillProps) {
  return (
    <div
      className="rounded-full transition-all duration-300"
      style={{
        width: isActive ? 20 : 6,
        height: 5,
        backgroundColor: isActive ? "var(--color-accent)" : "var(--color-dim)",
      }}
    />
  );
}

export function UserCalendarBanner({
  userName,
  role,
  streakWeeks,
  selectedDay,
  weekOffset,
  onSelectDay,
  onWeekChange,
  onGoToday,
  onGoProfile,
  onGoCheckIn,
  onGoOvercapacity,
  onGoInformation,
  onGoSettings,
  onSignOut,
  activeBookings,
  onConfirmBooking,
  onCancelBooking,
}: UserCalendarBannerProps) {
  const today = getSantiagoToday();
  const week = getWeekDates(weekOffset);
  const isTodaySelected = isSameDay(week[selectedDay]!, today);
  const bannerRef = useRef<HTMLElement>(null);
  const startX = useRef<number | null>(null);

  useEffect(() => {
    const element = bannerRef.current;
    if (!element) return;

    const onStart = (event: TouchEvent | MouseEvent) => {
      const clientX = "touches" in event ? event.touches[0]?.clientX : event.clientX;
      if (clientX === undefined) return;
      startX.current = clientX;
    };

    const onEnd = (event: TouchEvent | MouseEvent) => {
      if (startX.current === null) return;

      const clientX = "changedTouches" in event ? event.changedTouches[0]?.clientX : event.clientX;
      if (clientX === undefined) return;

      const distance = clientX - startX.current;
      startX.current = null;
      if (Math.abs(distance) <= SWIPE_THRESHOLD) return;

      const nextOffset =
        distance < 0
          ? Math.min(weekOffset + 1, MAX_WEEK_OFFSET)
          : Math.max(weekOffset - 1, MIN_WEEK_OFFSET);

      if (nextOffset !== weekOffset) onWeekChange(nextOffset);
    };

    element.addEventListener("touchstart", onStart, { passive: true });
    element.addEventListener("touchend", onEnd);
    element.addEventListener("mousedown", onStart);
    document.addEventListener("mouseup", onEnd);

    return () => {
      element.removeEventListener("touchstart", onStart);
      element.removeEventListener("touchend", onEnd);
      element.removeEventListener("mousedown", onStart);
      document.removeEventListener("mouseup", onEnd);
    };
  }, [onWeekChange, weekOffset]);

  return (
    <header
      ref={bannerRef}
      className="sticky top-0 z-20 border-b border-divider bg-surface select-none"
    >
      <UserTopBar
        userName={userName}
        role={role}
        streakWeeks={streakWeeks}
        onGoToday={onGoToday}
        onGoProfile={onGoProfile}
        onGoCheckIn={onGoCheckIn}
        onGoOvercapacity={onGoOvercapacity}
        onGoInformation={onGoInformation}
        onGoSettings={onGoSettings}
        onSignOut={onSignOut}
        activeBookings={activeBookings}
        onConfirmBooking={onConfirmBooking}
        onCancelBooking={onCancelBooking}
        isTodaySelected={isTodaySelected}
      />

      <div className="grid grid-cols-5 gap-1 px-2 pb-4">
        {week.map((date, index) => {
          const isSelected = index === selectedDay;
          const isToday = isSameDay(date, today);
          const isBookingDateAvailableForDate = isBookingDateAvailable(date);
          const isDateSelectable = weekOffset <= 0 || isBookingDateAvailableForDate;

          return (
            <button
              key={index}
              type="button"
              onClick={isDateSelectable ? () => onSelectDay(index) : undefined}
              disabled={!isDateSelectable}
              className="flex flex-col items-center gap-1.5 rounded-2xl py-1 transition-all disabled:cursor-not-allowed disabled:opacity-35"
            >
              <span
                className={clsx(
                  "text-xs font-medium tracking-[0.12em]",
                  isSelected ? "text-accent" : "text-dim",
                )}
              >
                {DAY_LETTERS[index]}
              </span>

              <div
                className={clsx(
                  "flex size-10 items-center justify-center rounded-full transition-all duration-200",
                  isSelected ? "bg-accent shadow-accent" : "bg-input",
                )}
              >
                <span
                  className={clsx(
                    "text-sm font-bold",
                    isSelected ? "text-neutral-950" : isToday ? "text-accent" : "text-muted",
                  )}
                >
                  {date.getDate()}
                </span>
              </div>

              <SelectionPill isActive={isSelected} />
            </button>
          );
        })}
      </div>
    </header>
  );
}

type WeekIndicatorProps = {
  weekOffset: number;
  onWeekChange: (offset: number) => void;
};

const WEEK_LABELS = ["Sem. anterior", "Esta semana", "Próx. semana"] as const;

export function WeekIndicator({ weekOffset, onWeekChange }: WeekIndicatorProps) {
  const activeDot = weekOffset + 1;

  return (
    <div className="flex shrink-0 items-center justify-center gap-3 border-b border-divider bg-surface py-2">
      {[0, 1, 2].map((dot) => {
        const offset = dot - 1;
        const isActive = dot === activeDot;
        return (
          <button
            key={dot}
            type="button"
            onClick={() => onWeekChange(offset)}
            className="group flex flex-col items-center gap-0.5 active:scale-95"
          >
            <SelectionPill isActive={isActive} />
            <span
              className={clsx(
                "text-xs tracking-widest transition-all duration-200",
                isActive ? "text-accent/60" : "text-dim",
              )}
            >
              {WEEK_LABELS[dot]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
