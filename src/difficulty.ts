// 난이도: 스테이지마다 앞 단계를 깨면 다음 단계가 열린다. ???는 불멸 클리어 후 챌린지 모드
export interface Difficulty { id: string; name: string; icon: string; hp: number; speed: number; lives: number; reward: number; maxWave: number; goalWave?: number; color: string }

export const DIFFICULTIES: Difficulty[] = [
  { id: 'easy', name: '쉬움', icon: '🌱', hp: 0.45, speed: 0.9, lives: 40, reward: 1, maxWave: 20, color: '#a7ecd2' },
  { id: 'normal', name: '보통', icon: '📘', hp: 0.75, speed: 1, lives: 30, reward: 1.5, maxWave: 20, color: '#a9d8ff' },
  { id: 'hard', name: '어려움', icon: '🔥', hp: 1.3, speed: 1.05, lives: 20, reward: 2, maxWave: 20, color: '#ffc46b' },
  { id: 'immortal', name: '불멸', icon: '💀', hp: 2.2, speed: 1.15, lives: 12, reward: 3, maxWave: 20, color: '#ff8f8f' },
  // 챌린지: 목표 450웨이브 (현재 20웨이브까지 구현)
  { id: 'challenge', name: '???', icon: '❓', hp: 3.5, speed: 1.25, lives: 6, reward: 4, maxWave: 20, goalWave: 450, color: '#c7a6ff' },
];
export const DIFF = new Map(DIFFICULTIES.map((d) => [d.id, d]));
export const clearKey = (stageId: string, diffId: string) => `${stageId}:${diffId}`;
