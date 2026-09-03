"use client";

import { useState } from "react";
import { BookingActionControls, type BookingActionState } from "@/components/BookingActionControls";
import { BookingCard } from "@/components/BookingCard";
import type { UserBlock } from "@/components/BlockCard";

export type StaffWeekBookingDay = {
  block: UserBlock;
  closureReason?: string;
  date: Date;
  isBookingAvailable: boolean;
  isCancellationLocked: boolean;
  isConfirmationWindowActive: boolean;
  isCurrentBlockAdmissionWindow: boolean;
  isTimeBlockPast: boolean;
};

type StaffWeekBookingListProps = {
  days: StaffWeekBookingDay[];
  totalSpots: number;
  onCancelBooking: (dayIndex: number) => void;
  onConfirmAttendance: (dayIndex: number) => void;
  onCreateBooking: (dayIndex: number) => void;
  onRequestAdmission: (dayIndex: number) => void;
  onShowClosureReason: (dayIndex: number) => void;
};

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("es-CL", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

function getDateLabel(date: Date): string {
  const label = WEEKDAY_FORMATTER.format(date).replace(".", "");
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function getAvailabilityLabel(day: StaffWeekBookingDay, totalSpots: number): string {
  if (day.closureReason) return "Bloque inhabilitado";
  if (day.block.userStatus === "confirmed") return "Reserva confirmada";
  if (day.block.userStatus === "inscribed") return "Reserva activa";
  if (day.isCurrentBlockAdmissionWindow) return "Bloque en curso";
  if (day.isTimeBlockPast) return "Solo lectura";
  if (!day.isBookingAvailable) return "Aún no disponible";
  if (day.block.taken >= totalSpots) return "Sin cupos disponibles";

  const spotsLeft = totalSpots - day.block.taken;
  return `${spotsLeft} cupo${spotsLeft === 1 ? "" : "s"} disponible${spotsLeft === 1 ? "" : "s"}`;
}

function getBookingActionState(day: StaffWeekBookingDay, totalSpots: number): BookingActionState {
  if (day.closureReason) return "closed";
  if (day.block.userStatus === "confirmed") return "confirmed";
  if (day.block.userStatus === "inscribed") return "reserved";
  if (day.isCurrentBlockAdmissionWindow) return "request_admission";
  if (day.isTimeBlockPast || !day.isBookingAvailable) return "unavailable";
  if (day.block.taken >= totalSpots) return "full";

  return "available";
}

export function StaffWeekBookingList({
  days,
  totalSpots,
  onCancelBooking,
  onConfirmAttendance,
  onCreateBooking,
  onRequestAdmission,
  onShowClosureReason,
}: StaffWeekBookingListProps) {
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-4 pt-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <div className="mb-1 flex shrink-0 flex-col gap-1 px-1">
        <p className="text-sm font-medium tracking-[0.1em] text-accent">RESERVA DE PERSONAL</p>
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-base font-semibold text-foreground">Bloque 7</h1>
          <span className="shrink-0 font-mono text-sm tracking-wide text-muted">17:15 · 18:40</span>
        </div>
      </div>

      {days.map((day, dayIndex) => {
        const actionState = getBookingActionState(day, totalSpots);
        const isSelected = selectedDayIndex === dayIndex;
        const isClosed = actionState === "closed";
        const canSelect =
          !day.isTimeBlockPast &&
          !isClosed &&
          actionState !== "full" &&
          actionState !== "unavailable";

        function handleSelect() {
          if (isClosed) {
            onShowClosureReason(dayIndex);
            return;
          }

          setSelectedDayIndex((currentIndex) => (currentIndex === dayIndex ? null : dayIndex));
        }

        return (
          <BookingCard
            key={day.date.toISOString()}
            actionState={actionState}
            detail={getAvailabilityLabel(day, totalSpots)}
            detailTone={actionState === "closed" ? "danger" : "default"}
            isDisabled={day.isTimeBlockPast}
            isSelected={isSelected}
            onSelect={canSelect || isClosed ? handleSelect : undefined}
            title={getDateLabel(day.date)}
            titleDetail={
              actionState === "reserved" && day.isConfirmationWindowActive
                ? "Ventana activa"
                : undefined
            }
            totalSpots={totalSpots}
            taken={day.block.taken}
            actions={
              isSelected ? (
                <BookingActionControls
                  actionState={actionState}
                  isCancellationLocked={day.isCancellationLocked}
                  isConfirmationWindowActive={day.isConfirmationWindowActive}
                  isTimeBlockPast={day.isTimeBlockPast}
                  onActionComplete={() => setSelectedDayIndex(null)}
                  onCancelBooking={() => onCancelBooking(dayIndex)}
                  onConfirmAttendance={() => onConfirmAttendance(dayIndex)}
                  onCreateBooking={() => onCreateBooking(dayIndex)}
                  onRequestAdmission={() => onRequestAdmission(dayIndex)}
                  onShowClosureReason={() => onShowClosureReason(dayIndex)}
                />
              ) : undefined
            }
          />
        );
      })}
      <div className="h-2" />
    </div>
  );
}
