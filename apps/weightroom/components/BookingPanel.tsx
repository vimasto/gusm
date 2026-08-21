import { AlertTriangle, Check, CheckCheck, type LucideIcon, X } from "lucide-react";
import clsx from "clsx";
import { cva } from "class-variance-authority";
import { accentTextClassByOccupancy, fillPct as calcFillPct } from "@/lib/occupancy";
import type { UserBlock } from "@/components/BlockCard";

type ActionState =
  | "inscribe"
  | "booking_closed"
  | "cancel"
  | "cancel_locked"
  | "confirm"
  | "request_admission"
  | "full"
  | "blocked";
type BannerState = "active" | "inactive" | "warning";

type BookingPanelProps = {
  selectedBlock: UserBlock | null;
  totalSpots: number;
  userBookedBlock: UserBlock | null;
  selectedDate: Date;
  isBookingAvailable: boolean;
  isCancellationLocked: boolean;
  isCurrentBlockAdmissionWindow: boolean;
  isAdmissionRequested: boolean;
  onInscribe: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  onRequestAdmission: () => void;
};

export function BookingPanel({
  selectedBlock,
  totalSpots,
  userBookedBlock,
  selectedDate,
  isBookingAvailable,
  isCancellationLocked,
  isCurrentBlockAdmissionWindow,
  isAdmissionRequested,
  onInscribe,
  onCancel,
  onConfirm,
  onRequestAdmission,
}: BookingPanelProps) {
  if (!selectedBlock) {
    return (
      <PanelShell>
        <p className="text-center text-sm text-dim">Selecciona un bloque horario</p>
        <div className="flex-1" />
        <div className="mt-2">
          <StatusBanner state="inactive" />
        </div>
        <div className="mt-2">
          <ActionButton
            state="blocked"
            onInscribe={onInscribe}
            onCancel={onCancel}
            onConfirm={onConfirm}
            isAdmissionRequested={isAdmissionRequested}
            onRequestAdmission={onRequestAdmission}
          />
        </div>
      </PanelShell>
    );
  }

  const isFull = selectedBlock.taken >= totalSpots;
  const fillPct = calcFillPct(selectedBlock.taken, totalSpots);
  const isOwnBlock = selectedBlock.userStatus !== "none";
  const hasOtherBooking = userBookedBlock !== null && userBookedBlock.id !== selectedBlock.id;
  const isConfirming = selectedBlock.userStatus === "confirming";

  let action: ActionState;
  if (isOwnBlock) {
    action = isConfirming ? "confirm" : isCancellationLocked ? "cancel_locked" : "cancel";
  } else if (hasOtherBooking) {
    action = "blocked";
  } else if (isCurrentBlockAdmissionWindow) {
    action = "request_admission";
  } else if (isFull) {
    action = "full";
  } else if (!isBookingAvailable) {
    action = "booking_closed";
  } else {
    action = "inscribe";
  }

  let bannerState: BannerState;
  if (isOwnBlock) {
    bannerState = isConfirming ? "active" : "inactive";
  } else if (hasOtherBooking) {
    bannerState = "warning";
  } else {
    bannerState = "inactive";
  }

  const showStatusBanner = !isFull || isOwnBlock;

  return (
    <PanelShell>
      <BlockInfo
        block={selectedBlock}
        totalSpots={totalSpots}
        fillPct={fillPct}
        date={selectedDate}
      />
      <div className="flex-1" />
      {showStatusBanner && (
        <div className="mt-2">
          <StatusBanner state={bannerState} bookedTimeRange={userBookedBlock?.timeRange} />
        </div>
      )}
      <div className="mt-2">
        <ActionButton
          state={action}
          onInscribe={onInscribe}
          onCancel={onCancel}
          onConfirm={onConfirm}
          isAdmissionRequested={isAdmissionRequested}
          onRequestAdmission={onRequestAdmission}
        />
      </div>
    </PanelShell>
  );
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-45 min-w-0 flex-shrink-0 flex-col border-t border-divider bg-surface px-4 py-4">
      {children}
    </div>
  );
}

type BlockInfoProps = {
  block: UserBlock;
  totalSpots: number;
  fillPct: number;
  date: Date;
};

const WEEKDAY_ABBREVIATIONS = ["dom.", "lun.", "mar.", "mié.", "jue.", "vie.", "sáb."];

function getBlockDateLabel(date: Date): string {
  const monthLabel = date.toLocaleDateString("es-CL", { month: "short" }).replace(".", "");
  return `${WEEKDAY_ABBREVIATIONS[date.getDay()]} ${date.getDate()} ${monthLabel}`;
}

function BlockInfo({ block, totalSpots, fillPct, date }: BlockInfoProps) {
  const spotsLeft = totalSpots - block.taken;
  const compactTimeRange = block.timeRange.replace(" · ", "·");
  const blockLabel = `${compactTimeRange}, ${getBlockDateLabel(date)}`;

  return (
    <div className="flex items-start justify-between gap-3">
      <span className="min-w-0 truncate font-mono text-sm tracking-wide text-foreground-muted">
        {blockLabel}
      </span>

      <span className={clsx("shrink-0 text-sm", accentTextClassByOccupancy(fillPct))}>
        {spotsLeft > 0
          ? `${spotsLeft} cupo${spotsLeft !== 1 ? "s" : ""} libre${spotsLeft !== 1 ? "s" : ""}`
          : "Sin cupos"}
      </span>
    </div>
  );
}

const bannerContainerVariants = cva(
  "flex w-full min-w-0 items-center gap-2 rounded-lg px-3 py-2 transition-all duration-300",
  {
    variants: {
      state: {
        active: "border border-accent/35 bg-accent/10",
        inactive: "border border-divider bg-input",
        warning: "border border-accent/20 bg-accent/5",
      },
    },
  },
);

const bannerDotVariants = cva("size-1.5 shrink-0 rounded-full transition-all duration-300", {
  variants: {
    state: {
      active: "bg-accent",
      inactive: "bg-dim",
      warning: "",
    },
  },
});

const bannerTextVariants = cva("text-sm transition-colors duration-300", {
  variants: {
    state: {
      active: "text-foreground-muted",
      inactive: "text-dim",
      warning: "text-muted",
    },
  },
});

type StatusBannerProps = {
  state: BannerState;
  bookedTimeRange?: string;
};

function StatusBanner({ state, bookedTimeRange }: StatusBannerProps) {
  return (
    <div className={bannerContainerVariants({ state })}>
      {state === "warning" ? (
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent" />
      ) : (
        <div className={bannerDotVariants({ state })} />
      )}

      <span className={clsx("min-w-0 break-words", bannerTextVariants({ state }))}>
        {state === "active" && "La ventana de confirmación cierra 1 h antes del bloque"}
        {state === "inactive" && "La confirmación abre 4 h antes y cierra 1 h antes del bloque"}
        {state === "warning" && (
          <>
            Tienes una reserva en <span className="text-accent">{bookedTimeRange}</span>. Cancélala
            para inscribirte aquí.
          </>
        )}
      </span>
    </div>
  );
}

const actionButtonVariants = cva(
  "flex w-full items-center justify-center gap-2 rounded-xl py-3 text-base transition-all duration-200 active:scale-[0.98]",
  {
    variants: {
      intent: {
        inscribe: "border border-accent/30 bg-accent/5 text-accent hover:bg-accent/10",
        booking_closed: "cursor-not-allowed border border-divider bg-transparent text-dim",
        cancel: "border border-red-500/30 bg-red-500/5 text-red-500 hover:bg-red-500/10",
        cancel_locked: "cursor-not-allowed border border-red-500/20 bg-red-500/5 text-red-500/60",
        confirm: "border border-accent/60 bg-accent/15 text-accent hover:bg-accent/20",
        request_admission: "border border-accent/60 bg-accent/15 text-accent hover:bg-accent/20",
        full: "cursor-not-allowed border border-divider bg-transparent text-dim",
        blocked: "cursor-not-allowed border border-accent/30 bg-accent/5 text-accent opacity-40",
      },
    },
  },
);

const ACTION_META: Record<ActionState, { icon: LucideIcon; label: string; isDisabled: boolean }> = {
  inscribe: { icon: Check, label: "Inscribirse", isDisabled: false },
  booking_closed: { icon: X, label: "Inscripciones cerradas", isDisabled: true },
  cancel: { icon: X, label: "Cancelar reserva", isDisabled: false },
  cancel_locked: { icon: X, label: "Cancelación bloqueada", isDisabled: true },
  confirm: { icon: CheckCheck, label: "Confirmar asistencia", isDisabled: false },
  request_admission: {
    icon: AlertTriangle,
    label: "Solicitar ingreso",
    isDisabled: false,
  },
  full: { icon: X, label: "Sin cupos disponibles", isDisabled: true },
  blocked: { icon: Check, label: "Inscribirse", isDisabled: true },
};

type ActionButtonProps = {
  state: ActionState;
  onInscribe: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  isAdmissionRequested: boolean;
  onRequestAdmission: () => void;
};

function ActionButton({
  state,
  onInscribe,
  onCancel,
  onConfirm,
  isAdmissionRequested,
  onRequestAdmission,
}: ActionButtonProps) {
  const actionMeta = ACTION_META[state];
  const isDisabled =
    actionMeta.isDisabled || (state === "request_admission" && isAdmissionRequested);
  const label =
    state === "request_admission" && isAdmissionRequested
      ? "Solicitud de ingreso enviada"
      : actionMeta.label;
  const Icon = actionMeta.icon;

  let handler: (() => void) | undefined;
  if (state === "inscribe") {
    handler = onInscribe;
  } else if (state === "cancel") {
    handler = onCancel;
  } else if (state === "confirm") {
    handler = onConfirm;
  } else if (state === "request_admission") {
    handler = onRequestAdmission;
  }

  return (
    <button
      type="button"
      onClick={handler}
      disabled={isDisabled}
      className={actionButtonVariants({ intent: state })}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}
