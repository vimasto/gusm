import { clsx } from "clsx";

interface ParticipantListProps {
  /** strings ya formateados: "Nombre Apellido" —> viene de la query SELECT full_name */
  participants: string[];
  /** capacidad máxima del bloque —> viene de la query de rules/bloques */
  totalSpots: number;
  /**
   * FIXME: should be className, not boolean
   */
  faded: boolean;
}

function initials(fullName: string) {
  const [firstName = "", lastName = ""] = fullName.split(" ");
  return `${firstName[0]}${lastName[0]}`;
}

export function ParticipantList({ participants, totalSpots, faded }: ParticipantListProps) {
  const rows = Array.from({ length: totalSpots }, (_, i) => participants[i] ?? null);

  return (
    <div
      className={clsx(
        "px-4 pt-1 pb-2 transition-opacity duration-150",
        faded ? "opacity-10" : "opacity-100",
      )}
    >
      {rows.map((fullName, i) => (
        <div
          key={i}
          className={clsx(
            "flex items-center gap-3 py-2.5",
            i < totalSpots - 1 && "border-b border-neutral-900",
          )}
        >
          {/* Spot number */}
          <span className="w-5 shrink-0 text-right font-mono text-xs text-neutral-500">
            {i + 1}
          </span>

          {/* Avatar circle */}
          <div
            className={clsx(
              "flex shrink-0 items-center justify-center rounded-full size-7 border",
              fullName
                ? "bg-amber-400/7 border-amber-400/10"
                : "bg-neutral-900/2 border-neutral-900/6",
            )}
          >
            {fullName && (
              <span className="text-xs font-semibold text-amber-400 uppercase">
                {initials(fullName)}
              </span>
            )}
          </div>

          {/* Nombre completo */}
          {fullName ? (
            <span className="text-sm text-neutral-300">{fullName}</span>
          ) : (
            <span className={clsx("text-sm text-amber-400/20")}>— disponible</span>
          )}
        </div>
      ))}
    </div>
  );
}
