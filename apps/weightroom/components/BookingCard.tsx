"use client";

import { Users } from "lucide-react";
import clsx from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CapacitySlots } from "@/components/CapacitySlots";
import type { BookingActionState } from "@/components/BookingActionControls";

type BookingCardProps = {
  actionState: BookingActionState;
  actions?: React.ReactNode;
  detail: string;
  detailTone?: "default" | "danger";
  isDisabled?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  title: string;
  titleDetail?: string;
  totalSpots: number;
  taken: number;
};

function getCardSurfaceClass(actionState: BookingActionState, isSelected: boolean): string {
  if (actionState === "closed") return "border-rose-500/30 bg-rose-500/5";
  if (actionState === "reserved" || actionState === "confirmed") {
    return "border-accent/55 bg-accent/5";
  }
  if (isSelected) return "border-accent/30 bg-input";
  return "border-accent/15 bg-input";
}

export function BookingCard({
  actionState,
  actions,
  detail,
  detailTone = "default",
  isDisabled = false,
  isSelected = false,
  onSelect,
  title,
  titleDetail,
  totalSpots,
  taken,
}: BookingCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const details = (
    <div className="min-w-0">
      <div className="flex min-w-0 items-baseline gap-2">
        <p className="truncate text-base font-semibold text-foreground">{title}</p>
        {titleDetail && <span className="truncate text-sm text-muted">{titleDetail}</span>}
      </div>
      <p
        className={clsx("mt-0.5 text-sm", detailTone === "danger" ? "text-rose-400" : "text-muted")}
      >
        {detail}
      </p>
    </div>
  );
  const cardContent = (
    <>
      <div className="min-h-11">{details}</div>

      <div className="mt-2 flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <CapacitySlots isDisabled={isDisabled} occupied={taken} total={totalSpots} />
        </div>
        <span
          className="flex w-15 shrink-0 items-center justify-end text-sm text-accent tabular-nums"
          aria-label={`${taken} de ${totalSpots} cupos ocupados`}
        >
          <Users className="mr-1 size-3.5 shrink-0" aria-hidden="true" />
          {taken}/{totalSpots}
        </span>
      </div>
    </>
  );

  return (
    <motion.article
      layout="size"
      className={clsx(
        "w-full shrink-0 rounded-xl border px-3.5 py-3",
        actions ? "h-40" : "h-24",
        isDisabled && "opacity-40 grayscale",
        getCardSurfaceClass(actionState, isSelected),
      )}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 330, damping: 32, mass: 0.62 }
      }
    >
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={isSelected}
          className="block w-full rounded-sm text-left focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        >
          {cardContent}
        </button>
      ) : (
        <div>{cardContent}</div>
      )}

      <AnimatePresence initial={false}>
        {actions && (
          <motion.div
            className="mt-3 flex h-11 items-center justify-end"
            initial={
              shouldReduceMotion ? false : { opacity: 0, y: -8, clipPath: "inset(0 0 100% 0)" }
            }
            animate={{ opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)" }}
            exit={
              shouldReduceMotion ? undefined : { opacity: 0, y: -5, clipPath: "inset(0 0 100% 0)" }
            }
            transition={
              shouldReduceMotion ? { duration: 0 } : { duration: 0.24, ease: [0.16, 1, 0.3, 1] }
            }
          >
            {actions}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
