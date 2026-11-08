import atlasIds from './character-atlas.json';
import { ART_SOURCES } from './artwork-sources';

export const RELEASE = '20261108v5';
export type ArtName = keyof typeof ART_SOURCES;
const images = new Map<ArtName, HTMLImageElement>();
const tiles = new Map<string, HTMLCanvasElement>();
const urls = new Map<string, string>();
const characterCells = new Map<string, [number, number]>();
atlasIds.forEach((ids, sheet) => ids.forEach((id, cell) => characterCells.set(id, [sheet + 1, cell])));

export const ERA_ART: Record<string, ArtName> = {
  고대: 'map-ancient', 동양: 'map-east', 중세: 'map-medieval', 근대: 'map-modern', 현대: 'map-contemporary', 히든: 'map-contemporary',
};
export const artUrl = (name: ArtName) => ART_SOURCES[name];
export const eraArtUrl = (era: string) => artUrl(ERA_ART[era] ?? 'map-ancient');
export const artImage = (name: ArtName) => images.get(name);

/** Images settle before main.ts initializes its sprite/portrait caches. */
export async function loadArtwork(onProgress?: (done: number, total: number) => void) {
  const names = Object.keys(ART_SOURCES) as ArtName[];
  let done = 0;
  const missing: string[] = [];
  await Promise.all(names.map((name) => new Promise<void>((resolve) => {
    const img = new Image();
    const finish = (ok: boolean) => {
      clearTimeout(timer); img.onload = img.onerror = null;
      if (ok) images.set(name, img); else missing.push(name);
      onProgress?.(++done, names.length); resolve();
    };
    const timer = window.setTimeout(() => finish(false), 15000);
    img.onload = () => finish(true); img.onerror = () => finish(false);
    img.src = ART_SOURCES[name];
  })));
  return missing;
}

/** Consume an equal-cell atlas as real transparent sprites, without DOM clipping tricks. */
function tile(name: ArtName, column: number, row: number, columns = 4, rows = 4): HTMLCanvasElement | undefined {
  const key = `${name}/${column}/${row}/${columns}/${rows}`;
  if (tiles.has(key)) return tiles.get(key);
  const source = images.get(name); if (!source) return;
  const sx = Math.round(column * source.naturalWidth / columns), sy = Math.round(row * source.naturalHeight / rows);
  const sw = Math.round((column + 1) * source.naturalWidth / columns) - sx;
  const sh = Math.round((row + 1) * source.naturalHeight / rows) - sy;
  const raw = document.createElement('canvas'); raw.width = sw; raw.height = sh;
  const r = raw.getContext('2d', { willReadFrequently: true })!;
  r.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  const data = r.getImageData(0, 0, sw, sh).data;
  let left = sw, top = sh, right = 0, bottom = 0;
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    if (data[(y * sw + x) * 4 + 3] < 180) continue;
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  const c = document.createElement('canvas'); c.width = c.height = 128;
  if (right >= left && bottom >= top) {
    const w = right - left + 1, h = bottom - top + 1, scale = Math.min(112 / w, 112 / h);
    const dw = Math.round(w * scale), dh = Math.round(h * scale);
    const ctx = c.getContext('2d')!; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(raw, left, top, w, h, Math.round((128 - dw) / 2), 120 - dh, dw, dh);
  }
  tiles.set(key, c); return c;
}

export function artworkCharacter(id: string) {
  const variants: Record<string, [number, number]> = { T701: [0, 0], T108: [1, 0], T704: [0, 1], T106: [1, 1] };
  const variant = variants[id];
  if (variant && images.has('sage-variants')) return tile('sage-variants', variant[0], variant[1], 2, 2);
  const cell = characterCells.get(id); if (!cell) return;
  return tile(`characters-${cell[0]}` as ArtName, cell[1] % 4, Math.floor(cell[1] / 4));
}
const itemIds = ['cup', 'watch', 'hammer', 'razor', 'flybottle', 'cigar', 'pipe', 'mirror', 'owl', 'lotus', 'skull', 'book', 'crane', 'boulder', 'lantern', 'axe'];
export function artworkItem(id: string) {
  const n = itemIds.indexOf(id); return n < 0 ? undefined : tile('items', n % 4, Math.floor(n / 4));
}
const iconIds = ['journey', 'room', 'gacha', 'codex', 'shop', 'coin', 'gem', 'ticket', 'sell', 'merge', 'upgrade', 'recipe', 'settings', 'sound', 'star', 'lock'];
export function iconUrl(id: string): string {
  if (urls.has(id)) return urls.get(id)!;
  const n = iconIds.indexOf(id), canvas = n < 0 ? undefined : tile('ui-icons', n % 4, Math.floor(n / 4));
  if (!canvas) return '';
  const url = canvas.toDataURL(); urls.set(id, url); return url;
}
export function iconHtml(id: string, label = '') {
  const url = iconUrl(id);
  return url ? `<img class="pixel-icon" src="${url}" alt="${label}">` : label;
}
export function artworkEnemy(era: string, kind: string) {
  const row = ['고대', '동양', '중세', '근대', '현대'].indexOf(era);
  const col = ['normal', 'fast', 'tank', 'swarm', 'boss'].indexOf(kind);
  return tile('enemies', Math.max(0, col), Math.max(0, row), 5, 5);
}
