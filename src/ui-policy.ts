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
