import { useState } from "react";
import { CalendarCheck, CheckCheck, X } from "lucide-react";
import clsx from "clsx";

export type ActiveBooking = {
  bookingKey: string;
  date: Date;
  timeRange: string;
  status: "reserved" | "confirmed";
  isConfirmationAvailable: boolean;
  isCancellationLocked: boolean;
};

type ActiveBookingsPanelProps = {
  bookings: ActiveBooking[];
  onClose: () => void;
  onConfirm: (bookingKey: string) => void;
  onCancel: (bookingKey: string) => void;
};

function getDateLabel(date: Date): string {
  const label = date.toLocaleDateString("es-CL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

export function ActiveBookingsPanel({
  bookings,
  onClose,
  onConfirm,
  onCancel,
}: ActiveBookingsPanelProps) {
  const [cancellingBookingKeys, setCancellingBookingKeys] = useState<string[]>([]);

  function handleCancel(bookingKey: string) {
    setCancellingBookingKeys((currentKeys) => [...currentKeys, bookingKey]);

    window.setTimeout(() => {
      onCancel(bookingKey);
      setCancellingBookingKeys((currentKeys) =>
        currentKeys.filter((currentBookingKey) => currentBookingKey !== bookingKey),
      );
    }, 180);
  }

  return (
    <div
      className="fixed inset-x-0 top-18 bottom-0 z-40 flex justify-center bg-black/70 px-4 pt-6"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Mis reservas activas"
        className="flex h-fit w-full max-w-md flex-col overflow-hidden rounded-2xl border border-divider bg-surface shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-divider px-3 py-2.5">
          <div className="flex items-center gap-2 text-accent">
            <CalendarCheck className="size-5" aria-hidden="true" />
            <h2 className="text-base font-semibold tracking-wide">Mis reservas</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar reservas activas"
            className="flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-input hover:text-neutral-100 active:scale-95"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {bookings.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-dim">No tienes reservas activas.</p>
        ) : (
          <div className="flex flex-col gap-1 p-2">
            {bookings.map((booking) => {
              const isConfirmed = booking.status === "confirmed";
              const isConfirmationDisabled = isConfirmed || !booking.isConfirmationAvailable;
              const isCancelling = cancellingBookingKeys.includes(booking.bookingKey);
              const isCancellationDisabled = isCancelling || booking.isCancellationLocked;

              return (
                <article
                  key={booking.bookingKey}
                  className={clsx(
                    "max-h-24 overflow-hidden rounded-xl border border-accent/20 bg-input px-3 py-2 transition-[max-height,opacity,padding,transform] duration-200",
                    isCancelling && "max-h-0 translate-y-1 border-transparent py-0 opacity-0",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-1">
                      <p className="shrink-0 font-mono text-base tracking-wide text-neutral-200">
                        {booking.timeRange}
                      </p>
                      <p className="truncate text-base text-muted">
                        · {getDateLabel(booking.date)}
                      </p>
                    </div>

                    <span
                      className={clsx(
                        "shrink-0 rounded-full border px-1.5 py-0 text-sm tracking-widest",
                        isConfirmed
                          ? "border-accent/40 bg-accent/15 text-accent"
                          : "border-accent/20 bg-accent/5 text-accent",
                      )}
                    >
                      {isConfirmed ? "CONFIRMADA" : "RESERVA"}
                    </span>
                  </div>

                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => onConfirm(booking.bookingKey)}
                      disabled={isConfirmationDisabled}
                      className={clsx(
                        "flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 text-base transition-all active:scale-[0.98] disabled:cursor-not-allowed",
                        isConfirmationDisabled
                          ? "border-divider bg-surface text-dim opacity-45"
                          : "border-accent/40 bg-accent/10 text-accent hover:bg-accent/15",
                      )}
                    >
                      <CheckCheck className="size-4" aria-hidden="true" />
                      {isConfirmed ? "Confirmada" : "Confirmar"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCancel(booking.bookingKey)}
                      disabled={isCancellationDisabled}
                      className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/5 px-2 text-base text-red-500 transition-all hover:bg-red-500/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <X className="size-4" aria-hidden="true" />
                      {booking.isCancellationLocked ? "Bloqueada" : "Cancelar"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
