import { Dumbbell } from "lucide-react";
import { ACCENT } from "@/lib/occupancy";

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
    <div
      className="sticky top-0 z-20"
      style={{
        borderBottom: "1px solid var(--color-divider)",
        background: "var(--color-surface)",
      }}
    >
      {/* Month row */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <Dumbbell size={13} style={{ color: ACCENT }} />
          <span
            className="text-xs capitalize"
            style={{ color: "#52525b", letterSpacing: "0.08em" }}
          >
            {monthLabel}
          </span>
        </div>
        {todayInWeek && (
          <button
            onClick={onGoToday}
            className="text-xs px-3 py-1 rounded-full transition-all"
            style={{
              backgroundColor: "rgba(245,180,0,0.12)",
              color: ACCENT,
            }}
          >
            Hoy
          </button>
        )}
      </div>

      {/* Days */}
      <div className="grid grid-cols-5 px-2 pb-4 gap-1">
        {week.map((date, i) => {
          const isSel = i === selectedDay;
          const isT = sameDay(date, today);

          return (
            <button
              key={i}
              onClick={() => onSelectDay(i)}
              className="flex flex-col items-center gap-1.5 py-1 rounded-2xl transition-all"
            >
              {/* letter */}
              <span
                className="text-xs font-medium"
                style={{
                  color: isSel ? "#fff" : "var(--color-text-dim)",
                  letterSpacing: "0.12em",
                }}
              >
                {DAY_LETTERS[i]}
              </span>

              {/* circle */}
              <div
                className="w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200"
                style={isSel ? { background: "#fff" } : {}}
              >
                <span
                  className="text-sm font-bold"
                  style={
                    isSel
                      ? { color: "#000" }
                      : isT
                        ? { color: ACCENT }
                        : { color: "#71717a" }
                  }
                >
                  {date.getDate()}
                </span>
              </div>

              {/* Pill indicator */}
              <div
                className="rounded-full transition-all duration-300"
                style={{
                  width: isSel ? 20 : 6,
                  height: 5,
                  backgroundColor: isSel ? ACCENT : "#27272a",
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
