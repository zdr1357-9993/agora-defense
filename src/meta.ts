// 고민방(방치·탭) + 철학자 카드/도구 뽑기 + 상점
import { PHILOSOPHERS } from './data';
import { ITEMS } from './items';
import type { Progress } from './save';

export const QA_GONOE = 100000;
export const QA_GEMS = 10000;

// ---------- 고민방 ----------
export const IDLE_PER_SEC = 0.5;
export const IDLE_CAP_HOURS = 8;
export const tapGain = (p: Progress) => 1 + p.tapLevel;
export const tapUpgradeCost = (p: Progress) => Math.round(50 * 1.6 ** p.tapLevel);

/** 지난번 계산 이후 쌓인 방치 고뇌를 정산하고 얼마 들어왔는지 돌려줌 */
/** 가만히 둘 때 초당 고뇌: 스테이지 클리어 + 고민의 깊이(레벨당 +25%) */
export const idleRate = (p: Progress, clearedStages: number) => IDLE_PER_SEC * (1 + clearedStages * 0.5) * (1 + 0.25 * p.tapLevel);
export function settleIdle(p: Progress, clearedStages: number, now = Date.now()) {
  const sec = Math.min((now - p.idleAt) / 1000, IDLE_CAP_HOURS * 3600);
  const gain = Math.floor(sec * idleRate(p, clearedStages));
  if (gain > 0) { p.gonoe += gain; p.idleAt = now; }
  return gain;
}

/** 전투 보상 */
export const battleReward = (wave: number, win: boolean) => wave * 15 + (win ? 300 : 0);
/** 스테이지·난이도 첫 클리어 보상 지혜석 */
export const FIRST_CLEAR_GEMS = [30, 50, 80, 120, 200];

// ---------- 뽑기 ----------
export const CARD_COST = 100, CARD_COST_10 = 900;
export const TOOL_COST = 150, TOOL_COST_10 = 1350;

/** 철학자 카드 등급 확률 (히든 제외) */
export const CARD_RATES = [
  { tier: 1, rate: 0.36 }, { tier: 2, rate: 0.26 }, { tier: 3, rate: 0.18 }, { tier: 4, rate: 0.11 },
  { tier: 5, rate: 0.06 }, { tier: 6, rate: 0.025 }, { tier: 7, rate: 0.005 },
];
/** 거장 이상(6·7등급) */
export const MASTER_TIER = 6;
/** 천장: 이 횟수 안에 거장 이상이 반드시 나온다 */
export const PITY_LIMIT = 60;

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** 카드 뽑기에 나올 수 있는 철학자 (스토리에서 열린 시대만). main에서 지정 */
let cardFilter: (p: (typeof PHILOSOPHERS)[number]) => boolean = () => true;
export function setCardFilter(f: typeof cardFilter) { cardFilter = f; }
export function drawCard(minTier = 1, anyEra = false): string {
  const rates = CARD_RATES.filter((c) => c.tier >= minTier);
  let r = Math.random() * rates.reduce((a, c) => a + c.rate, 0), tier = rates[rates.length - 1].tier;
  for (const c of rates) { if (r < c.rate) { tier = c.tier; break; } r -= c.rate; }
  const all = PHILOSOPHERS.filter((p) => p.tier === tier && !p.hidden);
  const ok = anyEra ? all : all.filter(cardFilter);
  return pick(ok.length ? ok : all).id;
}
export function drawTool(): string { return pick(ITEMS).id; }

export type Currency = 'gonoe' | 'gems' | 'ticket';
export interface PullOption { id: string; kind: 'card' | 'tool' | 'master'; times: 1 | 10; currency: Currency; cost: number; label: string }
export const PULLS: PullOption[] = [
  { id: 'c1', kind: 'card', times: 1, currency: 'gonoe', cost: CARD_COST, label: '1회' },
  { id: 'c10', kind: 'card', times: 10, currency: 'gonoe', cost: CARD_COST_10, label: '10회' },
  { id: 'c10g', kind: 'card', times: 10, currency: 'gems', cost: 270, label: '10회' },
  { id: 'm10', kind: 'master', times: 10, currency: 'gems', cost: 450, label: '거장 확정 10회' },
  { id: 'm1', kind: 'master', times: 1, currency: 'ticket', cost: 1, label: '초대장 사용' },
  { id: 't1', kind: 'tool', times: 1, currency: 'gonoe', cost: TOOL_COST, label: '1회' },
  { id: 't10', kind: 'tool', times: 10, currency: 'gonoe', cost: TOOL_COST_10, label: '10회' },
  { id: 't10g', kind: 'tool', times: 10, currency: 'gems', cost: 300, label: '10회' },
];
export const CUR_ICON: Record<Currency, string> = { gonoe: '🤔', gems: '💎', ticket: '🎫' };

const wallet = (p: Progress, c: Currency) => (c === 'gonoe' ? p.gonoe : c === 'gems' ? p.gems : p.tickets);
export const canAfford = (p: Progress, o: PullOption) => wallet(p, o.currency) >= o.cost;

/** 뽑기 실행. 카드는 천장 적용, 거장 뽑기는 거장 이상 1장(10회면 마지막 장) 확정 */
export function pull(p: Progress, o: PullOption): string[] | null {
  if (!canAfford(p, o)) return null;
  if (o.currency === 'gonoe') p.gonoe -= o.cost; else if (o.currency === 'gems') p.gems -= o.cost; else p.tickets -= o.cost;
  const got: string[] = [];
  for (let i = 0; i < o.times; i++) {
    if (o.kind === 'tool') { const id = drawTool(); p.items[id] = (p.items[id] ?? 0) + 1; got.push(id); continue; }
    const guarantee = (o.kind === 'master' && i === o.times - 1) || p.pity + 1 >= PITY_LIMIT;
    // 💎·🎫(유료) 뽑기는 시대 잠금 없이 어느 시대든 나온다
    const id = drawCard(guarantee ? MASTER_TIER : 1, o.currency !== 'gonoe');
    const tier = PHILOSOPHERS.find((x) => x.id === id)!.tier;
    p.pity = tier >= MASTER_TIER ? 0 : p.pity + 1;
    p.cards[id] = (p.cards[id] ?? 0) + 1;
    if (!p.seen.includes(id)) p.seen.push(id);
    got.push(id);
  }
  return got;
}

// ---------- 상점 (프로토타입: 실제 결제 없이 지급) ----------
export interface ShopItem { id: string; name: string; price: string; desc: string; gems?: number; tickets?: number; gonoe?: number; costGems?: number; once?: boolean; tag?: string; icon: string }
export const SHOP: ShopItem[] = [
  { id: 'starter', icon: '🎁', name: '아고라 입문 패키지', price: '₩4,900', desc: '💎 300 + 🎫 거장 초대장 1장', gems: 300, tickets: 1, once: true, tag: '1회 한정' },
  { id: 'gem60', icon: '💎', name: '지혜석 한 줌', price: '₩1,200', desc: '💎 60', gems: 60 },
  { id: 'gem330', icon: '💰', name: '지혜석 주머니', price: '₩5,900', desc: '💎 300 + 보너스 30', gems: 330, tag: '인기' },
  { id: 'gem1100', icon: '🧳', name: '지혜석 상자', price: '₩19,000', desc: '💎 1,000 + 보너스 100', gems: 1100 },
  { id: 'master3', icon: '🎫', name: '거장 초대장 3장', price: '₩9,900', desc: '거장 이상 1장 확정 × 3', tickets: 3, tag: '추천' },
  { id: 'gonoe5k', icon: '🌙', name: '밤샘 고민 묶음', price: '💎 120', desc: '🤔 고뇌 5,000', gonoe: 5000, costGems: 120 },
];

/** 구매 처리 (원화 상품은 모의 결제). 성공 시 true */
export function buy(p: Progress, item: ShopItem): boolean {
  if (item.once && p.purchases.includes(item.id)) return false;
  if (item.costGems) { if (p.gems < item.costGems) return false; p.gems -= item.costGems; }
  p.gems += item.gems ?? 0;
  p.tickets += item.tickets ?? 0;
  p.gonoe += item.gonoe ?? 0;
  p.purchases.push(item.id);
  return true;
}
