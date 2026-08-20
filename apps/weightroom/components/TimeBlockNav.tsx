import { ChevronUp, ChevronDown, Users } from "lucide-react";
import { accentBackgroundClassByOccupancy, fillPct as calcFillPct } from "@/lib/occupancy";
import clsx from "clsx";

type TimeBlockNavProps = {
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
};

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
  const fillPct = calcFillPct(participantCount, totalSpots);

  return (
    <>
      <div
        className={clsx(
          "flex items-center justify-between border-b border-divider bg-surface px-5 py-3",
        )}
      >
        {/* Up arrow + block counter */}
        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={onPrev}
            disabled={!hasPrev}
            className={clsx(
              "flex size-9 items-center justify-center rounded-full border border-accent text-accent transition-colors",
              "disabled:opacity-20",
            )}
          >
            <ChevronUp className="size-4" />
          </button>

          <span className="text-center text-sm text-muted">
            {blockPosition.current}/{blockPosition.total}
          </span>
        </div>

        {/* time range */}
        <div className="flex flex-col items-center gap-1">
          <div className="font-mono text-2xl font-bold tracking-widest text-foreground">
            {timeRange}
          </div>

          <div className="flex items-center justify-center gap-1.5">
            <Users className="size-3 text-accent/35" />

            <span className="text-sm text-muted">
              <span className="text-accent">{participantCount}</span> inscritos de {totalSpots}
            </span>
          </div>
        </div>

        {/* down arrow */}
        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={onNext}
            disabled={!hasNext}
            className={clsx(
              "flex size-9 items-center justify-center rounded-full border border-accent text-accent transition-colors",
              "disabled:opacity-20",
            )}
          >
            <ChevronDown className="size-4" />
          </button>
          <span className="text-sm text-muted">bloque</span>
        </div>
      </div>

      {/* occupancy bar */}
      <div className="h-0.5 bg-input">
        <div
          className={clsx(
            "h-full transition-all duration-500",
            accentBackgroundClassByOccupancy(fillPct),
          )}
          style={{ width: `${fillPct}%` }}
        />
      </div>
    </>
  );
}
