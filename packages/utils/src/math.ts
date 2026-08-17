export function seededRand(seed: number): number {
  const x = Math.sin(seed + 1.618) * 10000;
  return x - Math.floor(x);
}