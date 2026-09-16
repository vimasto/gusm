"use client";

import { motion, useReducedMotion } from "motion/react";
import type { WeekdayAttendance } from "@/lib/statistics";

type Props = {
  historyStartDate: string;
  weekdays: WeekdayAttendance[];
};

const WEEKDAY_LABELS = ["L", "M", "X", "J", "V"] as const;

function getHistoryStartLabel(dateKey: string) {
  return new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
    .format(new Date(`${dateKey}T12:00:00.000Z`))
    .replace(".", "");
}

function getMaximumAverage(weekdays: WeekdayAttendance[]) {
  return Math.max(
    1,
    ...weekdays.flatMap((weekday) => [weekday.currentMonthAverage, weekday.historicalAverage]),
  );
}

function getAverageLabel(value: number) {
  return `${value.toLocaleString("es-CL", { maximumFractionDigits: 1 })} asistentes`;
}

export function WeekdayAttendanceTrend({ historyStartDate, weekdays }: Props) {
  const shouldReduceMotion = useReducedMotion();
  const maximumAverage = getMaximumAverage(weekdays);

  return (
    <section className="rounded-2xl border border-divider bg-input/30 px-4 py-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Tendencia por día</h2>
        <p className="mt-1 text-sm text-muted">
          Promedio de asistentes por día operativo, sin considerar cierres.
        </p>
      </div>

      <div className="mt-4 flex items-center gap-3 text-xs text-muted" aria-label="Leyenda">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-capacity-segment-blue" aria-hidden="true" />
          Mes actual
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
          Histórico
        </span>
      </div>

      <div
        className="mt-5 grid grid-cols-5 gap-3"
        role="img"
        aria-label="Tendencia de asistencia por día de la semana"
      >
        {weekdays.map((weekday, index) => {
          const currentMonthHeight = (weekday.currentMonthAverage / maximumAverage) * 100;
          const historicalHeight = (weekday.historicalAverage / maximumAverage) * 100;
          const label = WEEKDAY_LABELS[weekday.weekday - 1];

          return (
            <div key={weekday.weekday} className="min-w-0">
              <div className="flex h-36 items-end justify-center gap-1 border-b border-divider/80 px-1">
                <motion.span
                  aria-label={`${label}, mes actual: ${getAverageLabel(weekday.currentMonthAverage)}`}
                  className="w-1/2 rounded-t bg-capacity-segment-blue"
                  initial={shouldReduceMotion ? false : { scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: index * 0.06, duration: 0.42, ease: "easeOut" }}
                  style={{
                    height: `${Math.max(currentMonthHeight, 2)}%`,
                    transformOrigin: "bottom",
                  }}
                />
                <motion.span
                  aria-label={`${label}, histórico: ${getAverageLabel(weekday.historicalAverage)}`}
                  className="w-1/2 rounded-t bg-accent"
                  initial={shouldReduceMotion ? false : { scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: index * 0.06 + 0.08, duration: 0.42, ease: "easeOut" }}
                  style={{ height: `${Math.max(historicalHeight, 2)}%`, transformOrigin: "bottom" }}
                />
              </div>
              <p className="mt-2 text-center text-sm font-medium text-foreground">{label}</p>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs leading-5 text-muted">
        Histórico desde {getHistoryStartLabel(historyStartDate)}.
      </p>
    </section>
  );
}
