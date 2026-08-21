const STEPS = [
  { threshold: 100, opacity: 0.3 },
  { threshold: 93, opacity: 0.4 },
  { threshold: 80, opacity: 0.6 },
  { threshold: 67, opacity: 0.8 },
] as const;

function getOccupancyOpacity(pct: number): number {
  const clamped = Math.min(pct, 100);

  for (const { threshold, opacity } of STEPS) {
    if (clamped >= threshold) return opacity;
  }

  return 1;
}

/** Compatibilidad temporal para los componentes de ocupación aún no migrados. */
export function accentByOccupancy(pct: number): string {
  return `rgb(0 75 133 / ${getOccupancyOpacity(pct)})`;
}

export function accentTextClassByOccupancy(pct: number): string {
  const opacity = getOccupancyOpacity(pct);
  if (opacity === 1) return "text-accent";
  if (opacity >= 0.8) return "text-accent/80";
  if (opacity >= 0.6) return "text-accent/60";
  if (opacity >= 0.4) return "text-accent/40";
  return "text-accent/30";
}

export function accentBackgroundClassByOccupancy(pct: number): string {
  const opacity = getOccupancyOpacity(pct);
  if (opacity === 1) return "bg-progress";
  if (opacity >= 0.8) return "bg-progress/80";
  if (opacity >= 0.6) return "bg-progress/60";
  if (opacity >= 0.4) return "bg-progress/40";
  return "bg-progress/30";
}

export function fillPct(taken: number, totalSpots: number): number {
  return Math.min((taken / totalSpots) * 100, 100);
}
