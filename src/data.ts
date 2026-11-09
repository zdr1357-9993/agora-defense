import philosophersJson from './data/philosophers.json';
import recipesJson from './data/recipes.json';
import catalystsJson from './data/catalysts.json';
import stagesJson from './data/stages.json';
import ratesJson from './data/rates.json';
import combatJson from './data/combat.json';

export interface Philosopher {
  /** 표시 이름 (오마주 이름 적용) / realName: 내부 키로 쓰는 실제 이름 */
  id: string; name: string; realName: string; tier: number; era: string; school: string;
  quote: string; skill: string; skillDesc: string; lore: string; hidden: boolean;
}
export interface Recipe { id: string; result: string; materials: string[]; catalyst: string | null; logic: string }
export interface Stage {
  id: string; era: string; name: string; unlockAfter: string | null;
  enemyEarly: string; enemyLate: string; boss10: string; boss20: string; counter: string; story: string;
}

import { SKILLS, describe } from './skills';

/**
 * 오마주 이름: 저작권 보호기간이 남은(1963년 이후 사망) 인물은 이름을 비틀어 표시한다.
 * 내부 로직(스킬·도트·도구 주인·조합식 ID)은 realName/ID 기준이라 여기만 바꾸면 된다.
 */
export const HOMAGE: Record<string, [string, string]> = {
  '마르틴 하이데거': ['마르틴 로우데거', '로우데거'],
  '장 폴 사르트르': ['장 폴 사리티리', '사리티리'],
  '자크 데리다': ['자크 디리타', '디리타'],
  '미셸 푸코': ['미셸 포쿠', '포쿠'],
  '자크 라캉': ['자크 로캉', '로캉'],
  '한나 아렌트': ['한나 아란트', '아란트'],
  '질 들뢰즈': ['질 들로즈', '들로즈'],
  '에마뉘엘 레비나스': ['에마뉘엘 리비나스', '리비나스'],
  '테오도어 아도르노': ['테오도어 아도로노', '아도로노'],
  '버트런드 러셀': ['버트런드 러설', '러설'],
};
const SHORT_REAL: Record<string, string> = {
  '마르틴 하이데거': '하이데거', '장 폴 사르트르': '사르트르', '자크 데리다': '데리다', '미셸 푸코': '푸코', '자크 라캉': '라캉',
  '한나 아렌트': '아렌트', '질 들뢰즈': '들뢰즈', '에마뉘엘 레비나스': '레비나스', '테오도어 아도르노': '아도르노', '버트런드 러셀': '러셀',
};
/** 본문 속 실제 이름을 오마주 이름으로 */
export function homage(text: string) {
  let s = text ?? '';
  for (const [real, [full, short]] of Object.entries(HOMAGE)) s = s.split(real).join(full).split(SHORT_REAL[real]).join(short);
  return s;
}

// 스킬 설명은 실제로 작동하는 효과(skills.ts)에서 자동 생성
export const PHILOSOPHERS = (philosophersJson as Philosopher[]).map((p) => ({
  ...p,
  realName: p.name,
  name: HOMAGE[p.name]?.[0] ?? p.name,
  quote: homage(p.quote),
  lore: homage(p.lore),
  skillDesc: describe(SKILLS[p.name]) || p.skillDesc,
}));
export const RECIPES = (recipesJson as Recipe[]).map((r) => ({ ...r, logic: homage(r.logic) }));
export const STAGES = stagesJson as Stage[];
export const CATALYSTS = catalystsJson as { id: string; name: string }[];
/** 소환 시 등급별 확률 (엑셀 Rates 시트) */
export const SUMMON_RATES = ratesJson as { tier: number; rate: number }[];
export const PHIL = new Map(PHILOSOPHERS.map((p) => [p.id, p]));
export const CAT_ICON: Record<string, string> = { C001: '🔥', C002: '💎', C003: '🌀', C004: '⚙️', C005: '🪞' };
export const CAT_NAME: Record<string, string> = Object.fromEntries(CATALYSTS.map((c) => [c.id, c.name.replace(/^\S*\s/, '').trim()]));
export const ERA_ICON: Record<string, string> = { 고대: '🏛', 중세: '⛪', 동양: '🏯', 근대: '⚙️', 근현대: '📻', 현대: '🌐', 히든: '✨' };
/** 등급 이름 (1 흔함 ~ 7 근원). 흔함만 소환되고 그 위는 전부 조합으로 만든다 */
export const TIER_NAME = ['', '흔함', '안흔함', '특별', '희귀', '전설', '거장', '근원'];
export const MAX_TIER = 7;

/** 캐릭터별 공격 프로필 (엑셀 Combat 시트) */
export interface Combat { id: string; type: '단일' | '광역' | '연쇄' | '제어' | '지원' | '저격'; range: number; speed: number; power: number; target: '선두' | '강한 적' | '약한 적' | '보스'; note: string }
export const COMBAT = new Map((combatJson as Combat[]).map((c) => [c.id, c]));
export const TYPE_ICON: Record<string, string> = { 단일: '🎯', 광역: '💥', 연쇄: '⚡', 제어: '🌀', 지원: '✨', 저격: '🏹' };
/** 철학자의 실제 전투 수치: 등급 기본 피해 × 위력, 사거리·속도는 개인 프로필 */
export function statsOf(id: string) {
  const p = PHIL.get(id)!, c = COMBAT.get(id), base = TIER_STATS[p.tier]!;
  return { dmg: base.dmg * (c?.power ?? 1), range: c?.range ?? base.range, cooldown: c ? 1 / c.speed : base.cooldown, type: c?.type ?? '단일', target: c?.target ?? '선두', note: c?.note ?? '' };
}


// 등급별 기본 전투 수치 (밸런스는 여기서 조정)
export const TIER_STATS = [
  null,
  { dmg: 10, range: 1.6, cooldown: 0.8 },   // 흔함
  { dmg: 26, range: 1.8, cooldown: 0.75 },  // 안흔함
  { dmg: 65, range: 2.0, cooldown: 0.7 },   // 특별
  { dmg: 160, range: 2.2, cooldown: 0.65 }, // 희귀
  { dmg: 400, range: 2.5, cooldown: 0.6 },  // 전설
  { dmg: 1000, range: 2.8, cooldown: 0.55 },// 거장
  { dmg: 2500, range: 3.1, cooldown: 0.5 }, // 근원
] as const;

/** 전설 이상 강화: 단계당 공격력 +35%, 최대 5단계 */
export const UPGRADE = { maxLevel: 5, perLevel: 0.35, minTier: 5, baseCost: [0, 0, 0, 0, 0, 200, 400, 900] };
/** 스테이지 카운터가 보스에게 주는 배율 */
export const COUNTER_MULT = 3;
