import { artImage, ERA_ART, eraArtUrl } from './artwork';
// TCG 카드 삽화: 시대별 배경 장면 + 기존 도트 캐릭터를 크게 얹어 카드 그림을 만든다
import type { Philosopher } from './data';

const W = 300, H = 230;
const cache = new Map<string, string>();

function rng(seed: number) {
  let s = seed || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function cloud(c: CanvasRenderingContext2D, x: number, y: number, s: number, col = 'rgba(255,255,255,.85)') {
  c.fillStyle = col;
  c.beginPath();
  c.arc(x, y, 12 * s, 0, 7); c.arc(x + 14 * s, y - 6 * s, 15 * s, 0, 7); c.arc(x + 30 * s, y, 11 * s, 0, 7);
  c.fill();
  c.fillRect(x, y, 30 * s, 11 * s);
}

function sparkle(c: CanvasRenderingContext2D, x: number, y: number, r: number, col: string) {
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r);
  c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r);
  c.fill();
}

function sky(c: CanvasRenderingContext2D, a: string, b: string) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, a); g.addColorStop(1, b);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}

const SCENES: Record<string, (c: CanvasRenderingContext2D, r: () => number) => void> = {
  고대(c, r) {
    sky(c, '#9fd4ff', '#fff4dc');
    c.fillStyle = '#ffe28a'; c.beginPath(); c.arc(240, 48, 26, 0, 7); c.fill();
    cloud(c, 30, 40, 1); cloud(c, 170, 70, 0.7);
    // 신전
    c.fillStyle = '#f3ead6'; c.beginPath(); c.moveTo(20, 120); c.lineTo(110, 92); c.lineTo(200, 120); c.fill();
    c.fillStyle = '#e8dcc0'; c.fillRect(24, 120, 172, 8);
    for (let i = 0; i < 6; i++) { c.fillStyle = '#fbf6ea'; c.fillRect(32 + i * 28, 128, 12, 62); c.fillStyle = '#e2d4b4'; c.fillRect(40 + i * 28, 128, 3, 62); }
    c.fillStyle = '#e8dcc0'; c.fillRect(18, 188, 184, 8);
    // 올리브 가지
    c.strokeStyle = '#7aa05a'; c.lineWidth = 3; c.beginPath(); c.moveTo(300, 150); c.quadraticCurveTo(250, 140, 225, 170); c.stroke();
    c.fillStyle = '#9cc47a'; for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(285 - i * 11, 148 + i * 3, 7, 3, -0.5, 0, 7); c.fill(); }
  },
  중세(c, r) {
    sky(c, '#b7a6e6', '#f3e8ff');
    // 장미창
    const cx = 150, cy = 80;
    c.fillStyle = '#7c5cbf'; c.beginPath(); c.arc(cx, cy, 58, 0, 7); c.fill();
    const cols = ['#fca5a5', '#93c5fd', '#fde68a', '#86efac', '#f0abfc', '#a5b4fc'];
    for (let i = 0; i < 12; i++) {
      c.fillStyle = cols[i % cols.length];
      c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, 52, (i / 12) * 6.283, ((i + 1) / 12) * 6.283); c.fill();
    }
    c.strokeStyle = '#5b3f99'; c.lineWidth = 3;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * 52, cy + Math.sin(a) * 52); c.stroke(); }
    c.fillStyle = '#fff7d6'; c.beginPath(); c.arc(cx, cy, 14, 0, 7); c.fill();
    // 아치 기둥
    c.fillStyle = '#d8ccef'; c.fillRect(0, 0, 40, H); c.fillRect(W - 40, 0, 40, H);
    // 촛불
    for (const x of [62, 238]) {
      c.fillStyle = '#fffbeb'; c.fillRect(x - 5, 160, 10, 34);
      c.fillStyle = '#fbbf24'; c.beginPath(); c.ellipse(x, 152, 5, 9, 0, 0, 7); c.fill();
      c.fillStyle = 'rgba(253,230,138,.35)'; c.beginPath(); c.arc(x, 152, 20, 0, 7); c.fill();
    }
  },
  동양(c, r) {
    sky(c, '#e6f4d4', '#fff8e6');
    c.fillStyle = '#ff8a7a'; c.beginPath(); c.arc(220, 62, 30, 0, 7); c.fill();
    // 수묵 산
    const mount = (base: number, col: string, peaks: number[]) => {
      c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
      peaks.forEach((p, i) => c.lineTo((i / (peaks.length - 1)) * W, base - p));
      c.lineTo(W, H); c.fill();
    };
    mount(170, 'rgba(120,150,140,.45)', [10, 60, 25, 85, 30, 55, 15]);
    mount(195, 'rgba(80,110,100,.55)', [5, 30, 55, 20, 45, 10]);
    cloud(c, 20, 120, 1.1, 'rgba(255,255,255,.75)'); cloud(c, 200, 140, 0.9, 'rgba(255,255,255,.75)');
    // 소나무
    c.strokeStyle = '#6b4f3a'; c.lineWidth = 5; c.beginPath(); c.moveTo(30, 230); c.quadraticCurveTo(45, 170, 25, 130); c.stroke();
    c.fillStyle = '#4d7c5a'; for (const [x, y] of [[20, 130], [45, 150], [15, 160]]) { c.beginPath(); c.ellipse(x, y, 22, 8, 0, 0, 7); c.fill(); }
  },
  근대(c, r) {
    sky(c, '#c9d6e8', '#f5f1ea');
    // 톱니바퀴
    const gear = (x: number, y: number, rad: number, col: string) => {
      c.fillStyle = col; c.beginPath();
      for (let i = 0; i < 20; i++) { const a = (i / 20) * 6.283, rr = i % 2 ? rad : rad * 1.18; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      c.fill(); c.fillStyle = '#eef2f7'; c.beginPath(); c.arc(x, y, rad * 0.35, 0, 7); c.fill();
    };
    gear(60, 60, 34, '#aab8cc'); gear(110, 34, 20, '#c3cddb'); gear(250, 150, 40, '#b8c4d4');
    // 시계
    c.fillStyle = '#fff'; c.beginPath(); c.arc(230, 55, 30, 0, 7); c.fill();
    c.strokeStyle = '#64748b'; c.lineWidth = 3; c.stroke();
    c.beginPath(); c.moveTo(230, 55); c.lineTo(230, 35); c.moveTo(230, 55); c.lineTo(244, 60); c.stroke();
    // 책 더미
    const books = ['#f87171', '#60a5fa', '#fbbf24', '#34d399'];
    books.forEach((b, i) => { c.fillStyle = b; c.fillRect(14 + i * 3, 200 - i * 12, 60 - i * 6, 11); });
  },
  현대(c, r) {
    sky(c, '#f6c8ef', '#dde4ff');
    // 별 + 추상 도형
    for (let i = 0; i < 18; i++) sparkle(c, r() * W, r() * 120, 2 + r() * 4, 'rgba(255,255,255,.9)');
    c.fillStyle = 'rgba(167,139,250,.35)'; c.beginPath(); c.arc(60, 70, 40, 0, 7); c.fill();
    c.fillStyle = 'rgba(244,114,182,.3)'; c.fillRect(200, 30, 60, 60);
    c.fillStyle = 'rgba(96,165,250,.3)'; c.beginPath(); c.moveTo(240, 120); c.lineTo(290, 190); c.lineTo(190, 190); c.fill();
    // 도시 실루엣
    c.fillStyle = 'rgba(99,102,241,.35)';
    let x = 0; while (x < W) { const w = 18 + r() * 22, h = 30 + r() * 60; c.fillRect(x, H - 30 - h, w, h + 30); x += w + 2; }
  },
  히든(c, r) {
    sky(c, '#fff3b0', '#ffffff');
    c.save(); c.translate(150, 110);
    for (let i = 0; i < 16; i++) { c.rotate(6.283 / 16); c.fillStyle = i % 2 ? 'rgba(253,224,71,.35)' : 'rgba(255,255,255,.5)'; c.beginPath(); c.moveTo(0, 0); c.lineTo(-18, -200); c.lineTo(18, -200); c.fill(); }
    c.restore();
    cloud(c, 10, 190, 1.4); cloud(c, 200, 195, 1.3);
  },
};

/** 카드 삽화 이미지(dataURL). sprite = 기존 도트(스킨 반영) */
export function cardArt(p: Philosopher, sprite: HTMLCanvasElement, skinKey = ''): string {
  const key = p.id + skinKey;
  const hit = cache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d')!;
  const r = rng(parseInt(p.id.slice(1), 10) * 97);
  const background = artImage(ERA_ART[p.era] ?? 'map-ancient');
  if (background) c.drawImage(background, 0, 0, background.naturalWidth, background.naturalWidth * H / W, 0, 0, W, H);
  else (SCENES[p.era] ?? SCENES['고대'])(c, r);

  // 바닥 그림자 + 무대 빛
  const glow = c.createRadialGradient(150, 150, 10, 150, 150, 120);
  glow.addColorStop(0, 'rgba(255,255,255,.75)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = glow; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(59,42,30,.18)'; c.beginPath(); c.ellipse(150, 212, 70, 12, 0, 0, 7); c.fill();

  // 캐릭터 (도트 그대로 확대)
  c.imageSmoothingEnabled = false;
  const size = 200;
  c.drawImage(sprite, 150 - size / 2, 222 - size, size, size);

  // 반짝이
  const sp = p.tier >= 5 ? ['#fde047', '#f0abfc', '#67e8f9'] : ['#fff', '#fde68a'];
  for (let i = 0; i < 3; i++) sparkle(c, 20 + r() * 260, 15 + r() * 170, 3 + r() * 5, sp[i % sp.length]);
  const url = cv.toDataURL();
  cache.set(key, url);
  return url;
}

/** 시대 배경 그림만 (스토리 장면용) */
const sceneCache = new Map<string, string>();
export function sceneArt(era: string): string {
  return eraArtUrl(era);
}
