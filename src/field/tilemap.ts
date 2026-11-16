/** 장(章)별 타일 지도: 11×26 격자 (폰 세로 폭에 한 번에 들어온다). 거점(스테이지·시설) 좌표에서 길을 자동으로 이어 만든다. */
export const T = 32, W = 11, H = 26;
export const GRASS = 0, PATH = 1, WATER = 2, TREE = 3;

export interface Poi {
  id: string;
  kind: 'stage' | 'facility';
  x: number; y: number;
  /** 팻말에 적는 짧은 글자 (스테이지는 '1-2', 시설은 이모지) */
  label: string;
  name: string;
  state: 'done' | 'open' | 'lock';
}
export interface FieldMap { tiles: Uint8Array; pois: Poi[]; }

const hash = (x: number, y: number, seed: number) => (((x * 73856093) ^ (y * 19349663) ^ (seed * 83492791)) >>> 0);

/** 스테이지 거점 좌표: 왼쪽·오른쪽을 번갈아 위로 올라간다 */
export function stageSpot(i: number, n: number): [number, number] {
  return [i % 2 === 0 ? 3 : 7, n <= 1 ? 12 : Math.round(19 - (i / (n - 1)) * 14)];
}
/** 시설 거점: 지도 맨 아래 한 줄 */
export const FACILITY_SPOTS: Record<string, [number, number]> = { room: [2, 24], shop: [5, 24], gacha: [8, 24] };

export function buildMap(pois: Poi[], seed: number): FieldMap {
  const tiles = new Uint8Array(W * H);
  const set = (x: number, y: number, v: number) => { if (x >= 0 && y >= 0 && x < W && y < H) tiles[y * W + x] = v; };
  const road = (a: [number, number], b: [number, number]) => {
    let [x, y] = a;
    while (x !== b[0]) { set(x, y, PATH); x += Math.sign(b[0] - x); }
    while (y !== b[1]) { set(x, y, PATH); y += Math.sign(b[1] - y); }
    set(x, y, PATH);
  };
  const stages = pois.filter((p) => p.kind === 'stage').sort((a, b) => b.y - a.y);
  const facilities = pois.filter((p) => p.kind === 'facility');
  // 시설 줄 → 첫 스테이지 → 위로 차례로
  if (facilities.length) {
    const xs = facilities.map((p) => p.x);
    road([Math.min(...xs), 24], [Math.max(...xs), 24]);
    if (stages[0]) road([stages[0].x, 24], [stages[0].x, stages[0].y]);
  }
  for (let i = 0; i < stages.length - 1; i++) road([stages[i].x, stages[i].y], [stages[i + 1].x, stages[i + 1].y]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (tiles[y * W + x] !== GRASS) continue;
    if ((x < 3 && y < 4) || (x > 8 && y > 19 && y < 23)) tiles[y * W + x] = WATER;
    else if (hash(x, y, seed) % 9 === 0) tiles[y * W + x] = TREE;
  }
  // 거점 주변 한 칸은 비운다 (나무가 입구를 막지 않게)
  for (const p of pois) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = p.x + dx, y = p.y + dy;
    if (x >= 0 && y >= 0 && x < W && y < H && tiles[y * W + x] === TREE) tiles[y * W + x] = GRASS;
  }
  for (const p of pois) set(p.x, p.y, PATH);
  return { tiles, pois };
}
