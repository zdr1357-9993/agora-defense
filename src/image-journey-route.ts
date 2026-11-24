/** RD-T064: normalized road centreline traced against journey-agora-v1.webp. */
export const AGORA_ROAD: readonly (readonly [number, number])[] = [
  [.50,.97],[.47,.92],[.44,.87],[.45,.83],[.46,.79],
  [.44,.76],[.40,.73],[.37,.70],[.36,.67],[.37,.65],
  [.40,.63],[.45,.61],[.51,.59],[.56,.57],[.59,.54],
  [.59,.51],[.56,.48],[.51,.46],[.46,.44],[.41,.42],
  [.36,.40],[.33,.38],[.33,.35],[.35,.32],[.40,.30],
  [.46,.28],[.52,.26],[.57,.23],[.60,.21],[.61,.19],[.62,.17],
];

export function journeyStops(count: number): number[] {
  return Array.from({ length: count }, (_, i) => count === 1 ? 4 : Math.round(4 + i * (AGORA_ROAD.length - 5) / (count - 1)));
}

/** Adjacent road samples only; never cut diagonally through scenery. */
export function roadSteps(from: number, to: number): number[] {
  if (from === to) return [];
  const direction = Math.sign(to - from);
  return Array.from({ length: Math.abs(to - from) }, (_, i) => from + direction * (i + 1));
}
