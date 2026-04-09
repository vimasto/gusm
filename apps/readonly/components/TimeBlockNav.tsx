import { ChevronUp, ChevronDown, Users } from "lucide-react";
import {
  ACCENT,
  accentByOccupancy,
  fillPct as calcFillPct,
} from "@/lib/occupancy";

interface TimeBlockNavProps {
  /** "HH:MM – HH:MM" :viene de la query del bloque actual */
  timeRange: string;
  /** Posición del bloque en el día : viene de la query de bloques del día */
  blockPosition: { current: number; total: number };
  /** capacida — viene de la query de rules/bloques */
  totalSpots: number;
  /** inscritos actuales — viene de COUNT(*) en bookings */
  participantCount: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export function TimeBlockNav({
  timeRange,
  blockPosition,
  totalSpots,
  participantCount,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
}: TimeBlockNavProps) {
  const isFull = participantCount >= totalSpots;
  const fillPct = calcFillPct(participantCount, totalSpots);

  return (
    <>
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{
          borderBottom: "1px solid var(--color-divider)",
          background: "var(--color-surface)",
        }}
      >
        {/* Up arrow + block counter */}
        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={onPrev}
            disabled={!hasPrev}
            className="w-9 h-9 flex items-center justify-center rounded-full transition-all disabled:opacity-20"
            style={{
              border: "1px solid rgba(245,180,0,0.12)",
              color: "rgba(245,180,0,0.40)",
            }}
          >
            <ChevronUp size={16} />
          </button>
          <span
            className="text-center"
            style={{
              fontSize: 9,
              color: "rgba(245,180,0,0.22)",
              letterSpacing: "0.06em",
            }}
          >
            {blockPosition.current}/{blockPosition.total}
          </span>
        </div>

        {/* time range */}
        <div className="text-center">
          <div
            className="font-mono font-bold tracking-widest text-white"
            style={{ fontSize: 22 }}
          >
            {timeRange}
          </div>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <Users size={10} style={{ color: "rgba(245,180,0,0.35)" }} />
            <span style={{ fontSize: 11 }}>
              <span style={{ color: accentByOccupancy(fillPct) }}>
                {participantCount}
              </span>
              <span style={{ color: "rgba(245,180,0,0.28)" }}>
                {" "}
                inscritos de {totalSpots}
              </span>
            </span>
          </div>
        </div>

        {/* down arrow */}
        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={onNext}
            disabled={!hasNext}
            className="w-9 h-9 flex items-center justify-center rounded-full transition-all disabled:opacity-20"
            style={{
              border: "1px solid rgba(245,180,0,0.12)",
              color: "rgba(245,180,0,0.40)",
            }}
          >
            <ChevronDown size={16} />
          </button>
          <span
            style={{
              fontSize: 9,
              color: "rgba(245,180,0,0.22)",
              letterSpacing: "0.06em",
            }}
          >
            bloque
          </span>
        </div>
      </div>

      {/* occupancy bar */}
      <div className="h-0.5" style={{ background: "#0f0f0f" }}>
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${fillPct}%`,
            backgroundColor: accentByOccupancy(fillPct),
          }}
        />
      </div>
    </>
  );
}
