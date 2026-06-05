import { Dumbbell } from "lucide-react";
import { clsx } from "clsx";

const DAY_LETTERS = ["L", "M", "X", "J", "V"];

function sameDay(a: Date, b: Date) {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

interface CalendarBannerProps {
  week: Date[];
  today: Date;
  selectedDay: number;
  onSelectDay: (i: number) => void;
  onGoToday: () => void;
}

export function CalendarBanner({
  week,
  today,
  selectedDay,
  onSelectDay,
  onGoToday,
}: CalendarBannerProps) {
  const start = week[0]!;
  const end = week[4]!;

  const monthLabel =
    start.getMonth() === end.getMonth()
      ? start.toLocaleDateString("es-CL", { month: "long", year: "numeric" })
      : `${start.toLocaleDateString("es-CL", { month: "short" })} — ${end.toLocaleDateString("es-CL", { month: "short", year: "numeric" })}`;

  const todayInWeek = week.some((d) => sameDay(d, today));

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-900 bg-black">
      {/* Month row */}
      <div className="flex items-center justify-between p-5">
        <div className="flex items-center gap-2">
          <Dumbbell className="size-2.5 shrink-0 text-amber-400" />

          <span className="text-xs text-neutral-500 capitalize">{monthLabel}</span>
        </div>

        {todayInWeek && (
          <button
            onClick={onGoToday}
            className="rounded-full bg-neutral-900 px-3 py-1 text-xs text-amber-400"
          >
            Hoy
          </button>
        )}
      </div>

      {/* Days */}
      <div className="grid grid-cols-5 gap-1 px-2 pb-4">
        {week.map((date, i) => {
          const isSelectedIndex = i === selectedDay;
          const isToday = sameDay(date, today);

          return (
            <button
              key={i}
              onClick={() => onSelectDay(i)}
              className="flex flex-col items-center justify-center gap-1.5"
            >
              {/* letter */}
              <span
                className={clsx(
                  "text-xs font-medium",
                  isSelectedIndex ? "text-white" : "text-neutral-500",
                )}
              >
                {DAY_LETTERS[i]}
              </span>

              {/* circle */}
              <div
                className={clsx(
                  "size-10 flex items-center justify-center rounded-full transition-colors duration-200",
                  isSelectedIndex ? "bg-white" : "bg-neutral-900",
                )}
              >
                <span
                  className={clsx(
                    "text-sm font-bold",
                    isSelectedIndex
                      ? "text-black"
                      : isToday
                        ? "text-amber-400"
                        : "text-neutral-500",
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
