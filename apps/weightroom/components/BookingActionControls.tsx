"use client";

import { CheckCheck, Lock, Plus, X } from "lucide-react";
import clsx from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export type BookingActionState =
  | "available"
  | "closed"
  | "confirmed"
  | "full"
  | "request_admission"
  | "reserved"
  | "unavailable";

const ACTION_CONTAINER_CLASS = "flex shrink-0 items-center justify-end gap-1";
const ACTION_BUTTON_CLASS =
  "flex h-11 items-center justify-center gap-1 rounded-lg px-3 text-base font-semibold whitespace-nowrap transition-opacity focus-visible:ring-2 focus-visible:outline-none active:scale-[0.98]";
const RESERVATION_ACTION_CONTAINER_CLASS = "flex w-full gap-2";
const RESERVATION_CONFIRM_BUTTON_CLASS =
  "flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 text-base transition-all active:scale-[0.98] disabled:cursor-not-allowed";
const RESERVATION_CANCEL_BUTTON_CLASS =
  "flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/5 px-2 text-base text-red-500 transition-all hover:bg-red-500/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

type BookingActionControlsProps = {
  actionState: BookingActionState;
  isCancellationLocked: boolean;
  isConfirmationWindowActive: boolean;
  isTimeBlockPast: boolean;
  onActionComplete?: () => void;
  onCancelBooking: () => void;
  onConfirmAttendance: () => void;
  onCreateBooking: () => void;
  onRequestAdmission: () => void;
  onShowClosureReason: () => void;
};

export function BookingActionControls({
  actionState,
  isCancellationLocked,
  isConfirmationWindowActive,
  isTimeBlockPast,
  onActionComplete,
  onCancelBooking,
  onConfirmAttendance,
  onCreateBooking,
  onRequestAdmission,
  onShowClosureReason,
}: BookingActionControlsProps) {
  const shouldReduceMotion = useReducedMotion();
  const transition = shouldReduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 420, damping: 28, mass: 0.42 };

  function handleAction(action: () => void) {
    action();
    onActionComplete?.();
  }

  if (actionState === "closed") {
    return (
      <div className={ACTION_CONTAINER_CLASS}>
        <button
          type="button"
          onClick={() => handleAction(onShowClosureReason)}
          className={clsx(
            ACTION_BUTTON_CLASS,
            "bg-rose-500/10 text-rose-400 focus-visible:ring-rose-400",
          )}
        >
          <Lock className="size-4" aria-hidden="true" />
          Ver motivo
        </button>
      </div>
    );
  }

  if (actionState === "unavailable" || actionState === "full") {
    return (
      <div className={ACTION_CONTAINER_CLASS}>
        <span className="flex h-11 items-center justify-center rounded-lg bg-ghost px-3 text-center text-sm text-dim">
          {actionState === "full" ? "Sin cupos" : "No disponible"}
        </span>
      </div>
    );
  }

  if (actionState === "request_admission") {
    return (
      <div className={ACTION_CONTAINER_CLASS}>
        <button
          type="button"
          onClick={() => handleAction(onRequestAdmission)}
          className={clsx(
            ACTION_BUTTON_CLASS,
            "bg-accent-fill text-accent-foreground focus-visible:ring-accent",
          )}
        >
          Solicitar ingreso
        </button>
      </div>
    );
  }

  if (actionState === "available") {
    return (
      <div className={ACTION_CONTAINER_CLASS}>
        <motion.button
          type="button"
          onClick={() => handleAction(onCreateBooking)}
          className={clsx(
            ACTION_BUTTON_CLASS,
            "bg-accent-fill text-accent-foreground hover:opacity-90 focus-visible:ring-accent",
          )}
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={transition}
        >
          <Plus className="size-4" aria-hidden="true" />
          Reservar cupo
        </motion.button>
      </div>
    );
  }

  const isReserved = actionState === "reserved";
  const isConfirmationDisabled = !isReserved || !isConfirmationWindowActive;
  const isCancellationDisabled = isTimeBlockPast || isCancellationLocked;

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        key={actionState}
        className={RESERVATION_ACTION_CONTAINER_CLASS}
        initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.9 }}
        transition={transition}
      >
        <button
          type="button"
          onClick={isConfirmationDisabled ? undefined : () => handleAction(onConfirmAttendance)}
          disabled={isConfirmationDisabled}
          aria-label={isReserved ? "Confirmar asistencia" : "Reserva confirmada"}
          title={isReserved ? "Confirmar asistencia" : "Reserva confirmada"}
          className={clsx(
            RESERVATION_CONFIRM_BUTTON_CLASS,
            isConfirmationDisabled
              ? "border-divider bg-surface text-dim opacity-45"
              : "border-accent/40 bg-accent/10 text-accent hover:bg-accent/15",
          )}
        >
          <CheckCheck className="size-4" aria-hidden="true" />
          {isReserved ? "Confirmar" : "Confirmada"}
        </button>
        <button
          type="button"
          onClick={isCancellationDisabled ? undefined : () => handleAction(onCancelBooking)}
          disabled={isCancellationDisabled}
          aria-label={isCancellationDisabled ? "Cancelación no disponible" : "Cancelar reserva"}
          title={isCancellationDisabled ? "Cancelación no disponible" : "Cancelar reserva"}
          className={clsx(
            RESERVATION_CANCEL_BUTTON_CLASS,
            isCancellationDisabled && "cursor-not-allowed",
          )}
        >
          <X className="size-4" aria-hidden="true" />
          Anular
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
