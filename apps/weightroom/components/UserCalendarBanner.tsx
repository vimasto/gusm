import useEmblaCarousel from "embla-carousel-react";
import { useEffect, useRef } from "react";
import clsx from "clsx";
import type { ActiveBooking } from "@/components/ActiveBookingsPanel";
import { type AppRole, UserTopBar } from "@/components/UserTopBar";

const DAY_LETTERS = ["L", "M", "X", "J", "V"];
const SANTIAGO_TIME_ZONE = "America/Santiago";
const SANTIAGO_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: SANTIAGO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const MIN_WEEK_OFFSET = -1;
export const MAX_WEEK_OFFSET = 1;
const WEEK_OFFSETS = [MIN_WEEK_OFFSET, 0, MAX_WEEK_OFFSET] as const;
const WEEK_CAROUSEL_OPTIONS = {
  align: "start",
  containScroll: "trimSnaps",
  dragFree: false,
  duration: 24,
} as const;

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
  accountLabel?: string;
  confirmationReminder?: React.ReactNode;
  userName: string;
  role: AppRole;
  streakWeeks: number;
  selectedDay: number;
  weekOffset: number;
  onSelectDay: (index: number) => void;
  onWeekChange: (offset: number) => void;
  onGoProfile: () => void;
  onGoCheckIn?: () => void;
  onGoOvercapacity?: () => void;
  onGoInformation?: () => void;
  onGoSettings?: () => void;
  onSignOut: () => void | Promise<void>;
  activeBookings: ActiveBooking[];
  onConfirmBooking: (bookingKey: string) => void;
  onCancelBooking: (bookingKey: string) => void;
  showUserName?: boolean;
  weekSelector?: React.ReactNode;
};

function getSelectionPillClassName(isActive: boolean): string {
  return clsx(
    "h-1.5 rounded-full transition-all duration-300",
    isActive ? "w-5 bg-accent" : "w-1.5 bg-dim",
  );
}

export function UserCalendarBanner({
  accountLabel,
  confirmationReminder,
  userName,
  role,
  streakWeeks,
  selectedDay,
  weekOffset,
  onSelectDay,
  onWeekChange,
  onGoProfile,
  onGoCheckIn,
  onGoOvercapacity,
  onGoInformation,
  onGoSettings,
  onSignOut,
  activeBookings,
  onConfirmBooking,
  onCancelBooking,
  showUserName,
  weekSelector,
}: UserCalendarBannerProps) {
  const today = getSantiagoToday();
  const initialWeekIndex = useRef(weekOffset - MIN_WEEK_OFFSET).current;
  const [weekCarouselRef, weekCarouselApi] = useEmblaCarousel({
    ...WEEK_CAROUSEL_OPTIONS,
    startIndex: initialWeekIndex,
  });

  useEffect(() => {
    if (!weekCarouselApi) return;

    function handleCarouselSelect(api: NonNullable<typeof weekCarouselApi>) {
      const nextOffset = api.selectedScrollSnap() + MIN_WEEK_OFFSET;
      if (nextOffset !== weekOffset) onWeekChange(nextOffset);
    }

    weekCarouselApi.on("select", handleCarouselSelect);
    return () => {
      weekCarouselApi.off("select", handleCarouselSelect);
    };
  }, [onWeekChange, weekCarouselApi, weekOffset]);

  useEffect(() => {
    if (!weekCarouselApi) return;

    const selectedWeekIndex = weekOffset - MIN_WEEK_OFFSET;
    if (weekCarouselApi.selectedScrollSnap() !== selectedWeekIndex) {
      weekCarouselApi.scrollTo(selectedWeekIndex);
    }
  }, [weekCarouselApi, weekOffset]);

  return (
    <header className="sticky top-0 z-20 border-b border-divider bg-surface select-none">
      <UserTopBar
        accountLabel={accountLabel}
        userName={userName}
        role={role}
        streakWeeks={streakWeeks}
        onGoProfile={onGoProfile}
        onGoCheckIn={onGoCheckIn}
        onGoOvercapacity={onGoOvercapacity}
        onGoInformation={onGoInformation}
        onGoSettings={onGoSettings}
        onSignOut={onSignOut}
        activeBookings={activeBookings}
        onConfirmBooking={onConfirmBooking}
        onCancelBooking={onCancelBooking}
        showUserName={showUserName}
      />

      {weekSelector}

      <div ref={weekCarouselRef} className="touch-pan-y overflow-hidden">
        <div className="flex">
          {WEEK_OFFSETS.map((offset) => {
            const slideWeek = getWeekDates(offset);
            const isSelectedWeek = offset === weekOffset;

            return (
              <div key={offset} aria-hidden={!isSelectedWeek} className="min-w-0 flex-[0_0_100%]">
                <div className="grid grid-cols-5 gap-1 px-2 pb-[5px]">
                  {slideWeek.map((date, index) => {
                    const isSelected = isSelectedWeek && index === selectedDay;
                    const isToday = isSameDay(date, today);
                    const isBookingDateAvailableForDate = isBookingDateAvailable(date);
                    const isDateSelectable = offset <= 0 || isBookingDateAvailableForDate;
                    const isInteractive = isSelectedWeek && isDateSelectable;

                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={isInteractive ? () => onSelectDay(index) : undefined}
                        disabled={!isInteractive}
                        tabIndex={isSelectedWeek ? 0 : -1}
                        className="flex flex-col items-center gap-1.5 rounded-2xl py-[3px] transition-all disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        <span
                          className={clsx(
                            "text-sm font-medium tracking-[0.12em]",
                            isSelected ? "text-accent" : "text-dim",
                          )}
                        >
                          {DAY_LETTERS[index]}
                        </span>

                        <div
                          className={clsx(
                            "flex size-10 items-center justify-center rounded-full border transition-[background-color,box-shadow] duration-200",
                            isSelected
                              ? "border-accent bg-accent shadow-accent"
                              : isToday
                                ? "border-accent/55 bg-input"
                                : "border-transparent bg-input",
                          )}
                        >
                          <span
                            className={clsx(
                              "text-sm font-bold",
                              isSelected
                                ? "text-accent-foreground"
                                : isToday
                                  ? "text-accent"
                                  : "text-muted",
                            )}
                          >
                            {date.getDate()}
                          </span>
                        </div>

                        <div className={getSelectionPillClassName(isSelected)} />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {confirmationReminder && (
        <div className="border-t border-divider px-4 py-2">{confirmationReminder}</div>
      )}
    </header>
  );
}

type WeekIndicatorProps = {
  compact?: boolean;
  weekOffset: number;
  onWeekChange: (offset: number) => void;
};

const WEEK_LABELS = ["Sem. anterior", "Esta semana", "Próx. semana"] as const;
const COMPACT_WEEK_LABELS = ["Anterior", "Actual", "Próxima"] as const;

export function WeekIndicator({ compact = false, weekOffset, onWeekChange }: WeekIndicatorProps) {
  const activeDot = weekOffset + 1;
  const labels = compact ? COMPACT_WEEK_LABELS : WEEK_LABELS;

  return (
    <div
      className={clsx(
        "flex shrink-0 items-center justify-center border-b border-divider bg-surface pt-0 pb-1.5",
        compact ? "gap-1 px-2" : "gap-1 px-2",
      )}
    >
      {[0, 1, 2].map((dot) => {
        const offset = dot - 1;
        const isActive = dot === activeDot;
        return (
          <button
            key={dot}
            type="button"
            onClick={() => onWeekChange(offset)}
            aria-label={WEEK_LABELS[dot]}
            className={clsx(
              "group flex min-w-0 flex-1 flex-col items-center gap-0.5 active:scale-95",
            )}
          >
            <div className={getSelectionPillClassName(isActive)} />
            <span
              className={clsx(
                "transition-all duration-200",
                compact ? "text-sm tracking-wide" : "text-sm tracking-[0.05em] whitespace-nowrap",
                isActive ? "text-accent/60" : "text-dim",
              )}
            >
              {labels[dot]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
