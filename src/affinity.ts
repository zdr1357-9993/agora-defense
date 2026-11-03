// 고향 보너스: 스테이지의 시대 철학자는 +25%, 그 스테이지의 핵심 인물은 +60%
// 키는 실제 이름(realName). 수치와 명단은 여기서 조정.
export const ERA_BONUS = 0.25;
export const STAR_BONUS = 0.6;

export const STAGE_STARS: Record<string, string[]> = {
  S1: ['광장의 소크라테스', '플라톤', '아리스토텔레스'],
  S2: ['아우구스티누스', '오컴의 윌리엄', '바울'],
  S3: ['대성지성 공자', '노자', '장자'],
  S4: ['임마누엘 칸트', '데이비드 흄', '르네 데카르트'],
  S5: ['루트비히 비트겐슈타인', '고틀로프 프레게', '자크 데리다'],
};

/** 스테이지 시대와 철학자 도트 시대가 맞는지 (현대 스테이지는 현대 인물) */
export function homeBonus(stageId: string, stageEra: string, realName: string, philEra: string): { mult: number; kind: '' | 'era' | 'star' } {
  if (STAGE_STARS[stageId]?.includes(realName)) return { mult: 1 + STAR_BONUS, kind: 'star' };
  if (philEra === stageEra) return { mult: 1 + ERA_BONUS, kind: 'era' };
  return { mult: 1, kind: '' };
}
