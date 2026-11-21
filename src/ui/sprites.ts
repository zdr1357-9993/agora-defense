import { PHIL } from '../data';
import { skinnedSprite, monsterSprite2, itemSprite } from '../sprites';
import { canWearSkin } from '../ui-policy';
import { progress } from '../state/progress';

/** 도트 → dataURL 캐시 (스킨을 바꾸면 clear 한다). main.ts 에서 분리, 동작 동일 */
export const spriteUrl = new Map<string, string>();
export const itemUrl = (id: string) => itemSprite(id).toDataURL();
/** 착용 스킨이 반영된 도트 */
export const spriteFor = (id: string) => skinnedSprite(PHIL.get(id)!, canWearSkin(PHIL.get(id)!.tier) ? progress?.skinOn?.[id] : undefined);
const monUrl = new Map<string, string>();
export const monsterUrl = (era: string, k: 'normal' | 'fast' | 'tank' | 'swarm' | 'boss') => { const key = era + k; if (!monUrl.has(key)) monUrl.set(key, monsterSprite2(era, k).toDataURL()); return monUrl.get(key)!; };
export const portrait = (id: string) => {
  const key = id + (progress?.skinOn?.[id] ?? '');
  if (!spriteUrl.has(key)) spriteUrl.set(key, spriteFor(id).toDataURL());
  return spriteUrl.get(key)!;
};

