import { ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";

const DAY_LETTERS = ["L", "M", "X", "J", "V", "S", "D"] as const;
const SPANISH_PLURAL_RULES = new Intl.PluralRules("es-CL");
const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

export type ProfileAttendanceEntry = {
  bookingDate: string;
  status: "present" | "absent";
};

type ProfileCalendarProps = {
  attendance: ProfileAttendanceEntry[];
  isLoading: boolean;
  month: Date;
  onNextMonth: () => void;
  onPreviousMonth: () => void;
  today: Date;
};

type CalendarCell = {
  dateKey: string;
  day: number;
  isCurrentMonth: boolean;
  isWeekend: boolean;
};

function getDateKey(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getDaysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function getMondayFirstWeekday(year: number, monthIndex: number) {
  const sundayFirstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  return sundayFirstWeekday === 0 ? 6 : sundayFirstWeekday - 1;
}

function createCalendarCells(month: Date): CalendarCell[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = getMondayFirstWeekday(year, monthIndex);
  const daysInMonth = getDaysInMonth(year, monthIndex);
  const cells: CalendarCell[] = [];

  for (let cellIndex = 0; cellIndex < 42; cellIndex += 1) {
    const day = cellIndex - firstWeekday + 1;
    const isCurrentMonth = day >= 1 && day <= daysInMonth;
    const weekDay = cellIndex % 7;

    cells.push({
      dateKey: isCurrentMonth ? getDateKey(year, monthIndex, day) : "",
      day: isCurrentMonth ? day : 0,
      isCurrentMonth,
      isWeekend: weekDay >= 5,
    });
  }

  return cells;
}

function getMonthLabel(month: Date) {
  return `${MONTH_NAMES[month.getMonth()]} ${month.getFullYear()}`;
}

function getTodayKey(today: Date) {
  return getDateKey(today.getFullYear(), today.getMonth(), today.getDate());
}

export function ProfileCalendar({
  attendance,
  isLoading,
  month,
  onNextMonth,
  onPreviousMonth,
  today,
}: ProfileCalendarProps) {
  const attendanceByDate = new Map(
    attendance.map((entry) => [entry.bookingDate, entry.status] as const),
  );
  const cells = createCalendarCells(month);
  const monthLabel = getMonthLabel(month);
  const todayKey = getTodayKey(today);
  const isCurrentMonth =
    month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();
  const monthlyAttendance = attendance.filter((entry) => entry.status === "present").length;
  const monthlyAbsences = attendance.filter((entry) => entry.status === "absent").length;
  const attendanceLabel =
    SPANISH_PLURAL_RULES.select(monthlyAttendance) === "one" ? "asistencia" : "asistencias";
  const absenceLabel =
    SPANISH_PLURAL_RULES.select(monthlyAbsences) === "one" ? "inasistencia" : "inasistencias";

  return (
    <section className="rounded-2xl border border-accent/15 bg-input/30 px-4 py-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-foreground capitalize">{monthLabel}</h1>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPreviousMonth}
            aria-label="Ver mes anterior"
            className="flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-accent/10 hover:text-accent active:scale-95"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onNextMonth}
            disabled={isCurrentMonth}
            aria-label="Ver mes siguiente"
            className="flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-accent/10 hover:text-accent active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className={clsx("grid grid-cols-7 gap-y-2", isLoading && "opacity-45")}>
        {DAY_LETTERS.map((dayLetter) => (
          <span
            key={dayLetter}
            className="text-center text-xs font-medium tracking-[0.12em] text-dim"
          >
            {dayLetter}
          </span>
        ))}

        {cells.map((cell, index) => {
          const attendanceStatus = attendanceByDate.get(cell.dateKey);
          const isToday = cell.dateKey === todayKey;
          const isPast = cell.isCurrentMonth && cell.dateKey < todayKey;

          return (
            <div key={`${cell.dateKey}-${index}`} className="flex h-9 items-center justify-center">
              {cell.isCurrentMonth && (
                <span
                  aria-label={
                    attendanceStatus === "present"
                      ? `${cell.day}: asistencia registrada`
                      : attendanceStatus === "absent"
                        ? `${cell.day}: inasistencia registrada`
                        : `${cell.day}`
                  }
                  className={clsx(
                    "flex size-8 items-center justify-center rounded-full text-sm font-medium tabular-nums",
                    attendanceStatus === "present" && "bg-accent text-accent-foreground",
                    attendanceStatus === "absent" &&
                      "border border-rose-500/70 text-rose-300 line-through decoration-rose-500/80 decoration-2",
                    !attendanceStatus && isToday && "ring-1 ring-accent/80 text-accent",
                    !attendanceStatus && !isToday && isPast && "text-dim",
                    !attendanceStatus && !isToday && !isPast && "text-ghost",
                    cell.isWeekend && !attendanceStatus && "opacity-55",
                    isToday &&
                      attendanceStatus &&
                      "ring-1 ring-accent ring-offset-2 ring-offset-input",
                  )}
                >
                  {cell.day}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 border-t border-accent/15 pt-3">
        <div className="border-r border-accent/15 pr-3">
          <div className="flex h-6 items-center">
            <p className="text-xs font-medium tracking-[0.12em] text-dim uppercase">Asistencias</p>
          </div>
          <p className="mt-1 text-base font-semibold text-foreground">
            {monthlyAttendance}{" "}
            <span className="text-sm font-normal text-muted">{attendanceLabel}</span>
          </p>
        </div>

        <div className="pl-3">
          <div className="flex h-6 items-center">
            <p className="text-xs font-medium tracking-[0.12em] text-dim uppercase">
              Inasistencias
            </p>
          </div>
          <p className="mt-1 text-base font-semibold text-foreground">
            {monthlyAbsences} <span className="text-sm font-normal text-muted">{absenceLabel}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
