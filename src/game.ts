import { PHIL, PHILOSOPHERS, RECIPES, TIER_STATS, type Recipe } from './data';

// 7x7 격자: 바깥 테두리 24칸은 적의 트랙, 안쪽 5x5는 타워 배치 칸
export const GRID = 7;
export const MAX_WAVE = 10;

export interface Tower { uid: number; philId: string; cx: number; cy: number; cd: number }
export interface Enemy { uid: number; hp: number; maxHp: number; dist: number; speed: number; boss: boolean; reward: number }
export interface Bullet { x: number; y: number; target: number; dmg: number; text: string; color: string }

// 트랙: 왼쪽 위 칸 중심에서 시계방향으로 한 바퀴 (단위: 칸)
const TRACK_LEN = (GRID - 1) * 4;
export function trackPos(dist: number): [number, number] {
  const d = ((dist % TRACK_LEN) + TRACK_LEN) % TRACK_LEN;
  const s = GRID - 1;
  if (d < s) return [d + 0.5, 0.5];
  if (d < 2 * s) return [s + 0.5, d - s + 0.5];
  if (d < 3 * s) return [s - (d - 2 * s) + 0.5, s + 0.5];
  return [0.5, s - (d - 3 * s) + 0.5];
}

let uidSeq = 1;

export class Game {
  gold = 200;
  lives = 20;
  wave = 0;
  summonCost = 50;
  towers: Tower[] = [];
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  toSpawn = 0;
  spawnTimer = 0;
  countdown = -1; // 다음 웨이브 자동 시작까지 남은 초
  running = false;
  over: 'win' | 'lose' | null = null;
  log = '';

  towerAt(cx: number, cy: number) { return this.towers.find((t) => t.cx === cx && t.cy === cy); }

  emptyCells() {
    const cells: [number, number][] = [];
    for (let y = 1; y < GRID - 1; y++) for (let x = 1; x < GRID - 1; x++) if (!this.towerAt(x, y)) cells.push([x, y]);
    return cells;
  }

  summon() {
    const cells = this.emptyCells();
    if (this.gold < this.summonCost || !cells.length) return null;
    this.gold -= this.summonCost;
    this.summonCost += 5;
    const pool = PHILOSOPHERS.filter((p) => p.tier === 1);
    const p = pool[Math.floor(Math.random() * pool.length)];
    const [cx, cy] = cells[Math.floor(Math.random() * cells.length)];
    const t = { uid: uidSeq++, philId: p.id, cx, cy, cd: 0 };
    this.towers.push(t);
    return t;
  }

  sell(t: Tower) {
    const tier = PHIL.get(t.philId)!.tier;
    this.gold += 25 * 2 ** (tier - 1);
    this.towers = this.towers.filter((x) => x !== t);
  }

  /** 이동 또는 스왑 */
  moveTo(t: Tower, cx: number, cy: number) {
    const other = this.towerAt(cx, cy);
    if (other) { other.cx = t.cx; other.cy = t.cy; }
    t.cx = cx; t.cy = cy;
  }

  /** 지금 필드 재료로 가능한 조합식 (촉매 필요 조합은 프로토타입에서 제외) */
  availableRecipes(): Recipe[] {
    return RECIPES.filter((r) => !r.catalyst && this.pickMaterials(r) !== null);
  }

  private pickMaterials(r: Recipe): Tower[] | null {
    const used = new Set<Tower>();
    for (const id of r.materials) {
      const t = this.towers.find((x) => x.philId === id && !used.has(x));
      if (!t) return null;
      used.add(t);
    }
    return [...used];
  }

  synthesize(r: Recipe) {
    const mats = this.pickMaterials(r);
    if (!mats) return null;
    const keep = mats[0];
    this.towers = this.towers.filter((t) => !mats.includes(t) || t === keep);
    keep.philId = r.result;
    keep.cd = 0;
    return keep;
  }

  startWave() {
    if (this.running || this.over || this.wave >= MAX_WAVE) return;
    this.wave++;
    this.running = true;
    this.countdown = -1;
    this.toSpawn = this.wave === MAX_WAVE ? 1 : 8 + this.wave * 2;
    this.spawnTimer = 0;
  }

  private spawn() {
    const boss = this.wave === MAX_WAVE;
    const hp = boss ? 9000 : Math.round(25 * 1.38 ** (this.wave - 1));
    this.enemies.push({
      uid: uidSeq++, hp, maxHp: hp, dist: 0, boss,
      speed: boss ? 0.9 : 1.4 + this.wave * 0.05,
      reward: boss ? 300 : 5 + Math.floor(this.wave / 2),
    });
  }

  update(dt: number) {
    if (this.over) return;

    if (this.countdown > 0) {
      this.countdown -= dt;
      if (this.countdown <= 0) this.startWave();
    }

    if (this.running && this.toSpawn > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) { this.spawn(); this.toSpawn--; this.spawnTimer = 0.7; }
    }

    // 적 이동: 트랙 한 바퀴 돌 때마다 멘탈 -1 (보스는 -5)
    for (const e of this.enemies) {
      const before = Math.floor(e.dist / TRACK_LEN);
      e.dist += e.speed * dt;
      if (Math.floor(e.dist / TRACK_LEN) > before) this.lives -= e.boss ? 5 : 1;
    }
    if (this.lives <= 0) { this.lives = 0; this.over = 'lose'; return; }

    // 타워 공격: 사거리 안에서 가장 멀리 간 적
    for (const t of this.towers) {
      t.cd -= dt;
      if (t.cd > 0) continue;
      const p = PHIL.get(t.philId)!;
      const st = TIER_STATS[p.tier]!;
      const tx = t.cx + 0.5, ty = t.cy + 0.5;
      let best: Enemy | null = null;
      for (const e of this.enemies) {
        const [ex, ey] = trackPos(e.dist);
        if (Math.hypot(ex - tx, ey - ty) <= st.range && (!best || e.dist > best.dist)) best = e;
      }
      if (!best) continue;
      t.cd = st.cooldown;
      this.bullets.push({ x: tx, y: ty, target: best.uid, dmg: st.dmg, text: p.quote, color: '' });
    }

    // 말풍선 탄환
    for (const b of this.bullets) {
      const e = this.enemies.find((x) => x.uid === b.target);
      if (!e) { b.dmg = 0; continue; }
      const [ex, ey] = trackPos(e.dist);
      const dx = ex - b.x, dy = ey - b.y, d = Math.hypot(dx, dy), step = 7 * dt;
      if (d <= step) { e.hp -= b.dmg; b.dmg = 0; }
      else { b.x += (dx / d) * step; b.y += (dy / d) * step; }
    }
    this.bullets = this.bullets.filter((b) => b.dmg > 0);

    for (const e of this.enemies) if (e.hp <= 0) this.gold += e.reward;
    this.enemies = this.enemies.filter((e) => e.hp > 0);

    // 웨이브 종료 → 보상 후 3초 뒤 자동 진행
    if (this.running && this.toSpawn === 0 && this.enemies.length === 0) {
      this.running = false;
      this.gold += 40 + this.wave * 5;
      if (this.wave >= MAX_WAVE) this.over = 'win';
      else this.countdown = 3;
    }
  }
}
