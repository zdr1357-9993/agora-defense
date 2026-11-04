// 진행 상황 저장 (브라우저 localStorage, 실패해도 게임은 계속)
import legacyIds from './legacy_ids.json';
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
  battleTutDone?: boolean;
  /** 조합표 v2(80명) 기준 ID로 옮겼는지 */
  idv2?: boolean;
  /** 스토리(쉬움) 클리어한 스테이지 ID */
  storyCleared?: string[];
  /** 마지막 저장 시각(ms): 기기 저장과 서버 저장 중 최신을 고를 때 */
  savedAt?: number;
  /** 오프닝을 봤는지 */
  prologueDone?: boolean;
  tabTut?: string[];
  /** 최애 철학자 (고민방 주인 · 전장 하트) */
  favorite?: string;
  /** 보유 스킨 "철학자ID:테마" / 착용 중인 스킨 */
  skins: string[];
  skinOn: Record<string, string>;
  /** 최애 원툴 도전 최고 기록 (철학자별 웨이브) */
  oneToolBest: Record<string, number>;
  /** 💗 저장한 목표 조합 (조합식 ID) */
  likedRecipes?: string[];
}

const fresh = (): Progress => ({ cleared: [], seen: [], gonoe: 300, idleAt: Date.now(), cards: { T101: 1 }, items: {}, loadout: {}, tapLevel: 0, gems: 100, pity: 0, tickets: 0, purchases: [], firstClears: [], tutorialDone: false, skins: [], skinOn: {}, oneToolBest: {}, idv2: true });

/** 조합표 v2로 철학자 ID가 바뀌었다: 예전 카드·도감·장착을 새 ID로 옮긴다 (재화·클리어는 그대로) */
function migrate(p: Progress): Progress {
  if (p.idv2) return p;
  const M = legacyIds as Record<string, string>;
  const mapId = (id: string) => M[id];
  const remap = <T>(o: Record<string, T>) => { const n: Record<string, T> = {}; for (const [k, v] of Object.entries(o ?? {})) { const nk = mapId(k); if (nk) n[nk] = v; } return n; };
  p.cards = remap(p.cards);
  p.seen = (p.seen ?? []).map(mapId).filter(Boolean);
  p.loadout = remap(p.loadout);
  p.skinOn = remap(p.skinOn);
  p.oneToolBest = remap(p.oneToolBest);
  p.skins = (p.skins ?? []).map((x) => { const [id, k] = x.split(':'); return mapId(id) ? `${mapId(id)}:${k}` : ''; }).filter(Boolean);
  if (p.favorite) p.favorite = mapId(p.favorite);
  p.likedRecipes = [];
  if (!Object.keys(p.cards).length) p.cards = { T101: 1 };
  p.idv2 = true;
  return p;
}

export function hasSave() { try { return !!localStorage.getItem(KEY_OF()); } catch { return false; } }

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY_OF());
    if (raw) return migrate({ ...fresh(), ...JSON.parse(raw) });
  } catch { /* 저장소 사용 불가 */ }
  return fresh();
}

/** 저장할 때마다 불리는 훅 (서버 저장 연결용) */
let onSave: ((p: Progress) => void) | null = null;
export function setSaveHook(f: (p: Progress) => void) { onSave = f; }
export function saveProgress(p: Progress) {
  p.savedAt = Date.now();
  try { localStorage.setItem(KEY_OF(), JSON.stringify(p)); } catch { /* 무시 */ }
  onSave?.(p);
}
/** 서버에서 받은 진행 상황을 이 기기 저장에 덮어쓴다 */
export function adoptProgress(remote: Progress): Progress {
  const p = { ...loadProgress(), ...remote };
  try { localStorage.setItem(KEY_OF(), JSON.stringify(p)); } catch { /* 무시 */ }
  return p;
}

export function resetProgress() {
  try { localStorage.removeItem(KEY_OF()); } catch { /* 무시 */ }
}

// ---------- 카드 레벨 + 한계돌파(각성) ----------
/** 레벨업에 필요한 누적 카드 수: Lv.1=1장 … Lv.10=52장 */
export const LEVEL_AT = [1, 2, 4, 7, 11, 16, 22, 30, 40, 52];
export const CARD_MAX_LEVEL = LEVEL_AT.length;
export const CARD_ATK_PER_LEVEL = 0.1;
/** Lv.10 이후 카드 20장마다 각성 1단계 (최대 5) */
export const AWAKEN_EVERY = 20, AWAKEN_MAX = 5, AWAKEN_ATK = 0.15, AWAKEN_SKILL = 0.2;

export function cardLevel(count: number) {
  let lv = 0;
  for (const need of LEVEL_AT) if (count >= need) lv++;
  return lv;
}
export function awakenLevel(count: number) {
  const top = LEVEL_AT[LEVEL_AT.length - 1];
  return count < top ? 0 : Math.min(AWAKEN_MAX, Math.floor((count - top) / AWAKEN_EVERY));
}
/** 다음 성장(레벨 또는 각성)에 필요한 누적 장수, 끝이면 null */
export function nextLevelAt(count: number) {
  const lv = cardLevel(count);
  if (lv < CARD_MAX_LEVEL) return LEVEL_AT[lv];
  const aw = awakenLevel(count);
  return aw >= AWAKEN_MAX ? null : LEVEL_AT[LEVEL_AT.length - 1] + (aw + 1) * AWAKEN_EVERY;
}
/** 공격력 배율: 레벨당 +10%, 각성당 +15% */
export function cardMult(count: number) {
  const lv = cardLevel(count);
  return (lv ? 1 + CARD_ATK_PER_LEVEL * (lv - 1) : 1) + AWAKEN_ATK * awakenLevel(count);
}
