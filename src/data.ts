import philosophersJson from './data/philosophers.json';
import recipesJson from './data/recipes.json';

export interface Philosopher {
  id: string; name: string; tier: number; era: string; school: string;
  quote: string; skill: string; skillDesc: string; lore: string;
}
export interface Recipe {
  id: string; result: string; materials: string[]; catalyst: string | null; logic: string;
}

export const PHILOSOPHERS = philosophersJson as Philosopher[];
export const RECIPES = recipesJson as Recipe[];
export const PHIL = new Map(PHILOSOPHERS.map((p) => [p.id, p]));

// 등급별 기본 전투 수치 (밸런스는 여기서 조정)
export const TIER_STATS = [
  null,
  { dmg: 10, range: 1.6, cooldown: 0.8 },
  { dmg: 30, range: 1.8, cooldown: 0.75 },
  { dmg: 80, range: 2.0, cooldown: 0.7 },
  { dmg: 200, range: 2.3, cooldown: 0.65 },
  { dmg: 500, range: 2.6, cooldown: 0.6 },
] as const;

export const TIER_COLORS = ['', '#64748b', '#0284c7', '#9333ea', '#d97706', '#dc2626'];
