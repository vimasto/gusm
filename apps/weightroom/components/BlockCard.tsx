import { Check, Flame } from "lucide-react";
import clsx from "clsx";
import { ACCENT, accentByOccupancy, fillPct as calcFillPct } from "@/lib/occupancy";

export type UserBookingStatus = "none" | "inscribed" | "confirming" | "confirmed";

export interface UserBlock {
  id: number;
  /** "HH:MM · HH:MM" — formateado para display */
  timeRange: string;
  startHour: number;
  startMin: number;
  /** TODO: COUNT(*) FROM bookings WHERE block_id = ? AND day = ? */
  taken: number;
  /** TODO: derivado de SELECT status FROM bookings WHERE user_id = ? AND block_id = ? AND day = ? */
  userStatus: UserBookingStatus;
}

interface BlockCardProps {
  block: UserBlock;
  /** TODO: SELECT capacity FROM gym_rules LIMIT 1 */
  totalSpots: number;
  isSelected: boolean;
  onSelect: () => void;
}

export function BlockCard({ block, totalSpots, isSelected, onSelect }: BlockCardProps) {
  const fillPct = calcFillPct(block.taken, totalSpots);
  const isFull = block.taken >= totalSpots;
  const isUserBlock = block.userStatus !== "none";
  const isLocked = isFull && !isUserBlock;

  const borderColor = isUserBlock
    ? "rgba(245,180,0,0.55)"
    : isSelected
      ? "rgba(245,180,0,0.30)"
      : fillPct < 67
        ? "rgba(245,180,0,0.22)"
        : fillPct < 80
          ? "rgba(245,180,0,0.14)"
          : fillPct < 93
            ? "rgba(245,180,0,0.09)"
            : "rgba(245,180,0,0.05)";

  const bgColor = isUserBlock ? "rgba(245,180,0,0.04)" : isSelected ? "#0a0a0a" : "transparent";

  return (
    <button
      onClick={isLocked ? undefined : onSelect}
      disabled={isLocked}
      className={clsx(
        "w-full text-left transition-all duration-150",
        isLocked
          ? "opacity-35 cursor-not-allowed pointer-events-none"
          : "active:scale-[0.99] cursor-pointer",
      )}
      style={{
        padding: "10px 14px 0 14px",
        border: `1px solid ${borderColor}`,
        borderRadius: 12,
        background: bgColor,
      }}
    >
      {/* ── Fila superior: hora + badge + count ─────────── */}
      <div className="flex items-center justify-between mb-2">
        <span
          className={clsx(
            "font-mono tracking-wider",
            isUserBlock ? "text-white" : isSelected ? "text-[#e4e4e7]" : "text-zinc-500",
          )}
          style={{ fontSize: 15 }}
        >
          {block.timeRange}
        </span>

        <div className="flex items-center gap-2">
          {block.userStatus === "confirmed" && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f5b400]/[.12] border border-[#f5b400]/25">
              <Check size={9} className="text-[#f5b400]" />
              <span className="text-[9px] text-[#f5b400] tracking-widest">CONFIRMADO</span>
            </div>
          )}

          {block.userStatus === "confirming" && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f5b400]/[.15] border border-[#f5b400]/40">
              <Flame size={9} className="text-[#f5b400]" />
              <span className="text-[9px] text-[#f5b400] tracking-widest">CONFIRMAR</span>
            </div>
          )}

          {block.userStatus === "inscribed" && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f5b400]/[.08] border border-[#f5b400]/20">
              <span className="text-[9px] text-[#f5b400] tracking-widest">TU RESERVA</span>
            </div>
          )}

          {isFull && !isUserBlock && (
            <span className="px-2 py-0.5 rounded-full text-[9px] text-[#f5b400] bg-[#f5b400]/[.08] border border-[#f5b400]/20 tracking-widest">
              LLENO
            </span>
          )}

          <span
            className="tabular-nums"
            style={{ fontSize: 12, color: accentByOccupancy(fillPct) }}
          >
            {block.taken}
            <span style={{ color: "rgba(245,180,0,0.20)" }}>/{totalSpots}</span>
          </span>
        </div>
      </div>

      {/* ── Barra de ocupación ────────────────────────── */}
      <div
        className="rounded-b-xl overflow-hidden"
        style={{ height: 4, background: "#0d0d0d", borderRadius: "0 0 10px 10px" }}
      >
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${fillPct}%`,
            backgroundColor: accentByOccupancy(fillPct),
            borderRadius: "0 2px 2px 0",
          }}
        />
      </div>
    </button>
  );
}
