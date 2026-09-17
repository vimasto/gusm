"use client";

import { motion, useReducedMotion } from "motion/react";
import type { WeeklyOccupancy } from "@/lib/statistics";

type Props = {
  occupancy: WeeklyOccupancy[];
};

const DAY_LABELS = ["Lun.", "Mar.", "Mié.", "Jue.", "Vie."] as const;
const RING_RADII = [72, 60, 48, 36, 24] as const;
const CIRCUMFERENCE = 100;

function getDateLabel(dateKey: string) {
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" })
    .format(new Date(`${dateKey}T12:00:00.000Z`))
    .replace(".", "");
}

function getStateLabel(state: WeeklyOccupancy["state"]) {
  if (state === "closed") return "Cerrado";
  if (state === "past") return "Asistencia";
  if (state === "current") return "Hoy";
  return "Reservas";
}

function getOccupancyPercent(day: WeeklyOccupancy) {
  if (day.capacity === 0) return 0;
  return Math.min(100, Math.round((day.occupied / day.capacity) * 100));
}

export function WeeklyOccupancyRings({ occupancy }: Props) {
  const shouldReduceMotion = useReducedMotion();
  const occupied = occupancy.reduce((total, day) => total + day.occupied, 0);
  const capacity = occupancy.reduce((total, day) => total + day.capacity, 0);

  return (
    <section className="rounded-2xl border border-divider bg-input/30 px-4 py-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Ocupación semanal</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          Asistencias de días transcurridos y reservas de los próximos bloques.
        </p>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <div
          className="relative size-40 shrink-0"
          role="img"
          aria-label={`Ocupación semanal: ${occupied} de ${capacity} cupos`}
        >
          <svg viewBox="0 0 180 180" className="size-full -rotate-90" aria-hidden="true">
            {occupancy.map((day, index) => {
              const percentage = getOccupancyPercent(day);
              const radius = RING_RADII[index];
              const dashOffset = CIRCUMFERENCE - percentage;

              return (
                <g key={day.date}>
                  <circle
                    cx="90"
                    cy="90"
                    r={radius}
                    fill="none"
                    pathLength={CIRCUMFERENCE}
                    className="stroke-accent/15"
                    strokeWidth="8"
                  />
                  <motion.circle
                    cx="90"
                    cy="90"
                    r={radius}
                    fill="none"
                    pathLength={CIRCUMFERENCE}
                    className="stroke-accent"
                    strokeLinecap="round"
                    strokeWidth="8"
                    initial={shouldReduceMotion ? false : { strokeDashoffset: CIRCUMFERENCE }}
                    animate={{ strokeDashoffset: dashOffset }}
                    style={{ strokeDasharray: `${percentage} ${CIRCUMFERENCE - percentage}` }}
                    transition={{ delay: index * 0.08, duration: 0.5, ease: "easeOut" }}
                  />
                </g>
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-xl font-semibold text-foreground tabular-nums">{occupied}</span>
            <span className="text-xs text-muted">de {capacity}</span>
          </div>
        </div>

        <dl className="min-w-0 flex-1 space-y-1.5">
          {occupancy.map((day, index) => (
            <div key={day.date} className="flex items-baseline justify-between gap-2 text-sm">
              <dt className="min-w-0 truncate text-muted">
                <span className="font-medium text-foreground">{DAY_LABELS[index]}</span>{" "}
                {getDateLabel(day.date)}
              </dt>
              <dd className="shrink-0 text-foreground tabular-nums">
                {day.state === "closed" ? "Cerrado" : `${day.occupied}/${day.capacity}`}
                <span className="ml-1 text-xs text-muted">{getStateLabel(day.state)}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
