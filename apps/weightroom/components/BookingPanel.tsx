import { X, Check, CheckCheck, AlertTriangle, type LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { cva } from 'class-variance-authority';
import { accentByOccupancy, fillPct as calcFillPct } from '@/lib/occupancy';
import type { UserBlock } from '@/components/BlockCard';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ActionState = 'inscribe' | 'cancel' | 'confirm' | 'full' | 'blocked';
type BannerState = 'active' | 'inactive' | 'warning';

interface BookingPanelProps {
  selectedBlock: UserBlock | null;
  totalSpots: number;
  userBookedBlock: UserBlock | null;
  /** Fecha del día seleccionado en el calendario */
  selectedDate: Date;
  onInscribe: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// BookingPanel
// ─────────────────────────────────────────────────────────────────────────────

export function BookingPanel({
  selectedBlock,
  totalSpots,
  userBookedBlock,
  selectedDate,
  onInscribe,
  onCancel,
  onConfirm,
}: BookingPanelProps) {
  if (!selectedBlock) {
    return (
      <PanelShell>
        <p className="text-xs text-zinc-700 text-center py-1">
          Selecciona un bloque horario
        </p>
        <StatusBanner state="inactive" visible />
        <ActionButton
          state="blocked"
          onInscribe={onInscribe}
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      </PanelShell>
    );
  }

  const isFull          = selectedBlock.taken >= totalSpots;
  const fillPct         = calcFillPct(selectedBlock.taken, totalSpots);
  const isOwnBlock      = selectedBlock.userStatus !== 'none';
  const hasOtherBooking = userBookedBlock !== null && userBookedBlock.id !== selectedBlock.id;
  const isConfirming    = selectedBlock.userStatus === 'confirming';

  let action: ActionState;
  if (isOwnBlock) {
    action = isConfirming ? 'confirm' : 'cancel';
  } else if (hasOtherBooking) {
    action = 'blocked';
  } else if (isFull) {
    action = 'full';
  } else {
    action = 'inscribe';
  }

  let bannerState: BannerState;
  if (isOwnBlock) {
    bannerState = isConfirming ? 'active' : 'inactive';
  } else if (hasOtherBooking) {
    bannerState = 'warning';
  } else {
    bannerState = 'inactive';
  }

  const bannerVisible = !isFull || isOwnBlock;

  return (
    <PanelShell>
      <BlockInfo block={selectedBlock} totalSpots={totalSpots} fillPct={fillPct} date={selectedDate} />
      <StatusBanner
        state={bannerState}
        visible={bannerVisible}
        bookedTimeRange={userBookedBlock?.timeRange}
      />
      <ActionButton
        state={action}
        onInscribe={onInscribe}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </PanelShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────────────────────

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-shrink-0 flex flex-col gap-2 px-4 py-4 border-t border-[#111] bg-black">
      {children}
    </div>
  );
}

function BlockInfo({
  block,
  totalSpots,
  fillPct,
  date,
}: {
  block: UserBlock;
  totalSpots: number;
  fillPct: number;
  date: Date;
}) {
  const spotsLeft = totalSpots - block.taken;
  const dayName   = date.toLocaleDateString('es-CL', { weekday: 'long' });
  const dayNum    = date.getDate();
  const dateLabel = `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${dayNum}`;

  return (
    <div className="relative flex items-center justify-between">
      <span className="font-mono tracking-wider text-[#e4e4e7]" style={{ fontSize: 18 }}>
        {block.timeRange}
      </span>

      <span
        className="absolute left-1/2 -translate-x-1/2 font-mono tracking-wider text-[#e4e4e7] pointer-events-none"
        style={{ fontSize: 18 }}
      >
        {dateLabel}
      </span>

      <span style={{ fontSize: 12, color: accentByOccupancy(fillPct) }}>
        {spotsLeft > 0
          ? `${spotsLeft} cupo${spotsLeft !== 1 ? 's' : ''} libre${spotsLeft !== 1 ? 's' : ''}`
          : 'Sin cupos'}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatusBanner
// ─────────────────────────────────────────────────────────────────────────────

const bannerContainerVariants = cva(
  'flex items-center gap-2 w-full px-3 py-2 rounded-lg transition-all duration-300',
  {
    variants: {
      state: {
        active:   'bg-[#f5b400]/[.10] border border-[#f5b400]/35',
        inactive: 'bg-[#0a0a0a]       border border-[#1a1a1a]',
        warning:  'bg-[#f5b400]/[.06] border border-[#f5b400]/20',
      },
    },
  }
);

const bannerDotVariants = cva(
  'w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-300',
  {
    variants: {
      state: {
        active:   'bg-[#f5b400]',
        inactive: 'bg-zinc-800',
        warning:  '',
      },
    },
  }
);

const bannerTextVariants = cva(
  'text-[11px] transition-colors duration-300',
  {
    variants: {
      state: {
        active:   'text-zinc-300',
        inactive: 'text-zinc-700',
        warning:  'text-zinc-400',
      },
    },
  }
);

function StatusBanner({
  state,
  visible = true,
  bookedTimeRange,
}: {
  state: BannerState;
  visible?: boolean;
  bookedTimeRange?: string;
}) {
  return (
    <div
      className={clsx(
        bannerContainerVariants({ state }),
        !visible && 'opacity-0 pointer-events-none'
      )}
    >
      {state === 'warning' ? (
        <AlertTriangle size={13} className="text-[#f5b400] shrink-0 mt-0.5" />
      ) : (
        <div className={bannerDotVariants({ state })} />
      )}

      <span className={bannerTextVariants({ state })}>
        {state === 'active' && 'La ventana de confirmación para este bloque está activa'}
        {state === 'inactive' && 'La ventana de confirmación se abrirá 2 h antes del bloque'}
        {state === 'warning' && (
          <>
            Ya tienes reserva en{' '}
            <span className="text-[#f5b400]">{bookedTimeRange}</span>.
            {' '}Cancela esa reserva para inscribirte aquí.
          </>
        )}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ActionButton
// ─────────────────────────────────────────────────────────────────────────────

const actionButtonVariants = cva(
  'w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-[13px] transition-all duration-200 active:scale-[0.98]',
  {
    variants: {
      intent: {
        inscribe: 'border border-[#f5b400]/30 text-[#f5b400] bg-[#f5b400]/[.05] hover:bg-[#f5b400]/[.09]',
        cancel:   'border border-red-500/30   text-red-500   bg-red-500/[.05]   hover:bg-red-500/[.09]',
        confirm:  'border border-[#f5b400]/60 text-[#f5b400] bg-[#f5b400]/[.12] hover:bg-[#f5b400]/[.18]',
        full:     'border border-zinc-900     text-zinc-700  bg-transparent      cursor-not-allowed',
        blocked:  'border border-[#f5b400]/30 text-[#f5b400] bg-[#f5b400]/[.05] cursor-not-allowed opacity-40',
      },
    },
  }
);

const ACTION_META: Record<ActionState, { icon: LucideIcon; label: string; isDisabled: boolean }> = {
  inscribe: { icon: Check,      label: 'Inscribirse',           isDisabled: false },
  cancel:   { icon: X,          label: 'Cancelar reserva',      isDisabled: false },
  confirm:  { icon: CheckCheck, label: 'Confirmar asistencia',  isDisabled: false },
  full:     { icon: X,          label: 'Sin cupos disponibles', isDisabled: true  },
  blocked:  { icon: Check,      label: 'Inscribirse',           isDisabled: true  },
};

function ActionButton({
  state,
  onInscribe,
  onCancel,
  onConfirm,
}: {
  state: ActionState;
  onInscribe: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { icon: Icon, label, isDisabled } = ACTION_META[state];

  const handler =
    state === 'inscribe' ? onInscribe :
    state === 'cancel'   ? onCancel   :
    state === 'confirm'  ? onConfirm  :
    undefined;

  return (
    <button
      onClick={handler}
      disabled={isDisabled}
      className={actionButtonVariants({ intent: state })}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}
