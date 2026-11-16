import { W, H, WATER, TREE, type FieldMap } from './tilemap';

export interface Pt { x: number; y: number }
const blocked = (m: FieldMap, x: number, y: number) => { const v = m.tiles[y * W + x]; return v === WATER || v === TREE; };
export const walkable = (m: FieldMap, x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && !blocked(m, x, y);

/** 4방향 A*. 길이 없으면 빈 배열. 시작 칸은 포함하지 않는다. */
export function astar(m: FieldMap, s: Pt, e: Pt): Pt[] {
  if (!walkable(m, e.x, e.y)) return [];
  const key = (x: number, y: number) => y * W + x;
  const g = new Map<number, number>([[key(s.x, s.y), 0]]), from = new Map<number, number>();
  const open: [number, number, number][] = [[0, s.x, s.y]];
  const h = (x: number, y: number) => Math.abs(x - e.x) + Math.abs(y - e.y);
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
    const [, x, y] = open.splice(bi, 1)[0];
    if (x === e.x && y === e.y) {
      const path: Pt[] = []; let k = key(x, y);
      while (from.has(k)) { path.unshift({ x: k % W, y: (k / W) | 0 }); k = from.get(k)!; }
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!walkable(m, nx, ny)) continue;
      const ng = g.get(key(x, y))! + 1;
      if (!g.has(key(nx, ny)) || ng < g.get(key(nx, ny))!) { g.set(key(nx, ny), ng); from.set(key(nx, ny), key(x, y)); open.push([ng + h(nx, ny), nx, ny]); }
    }
  }
  return [];
}

/** 눌린 칸이 막혔으면 가장 가까운 걸을 수 있는 이웃 칸으로 */
export function nearestWalkable(m: FieldMap, t: Pt, from: Pt): Pt | null {
  if (walkable(m, t.x, t.y)) return t;
  const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => ({ x: t.x + a, y: t.y + b })).filter((p) => walkable(m, p.x, p.y));
  near.sort((a, b) => Math.abs(a.x - from.x) + Math.abs(a.y - from.y) - Math.abs(b.x - from.x) - Math.abs(b.y - from.y));
  return near[0] ?? null;
}

export const SPEED = 5.5; // 칸/초
export class Walker {
  px: number; py: number; path: Pt[] = []; facing = 1; stride = 0;
  constructor(x: number, y: number) { this.px = x; this.py = y; }
  get tile(): Pt { return { x: Math.round(this.px), y: Math.round(this.py) }; }
  get moving() { return this.path.length > 0; }
  /** dt 초만큼 걷는다. 목적지에 닿으면 true */
  step(dt: number): boolean {
    if (!this.path.length) return false;
    this.stride += dt;
    const n = this.path[0], dx = n.x - this.px, dy = n.y - this.py, d = Math.hypot(dx, dy), sp = SPEED * dt;
    if (dx) this.facing = dx > 0 ? 1 : -1;
    if (d <= sp) { this.px = n.x; this.py = n.y; this.path.shift(); return this.path.length === 0; }
    this.px += (dx / d) * sp; this.py += (dy / d) * sp;
    return false;
  }
  teleport(x: number, y: number) { this.px = x; this.py = y; this.path = []; }
}
