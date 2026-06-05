/**
 * @duplicated apps/user/src/lib/occupancy.ts
 *       mover a packages/utils cuando se cree el package compartido
 *       require: turbo.json, pnpm-workspace.yaml, tsconfig de readonly y user.
 *
 * Sistema de color por ocupación.
 *
 * Lógica: intensidad INVERSA al llenado.
 * Más cupos disponibles -> más brillo -< guía indirecta al usuario.
 * A partir del ~67 % empieza a atenuarse; lleno = muy apagado.
 *
 * Umbrales (% de ocupación):
 *   < 67 %  → plena intensidad  (#F5B400)
 *   67–80 % → leve fade         (0.78)
 *   80–93 % → fade moderado     (0.58)
 *   93–99 % → claramente opaco  (0.40)
 *   100 %   → muted             (0.28)
 */
export const ACCENT = "#F5B400";
const STEPS = [
  { threshold: 100, alpha: 0.28 },
  { threshold: 93, alpha: 0.4 },
  { threshold: 80, alpha: 0.58 },
  { threshold: 67, alpha: 0.78 },
] as const;
/** Devuelve `rgba(245,180,0, α)` según % de ocupación. α = 1 cuando pct < 67. */
export function accentByOccupancy(pct: number): string {
  const clamped = Math.min(pct, 100);
  for (const { threshold, alpha } of STEPS) {
    if (clamped >= threshold) return `rgba(245,180,0,${alpha})`;
  }
  return ACCENT; // < 67 % -> plena intensidad
}
/** Calcula el porcentaje de ocupación (0–100, clampeado). */
export function fillPct(taken: number, totalSpots: number): number {
  return Math.min((taken / totalSpots) * 100, 100);
}
