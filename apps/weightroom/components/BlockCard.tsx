"use client";

import { BookingActionControls, type BookingActionState } from "@/components/BookingActionControls";
import { BookingCard } from "@/components/BookingCard";

export type UserBookingStatus = "none" | "inscribed" | "confirming" | "confirmed";

export type UserBlock = {
  id: number;
  startTime: string;
  endTime: string;
  timeRange: string;
  taken: number;
  userStatus: UserBookingStatus;
};

type BlockCardProps = {
  block: UserBlock;
  closureReason?: string;
  isBookingAvailable: boolean;
  isBookingReplacementPending: boolean;
  isBookingReplacementRequested: boolean;
  isCancellationLocked: boolean;
  isConfirmationWindowActive: boolean;
  isCurrentBlockAdmissionWindow: boolean;
  isDirectConfirmationBooking: boolean;
  isSelected: boolean;
  isTimeBlockPast: boolean;
  onDismissActions: () => void;
  onCancelBooking: () => void;
  onCancelBookingReplacement: () => void;
  onConfirmAttendance: () => void;
  onConfirmBookingReplacement: () => void;
  onCreateBooking: () => void;
  onRequestAdmission: () => void;
  onSelect: () => void;
  onShowClosureReason: () => void;
  totalSpots: number;
};

function getAvailabilityLabel(
  block: UserBlock,
  totalSpots: number,
  isTimeBlockPast: boolean,
): string {
  if (block.userStatus === "confirmed") return "Reserva confirmada";
  if (block.userStatus === "inscribed") return "Reserva activa";
  if (block.userStatus === "confirming") return "Ventana de confirmación activa";
  if (isTimeBlockPast) return "Solo lectura";
  if (block.taken >= totalSpots) return "Sin cupos disponibles";

  const spotsLeft = totalSpots - block.taken;
  return `${spotsLeft} cupo${spotsLeft === 1 ? "" : "s"} disponible${spotsLeft === 1 ? "" : "s"}`;
}

function getBookingActionState({
  block,
  closureReason,
  isBookingAvailable,
  isCurrentBlockAdmissionWindow,
  isTimeBlockPast,
  totalSpots,
}: Pick<
  BlockCardProps,
  | "block"
  | "closureReason"
  | "isBookingAvailable"
  | "isCurrentBlockAdmissionWindow"
  | "isTimeBlockPast"
  | "totalSpots"
>): BookingActionState {
  if (closureReason) return "closed";
  if (block.userStatus === "confirmed") return "confirmed";
  if (block.userStatus === "inscribed" || block.userStatus === "confirming") return "reserved";
  if (isCurrentBlockAdmissionWindow) return "request_admission";
  if (isTimeBlockPast || !isBookingAvailable) return "unavailable";
  if (block.taken >= totalSpots) return "full";

  return "available";
}

export function BlockCard({
  block,
  closureReason,
  isBookingAvailable,
  isBookingReplacementPending,
  isBookingReplacementRequested,
  isCancellationLocked,
  isConfirmationWindowActive,
  isCurrentBlockAdmissionWindow,
  isDirectConfirmationBooking,
  isSelected,
  isTimeBlockPast,
  onDismissActions,
  onCancelBooking,
  onCancelBookingReplacement,
  onConfirmAttendance,
  onConfirmBookingReplacement,
  onCreateBooking,
  onRequestAdmission,
  onSelect,
  onShowClosureReason,
  totalSpots,
}: BlockCardProps) {
  const actionState = getBookingActionState({
    block,
    closureReason,
    isBookingAvailable,
    isCurrentBlockAdmissionWindow,
    isTimeBlockPast,
    totalSpots,
  });
  const isClosed = closureReason !== undefined;
  const isDirectConfirmationWarning = actionState === "available" && isDirectConfirmationBooking;
  const canSelect =
    isClosed ||
    (!isTimeBlockPast &&
      (block.userStatus !== "none" ||
        isCurrentBlockAdmissionWindow ||
        (isBookingAvailable && block.taken < totalSpots)));

  function handleSelect() {
    if (isClosed) {
      onShowClosureReason();
      return;
    }

    onSelect();
  }

  return (
    <BookingCard
      actionState={actionState}
      detail={
        isClosed
          ? "Bloque inhabilitado"
          : isDirectConfirmationWarning
            ? "Reservar equivale a confirmar asistencia."
            : getAvailabilityLabel(block, totalSpots, isTimeBlockPast)
      }
      detailTone={isClosed ? "danger" : isDirectConfirmationWarning ? "warning" : "default"}
      isDisabled={isTimeBlockPast}
      isSelected={isSelected}
      onSelect={canSelect ? handleSelect : undefined}
      title={block.timeRange}
      titleDetail={block.userStatus === "confirming" ? "Ventana activa" : undefined}
      totalSpots={totalSpots}
      taken={block.taken}
      actions={
        isSelected && !isClosed ? (
          <BookingActionControls
            actionState={actionState}
            isBookingReplacementPending={isBookingReplacementPending}
            isBookingReplacementRequested={isBookingReplacementRequested}
            isCancellationLocked={isCancellationLocked}
            isConfirmationWindowActive={isConfirmationWindowActive}
            isTimeBlockPast={isTimeBlockPast}
            onActionComplete={onDismissActions}
            onCancelBooking={onCancelBooking}
            onCancelBookingReplacement={onCancelBookingReplacement}
            onConfirmAttendance={onConfirmAttendance}
            onConfirmBookingReplacement={onConfirmBookingReplacement}
            onCreateBooking={onCreateBooking}
            onRequestAdmission={onRequestAdmission}
            onShowClosureReason={onShowClosureReason}
          />
        ) : undefined
      }
    />
  );
}
