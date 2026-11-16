import { PHIL, PHILOSOPHERS } from '../data';
import { QA_MODE } from '../game';
import { STORY, CHAPTERS, START_POOL, type StoryStage } from '../story';
import { progress } from '../state/progress';
import { isAdmin } from '../state/account';

// main.ts 쪼개기 2차(RD-T038): 스토리 진행 규칙 중 화면과 무관한 것(기억 경험치·소환 풀·열린 시대)을 이동만. 동작은 그대로.
/** 난이도별 카드 기억 경험치 */
export const XP_RATE: Record<string, number> = { easy: 0.2, normal: 0.5, hard: 0.8, immortal: 1, challenge: 1 };
export function gainXp(id: string, rate: number): string {
  const xp = (progress.cardXp ??= {});
  xp[id] = (xp[id] ?? 0) + rate;
  let got = 0;
  while (xp[id] >= 1 - 1e-9) { xp[id] -= 1; got++; }
  xp[id] = Math.round(xp[id] * 100) / 100;
  if (got) { progress.cards[id] = (progress.cards[id] ?? 0) + got; if (!progress.seen.includes(id)) progress.seen.push(id); }
  const name = PHIL.get(id)!.name;
  return got ? `📈 ${name}의 기억이 또렷해졌다! 카드 +${got}장` : `📈 ${name}의 기억 +${Math.round(rate * 100)}% (${Math.round(xp[id] * 100)}%)`;
}
/** 소환되는 흔함: 그리스 여섯 명 + 스토리에서 만난 동양의 셋 */
export function summonPool(st?: StoryStage): string[] {
  if (QA_MODE) return [];
  const toIds = (names: Set<string>) => PHILOSOPHERS.filter((p) => p.tier === 1 && names.has(p.realName)).map((p) => p.id);
  if (st?.pool) return toIds(new Set(st.pool)); // 시작 튜토리얼은 판마다 정해진 철학자만
  const names = new Set(START_POOL);
  for (const st of STORY) if ((progress.storyCleared ?? []).includes(st.id)) for (const n of st.unlock ?? []) names.add(n);
  return PHILOSOPHERS.filter(p=>(p.tier===1 && names.has(p.realName)) || (p.tier>1 && (progress.cards[p.id]??0)>0)).map(p=>p.id);
}
/** 기억이 열린 시대: 지금 진행 중인 장까지 */
export function openEras(): Set<string> {
  if (isAdmin()) return new Set(PHILOSOPHERS.map(p => p.era));
  const done = progress.storyCleared ?? [];
  const next = STORY.find((s) => !done.includes(s.id));
  const upto = QA_MODE || !next ? Math.max(...CHAPTERS.map(c=>c.n)) : next.chapter;
  return new Set(CHAPTERS.filter((c) => c.n <= upto).map((c) => c.era));
}
