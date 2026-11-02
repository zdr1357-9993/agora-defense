// 진행 상황 저장 (브라우저 localStorage, 실패해도 게임은 계속)
const BASE_KEY = 'agora_progress_v3';
let account = 'guest';
/** 로그인한 계정별로 저장 칸을 나눈다 */
export function setAccount(id: string) { account = id; }
const KEY_OF = () => `${BASE_KEY}:${account}`;

export interface Progress {
  cleared: string[];
  seen: string[];
  /** 고뇌: 고민방에서 쌓는 재화 (뽑기에 사용) */
  gonoe: number;
  /** 마지막으로 방치 보상을 계산한 시각(ms) */
  idleAt: number;
  /** 철학자 카드 보유 수량 (누적될수록 레벨업) */
  cards: Record<string, number>;
  /** 도구 보유 수량 */
  items: Record<string, number>;
  /** 철학자별 장착 도구 */
  loadout: Record<string, string>;
  /** 고민방 탭 강화 단계 */
  tapLevel: number;
  /** 유료 재화 💎 지혜석 */
  gems: number;
  /** 5성 이상이 안 나온 연속 카드 뽑기 수 (천장) */
  pity: number;
  /** 거장 초대장: 5성 이상 1장 확정 */
  tickets: number;
  /** 구매 기록 / 첫 클리어 보상 기록 */
  purchases: string[];
  firstClears: string[];
  tutorialDone: boolean;
  /** 최애 철학자 (고민방 주인 · 전장 하트) */
  favorite?: string;
}

const fresh = (): Progress => ({ cleared: [], seen: [], gonoe: 300, idleAt: Date.now(), cards: { T101: 1 }, items: {}, loadout: {}, tapLevel: 0, gems: 100, pity: 0, tickets: 0, purchases: [], firstClears: [], tutorialDone: false });

export function hasSave() { try { return !!localStorage.getItem(KEY_OF()); } catch { return false; } }

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY_OF());
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch { /* 저장소 사용 불가 */ }
  return fresh();
}

export function saveProgress(p: Progress) {
  try { localStorage.setItem(KEY_OF(), JSON.stringify(p)); } catch { /* 무시 */ }
}

export function resetProgress() {
  try { localStorage.removeItem(KEY_OF()); } catch { /* 무시 */ }
}

// ---------- 카드 레벨: 1·2·4·8·16·32… 장 모일 때마다 레벨업 ----------
export const CARD_MAX_LEVEL = 10;
export const CARD_ATK_PER_LEVEL = 0.1;

export function cardLevel(count: number) {
  return count > 0 ? Math.min(CARD_MAX_LEVEL, Math.floor(Math.log2(count)) + 1) : 0;
}
export function nextLevelAt(count: number) {
  const lv = cardLevel(count);
  return lv >= CARD_MAX_LEVEL ? null : 2 ** lv;
}
/** 카드 레벨에 따른 공격력 배율 (Lv.1 = 1.0, 레벨당 +10%) */
export function cardMult(count: number) {
  const lv = cardLevel(count);
  return lv ? 1 + CARD_ATK_PER_LEVEL * (lv - 1) : 1;
}
