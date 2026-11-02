import {
  PHIL, PHILOSOPHERS, RECIPES, TIER_STATS, COUNTER_MULT, SUMMON_RATES, MAX_MERGE_TIER, UPGRADE,
  type Recipe, type Stage,
} from './data';

import { ITEMS, ITEM_BONUS, ITEM_DROP, isOwner } from './items';
import { N, STAGE_PATHS, pathCells, pathLength, pointAt, type Layout } from './paths';

// 9x9 격자: 스테이지마다 길 모양이 다르고, 길이 아닌 칸에 타워를 배치
export const GRID = N;
export const MAX_WAVE = 20;
export const BOSS_WAVES = [10, 20];

// QA 모드: 주소 뒤에 ?qa=0 을 붙이면 일반 모드
export const QA_MODE = new URLSearchParams(location.search).get('qa') !== '0';
const START_GOLD = QA_MODE ? 10000 : 200;
export const CATALYST_IDS = ['C001', 'C002', 'C003', 'C004', 'C005'];

export interface Tower { uid: number; philId: string; cx: number; cy: number; cd: number; level: number; item?: string }
export interface Enemy { uid: number; hp: number; maxHp: number; dist: number; speed: number; boss: boolean; reward: number; name: string; path: number }
export interface Bullet { x: number; y: number; target: number; dmg: number; text: string; color: string }

let uidSeq = 1;
const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export class Game {
  gold = START_GOLD;
  lives = 20;
  wave = 0;
  summonCost = 50;
  towers: Tower[] = [];
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  catalysts: Record<string, number> = Object.fromEntries(CATALYST_IDS.map((id) => [id, 0]));
  drops: string[] = [];
  bag: string[] = [];
  itemDrops: string[] = [];
  discovered = new Set<string>();
  toSpawn = 0;
  spawnTimer = 0;
  countdown = -1;
  running = false;
  over: 'win' | 'lose' | null = null;

  layout: Layout;
  road: Set<string>;
  notice = '';
  noticeTime = 0;

  constructor(public stage: Stage) {
    this.layout = STAGE_PATHS[stage.id].layoutFor(1);
    this.road = pathCells(this.layout);
  }

  isRoad(cx: number, cy: number) { return this.road.has(`${cx},${cy}`); }
  towerAt(cx: number, cy: number) { return this.towers.find((t) => t.cx === cx && t.cy === cy); }

  emptyCells() {
    const cells: [number, number][] = [];
    for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) if (!this.isRoad(x, y) && !this.towerAt(x, y)) cells.push([x, y]);
    return cells;
  }

  enemyPos(e: Enemy): [number, number] {
    const path = this.layout.paths[e.path % this.layout.paths.length];
    const L = pathLength(path);
    return pointAt(path, this.layout.loop ? e.dist % L : Math.min(e.dist, L));
  }

  /** 웨이브 시작 시 길 모양 갱신. 새 길 위에 있던 타워는 빈 칸으로 밀려남 */
  private refreshLayout() {
    const sp = STAGE_PATHS[this.stage.id];
    const next = sp.layoutFor(this.wave);
    const msg = sp.notice?.(this.wave);
    if (msg) { this.notice = msg; this.noticeTime = 3; }
    if (next === this.layout) return;
    this.layout = next;
    this.road = pathCells(next);
    for (const t of this.towers) if (this.isRoad(t.cx, t.cy)) {
      const free = this.emptyCells().filter(([x, y]) => !this.towers.some((o) => o.cx === x && o.cy === y));
      if (free.length) { const [x, y] = pick(free); t.cx = x; t.cy = y; }
    }
  }

  private place(philId: string) {
    const cells = this.emptyCells();
    if (!cells.length) return null;
    const [cx, cy] = pick(cells);
    const t = { uid: uidSeq++, philId, cx, cy, cd: 0, level: 0 };
    this.towers.push(t);
    this.discovered.add(philId);
    return t;
  }

  /** 등급 확률표(SUMMON_RATES)대로 등급을 뽑고, 그 등급에서 무작위 1명 */
  summon() {
    if (this.gold < this.summonCost || !this.emptyCells().length) return null;
    this.gold -= this.summonCost;
    this.summonCost += 5;
    let r = Math.random(), tier = 1;
    for (const s of SUMMON_RATES) { if (r < s.rate) { tier = s.tier; break; } r -= s.rate; }
    return this.place(pick(PHILOSOPHERS.filter((p) => p.tier === tier && !p.hidden)).id);
  }

  sell(t: Tower) {
    this.returnItems([t]);
    this.gold += 25 * 2 ** (PHIL.get(t.philId)!.tier - 1);
    this.towers = this.towers.filter((x) => x !== t);
  }

  moveTo(t: Tower, cx: number, cy: number) {
    if (this.isRoad(cx, cy)) return;
    const other = this.towerAt(cx, cy);
    if (other) { other.cx = t.cx; other.cy = t.cy; }
    t.cx = cx; t.cy = cy;
  }

  // ---------- 아이템 ----------
  private dropItem() { const id = pick(ITEMS).id; this.bag.push(id); this.itemDrops.push(id); }
  private returnItems(ts: Tower[]) { for (const t of ts) if (t.item) { this.bag.push(t.item); t.item = undefined; } }

  /** 가방의 아이템을 장착. 이미 끼고 있던 건 가방으로 */
  equip(t: Tower, itemId: string) {
    const i = this.bag.indexOf(itemId);
    if (i < 0) return;
    this.bag.splice(i, 1);
    if (t.item) this.bag.push(t.item);
    t.item = itemId;
  }

  itemMult(t: Tower) {
    if (!t.item) return { dmg: 1, range: 0 };
    return isOwner(t.item, PHIL.get(t.philId)!.name)
      ? { dmg: 1 + ITEM_BONUS.ownerDmg, range: ITEM_BONUS.ownerRange }
      : { dmg: 1 + ITEM_BONUS.dmg, range: 0 };
  }

  // ---------- 강화 (5성 이상) ----------
  upgradeCost(t: Tower) {
    const p = PHIL.get(t.philId)!;
    if (p.tier < 5 || t.level >= UPGRADE.maxLevel) return null;
    return UPGRADE.baseCost[p.tier] * (t.level + 1);
  }

  upgrade(t: Tower) {
    const cost = this.upgradeCost(t);
    if (cost === null || this.gold < cost) return false;
    this.gold -= cost;
    t.level++;
    return true;
  }

  // ---------- 합성 ----------
  /** 같은 등급 아무나 3명 → 다음 등급 무작위 (1~3성) */
  mergeable(): number[] {
    const n = [0, 0, 0, 0, 0, 0, 0];
    for (const t of this.towers) { const p = PHIL.get(t.philId)!; if (!p.hidden) n[p.tier]++; }
    const out: number[] = [];
    for (let tier = MAX_MERGE_TIER; tier >= 1; tier--) if (n[tier] >= 3) out.push(tier);
    return out;
  }

  /** 조합식 재료로 쓰이는 사람은 아껴 두고, 같은 사람이 겹친 것부터 합친다 */
  mergeThree(tier: number) {
    const group = this.towers.filter((t) => { const p = PHIL.get(t.philId)!; return p.tier === tier && !p.hidden; });
    const dup = (t: Tower) => group.filter((x) => x.philId === t.philId).length;
    group.sort((a, b) => dup(b) - dup(a));
    const used = group.slice(0, 3);
    if (used.length < 3) return null;
    const keep = used[0];
    this.returnItems(used);
    this.towers = this.towers.filter((t) => !used.includes(t) || t === keep);
    keep.philId = pick(PHILOSOPHERS.filter((x) => x.tier === tier + 1 && !x.hidden)).id;
    keep.cd = 0;
    this.discovered.add(keep.philId);
    return keep;
  }

  /** 조합표용: 이 조합에서 지금 가진 재료 */
  ownedMaterials(r: Recipe) {
    const pool = this.towers.map((t) => t.philId);
    return r.materials.map((m) => { const i = pool.indexOf(m); if (i >= 0) pool.splice(i, 1); return i >= 0; });
  }

  availableRecipes(): Recipe[] { return RECIPES.filter((r) => this.pickMaterials(r) !== null); }

  private pickMaterials(r: Recipe): Tower[] | null {
    const used = new Set<Tower>();
    for (const id of r.materials) {
      const t = this.towers.find((x) => x.philId === id && !used.has(x));
      if (!t) return null;
      used.add(t);
    }
    return [...used];
  }

  hasCatalyst(r: Recipe) { return !r.catalyst || this.catalysts[r.catalyst] > 0; }

  synthesize(r: Recipe) {
    const mats = this.pickMaterials(r);
    if (!mats || !this.hasCatalyst(r)) return null;
    if (r.catalyst) this.catalysts[r.catalyst]--;
    const keep = mats[0];
    this.returnItems(mats);
    this.towers = this.towers.filter((t) => !mats.includes(t) || t === keep);
    keep.philId = r.result;
    keep.cd = 0;
    keep.level = 0;
    this.discovered.add(r.result);
    return keep;
  }

  // ---------- 웨이브 ----------
  randomCatalyst() { return pick(CATALYST_IDS); }
  gainCatalyst(id: string) { this.catalysts[id]++; this.drops.push(id); }

  isBossWave() { return BOSS_WAVES.includes(this.wave); }

  startWave() {
    if (this.running || this.over || this.wave >= MAX_WAVE) return;
    this.wave++;
    this.refreshLayout();
    this.running = true;
    this.countdown = -1;
    this.toSpawn = this.isBossWave() ? 1 : 8 + this.wave * 2;
    this.spawnTimer = 0;
  }

  private spawn() {
    const boss = this.isBossWave();
    const base = Math.round(25 * 1.3 ** (this.wave - 1));
    const s = this.stage;
    this.enemies.push({
      uid: uidSeq++, boss,
      hp: boss ? base * 30 : base, maxHp: boss ? base * 30 : base,
      dist: 0, speed: (boss ? 0.9 : 1.4 + this.wave * 0.05) * (this.layout.speedMult ?? 1),
      path: Math.floor(Math.random() * this.layout.paths.length),
      reward: boss ? 150 * (this.wave / 10) : 5 + Math.floor(this.wave / 2),
      name: boss ? (this.wave === 10 ? s.boss10 : s.boss20) : this.wave < 10 ? s.enemyEarly : s.enemyLate,
    });
  }

  update(dt: number) {
    if (this.over) return;
    if (this.countdown > 0) { this.countdown -= dt; if (this.countdown <= 0) this.startWave(); }

    if (this.running && this.toSpawn > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) { this.spawn(); this.toSpawn--; this.spawnTimer = 0.7; }
    }

    if (this.noticeTime > 0) this.noticeTime -= dt;
    const escaped: Enemy[] = [];
    for (const e of this.enemies) {
      const L = pathLength(this.layout.paths[e.path % this.layout.paths.length]);
      const before = Math.floor(e.dist / L);
      e.dist += e.speed * dt;
      if (this.layout.loop) { if (Math.floor(e.dist / L) > before) this.lives -= e.boss ? 5 : 1; }
      else if (e.dist >= L) { this.lives -= e.boss ? 5 : 1; escaped.push(e); }
    }
    // 출구에 닿은 적은 다시 입구에서 출발 (보스는 계속 압박)
    for (const e of escaped) e.dist = 0;
    if (this.lives <= 0) { this.lives = 0; this.over = 'lose'; return; }

    for (const t of this.towers) {
      t.cd -= dt;
      if (t.cd > 0) continue;
      const p = PHIL.get(t.philId)!;
      const st = TIER_STATS[p.tier]!;
      const tx = t.cx + 0.5, ty = t.cy + 0.5;
      const im = this.itemMult(t);
      let best: Enemy | null = null;
      for (const e of this.enemies) {
        const [ex, ey] = this.enemyPos(e);
        if (Math.hypot(ex - tx, ey - ty) <= st.range + im.range && (!best || e.dist > best.dist)) best = e;
      }
      if (!best) continue;
      t.cd = st.cooldown;
      let dmg = st.dmg * (1 + UPGRADE.perLevel * t.level) * im.dmg;
      if (best.boss && t.philId === this.stage.counter) dmg *= COUNTER_MULT;
      this.bullets.push({ x: tx, y: ty, target: best.uid, dmg, text: p.quote, color: p.tier >= 6 ? 'rainbow' : p.tier >= 4 ? 'gold' : '' });
    }

    for (const b of this.bullets) {
      const e = this.enemies.find((x) => x.uid === b.target);
      if (!e) { b.dmg = 0; continue; }
      const [ex, ey] = this.enemyPos(e);
      const dx = ex - b.x, dy = ey - b.y, d = Math.hypot(dx, dy), step = 7 * dt;
      if (d <= step) { e.hp -= b.dmg; b.dmg = 0; } else { b.x += (dx / d) * step; b.y += (dy / d) * step; }
    }
    this.bullets = this.bullets.filter((b) => b.dmg > 0);

    for (const e of this.enemies) if (e.hp <= 0) {
      this.gold += e.reward;
      if (!e.boss && Math.random() < 0.03) this.gainCatalyst(this.randomCatalyst());
      if (Math.random() < (e.boss ? ITEM_DROP.boss : ITEM_DROP.normal)) this.dropItem();
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);

    if (this.running && this.toSpawn === 0 && this.enemies.length === 0) {
      this.running = false;
      this.gold += 40 + this.wave * 5;
      this.gainCatalyst(this.randomCatalyst());
      if (this.isBossWave()) { this.gainCatalyst(this.randomCatalyst()); this.gainCatalyst('C001'); }
      if (this.wave >= MAX_WAVE) this.over = 'win';
      else this.countdown = 3;
    }
  }
}
