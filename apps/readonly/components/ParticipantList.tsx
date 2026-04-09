import { ACCENT } from "@/lib/occupancy";

interface ParticipantListProps {
  /** strings ya formateados: "Nombre Apellido" —> viene de la query SELECT full_name */
  participants: string[];
  /** capacidad máxima del bloque —> viene de la query de rules/bloques */
  totalSpots: number;
  faded: boolean;
}

export function ParticipantList({
  participants,
  totalSpots,
  faded,
}: ParticipantListProps) {
  const rows = Array.from(
    { length: totalSpots },
    (_, i) => participants[i] ?? null,
  );

  /** Extrae hasta 2 iniciales del string "Nombre Apellido [...]" */
  function initials(fullName: string): string {
    return fullName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  }

  return (
    <div
      className="px-4 pt-1 pb-2 transition-opacity duration-150"
      style={{ opacity: faded ? 0.1 : 1 }}
    >
      {rows.map((fullName, i) => (
        <div
          key={i}
          className="flex items-center gap-3"
          style={{
            paddingTop: 10,
            paddingBottom: 10,
            borderBottom: `1px solid ${fullName ? "rgba(245,180,0,0.07)" : "rgba(245,180,0,0.03)"}`,
          }}
        >
          {/* Spot number */}
          <span
            className="shrink-0 text-right font-mono"
            style={{
              width: 18,
              fontSize: 11,
              color: fullName ? "rgba(245,180,0,0.30)" : "rgba(245,180,0,0.14)",
            }}
          >
            {i + 1}
          </span>

          {/* Avatar circle */}
          <div
            className="shrink-0 rounded-full flex items-center justify-center"
            style={
              fullName
                ? {
                    width: 30,
                    height: 30,
                    background: "rgba(245,180,0,0.07)",
                    border: "1px solid rgba(245,180,0,0.2)",
                  }
                : {
                    width: 30,
                    height: 30,
                    background: "rgba(245,180,0,0.02)",
                    border: "1px solid rgba(245,180,0,0.06)",
                  }
            }
          >
            {fullName && (
              <span
                className="font-semibold"
                style={{ fontSize: 10, color: ACCENT }}
              >
                {initials(fullName)}
              </span>
            )}
          </div>

          {/* Nombre completo */}
          {fullName ? (
            <span className="text-sm" style={{ color: "#d4d4d8" }}>
              {fullName}
            </span>
          ) : (
            <span style={{ fontSize: 13, color: "rgba(245,180,0,0.22)" }}>
              — disponible
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
