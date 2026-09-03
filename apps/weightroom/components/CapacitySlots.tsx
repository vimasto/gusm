"use client";

import clsx from "clsx";
import { motion, useReducedMotion } from "motion/react";

type CapacitySlotsProps = {
  isDisabled?: boolean;
  occupied: number;
  total: number;
};

const CAPACITY_SEGMENTS = 3;

function clampOccupiedSlots(occupied: number, total: number): number {
  return Math.max(0, Math.min(occupied, total));
}

function getSegmentFill(occupied: number, total: number, segmentIndex: number): number {
  const segmentCapacity = total / CAPACITY_SEGMENTS;
  const segmentStart = segmentIndex * segmentCapacity;

  return Math.max(0, Math.min((occupied - segmentStart) / segmentCapacity, 1));
}

export function CapacitySlots({ isDisabled = false, occupied, total }: CapacitySlotsProps) {
  const shouldReduceMotion = useReducedMotion();
  const occupiedSlots = clampOccupiedSlots(occupied, total);

  return (
    <div
      className="grid min-w-0 flex-1 grid-cols-3 gap-0.5"
      aria-label={`${occupiedSlots} de ${total} cupos ocupados`}
      role="img"
    >
      {Array.from({ length: CAPACITY_SEGMENTS }, (_, index) => {
        const fill = getSegmentFill(occupiedSlots, total, index);

        return (
          <span
            key={index}
            aria-hidden="true"
            className={clsx(
              "relative h-2.5 overflow-hidden rounded-full border border-divider",
              isDisabled ? "bg-capacity-disabled-track" : "bg-ghost",
              index === 1 && "scale-y-90",
            )}
          >
            <motion.span
              className={clsx(
                "absolute inset-y-0 left-0 w-full origin-left rounded-full",
                isDisabled ? "bg-capacity-disabled-fill" : "bg-progress",
              )}
              initial={false}
              animate={{ opacity: fill === 0 ? 0 : 1, scaleX: fill }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 260, damping: 30, mass: 0.45 }
              }
            />
          </span>
        );
      })}
    </div>
  );
}
