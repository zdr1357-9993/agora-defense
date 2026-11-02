// 이전 버전(code_artifact.html)의 24x24 픽셀 도트 생성기를 이식.
// 시대별 복장 + 인물별 시그니처(소크라테스 대머리, 니체 콧수염, 디오게네스 통 등)
import type { Philosopher } from './data';

export const TIER_AURA = ['', '#64748b', '#38bdf8', '#a855f7', '#f59e0b', '#ef4444'];

type Px = (x: number, y: number, w: number, h: number, c: string) => void;

function makeSprite(draw: (px: Px) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 24;
  const ctx = c.getContext('2d')!;
  draw((x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); });
  return c;
}

const cache = new Map<string, HTMLCanvasElement>();

export function philosopherSprite(p: Philosopher): HTMLCanvasElement {
  const hit = cache.get(p.id);
  if (hit) return hit;
  const n = parseInt(p.id.slice(1), 10);
  const is = (...names: string[]) => names.includes(p.name);

  const sprite = makeSprite((px) => {
    px(5, 21, 14, 2, TIER_AURA[p.tier]);
    if (p.tier >= 4) px(3, 20, 18, 1, p.tier === 5 ? '#f43f5e' : '#fbbf24');

    const skin = ['#fde68a', '#fed7aa', '#fbcfe8', '#fef08a'][n % 4];
    let robe = '#f1f5f9', trim = '#38bdf8';
    if (p.era === '중세') { robe = '#78350f'; trim = '#fbbf24'; }
    else if (p.era === '근대') { robe = ['#1e3a8a', '#7f1d1d', '#14532d', '#312e81', '#4c1d95'][n % 5]; trim = '#fde047'; }
    else if (p.era === '현대') { robe = ['#18181b', '#334155', '#3f3f46', '#1e1b4b'][n % 4]; trim = '#e2e8f0'; }
    if (is('카를 마르크스')) { robe = '#991b1b'; trim = '#ef4444'; }
    if (is('프리드리히 니체')) { robe = '#1e1b4b'; trim = '#f43f5e'; }
    if (is('임마누엘 칸트')) { robe = '#1d4ed8'; trim = '#fbbf24'; }

    // 몸통
    if (is('디오게네스')) {
      px(6, 13, 12, 8, '#92400e'); px(6, 15, 12, 1, '#451a03'); px(6, 18, 12, 1, '#451a03');
      px(9, 13, 1, 8, '#78350f'); px(14, 13, 1, 8, '#78350f');
    } else {
      px(7, 13, 10, 8, robe);
      if (p.era === '고대') { px(7, 13, 4, 8, trim); px(9, 14, 6, 1, '#cbd5e1'); }
      else if (p.era === '중세') { px(11, 13, 2, 8, trim); px(9, 15, 6, 2, trim); }
      else { px(11, 13, 2, 7, '#ffffff'); px(11, 14, 2, 5, trim); px(6, 14, 2, 5, robe); px(16, 14, 2, 5, robe); }
    }

    // 얼굴과 눈
    px(8, 5, 8, 8, skin);
    px(9, 8, 2, 2, '#0f172a'); px(13, 8, 2, 2, '#0f172a');
    px(9, 8, 1, 1, '#ffffff'); px(13, 8, 1, 1, '#ffffff');
    if (is('바뤼흐 스피노자', '임마누엘 칸트', '에드문트 후설', '고틀로프 프레게', '장 폴 사르트르', '엠마누엘 레비나스', '미셸 푸코')) {
      px(8, 7, 4, 3, '#38bdf8'); px(12, 7, 4, 3, '#38bdf8');
      px(9, 8, 2, 1, '#0f172a'); px(13, 8, 2, 1, '#0f172a');
    }

    // 머리와 수염
    if (is('소크라테스', '미셸 푸코')) {
      px(7, 6, 1, 3, '#cbd5e1'); px(16, 6, 1, 3, '#cbd5e1');
      if (is('소크라테스')) { px(8, 11, 8, 4, '#e2e8f0'); px(9, 15, 6, 1, '#cbd5e1'); }
    } else if (is('프리드리히 니체')) {
      px(7, 4, 10, 3, '#451a03'); px(7, 10, 10, 3, '#451a03'); px(6, 11, 12, 2, '#78350f');
    } else if (is('카를 마르크스')) {
      px(6, 4, 12, 4, '#334155'); px(6, 7, 2, 6, '#334155'); px(16, 7, 2, 6, '#334155'); px(7, 10, 10, 6, '#475569');
    } else if (is('아르투어 쇼펜하우어')) {
      px(5, 6, 3, 5, '#f8fafc'); px(16, 6, 3, 5, '#f8fafc');
    } else if (p.era === '고대') {
      const hair = n % 2 === 0 ? '#cbd5e1' : '#78350f';
      px(7, 4, 10, 2, hair); px(7, 4, 10, 1, '#22c55e'); px(8, 11, 8, 3, hair); px(9, 14, 6, 1, hair);
    } else if (p.era === '중세') {
      if (is('아우구스티누스', '안셀무스', '토마스 아퀴나스')) {
        px(8, 2, 8, 3, '#fbbf24'); px(10, 1, 4, 1, '#f59e0b'); px(11, 2, 2, 3, '#ef4444');
      } else { px(7, 5, 10, 2, '#78350f'); px(9, 4, 6, 1, skin); }
    } else if (p.era === '근대') {
      px(7, 3, 10, 3, '#f1f5f9'); px(6, 5, 2, 7, '#f1f5f9'); px(16, 5, 2, 7, '#f1f5f9');
    } else {
      const hc = ['#1e293b', '#78350f', '#94a3b8', '#e2e8f0'][n % 4];
      px(7, 4, 10, 2, hc); px(7, 5, 2, 3, hc);
    }

    // 손에 든 상징물
    if (is('탈레스')) { px(18, 10, 4, 4, '#38bdf8'); px(19, 9, 2, 6, '#0284c7'); }
    else if (is('헤라클레이토스')) { px(18, 9, 4, 5, '#ef4444'); px(19, 7, 2, 5, '#fbbf24'); }
    else if (is('피타고라스')) { px(18, 12, 5, 1, '#fbbf24'); px(19, 10, 3, 2, '#fbbf24'); px(20, 8, 1, 2, '#fbbf24'); }
    else if (is('오컴의 윌리엄')) { px(19, 8, 2, 6, '#e2e8f0'); px(19, 14, 2, 3, '#78350f'); }
    else if (is('임마누엘 칸트')) { px(18, 11, 4, 4, '#fbbf24'); px(19, 12, 2, 2, '#ffffff'); }
    else if (is('프리드리히 니체', '카를 마르크스')) { px(19, 9, 2, 9, '#92400e'); px(17, 7, 6, 3, '#94a3b8'); }
    else if (is('장 폴 사르트르')) { px(15, 11, 4, 1, '#78350f'); px(18, 10, 2, 2, '#451a03'); px(19, 7, 2, 2, '#cbd5e1'); }
    else if (is('자크 데리다')) { px(2, 6, 3, 3, '#a855f7'); px(19, 8, 3, 3, '#22d3ee'); }
    else { px(18, 12, 4, 5, '#fef3c7'); px(18, 12, 4, 1, '#d97706'); px(18, 16, 4, 1, '#d97706'); }
  });
  cache.set(p.id, sprite);
  return sprite;
}

// 웨이브 구간별 몬스터: 1~3 궤변론자, 4~6 동굴의 그림자, 7~9 이단 심문관, 10 보스
const monsterCache = new Map<string, HTMLCanvasElement>();
export function monsterSprite(wave: number, boss: boolean): HTMLCanvasElement {
  const key = boss ? (wave === 10 ? 'jury' : wave === 20 ? 'hunter' : 'boss') : wave <= 5 ? 'sophist' : wave < 10 ? 'shadow' : wave < 20 ? 'inquisitor' : 'clockwork';
  const hit = monsterCache.get(key);
  if (hit) return hit;
  const s = makeSprite((px) => {
    if (key === 'sophist') {
      px(6, 5, 12, 14, '#581c87'); px(8, 8, 8, 6, '#fde68a');
      px(9, 9, 2, 2, '#ef4444'); px(13, 9, 2, 2, '#ef4444'); px(10, 13, 5, 2, '#f43f5e');
    } else if (key === 'shadow') {
      px(6, 4, 12, 16, '#1e293b'); px(5, 8, 14, 10, '#0f172a');
      px(8, 9, 3, 2, '#38bdf8'); px(13, 9, 3, 2, '#38bdf8');
    } else if (key === 'inquisitor') {
      px(7, 3, 10, 5, '#991b1b'); px(6, 8, 12, 12, '#7f1d1d');
      px(9, 9, 2, 2, '#fde047'); px(13, 9, 2, 2, '#fde047');
      px(19, 7, 3, 5, '#f97316'); px(20, 12, 1, 6, '#78350f');
    } else if (key === 'clockwork') {
      px(7, 5, 10, 14, '#64748b'); px(8, 6, 8, 5, '#94a3b8');
      px(9, 8, 2, 2, '#22d3ee'); px(13, 8, 2, 2, '#22d3ee'); px(11, 2, 2, 3, '#f59e0b');
    } else if (key === 'jury') {
      px(3, 6, 18, 14, '#e2e8f0'); px(5, 3, 14, 4, '#94a3b8');
      px(7, 9, 3, 2, '#0f172a'); px(14, 9, 3, 2, '#0f172a'); px(18, 12, 4, 5, '#16a34a'); px(19, 11, 2, 1, '#bbf7d0');
    } else if (key === 'hunter') {
      px(6, 1, 12, 7, '#18181b'); px(4, 7, 16, 2, '#18181b'); px(6, 9, 12, 12, '#7f1d1d');
      px(8, 10, 3, 2, '#fde047'); px(13, 10, 3, 2, '#fde047'); px(19, 4, 4, 6, '#f97316'); px(20, 10, 2, 9, '#78350f');
    } else {
      px(4, 4, 16, 16, '#18181b'); px(6, 6, 12, 12, '#4c1d95');
      px(8, 9, 3, 3, '#f43f5e'); px(13, 9, 3, 3, '#f43f5e'); px(8, 15, 8, 2, '#fbbf24');
    }
  });
  monsterCache.set(key, s);
  return s;
}


