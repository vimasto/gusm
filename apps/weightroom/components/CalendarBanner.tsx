import clsx from "clsx";
import { UserTopBar } from "@/components/UserTopBar";

const DAY_LETTERS = ["L", "M", "X", "J", "V"];

function sameDay(a: Date, b: Date) {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

type CalendarBannerProps = {
  week: Date[];
  today: Date;
  selectedDay: number;
  onSelectDay: (index: number) => void;
  onGoToday: () => void;
};

export function CalendarBanner({
  week,
  today,
  selectedDay,
  onSelectDay,
  onGoToday,
}: CalendarBannerProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-divider bg-surface">
      <UserTopBar onGoToday={onGoToday} isTodaySelected={sameDay(week[selectedDay]!, today)} />

      <div className="grid grid-cols-5 gap-1 px-2 pb-4">
        {week.map((date, index) => {
          const isSelected = index === selectedDay;
          const isToday = sameDay(date, today);

          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => onSelectDay(index)}
              className="flex flex-col items-center justify-center gap-1.5 rounded-2xl py-1 transition-all active:scale-95"
            >
              <span
                className={clsx("text-xs font-medium", isSelected ? "text-accent" : "text-dim")}
              >
                {DAY_LETTERS[index]}
              </span>

              <div
                className={clsx(
                  "flex size-10 items-center justify-center rounded-full transition-colors duration-200",
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
            </button>
          );
        })}
      </div>
    </header>
  );
}
