import { ChevronUp, ChevronDown, Users } from "lucide-react";
import { accentByOccupancy, fillPct as calcFillPct } from "@/lib/occupancy";
import clsx from "clsx";

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
        className={clsx(
          "flex items-center justify-between px-5 py-3 border-b border-neutral-900 bg-black",
        )}
      >
        {/* Up arrow + block counter */}
        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={onPrev}
            disabled={!hasPrev}
            className={clsx(
              "flex size-9 items-center justify-center rounded-full transition-colors border border-amber-400 text-amber-400",
              "disabled:opacity-20",
            )}
          >
            <ChevronUp className="size-4" />
          </button>

          <span className="text-center text-xs text-neutral-500">
            {blockPosition.current}/{blockPosition.total}
          </span>
        </div>

        {/* time range */}
        <div className="flex flex-col items-center gap-1">
          <div className="font-mono text-2xl font-bold tracking-widest text-white">{timeRange}</div>

          <div className="flex items-center justify-center gap-1.5">
            <Users className="size-3 text-amber-400/35" />

            <span className="text-xs text-neutral-500">
              <span className="text-amber-400">{participantCount}</span> inscritos de {totalSpots}
            </span>
          </div>
        </div>

        {/* down arrow */}
        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={onNext}
            disabled={!hasNext}
            className={clsx(
              "flex size-9 items-center justify-center rounded-full transition-colors border border-amber-400 text-amber-400",
              "disabled:opacity-20",
            )}
          >
            <ChevronDown className="size-4" />
          </button>
          <span className="text-xs text-neutral-500">bloque</span>
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
