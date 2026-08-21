import { Check, Flame } from "lucide-react";
import clsx from "clsx";
import {
  accentBackgroundClassByOccupancy,
  accentTextClassByOccupancy,
  fillPct as calcFillPct,
} from "@/lib/occupancy";

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
  totalSpots: number;
  isSelected: boolean;
  isBookingDateAvailable: boolean;
  isTimeBlockPast: boolean;
  isCurrentBlockAdmissionWindow: boolean;
  onSelect: () => void;
};

function getCardSurfaceClass(isUserBlock: boolean, isSelected: boolean, fillPct: number) {
  if (isUserBlock) return "border-accent/55 bg-accent/5";
  if (isSelected) return "border-accent/30 bg-input";
  if (fillPct < 67) return "border-accent/20";
  if (fillPct < 80) return "border-accent/15";
  if (fillPct < 93) return "border-accent/10";
  return "border-accent/5";
}

function getTimeTextClass(isUserBlock: boolean, isSelected: boolean) {
  if (isUserBlock) return "text-foreground";
  if (isSelected) return "text-foreground-muted";
  return "text-muted";
}

export function BlockCard({
  block,
  totalSpots,
  isSelected,
  isBookingDateAvailable,
  isTimeBlockPast,
  isCurrentBlockAdmissionWindow,
  onSelect,
}: BlockCardProps) {
  const fillPct = calcFillPct(block.taken, totalSpots);
  const isFull = block.taken >= totalSpots;
  const isUserBlock = block.userStatus !== "none";
  const isDateLocked = !isBookingDateAvailable;
  const isFullLocked = isFull && !isUserBlock && !isCurrentBlockAdmissionWindow;
  const isLocked = isDateLocked || isFullLocked;

  return (
    <button
      type="button"
      onClick={isLocked ? undefined : onSelect}
      disabled={isLocked}
      className={clsx(
        "gusm-control-height w-full rounded-xl border px-3.5 py-3 text-left transition-all duration-150",
        getCardSurfaceClass(isUserBlock, isSelected, fillPct),
        isFullLocked && "pointer-events-none cursor-not-allowed opacity-35",
        isDateLocked && "pointer-events-none cursor-not-allowed",
        !isLocked && "cursor-pointer active:scale-[0.99]",
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span
          className={clsx(
            "font-mono text-base tracking-wider",
            getTimeTextClass(isUserBlock, isSelected),
            isTimeBlockPast && "line-through",
          )}
        >
          {block.timeRange}
        </span>

        <div className="flex items-center gap-2">
          {block.userStatus === "confirmed" && (
            <div className="flex items-center gap-1 rounded-full border border-accent/25 bg-accent/10 px-2 py-0.5">
              <Check className="size-3 text-accent" />
              <span className="text-xs tracking-widest text-accent">CONFIRMADO</span>
            </div>
          )}

          {block.userStatus === "confirming" && (
            <div className="flex items-center gap-1 rounded-full border border-accent/40 bg-accent/15 px-2 py-0.5">
              <Flame className="size-3 text-accent" />
              <span className="text-xs tracking-widest text-accent">CONFIRMAR</span>
            </div>
          )}

          {block.userStatus === "inscribed" && (
            <div className="flex items-center gap-1 rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5">
              <span className="text-xs tracking-widest text-accent">TU RESERVA</span>
            </div>
          )}

          {isFull && !isUserBlock && (
            <span className="rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-xs tracking-widest text-accent">
              LLENO
            </span>
          )}

          <span className={clsx("text-sm tabular-nums", accentTextClassByOccupancy(fillPct))}>
            {block.taken}
            <span className="text-accent/20">/{totalSpots}</span>
          </span>
        </div>
      </div>

      <div className="h-1 overflow-hidden rounded-b-lg bg-input">
        <div
          className={clsx(
            "h-full rounded-r-sm transition-all duration-500",
            accentBackgroundClassByOccupancy(fillPct),
          )}
          style={{ width: `${fillPct}%` }}
        />
      </div>
    </button>
  );
}
