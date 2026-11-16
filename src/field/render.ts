import { T, W, H, PATH, WATER, TREE, type FieldMap, type Poi } from './tilemap';

export interface Palette { g: [string, string]; path: string; acc: string; tree: string; water: string; prop: 'column' | 'pine' | 'tower' | 'gas' | 'sign' }
export const PALETTES: Record<string, Palette> = {
  ancient: { g: ['#7d9a55', '#86a35c'], path: '#d8c79a', acc: '#e8e0cc', tree: '#4d7a3b', water: '#5b8fb9', prop: 'column' },
  east: { g: ['#c9c5b0', '#d3cfba'], path: '#e8e4d4', acc: '#3a3a38', tree: '#5f6b55', water: '#8fa6a8', prop: 'pine' },
  medieval: { g: ['#6b8a4a', '#73934f'], path: '#a89877', acc: '#8a8f98', tree: '#3f6b3a', water: '#4f7aa0', prop: 'tower' },
  modern: { g: ['#7a8667', '#838f70'], path: '#9b8b72', acc: '#8a5a44', tree: '#476146', water: '#5d7f98', prop: 'gas' },
  contemporary: { g: ['#8c9096', '#969aa0'], path: '#c9ccd1', acc: '#4a6fa5', tree: '#5c7f5c', water: '#5d8fb0', prop: 'sign' },
};
/** 장 번호 → 팔레트 (0·1 고대, 2 동양, 3 중세, 4 근대, 5 이후 현대) */
export const paletteFor = (chapter: number): Palette => PALETTES[['ancient', 'ancient', 'east', 'medieval', 'modern', 'contemporary'][Math.min(5, Math.max(0, chapter))]];

const rnd = (s: number) => { s = Math.sin(s) * 1e4; return s - Math.floor(s); };
function mk(f: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = c.height = T; const g = c.getContext('2d')!; g.imageSmoothingEnabled = false; f(g); return c;
}
export interface Tiles { g: HTMLCanvasElement[]; p: HTMLCanvasElement; w: HTMLCanvasElement[]; t: HTMLCanvasElement; poi: HTMLCanvasElement }
/** 32px 타일은 전부 코드로 그린다 (정식 일러스트는 T023). */
export function buildTiles(E: Palette): Tiles {
  return {
    g: [0, 1].map((i) => mk((g) => { g.fillStyle = E.g[i]; g.fillRect(0, 0, T, T); g.fillStyle = E.g[1 - i]; for (let k = 0; k < 7; k++) g.fillRect(((rnd(k + i * 9) * T) | 0) & ~1, ((rnd(k * 3 + i) * T) | 0) & ~1, 2, 2); })),
    p: mk((g) => { g.fillStyle = E.path; g.fillRect(0, 0, T, T); g.fillStyle = '#00000018'; for (let k = 0; k < 6; k++) g.fillRect((rnd(k) * 28) | 0, (rnd(k + 5) * 28) | 0, 3, 2); }),
    w: [0, 1].map((i) => mk((g) => { g.fillStyle = E.water; g.fillRect(0, 0, T, T); g.fillStyle = '#ffffff40'; g.fillRect(4 + i * 8, 10, 10, 2); g.fillRect(16 - i * 6, 22, 10, 2); })),
    t: mk((g) => { g.fillStyle = '#00000030'; g.fillRect(8, 26, 16, 4); g.fillStyle = '#6b4a2c'; g.fillRect(14, 18, 4, 10); g.fillStyle = E.tree; g.fillRect(6, 6, 20, 14); g.fillRect(9, 3, 14, 5); g.fillStyle = '#ffffff22'; g.fillRect(9, 7, 6, 3); }),
    poi: mk((g) => {
      g.fillStyle = '#00000030'; g.fillRect(4, 26, 24, 4);
      if (E.prop === 'column') { g.fillStyle = E.acc; g.fillRect(8, 6, 16, 3); g.fillRect(10, 9, 12, 17); g.fillRect(8, 26, 16, 3); g.fillStyle = '#0002'; g.fillRect(14, 9, 2, 17); }
      else if (E.prop === 'pine') { g.fillStyle = '#4b4036'; g.fillRect(14, 16, 4, 12); g.fillStyle = E.acc; g.fillRect(6, 12, 20, 4); g.fillRect(9, 8, 14, 4); g.fillRect(12, 4, 8, 4); }
      else if (E.prop === 'tower') { g.fillStyle = E.acc; g.fillRect(8, 8, 16, 20); g.fillRect(8, 4, 4, 4); g.fillRect(14, 4, 4, 4); g.fillRect(20, 4, 4, 4); g.fillStyle = '#0006'; g.fillRect(14, 16, 4, 12); }
      else if (E.prop === 'gas') { g.fillStyle = '#3b3b3b'; g.fillRect(15, 8, 2, 20); g.fillStyle = '#f3d277'; g.fillRect(11, 3, 10, 6); }
      else { g.fillStyle = E.acc; g.fillRect(5, 6, 22, 14); g.fillStyle = '#fff'; g.fillRect(8, 9, 16, 3); g.fillRect(8, 14, 10, 3); g.fillStyle = '#555'; g.fillRect(15, 20, 2, 8); }
    }),
  };
}

const PLAQUE: Record<Poi['state'], [string, string]> = { done: ['#c9e3b8', '#2f4a28'], open: ['#f2e9cd', '#393b2e'], lock: ['#b9b4a4', '#5d574a'] };
/** 변하지 않는 타일·건물·팻말을 한 장에 그려 둔다 (이동 중에는 이 그림에서 보이는 부분만 복사). */
export function renderStatic(map: FieldMap, tiles: Tiles): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = W * T; c.height = H * T;
  const x = c.getContext('2d')!; x.imageSmoothingEnabled = false;
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    const m = map.tiles[ty * W + tx], v = (tx * 7 + ty * 13) & 1;
    x.drawImage(m === PATH ? tiles.p : m === WATER ? tiles.w[v] : tiles.g[v], tx * T, ty * T);
    if (m === TREE) x.drawImage(tiles.t, tx * T, ty * T);
  }
  x.textAlign = 'center'; x.textBaseline = 'middle';
  for (const p of map.pois) {
    if (p.kind === 'stage') x.drawImage(tiles.poi, p.x * T, p.y * T - 8);
    else { x.font = '22px sans-serif'; x.fillText(p.label, p.x * T + 16, p.y * T + 6); }
    x.font = 'bold 10px sans-serif';
    const txt = p.kind === 'stage' ? (p.state === 'done' ? '★ ' : p.state === 'lock' ? '🔒 ' : '') + p.label : p.name;
    const w = x.measureText(txt).width + 8, [bg, fg] = PLAQUE[p.state];
    x.fillStyle = '#514535'; x.fillRect(p.x * T + 16 - w / 2 - 1, p.y * T + 25, w + 2, 14);
    x.fillStyle = bg; x.fillRect(p.x * T + 16 - w / 2, p.y * T + 26, w, 12);
    x.fillStyle = fg; x.fillText(txt, p.x * T + 16, p.y * T + 32);
  }
  return c;
}
