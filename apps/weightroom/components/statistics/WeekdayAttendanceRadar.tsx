"use client";

import { motion, useReducedMotion } from "motion/react";
import type { WeekdayAttendance } from "@/lib/statistics";

type Props = {
  historyStartDate: string;
  weekdays: WeekdayAttendance[];
};

type Point = {
  label: string;
  weekday: number;
  x: number;
  y: number;
};

const CENTER = 120;
const RADAR_POINTS: Point[] = [
  { label: "V", weekday: 5, x: 120, y: 42 },
  { label: "L", weekday: 1, x: 194, y: 96 },
  { label: "M", weekday: 2, x: 166, y: 183 },
  { label: "X", weekday: 3, x: 74, y: 183 },
  { label: "J", weekday: 4, x: 46, y: 96 },
];

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
  return Math.max(1, ...weekdays.map((weekday) => weekday.average));
}

function getPolygonPoints(scale: number) {
  return RADAR_POINTS.map((point) => {
    const x = CENTER + (point.x - CENTER) * scale;
    const y = CENTER + (point.y - CENTER) * scale;
    return `${x},${y}`;
  }).join(" ");
}

function getDataPoints(weekdays: WeekdayAttendance[], maximumAverage: number) {
  const averageByWeekday = new Map(weekdays.map((weekday) => [weekday.weekday, weekday.average]));

  return RADAR_POINTS.map((point) => {
    const average = averageByWeekday.get(point.weekday) ?? 0;
    const scale = average / maximumAverage;
    const x = CENTER + (point.x - CENTER) * scale;
    const y = CENTER + (point.y - CENTER) * scale;
    return `${x},${y}`;
  }).join(" ");
}

function getAverageLabel(value: number) {
  return value.toLocaleString("es-CL", { maximumFractionDigits: 1 });
}

export function WeekdayAttendanceRadar({ historyStartDate, weekdays }: Props) {
  const shouldReduceMotion = useReducedMotion();
  const maximumAverage = getMaximumAverage(weekdays);
  const dataPoints = getDataPoints(weekdays, maximumAverage);

  return (
    <section className="rounded-2xl border border-divider bg-input/30 px-4 py-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Ritmo semanal</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          Promedio histórico de asistencias por día operativo.
        </p>
      </div>

      <div
        className="mx-auto mt-2 max-w-64"
        role="img"
        aria-label="Radar histórico de asistencia de lunes a viernes"
      >
        <svg viewBox="0 0 240 240" className="size-full overflow-visible" aria-hidden="true">
          {[0.25, 0.5, 0.75, 1].map((scale) => (
            <polygon
              key={scale}
              points={getPolygonPoints(scale)}
              fill="none"
              className="stroke-divider"
              strokeWidth="1"
            />
          ))}
          {RADAR_POINTS.map((point) => (
            <line
              key={point.weekday}
              x1={CENTER}
              x2={point.x}
              y1={CENTER}
              y2={point.y}
              className="stroke-divider"
              strokeWidth="1"
            />
          ))}
          <motion.polygon
            points={dataPoints}
            className="fill-accent/20 stroke-accent"
            strokeWidth="2"
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ transformOrigin: "center" }}
            transition={{ duration: 0.48, ease: "easeOut" }}
          />
          {RADAR_POINTS.map((point) => (
            <text
              key={point.weekday}
              x={CENTER + (point.x - CENTER) * 1.17}
              y={CENTER + (point.y - CENTER) * 1.17 + 4}
              className="fill-muted text-[13px] font-medium"
              textAnchor="middle"
            >
              {point.label}
            </text>
          ))}
        </svg>
      </div>

      <dl className="mt-1 grid grid-cols-5 gap-1 text-center">
        {weekdays.map((weekday) => (
          <div key={weekday.weekday}>
            <dt className="text-xs text-muted">
              {RADAR_POINTS.find((point) => point.weekday === weekday.weekday)?.label}
            </dt>
            <dd className="mt-0.5 text-sm font-medium text-foreground tabular-nums">
              {getAverageLabel(weekday.average)}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 text-xs leading-5 text-muted">
        Histórico desde {getHistoryStartLabel(historyStartDate)}. La escala máxima es{" "}
        {getAverageLabel(maximumAverage)} asistentes.
      </p>
    </section>
  );
}
