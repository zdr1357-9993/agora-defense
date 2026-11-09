import type { Progress } from './save';
export const canWearSkin = (tier: number) => tier >= 6;
/** Reapplying admin visibility never increments an existing card or grants a clear. */
export function revealAdminCollection(progress: Progress, ids: string[]) {
  let changed = false;
  for (const id of ids) {
    if (!progress.seen.includes(id)) { progress.seen.push(id); changed = true; }
    if (!(progress.cards[id] > 0)) { progress.cards[id] = 1; changed = true; }
  }
  return changed;
}

/** The contemporary expansion opens after Hard clears in the five earlier maps.
 * S6 is intentionally excluded so the unlock never requires clearing itself. */
export const MODERN_PREREQUISITES = ['S1','S2','S3','S4','S5'] as const;
export function modernUnlockStatus(cleared: readonly string[]) {
  const missing = MODERN_PREREQUISITES.filter(id => !cleared.includes(`${id}:hard`));
  return { unlocked: missing.length === 0, completed: MODERN_PREREQUISITES.length - missing.length, total: MODERN_PREREQUISITES.length, missing };
}
