// 이전 버전(code_artifact.html)의 24x24 픽셀 도트 생성기를 이식.
// 시대별 복장 + 인물별 시그니처(소크라테스 대머리, 니체 콧수염, 디오게네스 통 등)
import type { Philosopher } from './data';

export const TIER_AURA = ['', '#64748b', '#38bdf8', '#a855f7', '#f59e0b', '#ef4444', '#e879f9'];

type Px = (x: number, y: number, w: number, h: number, c: string) => void;

/** 도트 후처리: 위쪽 하이라이트 · 아래/오른쪽 음영 · 스티커 외곽선 → 2배 해상도로 출력 */
function polish(src: HTMLCanvasElement, outline = [59, 42, 30]): HTMLCanvasElement {
  const n = src.width;
  const sctx = src.getContext('2d')!;
  const img = sctx.getImageData(0, 0, n, n), d = img.data;
  const A = (x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n && d[(y * n + x) * 4 + 3] > 0;
  const out = new ImageData(n, n);
  const o = out.data;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = (y * n + x) * 4;
    if (A(x, y)) {
      let k = 1;
      if (!A(x, y - 1)) k = 1.18;                       // 윗면 하이라이트
      else if (!A(x, y + 1) || !A(x + 1, y)) k = 0.8;   // 아랫면·오른쪽 음영
      o[i] = Math.min(255, d[i] * k); o[i + 1] = Math.min(255, d[i + 1] * k); o[i + 2] = Math.min(255, d[i + 2] * k); o[i + 3] = 255;
    } else if (A(x - 1, y) || A(x + 1, y) || A(x, y - 1) || A(x, y + 1)) {
      o[i] = outline[0]; o[i + 1] = outline[1]; o[i + 2] = outline[2]; o[i + 3] = 255;
    }
  }
  const tmp = document.createElement('canvas');
  tmp.width = tmp.height = n;
  tmp.getContext('2d')!.putImageData(out, 0, 0);
  // 2배 확대(선명한 픽셀) 후 1px 반짝이 점
  const big = document.createElement('canvas');
  big.width = big.height = n * 2;
  const b = big.getContext('2d')!;
  b.imageSmoothingEnabled = false;
  b.drawImage(tmp, 0, 0, n * 2, n * 2);
  return big;
}

function makeSprite(draw: (px: Px) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 26;
  const ctx = c.getContext('2d')!;
  ctx.translate(1, 1); // 외곽선 여백
  draw((x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); });
  return polish(c);
}

const cache = new Map<string, HTMLCanvasElement>();

export function philosopherSprite(p: Philosopher): HTMLCanvasElement {
  const hit = cache.get(p.id);
  if (hit) return hit;
  const n = parseInt(p.id.slice(1), 10);
  const is = (...names: string[]) => names.includes(p.realName ?? p.name);

  const sprite = makeSprite((px) => {
    px(5, 21, 14, 2, TIER_AURA[p.tier]);
    if (p.tier >= 4) px(3, 20, 18, 1, p.tier === 6 ? '#22d3ee' : p.tier === 5 ? '#f43f5e' : '#fbbf24');
    if (p.tier === 6) { px(2, 19, 20, 1, '#fde047'); px(1, 4, 1, 2, '#e879f9'); px(22, 6, 1, 2, '#22d3ee'); px(2, 1, 1, 1, '#fde047'); }

    const skin = ['#fde68a', '#fed7aa', '#fbcfe8', '#fef08a'][n % 4];
    let robe = '#f1f5f9', trim = '#38bdf8';
    if (p.era === '중세') { robe = '#78350f'; trim = '#fbbf24'; }
    else if (p.era === '근대') { robe = ['#1e3a8a', '#7f1d1d', '#14532d', '#312e81', '#4c1d95'][n % 5]; trim = '#fde047'; }
    else if (p.era === '현대') { robe = ['#18181b', '#334155', '#3f3f46', '#1e1b4b'][n % 4]; trim = '#e2e8f0'; }
    const east = p.era === '동양';
    const islam = p.school === '이슬람철학' || is('마이모니데스');
    if (east && !['도가', '불교'].includes(p.school)) { robe = n % 2 ? '#1e3a5f' : '#e7e5e4'; trim = '#0f172a'; }
    if (p.school === '도가') { robe = '#d6d3d1'; trim = '#57534e'; }
    if (is('예수')) {
      px(7, 1, 10, 1, '#fde047'); px(6, 2, 1, 1, '#fde047'); px(17, 2, 1, 1, '#fde047');
      px(7, 4, 10, 2, '#78350f'); px(7, 5, 2, 8, '#78350f'); px(15, 5, 2, 8, '#78350f'); px(9, 11, 6, 3, '#78350f');
    } else if (is('바울')) {
      px(8, 5, 8, 1, skin); px(7, 6, 1, 3, '#57534e'); px(16, 6, 1, 3, '#57534e'); px(8, 11, 8, 4, '#57534e');
    } else if (is('힐데가르트 폰 빙엔')) {
      px(6, 3, 12, 3, '#0f172a'); px(6, 5, 2, 9, '#0f172a'); px(16, 5, 2, 9, '#0f172a'); px(8, 5, 8, 1, '#f8fafc');
    } else if (islam) {
      px(7, 2, 10, 4, '#f8fafc'); px(8, 3, 8, 1, '#cbd5e1'); px(9, 11, 6, 3, '#1c1917'); px(10, 14, 4, 1, '#1c1917');
    } else if (p.school === '불교') { robe = '#ea580c'; trim = '#9a3412'; }
    if (islam) { robe = n % 2 ? '#065f46' : '#f5f5f4'; trim = '#ca8a04'; }
    if (is('힐데가르트 폰 빙엔')) { robe = '#0f172a'; trim = '#f8fafc'; }
    if (is('예수')) { robe = '#f8fafc'; trim = '#dc2626'; }
    if (is('바울')) { robe = '#92400e'; trim = '#f8fafc'; }
    if (is('카를 마르크스')) { robe = '#991b1b'; trim = '#ef4444'; }
    if (is('프리드리히 니체')) { robe = '#1e1b4b'; trim = '#f43f5e'; }
    if (is('임마누엘 칸트')) { robe = '#1d4ed8'; trim = '#fbbf24'; }

    // 몸통
    if (is('디오게네스')) {
      px(6, 13, 12, 8, '#92400e'); px(6, 15, 12, 1, '#451a03'); px(6, 18, 12, 1, '#451a03');
      px(9, 13, 1, 8, '#78350f'); px(14, 13, 1, 8, '#78350f');
    } else {
      px(7, 13, 10, 8, robe);
      if (east || islam || p.era === '히든' || is('힐데가르트 폰 빙엔')) { px(11, 13, 2, 8, trim); px(7, 19, 10, 1, trim); px(6, 15, 2, 5, robe); px(16, 15, 2, 5, robe); }
      else if (p.era === '고대') { px(7, 13, 4, 8, trim); px(9, 14, 6, 1, '#cbd5e1'); }
      else if (p.era === '중세') { px(11, 13, 2, 8, trim); px(9, 15, 6, 2, trim); }
      else { px(11, 13, 2, 7, '#ffffff'); px(11, 14, 2, 5, trim); px(6, 14, 2, 5, robe); px(16, 14, 2, 5, robe); }
    }

    // 얼굴과 눈
    px(8, 5, 8, 8, skin);
    px(9, 8, 2, 2, '#0f172a'); px(13, 8, 2, 2, '#0f172a'); px(8, 10, 1, 1, '#fda4af'); px(15, 10, 1, 1, '#fda4af');
    px(9, 8, 1, 1, '#ffffff'); px(13, 8, 1, 1, '#ffffff');
    if (is('바뤼흐 스피노자', '임마누엘 칸트', '에드문트 후설', '고틀로프 프레게', '장 폴 사르트르', '엠마누엘 레비나스', '에마뉘엘 레비나스', '지그문트 프로이트', '테오도어 아도르노', '니시다 기타로', '미셸 푸코')) {
      px(8, 7, 4, 3, '#38bdf8'); px(12, 7, 4, 3, '#38bdf8');
      px(9, 8, 2, 1, '#0f172a'); px(13, 8, 2, 1, '#0f172a');
    }

    // 머리와 수염
    if (is('예수')) {
      px(7, 1, 10, 1, '#fde047'); px(6, 2, 1, 1, '#fde047'); px(17, 2, 1, 1, '#fde047');
      px(7, 4, 10, 2, '#78350f'); px(7, 5, 2, 8, '#78350f'); px(15, 5, 2, 8, '#78350f'); px(9, 11, 6, 3, '#78350f');
    } else if (is('바울')) {
      px(8, 5, 8, 1, skin); px(7, 6, 1, 3, '#57534e'); px(16, 6, 1, 3, '#57534e'); px(8, 11, 8, 4, '#57534e');
    } else if (is('힐데가르트 폰 빙엔')) {
      px(6, 3, 12, 3, '#0f172a'); px(6, 5, 2, 9, '#0f172a'); px(16, 5, 2, 9, '#0f172a'); px(8, 5, 8, 1, '#f8fafc');
    } else if (islam) {
      px(7, 2, 10, 4, '#f8fafc'); px(8, 3, 8, 1, '#cbd5e1'); px(9, 11, 6, 3, '#1c1917'); px(10, 14, 4, 1, '#1c1917');
    } else if (p.school === '불교') {
      // 삭발 + 염주
      px(8, 5, 8, 1, skin);
      for (let i = 0; i < 5; i++) px(8 + i * 2, 13, 1, 1, '#78350f');
    } else if (is('퇴계 이황', '율곡 이이', '다산 정약용')) {
      // 갓 + 수염
      px(4, 5, 16, 1, '#0f172a'); px(8, 1, 8, 4, '#1e293b'); px(8, 4, 8, 1, '#0f172a');
      px(9, 11, 6, 3, '#1e293b'); px(11, 14, 2, 1, '#1e293b');
    } else if (p.school === '유학') {
      // 상투 + 유건 + 긴 수염
      px(7, 4, 10, 2, '#0f172a'); px(10, 1, 4, 3, '#0f172a');
      px(9, 11, 6, 2, '#0f172a'); px(10, 13, 4, 3, '#0f172a');
    } else if (p.school === '도가') {
      // 흰 머리 + 긴 흰 수염
      px(7, 4, 10, 2, '#f1f5f9'); px(10, 2, 4, 2, '#f1f5f9');
      px(8, 11, 8, 3, '#f8fafc'); px(9, 14, 6, 3, '#f1f5f9');
    } else if (is('소크라테스', '미셸 푸코')) {
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
    else if (is('예수')) { px(19, 9, 1, 9, '#78350f'); px(18, 9, 3, 1, '#78350f'); }
    else if (is('바울')) { px(19, 7, 1, 8, '#cbd5e1'); px(18, 14, 3, 1, '#ca8a04'); px(2, 12, 3, 5, '#fef3c7'); }
    else if (is('이븐 시나')) { px(18, 11, 4, 5, '#38bdf8'); px(19, 10, 2, 1, '#e0f2fe'); }
    else if (is('블레즈 파스칼')) { px(18, 12, 5, 4, '#a16207'); px(19, 13, 1, 1, '#fde047'); px(21, 13, 1, 1, '#fde047'); }
    else if (is('알베르 카뮈')) { px(15, 11, 5, 1, '#f5f5f4'); px(20, 11, 1, 1, '#f97316'); px(20, 8, 2, 2, '#e5e7eb'); px(1, 16, 4, 4, '#a8a29e'); }
    else if (is('지그문트 프로이트')) { px(15, 11, 5, 1, '#92400e'); px(20, 11, 1, 1, '#f97316'); px(20, 8, 2, 2, '#e5e7eb'); }
    else if (is('자크 라캉')) { px(18, 8, 4, 6, '#f0abfc'); px(19, 9, 2, 4, '#e0f2fe'); px(19, 14, 2, 3, '#a16207'); }
    else if (is('한나 아렌트')) { px(15, 11, 5, 1, '#f5f5f4'); px(20, 11, 1, 1, '#f97316'); px(20, 8, 2, 2, '#e5e7eb'); }
    else if (is('질 들뢰즈')) { px(18, 9, 1, 8, '#16a34a'); px(20, 7, 1, 10, '#16a34a'); px(22, 10, 1, 7, '#16a34a'); }
    else if (is('에마뉘엘 레비나스')) { px(18, 9, 5, 6, '#fef3c7'); px(19, 11, 1, 1, '#1c1917'); px(21, 11, 1, 1, '#1c1917'); px(20, 13, 1, 1, '#9f1239'); }
    else if (is('테오도어 아도르노')) { px(19, 7, 1, 8, '#1c1917'); px(17, 14, 3, 2, '#1c1917'); px(20, 7, 3, 1, '#1c1917'); }
    else if (is('니시다 기타로')) { px(17, 9, 6, 1, '#1c1917'); px(17, 9, 1, 6, '#1c1917'); px(22, 9, 1, 5, '#1c1917'); px(17, 15, 5, 1, '#1c1917'); }
    else if (is('루트비히 비트겐슈타인')) { px(18, 8, 4, 8, '#bae6fd'); px(19, 7, 2, 1, '#78350f'); px(19, 11, 2, 2, '#1c1917'); }
    else if (is('마르틴 하이데거')) { px(19, 8, 2, 10, '#92400e'); px(20, 7, 3, 4, '#94a3b8'); }
    else if (is('게오르크 헤겔')) { px(18, 9, 5, 6, '#a16207'); px(19, 10, 1, 1, '#fde047'); px(21, 10, 1, 1, '#fde047'); }
    else if (is('아르투어 쇼펜하우어')) { px(17, 13, 6, 4, '#f5f5f4'); px(21, 11, 3, 3, '#f5f5f4'); px(22, 12, 1, 1, '#1c1917'); }
    else if (is('쇠렌 키르케고르')) { px(19, 6, 1, 12, '#1c1917'); px(16, 6, 7, 2, '#1c1917'); }
    else if (is('고틀로프 프레게')) { px(18, 10, 5, 6, '#fef3c7'); px(19, 12, 3, 1, '#1d4ed8'); px(20, 11, 1, 3, '#1d4ed8'); }
    else if (is('버트런드 러셀')) { px(15, 11, 4, 1, '#78350f'); px(18, 10, 2, 2, '#451a03'); px(19, 7, 2, 2, '#cbd5e1'); }
    else if (is('노자')) { px(19, 8, 2, 10, '#78350f'); px(18, 7, 4, 2, '#a16207'); }
    else if (is('장자')) { px(18, 7, 2, 3, '#f472b6'); px(21, 7, 2, 3, '#f472b6'); px(20, 8, 1, 2, '#1e293b'); }
    else if (is('원효')) { px(18, 11, 5, 4, '#f5f5f4'); px(19, 12, 1, 1, '#0f172a'); px(21, 12, 1, 1, '#0f172a'); }
    else if (is('다산 정약용')) { px(19, 6, 1, 11, '#78350f'); px(17, 6, 5, 1, '#78350f'); px(18, 7, 1, 3, '#94a3b8'); px(21, 7, 1, 3, '#94a3b8'); }
    else if (p.school === '유학' || p.school === '불교') { px(18, 10, 3, 7, '#fef3c7'); px(18, 10, 3, 1, '#a16207'); px(18, 16, 3, 1, '#a16207'); }
    else if (is('자크 데리다')) { px(2, 6, 3, 3, '#a855f7'); px(19, 8, 3, 3, '#22d3ee'); }
    else { px(18, 12, 4, 5, '#fef3c7'); px(18, 12, 4, 1, '#d97706'); px(18, 16, 4, 1, '#d97706'); }
  });
  cache.set(p.id, sprite);
  return sprite;
}

// 스테이지별 몬스터: 팔레트(시대) × 실루엣(일반/후반/보스)
const STAGE_PAL: Record<string, [string, string, string]> = {
  고대: ['#581c87', '#fde68a', '#ef4444'],
  중세: ['#7f1d1d', '#fde047', '#f97316'],
  동양: ['#334155', '#f8fafc', '#22c55e'],
  근대: ['#475569', '#22d3ee', '#f59e0b'],
  현대: ['#18181b', '#f43f5e', '#a855f7'],
};
const monsterCache = new Map<string, HTMLCanvasElement>();
export function monsterSprite(era: string, kind: 'early' | 'late' | 'boss'): HTMLCanvasElement {
  const key = era + kind;
  const hit = monsterCache.get(key);
  if (hit) return hit;
  const [body, eye, accent] = STAGE_PAL[era] ?? STAGE_PAL['고대'];
  const s = makeSprite((px) => {
    if (kind === 'early') {
      px(6, 5, 12, 14, body); px(8, 8, 8, 6, '#1f2937');
      px(9, 9, 2, 2, eye); px(13, 9, 2, 2, eye); px(10, 13, 5, 2, accent);
    } else if (kind === 'late') {
      px(6, 4, 12, 16, body); px(5, 8, 14, 10, '#0f172a');
      px(8, 9, 3, 2, eye); px(13, 9, 3, 2, eye); px(11, 1, 2, 3, accent); px(19, 8, 3, 5, accent);
    } else {
      px(4, 4, 16, 16, '#18181b'); px(6, 6, 12, 12, body); px(3, 2, 3, 4, accent); px(18, 2, 3, 4, accent);
      px(8, 9, 3, 3, eye); px(13, 9, 3, 3, eye); px(8, 15, 8, 2, accent);
    }
  });
  monsterCache.set(key, s);
  return s;
}

// ---------- 장착 아이템 아이콘 (12x12) ----------
const itemCache = new Map<string, HTMLCanvasElement>();
export function itemSprite(id: string): HTMLCanvasElement {
  const hit = itemCache.get(id);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 12;
  const ctx = c.getContext('2d')!;
  const px = (x: number, y: number, w: number, h: number, col: string) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  switch (id) {
    case 'cup': px(3, 2, 6, 5, '#a3a3a3'); px(4, 3, 4, 2, '#4d7c0f'); px(5, 7, 2, 3, '#a3a3a3'); px(3, 10, 6, 1, '#a3a3a3'); break;
    case 'watch': px(3, 3, 6, 6, '#fbbf24'); px(4, 4, 4, 4, '#fff'); px(6, 5, 1, 2, '#1c1917'); px(5, 1, 2, 2, '#fbbf24'); break;
    case 'hammer': px(5, 4, 2, 8, '#92400e'); px(2, 1, 8, 3, '#94a3b8'); break;
    case 'razor': px(5, 1, 2, 6, '#e2e8f0'); px(5, 7, 2, 4, '#78350f'); break;
    case 'flybottle': px(3, 3, 6, 8, '#bae6fd'); px(4, 1, 4, 2, '#78350f'); px(5, 6, 2, 2, '#1c1917'); break;
    case 'cigar': px(1, 5, 9, 2, '#92400e'); px(10, 5, 1, 2, '#f97316'); px(9, 2, 2, 2, '#e5e7eb'); break;
    case 'pipe': px(1, 4, 6, 1, '#78350f'); px(7, 3, 3, 4, '#451a03'); px(8, 1, 2, 1, '#e5e7eb'); break;
    case 'mirror': px(3, 1, 6, 7, '#f0abfc'); px(4, 2, 4, 5, '#e0f2fe'); px(5, 8, 2, 3, '#a16207'); break;
    case 'owl': px(2, 2, 8, 9, '#a16207'); px(3, 4, 2, 2, '#fde047'); px(7, 4, 2, 2, '#fde047'); px(5, 7, 2, 1, '#f97316'); break;
    case 'lotus': px(1, 7, 10, 3, '#f9a8d4'); px(3, 4, 6, 3, '#fbcfe8'); px(5, 2, 2, 2, '#fdf2f8'); break;
    case 'skull': px(2, 2, 8, 7, '#f5f5f4'); px(3, 4, 2, 2, '#1c1917'); px(7, 4, 2, 2, '#1c1917'); px(4, 9, 4, 2, '#f5f5f4'); break;
    case 'book': px(2, 2, 8, 9, '#b45309'); px(3, 3, 6, 7, '#fef3c7'); px(5, 3, 1, 7, '#b45309'); break;
    case 'crane': px(5, 1, 1, 10, '#78350f'); px(2, 1, 8, 1, '#78350f'); px(3, 2, 1, 4, '#94a3b8'); px(8, 2, 1, 4, '#94a3b8'); break;
    case 'axe': px(5, 2, 2, 9, '#92400e'); px(6, 1, 4, 4, '#94a3b8'); break;
    case 'boulder': px(2, 3, 8, 7, '#a8a29e'); px(3, 4, 3, 2, '#d6d3d1'); px(1, 10, 10, 1, '#78716c'); break;
    case 'lantern': px(3, 2, 6, 8, '#fde047'); px(4, 3, 4, 6, '#fef9c3'); px(4, 1, 4, 1, '#1c1917'); px(4, 10, 4, 1, '#1c1917'); break;
  }
  itemCache.set(id, c);
  return c;
}

// ---------- 스킨: 기본 도트 위에 테마 색을 입히고 장신구를 얹는다 ----------
export const SKINS: Record<string, { name: string; icon: string; color: [number, number, number] }> = {
  sakura: { name: '벚꽃 산책', icon: '🌸', color: [255, 158, 203] },
  night: { name: '한밤의 사색', icon: '🌙', color: [99, 102, 241] },
  gold: { name: '황금 아고라', icon: '✨', color: [255, 200, 60] },
};
const skinCache = new Map<string, HTMLCanvasElement>();
export function skinnedSprite(p: Philosopher, skin?: string): HTMLCanvasElement {
  const base = philosopherSprite(p);
  if (!skin || !SKINS[skin]) return base;
  const key = p.id + skin;
  const hit = skinCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = base.width; c.height = base.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(base, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height), d = img.data, [tr, tg, tb] = SKINS[skin].color;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const isOutline = r < 70 && g < 55 && b < 45;
    const isSkin = r > 230 && g > 180 && b > 120 && r - b > 30;
    const isEye = r < 40 && g < 40 && b < 60;
    if (isOutline || isSkin || isEye) continue;
    const k = 0.5;
    d[i] = r * (1 - k) + tr * k; d[i + 1] = g * (1 - k) + tg * k; d[i + 2] = b * (1 - k) + tb * k;
  }
  ctx.putImageData(img, 0, 0);
  // 장신구 (2배 해상도 좌표)
  const px = (x: number, y: number, w: number, h: number, col: string) => { ctx.fillStyle = col; ctx.fillRect(x * 2, y * 2, w * 2, h * 2); };
  if (skin === 'sakura') { for (const x of [8, 11, 14, 17]) { px(x, 2, 2, 2, '#ff9ecb'); px(x + 0.5, 2.5, 1, 1, '#fff1f7'); } }
  if (skin === 'night') { px(19, 0, 4, 4, '#fde68a'); px(20, 0, 3, 3, '#6366f1'); px(3, 3, 1, 1, '#fff'); px(1, 8, 1, 1, '#fff'); }
  if (skin === 'gold') { px(8, 1, 10, 2, '#fbbf24'); px(8, 0, 2, 1, '#fbbf24'); px(12, 0, 2, 1, '#fbbf24'); px(16, 0, 2, 1, '#fbbf24'); px(12, 1, 2, 1, '#ef4444'); }
  skinCache.set(key, c);
  return c;
}
