import philosophersJson from './data/philosophers.json';
import recipesJson from './data/recipes.json';
import catalystsJson from './data/catalysts.json';
import stagesJson from './data/stages.json';
import ratesJson from './data/rates.json';

export interface Philosopher {
  id: string; name: string; tier: number; era: string; school: string;
  quote: string; skill: string; skillDesc: string; lore: string; hidden: boolean;
}
export interface Recipe { id: string; result: string; materials: string[]; catalyst: string | null; logic: string }
export interface Stage {
  id: string; era: string; name: string; unlockAfter: string | null;
  enemyEarly: string; enemyLate: string; boss10: string; boss20: string; counter: string; story: string;
}

import { SKILLS, describe } from './skills';
// 스킬 설명은 실제로 작동하는 효과(skills.ts)에서 자동 생성
export const PHILOSOPHERS = (philosophersJson as Philosopher[]).map((p) => ({ ...p, skillDesc: describe(SKILLS[p.name]) || p.skillDesc }));
export const RECIPES = recipesJson as Recipe[];
export const STAGES = stagesJson as Stage[];
export const CATALYSTS = catalystsJson as { id: string; name: string }[];
/** 소환 시 등급별 확률 (엑셀 Rates 시트) */
export const SUMMON_RATES = ratesJson as { tier: number; rate: number }[];
export const PHIL = new Map(PHILOSOPHERS.map((p) => [p.id, p]));
export const CAT_ICON: Record<string, string> = Object.fromEntries(CATALYSTS.map((c) => [c.id, c.name.split(' ')[0]]));
export const ERA_ICON: Record<string, string> = { 고대: '🏛', 중세: '⛪', 동양: '🏯', 근대: '⚙️', 현대: '📡', 히든: '✨' };
export const TIER_NAME = ['', '사유', '학파', '전통', '전환', '거장', '근원'];

/** 같은 등급 3명 무작위 합성이 가능한 최고 등급 (3성 ×3 → 4성까지) */
export const MAX_MERGE_TIER = 3;

// 등급별 기본 전투 수치 (밸런스는 여기서 조정)
export const TIER_STATS = [
  null,
  { dmg: 10, range: 1.6, cooldown: 0.8 },
  { dmg: 28, range: 1.8, cooldown: 0.75 },
  { dmg: 75, range: 2.0, cooldown: 0.7 },
  { dmg: 190, range: 2.3, cooldown: 0.65 },
  { dmg: 560, range: 2.7, cooldown: 0.6 },
  { dmg: 1500, range: 3.1, cooldown: 0.5 },
] as const;

/** 5성 이상 강화: 단계당 공격력 +35%, 최대 5단계 */
export const UPGRADE = { maxLevel: 5, perLevel: 0.35, baseCost: [0, 0, 0, 0, 0, 300, 800] };
/** 스테이지 카운터가 보스에게 주는 배율 */
export const COUNTER_MULT = 3;
