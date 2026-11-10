/** Spotlight the first best result; preserve draw order and duplicate cards. */
export function gachaLayout(tiers: readonly number[], isTool = false) {
  const top = tiers.length ? Math.max(...tiers) : 0;
  const hero = !isTool && top >= 5 ? tiers.indexOf(top) : -1;
  return { top, hero, rest: tiers.map((_, i) => i).filter(i => i !== hero) };
}
