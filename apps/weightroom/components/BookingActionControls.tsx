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
  isBookingReplacementPending?: boolean;
  isBookingReplacementRequested?: boolean;
  isCancellationLocked: boolean;
  isConfirmationWindowActive: boolean;
  isTimeBlockPast: boolean;
  onActionComplete?: () => void;
  onCancelBooking: () => void;
  onCancelBookingReplacement?: () => void;
  onConfirmAttendance: () => void;
  onConfirmBookingReplacement?: () => void;
  onCreateBooking: () => void;
  onRequestAdmission: () => void;
  onShowClosureReason: () => void;
};

export function BookingActionControls({
  actionState,
  isBookingReplacementPending = false,
  isBookingReplacementRequested = false,
  isCancellationLocked,
  isConfirmationWindowActive,
  isTimeBlockPast,
  onActionComplete,
  onCancelBooking,
  onCancelBookingReplacement,
  onConfirmAttendance,
  onConfirmBookingReplacement,
  onCreateBooking,
  onRequestAdmission,
  onShowClosureReason,
}: BookingActionControlsProps) {
  const shouldReduceMotion = useReducedMotion();

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
      <div className={RESERVATION_ACTION_CONTAINER_CLASS}>
        <AnimatePresence initial={false} mode="wait">
          {isBookingReplacementRequested ? (
            <motion.div
              key="replace-booking"
              initial={shouldReduceMotion ? false : { opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, x: -8 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="flex w-full items-center gap-2"
            >
              <p className="min-w-0 flex-1 text-sm leading-4 text-muted">
                Reservar aquí y anular tu otra reserva de este día?
              </p>
              <button
                type="button"
                onClick={onConfirmBookingReplacement}
                disabled={isBookingReplacementPending}
                aria-label="Confirmar cambio de reserva"
                title="Confirmar cambio de reserva"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-accent/40 bg-accent/10 text-accent transition-all hover:bg-accent/15 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <CheckCheck className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onCancelBookingReplacement}
                disabled={isBookingReplacementPending}
                aria-label="Cancelar cambio de reserva"
                title="Cancelar cambio de reserva"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/5 text-red-500 transition-all hover:bg-red-500/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="create-booking"
              type="button"
              onClick={onCreateBooking}
              initial={shouldReduceMotion ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, x: 8 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className={clsx(
                RESERVATION_CONFIRM_BUTTON_CLASS,
                "border-accent-fill bg-accent-fill text-accent-foreground hover:opacity-90 focus-visible:ring-accent",
              )}
            >
              <Plus className="size-4" aria-hidden="true" />
              Reservar cupo
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const isReserved = actionState === "reserved";
  const isConfirmationDisabled = !isReserved || !isConfirmationWindowActive;
  const isCancellationDisabled = isTimeBlockPast || isCancellationLocked;

  return (
    <div className={RESERVATION_ACTION_CONTAINER_CLASS}>
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
        {isReserved ? "Confirmar" : <span className="sr-only">Reserva confirmada</span>}
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
    </div>
  );
}
