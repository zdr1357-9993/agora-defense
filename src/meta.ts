// 고민방(방치·탭) + 철학자 카드 뽑기 + 도구 뽑기
import { PHILOSOPHERS } from './data';
import { ITEMS } from './items';
import type { Progress } from './save';

export const QA_GONOE = 100000;

// ---------- 고민방 ----------
export const IDLE_PER_SEC = 0.5;
export const IDLE_CAP_HOURS = 8;
export const tapGain = (p: Progress) => 1 + p.tapLevel;
export const tapUpgradeCost = (p: Progress) => Math.round(50 * 1.6 ** p.tapLevel);

/** 지난번 계산 이후 쌓인 방치 고뇌를 정산하고 얼마 들어왔는지 돌려줌 */
export function settleIdle(p: Progress, now = Date.now()) {
  const sec = Math.min((now - p.idleAt) / 1000, IDLE_CAP_HOURS * 3600);
  const gain = Math.floor(sec * IDLE_PER_SEC * (1 + p.cleared.length * 0.5));
  if (gain > 0) { p.gonoe += gain; p.idleAt = now; }
  return gain;
}

/** 전투 보상 */
export const battleReward = (wave: number, win: boolean) => wave * 15 + (win ? 300 : 0);

// ---------- 뽑기 ----------
export const CARD_COST = 100, CARD_COST_10 = 900;
export const TOOL_COST = 150, TOOL_COST_10 = 1350;

/** 철학자 카드 등급 확률 (5·6성 카드도 뽑을 수 있음, 히든 제외) */
export const CARD_RATES = [
  { tier: 1, rate: 0.45 }, { tier: 2, rate: 0.28 }, { tier: 3, rate: 0.15 },
  { tier: 4, rate: 0.08 }, { tier: 5, rate: 0.035 }, { tier: 6, rate: 0.005 },
];

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export function drawCard(): string {
  let r = Math.random(), tier = 1;
  for (const c of CARD_RATES) { if (r < c.rate) { tier = c.tier; break; } r -= c.rate; }
  return pick(PHILOSOPHERS.filter((p) => p.tier === tier && !p.hidden)).id;
}

export function drawTool(): string { return pick(ITEMS).id; }

export function pull(p: Progress, kind: 'card' | 'tool', times: 1 | 10): string[] | null {
  const cost = kind === 'card' ? (times === 1 ? CARD_COST : CARD_COST_10) : (times === 1 ? TOOL_COST : TOOL_COST_10);
  if (p.gonoe < cost) return null;
  p.gonoe -= cost;
  const got: string[] = [];
  for (let i = 0; i < times; i++) {
    const id = kind === 'card' ? drawCard() : drawTool();
    got.push(id);
    const bag = kind === 'card' ? p.cards : p.items;
    bag[id] = (bag[id] ?? 0) + 1;
    if (kind === 'card' && !p.seen.includes(id)) p.seen.push(id);
  }
  return got;
}
