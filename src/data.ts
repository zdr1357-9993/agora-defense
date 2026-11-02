import philosophersJson from './data/philosophers.json';
import recipesJson from './data/recipes.json';
import catalystsJson from './data/catalysts.json';
import stagesJson from './data/stages.json';

export interface Philosopher {
  id: string; name: string; tier: number; era: string; school: string;
  quote: string; skill: string; skillDesc: string; lore: string; hidden: boolean;
}
export interface Recipe { id: string; result: string; materials: string[]; catalyst: string | null; logic: string }
export interface Stage {
  id: string; era: string; name: string; unlockAfter: string | null;
  enemyEarly: string; enemyLate: string; boss10: string; boss20: string; counter: string; story: string;
}

export const PHILOSOPHERS = philosophersJson as Philosopher[];
export const RECIPES = recipesJson as Recipe[];
export const STAGES = stagesJson as Stage[];
export const CATALYSTS = catalystsJson as { id: string; name: string }[];
export const PHIL = new Map(PHILOSOPHERS.map((p) => [p.id, p]));
export const CAT_ICON: Record<string, string> = Object.fromEntries(CATALYSTS.map((c) => [c.id, c.name.split(' ')[0]]));
export const ERAS = ['고대', '중세', '동양', '근대', '현대'];
export const ERA_ICON: Record<string, string> = { 고대: '🏛', 중세: '⛪', 동양: '🏯', 근대: '⚙️', 현대: '📡', 히든: '✨' };

// 등급별 기본 전투 수치 (밸런스는 여기서 조정)
export const TIER_STATS = [
  null,
  { dmg: 10, range: 1.6, cooldown: 0.8 },
  { dmg: 30, range: 1.8, cooldown: 0.75 },
  { dmg: 80, range: 2.0, cooldown: 0.7 },
  { dmg: 200, range: 2.3, cooldown: 0.65 },
  { dmg: 520, range: 2.6, cooldown: 0.6 },
] as const;

/** 원정 페널티(현지 철학자와 대화하지 않을 때) */
export const EXPEDITION_MULT = 0.6;
/** 스테이지 5성 카운터가 보스에게 주는 배율 */
export const COUNTER_MULT = 3;
