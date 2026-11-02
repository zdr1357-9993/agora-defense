// 귀여운 SD(치비) 도트 생성기: 32x32, 큰 머리·큰 눈·볼터치·스티커 외곽선
import type { Philosopher } from './data';

export const TIER_AURA = ['', '#94a3b8', '#38bdf8', '#a855f7', '#f59e0b', '#ef4444', '#e879f9'];
const S = 32;
type Px = (x: number, y: number, w: number, h: number, c: string) => void;

function makeSprite(draw: (px: Px) => void, outline = '#1c1917'): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  draw((x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); });
  // 스티커 외곽선: 투명 픽셀 중 불투명 픽셀과 맞닿은 곳을 칠함
  const img = ctx.getImageData(0, 0, S, S);
  const a = (x: number, y: number) => x >= 0 && y >= 0 && x < S && y < S && img.data[(y * S + x) * 4 + 3] > 0;
  const edge: number[] = [];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++)
    if (!a(x, y) && (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1))) edge.push(x, y);
  ctx.fillStyle = outline;
  for (let i = 0; i < edge.length; i += 2) ctx.fillRect(edge[i], edge[i + 1], 1, 1);
  return c;
}

// ---------- 인물별 특징 ----------
type Hair = 'bald' | 'curly' | 'short' | 'long' | 'wig' | 'topknot' | 'gat' | 'monk' | 'turban' | 'veil' | 'wild' | 'side' | 'neat';
interface Look { hair: Hair; hairC: string; beard?: string; mustache?: string; glasses?: boolean; robe: string; trim: string; prop?: string; halo?: boolean }

const L = (hair: Hair, hairC: string, robe: string, trim: string, extra: Partial<Look> = {}): Look => ({ hair, hairC, robe, trim, ...extra });
const WHITE = '#f8fafc', GREY = '#cbd5e1', BROWN = '#78350f', DARK = '#1e293b', BLACK = '#0f172a';

const LOOKS: Record<string, Look> = {
  탈레스: L('curly', GREY, '#e0f2fe', '#0284c7', { beard: GREY, prop: 'water' }),
  헤라클레이토스: L('wild', BROWN, '#fee2e2', '#dc2626', { beard: BROWN, prop: 'fire' }),
  피타고라스: L('curly', WHITE, '#fef9c3', '#ca8a04', { beard: WHITE, prop: 'triangle' }),
  플라톤: L('curly', WHITE, '#ede9fe', '#7c3aed', { beard: WHITE, prop: 'book' }),
  아리스토텔레스: L('short', BROWN, '#dcfce7', '#16a34a', { beard: BROWN, prop: 'scroll' }),
  노자: L('long', WHITE, '#e7e5e4', '#57534e', { beard: WHITE, prop: 'staff' }),
  '오컴의 윌리엄': L('monk', BROWN, '#78350f', '#fbbf24', { prop: 'razor' }),
  아우구스티누스: L('short', DARK, '#fef3c7', '#b91c1c', { beard: DARK, prop: 'mitre' }),
  '르네 데카르트': L('wig', DARK, '#1e3a8a', '#fde047', { mustache: DARK, prop: 'book' }),
  '바뤼흐 스피노자': L('wig', DARK, '#334155', '#94a3b8', { glasses: true, prop: 'lens' }),
  장자: L('long', DARK, '#ecfccb', '#4d7c0f', { beard: DARK, prop: 'butterfly' }),
  나가르주나: L('monk', BROWN, '#ea580c', '#9a3412', { prop: 'beads' }),
  원효: L('monk', BROWN, '#a8a29e', '#57534e', { prop: 'skull' }),
  '데이비드 흄': L('wig', WHITE, '#7f1d1d', '#fde047', { prop: 'billiard' }),
  '고트프리트 라이프니츠': L('wig', '#a16207', '#4c1d95', '#fbbf24', { prop: 'book' }),
  '게오르크 헤겔': L('side', GREY, '#1e293b', '#e2e8f0', { prop: 'owl' }),
  '에드문트 후설': L('bald', GREY, '#334155', '#e2e8f0', { beard: GREY, glasses: true }),
  '아르투어 쇼펜하우어': L('side', WHITE, '#3f3f46', '#e2e8f0', { prop: 'poodle' }),
  '버트런드 러셀': L('neat', WHITE, '#18181b', '#e2e8f0', { prop: 'pipe' }),
  주희: L('topknot', BLACK, '#e7e5e4', '#0f172a', { beard: BLACK, prop: 'book' }),
  '프리드리히 니체': L('neat', '#451a03', '#1e1b4b', '#f43f5e', { mustache: '#451a03', prop: 'hammer' }),
  '지그문트 프로이트': L('neat', GREY, '#292524', '#e2e8f0', { beard: GREY, glasses: true, prop: 'cigar' }),
  '카를 마르크스': L('wild', '#334155', '#991b1b', '#ef4444', { beard: '#475569', prop: 'hammer' }),
  '고틀로프 프레게': L('bald', GREY, '#1e293b', '#e2e8f0', { beard: GREY }),
  '쇠렌 키르케고르': L('wild', '#a16207', '#18181b', '#e2e8f0', { prop: 'umbrella' }),
  '퇴계 이황': L('gat', BLACK, '#f5f5f4', '#0f172a', { beard: BLACK, prop: 'book' }),
  혜능: L('monk', BROWN, '#a16207', '#78350f', { prop: 'beads' }),
  '마르틴 하이데거': L('neat', DARK, '#365314', '#a3e635', { mustache: DARK, prop: 'axe' }),
  '루트비히 비트겐슈타인': L('wild', '#78350f', '#334155', '#e2e8f0', { prop: 'fly' }),
  '장 폴 사르트르': L('neat', DARK, '#18181b', '#e2e8f0', { glasses: true, prop: 'pipe' }),
  '자크 라캉': L('neat', WHITE, '#581c87', '#f0abfc', { prop: 'mirror' }),
  '미셸 푸코': L('bald', GREY, '#f8fafc', '#18181b', { glasses: true, prop: 'eye' }),
  '한나 아렌트': L('side', DARK, '#7f1d1d', '#fecaca', { prop: 'cigar' }),
  '질 들뢰즈': L('wild', GREY, '#0f766e', '#99f6e4', { prop: 'root' }),
  '에마뉘엘 레비나스': L('neat', GREY, '#1e293b', '#e2e8f0', { mustache: GREY, glasses: true }),
  '테오도어 아도르노': L('bald', DARK, '#1c1917', '#e2e8f0', { glasses: true, prop: 'note' }),
  '니시다 기타로': L('neat', GREY, '#44403c', '#d6d3d1', { glasses: true, prop: 'ensō' }),
  '다산 정약용': L('gat', BLACK, '#e0f2fe', '#0f172a', { beard: BLACK, prop: 'crane' }),
  소크라테스: L('bald', WHITE, '#f8fafc', '#2563eb', { beard: WHITE, prop: 'question' }),
  '임마누엘 칸트': L('wig', WHITE, '#1d4ed8', '#fbbf24', { prop: 'watch' }),
  '자크 데리다': L('wild', WHITE, '#18181b', '#a855f7', { prop: 'glitch' }),
  공자: L('topknot', BLACK, '#fef3c7', '#b45309', { beard: BLACK, prop: 'scroll' }),
  '고타마 붓다': L('monk', '#1e293b', '#f59e0b', '#b45309', { prop: 'lotus', halo: true }),
  바울: L('bald', '#57534e', '#92400e', '#fef3c7', { beard: '#57534e', prop: 'sword' }),
  예수: L('long', BROWN, '#f8fafc', '#dc2626', { beard: BROWN, prop: 'lamb', halo: true }),
};
const DEFAULT = L('short', BROWN, '#e2e8f0', '#64748b', { prop: 'book' });

const SKINS = ['#fde7c7', '#fcd9b6', '#f5d0a9', '#fbe0c4'];
const cache = new Map<string, HTMLCanvasElement>();

export function philosopherSprite(p: Philosopher): HTMLCanvasElement {
  const hit = cache.get(p.id);
  if (hit) return hit;
  const lk = LOOKS[p.name] ?? DEFAULT;
  const skin = SKINS[p.name.length % SKINS.length];

  const sprite = makeSprite((px) => {
    if (lk.halo) { px(9, 1, 14, 1, '#fde047'); px(8, 2, 1, 1, '#fde047'); px(23, 2, 1, 1, '#fde047'); }
    // 몸 (작은 몸통 + 짧은 팔다리)
    px(10, 22, 12, 7, lk.robe); px(11, 29, 3, 2, '#44403c'); px(18, 29, 3, 2, '#44403c');
    px(15, 22, 2, 7, lk.trim);
    px(8, 23, 2, 4, lk.robe); px(22, 23, 2, 4, lk.robe); px(8, 27, 2, 1, skin); px(22, 27, 2, 1, skin);
    // 큰 머리 (모서리를 깎은 둥근 사각형)
    px(8, 6, 16, 15, skin); px(7, 8, 1, 11, skin); px(24, 8, 1, 11, skin); px(9, 5, 14, 1, skin); px(9, 21, 14, 1, skin);
    // 머리카락
    const h = lk.hairC;
    switch (lk.hair) {
      case 'bald': px(6, 10, 2, 5, h); px(24, 10, 2, 5, h); px(12, 6, 3, 1, '#fff7ed'); break;
      case 'curly': px(7, 4, 18, 4, h); px(6, 6, 2, 8, h); px(24, 6, 2, 8, h); px(9, 3, 3, 1, h); px(15, 3, 3, 1, h); px(21, 3, 2, 1, h); px(7, 4, 18, 1, '#4ade80'); break;
      case 'short': px(7, 4, 18, 4, h); px(7, 7, 2, 4, h); px(23, 7, 2, 4, h); break;
      case 'long': px(7, 3, 18, 5, h); px(6, 6, 2, 14, h); px(24, 6, 2, 14, h); px(14, 1, 4, 2, h); break;
      case 'wig': px(6, 3, 20, 5, h); px(5, 7, 3, 12, h); px(24, 7, 3, 12, h); px(5, 9, 3, 1, '#e2e8f0'); px(24, 9, 3, 1, '#e2e8f0'); break;
      case 'wild': px(6, 2, 20, 6, h); px(5, 5, 3, 9, h); px(24, 5, 3, 9, h); px(8, 1, 2, 1, h); px(13, 1, 3, 1, h); px(20, 1, 2, 1, h); break;
      case 'side': px(8, 5, 16, 2, skin); px(5, 7, 4, 8, h); px(23, 7, 4, 8, h); px(9, 4, 14, 2, h); break;
      case 'neat': px(7, 4, 18, 4, h); px(7, 7, 3, 3, h); px(20, 5, 5, 2, h); break;
      case 'topknot': px(7, 4, 18, 3, h); px(13, 0, 6, 4, h); px(12, 3, 8, 1, '#e7e5e4'); break;
      case 'gat': px(3, 5, 26, 2, BLACK); px(10, 0, 12, 5, '#1e293b'); px(10, 4, 12, 1, BLACK); px(7, 7, 2, 4, h); px(23, 7, 2, 4, h); break;
      case 'monk': px(9, 5, 14, 2, '#fde7c7'); break;
      case 'turban': px(6, 2, 20, 6, WHITE); px(8, 4, 16, 1, GREY); break;
      case 'veil': px(5, 3, 22, 4, BLACK); px(5, 6, 3, 15, BLACK); px(24, 6, 3, 15, BLACK); px(8, 6, 16, 1, WHITE); break;
    }
    // 큰 눈 + 반짝이
    px(11, 12, 3, 4, '#1c1917'); px(18, 12, 3, 4, '#1c1917');
    px(11, 12, 1, 1, '#ffffff'); px(18, 12, 1, 1, '#ffffff'); px(13, 15, 1, 1, '#ffffff'); px(20, 15, 1, 1, '#ffffff');
    if (lk.glasses) {
      px(10, 11, 5, 1, '#0ea5e9'); px(10, 16, 5, 1, '#0ea5e9'); px(10, 11, 1, 6, '#0ea5e9'); px(14, 11, 1, 6, '#0ea5e9');
      px(17, 11, 5, 1, '#0ea5e9'); px(17, 16, 5, 1, '#0ea5e9'); px(17, 11, 1, 6, '#0ea5e9'); px(21, 11, 1, 6, '#0ea5e9'); px(15, 13, 2, 1, '#0ea5e9');
    }
    // 볼터치 + 입
    px(8, 16, 2, 1, '#fda4af'); px(22, 16, 2, 1, '#fda4af');
    px(15, 17, 2, 1, '#9f1239');
    if (lk.mustache) { px(12, 17, 8, 2, lk.mustache); }
    if (lk.beard) { px(9, 18, 14, 4, lk.beard); px(11, 22, 10, 2, lk.beard); px(15, 18, 2, 1, '#9f1239'); }
    // 소품 (오른손 쪽)
    const P = (x: number, y: number, w: number, hh: number, c: string) => px(x, y, w, hh, c);
    switch (lk.prop) {
      case 'water': P(25, 19, 5, 5, '#38bdf8'); P(26, 18, 3, 1, '#7dd3fc'); break;
      case 'fire': P(25, 18, 5, 6, '#f97316'); P(26, 16, 3, 4, '#fde047'); break;
      case 'triangle': P(25, 23, 6, 1, '#fbbf24'); P(26, 21, 4, 2, '#fbbf24'); P(27, 19, 2, 2, '#fbbf24'); break;
      case 'book': P(25, 20, 5, 6, '#b45309'); P(26, 21, 3, 4, '#fef3c7'); break;
      case 'scroll': P(25, 19, 4, 7, '#fef3c7'); P(25, 19, 4, 1, '#a16207'); P(25, 25, 4, 1, '#a16207'); break;
      case 'staff': P(26, 12, 2, 18, '#78350f'); P(25, 11, 4, 2, '#a16207'); break;
      case 'razor': P(26, 15, 2, 8, '#e2e8f0'); P(26, 23, 2, 4, '#78350f'); break;
      case 'mitre': P(11, 0, 10, 5, '#fbbf24'); P(15, 0, 2, 5, '#dc2626'); break;
      case 'lens': P(25, 19, 5, 5, '#bae6fd'); P(26, 20, 3, 3, '#e0f2fe'); break;
      case 'butterfly': P(25, 15, 3, 3, '#f472b6'); P(29, 15, 3, 3, '#f472b6'); P(28, 16, 1, 3, '#1e293b'); break;
      case 'beads': for (let i = 0; i < 6; i++) P(10 + i * 2, 22, 1, 1, '#78350f'); P(25, 20, 4, 4, '#a16207'); break;
      case 'skull': P(25, 19, 6, 5, '#f5f5f4'); P(26, 21, 1, 1, '#1c1917'); P(29, 21, 1, 1, '#1c1917'); break;
      case 'billiard': P(25, 20, 4, 4, '#ef4444'); P(28, 22, 4, 4, '#f8fafc'); break;
      case 'owl': P(25, 17, 6, 7, '#a16207'); P(26, 18, 1, 1, '#fde047'); P(29, 18, 1, 1, '#fde047'); break;
      case 'poodle': P(25, 21, 6, 5, '#f5f5f4'); P(29, 19, 3, 3, '#f5f5f4'); P(30, 20, 1, 1, '#1c1917'); break;
      case 'pipe': P(18, 18, 6, 1, '#78350f'); P(24, 16, 3, 3, '#451a03'); P(25, 13, 2, 2, '#e5e7eb'); break;
      case 'cigar': P(18, 18, 7, 1, '#92400e'); P(25, 18, 1, 1, '#f97316'); P(26, 15, 2, 2, '#e5e7eb'); break;
      case 'hammer': P(26, 15, 2, 12, '#92400e'); P(24, 13, 6, 3, '#94a3b8'); break;
      case 'umbrella': P(26, 13, 1, 15, '#1c1917'); P(23, 12, 7, 2, '#1c1917'); break;
      case 'axe': P(26, 14, 2, 13, '#92400e'); P(27, 13, 4, 4, '#94a3b8'); break;
      case 'fly': P(26, 16, 4, 6, '#bae6fd'); P(27, 18, 2, 2, '#1c1917'); break;
      case 'mirror': P(25, 16, 5, 7, '#f0abfc'); P(26, 17, 3, 5, '#e0f2fe'); P(27, 23, 1, 4, '#a16207'); break;
      case 'eye': P(25, 19, 6, 4, '#f8fafc'); P(27, 20, 2, 2, '#1c1917'); break;
      case 'root': P(25, 18, 1, 8, '#16a34a'); P(27, 16, 1, 10, '#16a34a'); P(29, 19, 1, 7, '#16a34a'); break;
      case 'note': P(26, 15, 1, 8, '#1c1917'); P(24, 22, 3, 2, '#1c1917'); P(27, 15, 3, 1, '#1c1917'); break;
      case 'ensō': P(25, 17, 6, 1, '#1c1917'); P(25, 17, 1, 6, '#1c1917'); P(30, 17, 1, 5, '#1c1917'); P(25, 23, 5, 1, '#1c1917'); break;
      case 'crane': P(27, 10, 1, 17, '#78350f'); P(24, 10, 7, 1, '#78350f'); P(25, 11, 1, 4, '#94a3b8'); P(29, 11, 1, 4, '#94a3b8'); break;
      case 'question': P(25, 12, 6, 7, '#f8fafc'); P(27, 13, 2, 1, '#2563eb'); P(28, 14, 1, 2, '#2563eb'); P(27, 17, 1, 1, '#2563eb'); break;
      case 'watch': P(25, 19, 5, 5, '#fbbf24'); P(26, 20, 3, 3, '#ffffff'); P(27, 21, 1, 1, '#1c1917'); break;
      case 'glitch': P(1, 10, 3, 3, '#a855f7'); P(26, 14, 4, 4, '#22d3ee'); P(28, 20, 3, 2, '#f472b6'); break;
      case 'lotus': P(24, 22, 8, 3, '#f9a8d4'); P(26, 20, 4, 2, '#fbcfe8'); break;
      case 'sword': P(27, 11, 2, 12, '#e2e8f0'); P(25, 23, 6, 1, '#ca8a04'); break;
      case 'lamb': P(24, 21, 7, 5, '#f8fafc'); P(29, 19, 3, 3, '#f8fafc'); P(30, 20, 1, 1, '#1c1917'); break;
    }
  });
  cache.set(p.id, sprite);
  return sprite;
}

// ---------- 몬스터: 귀엽지만 얄미운 도그마들 ----------
const STAGE_PAL: Record<string, [string, string]> = {
  고대: ['#a78bfa', '#7c3aed'], 중세: ['#f87171', '#991b1b'], 동양: ['#86efac', '#15803d'],
  근대: ['#94a3b8', '#334155'], 현대: ['#f472b6', '#831843'],
};
const monsterCache = new Map<string, HTMLCanvasElement>();
export function monsterSprite(era: string, kind: 'early' | 'late' | 'boss'): HTMLCanvasElement {
  const key = era + kind;
  const hit = monsterCache.get(key);
  if (hit) return hit;
  const [body, dark] = STAGE_PAL[era] ?? STAGE_PAL['고대'];
  const s = makeSprite((px) => {
    if (kind === 'early') {
      // 말랑한 슬라임형
      px(8, 12, 16, 14, body); px(6, 16, 20, 10, body); px(10, 10, 12, 2, body);
      px(11, 16, 3, 4, '#1c1917'); px(18, 16, 3, 4, '#1c1917'); px(11, 16, 1, 1, '#fff'); px(18, 16, 1, 1, '#fff');
      px(14, 22, 4, 1, dark); px(10, 13, 3, 2, '#ffffff');
    } else if (kind === 'late') {
      // 뿔 달린 꼬마 악마형
      px(8, 9, 16, 17, body); px(7, 12, 18, 12, body);
      px(8, 5, 3, 4, dark); px(21, 5, 3, 4, dark);
      px(11, 14, 3, 3, '#fde047'); px(18, 14, 3, 3, '#fde047'); px(12, 15, 1, 1, '#1c1917'); px(19, 15, 1, 1, '#1c1917');
      px(13, 20, 6, 2, dark); px(14, 20, 1, 1, '#fff'); px(17, 20, 1, 1, '#fff');
      px(10, 26, 3, 3, dark); px(19, 26, 3, 3, dark);
    } else {
      // 왕관 쓴 보스
      px(4, 9, 24, 19, dark); px(6, 11, 20, 15, body);
      px(8, 3, 16, 5, '#fbbf24'); px(8, 1, 2, 2, '#fbbf24'); px(15, 1, 2, 2, '#fbbf24'); px(22, 1, 2, 2, '#fbbf24'); px(15, 4, 2, 2, '#ef4444');
      px(9, 14, 5, 4, '#1c1917'); px(18, 14, 5, 4, '#1c1917'); px(10, 14, 1, 1, '#f43f5e'); px(19, 14, 1, 1, '#f43f5e');
      px(11, 21, 10, 2, '#1c1917'); px(12, 21, 1, 1, '#fff'); px(15, 21, 1, 1, '#fff'); px(18, 21, 1, 1, '#fff');
    }
  });
  monsterCache.set(key, s);
  return s;
}
