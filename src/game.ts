import {
  PHIL, PHILOSOPHERS, RECIPES, TIER_STATS, COUNTER_MULT, SUMMON_RATES, MAX_MERGE_TIER, UPGRADE,
  type Recipe, type Stage,
} from './data';

import { ITEM_BONUS, isOwner } from './items';
import { DIFF, type Difficulty } from './difficulty';
import { SKILLS, type Skill } from './skills';
import { N, STAGE_PATHS, pathCells, pathLength, pointAt, type Layout } from './paths';

// 9x9 격자: 스테이지마다 길 모양이 다르고, 길이 아닌 칸에 타워를 배치
export const GRID = N;
export const MAX_WAVE = 20;
export const BOSS_WAVES = [10, 20];
/** 웨이브마다 적 체력 증가율 (밸런스 핵심 값) */
export const HP_GROWTH = 1.3;

// QA 모드: 주소 뒤에 ?qa=1 (전 스테이지 해금·재화 지급). 기본은 처음 시작하는 상태
export let QA_MODE = typeof location === 'undefined' ? false : new URLSearchParams(location.search).get('qa') === '1';
/** 마스터 계정 로그인 시 QA(전부 해금) 권한 */
export function setQA(on: boolean) { QA_MODE = on; }
/** 전투 시작 골드: 마스터(QA) 10000, 일반 200 */
const startGold = () => (QA_MODE ? 10000 : 200);
export const CATALYST_IDS = ['C001', 'C002', 'C003', 'C004', 'C005'];

export interface Tower { uid: number; philId: string; cx: number; cy: number; cd: number; level: number; shots?: number; stacks?: number; stunT?: number }
/** 메타 성장(카드 레벨·장착 도구)을 전투에 넘겨주는 통로 */
export interface Meta { cardMult(philId: string): number; tool(philId: string): string | undefined }
export type EnemyKind = 'normal' | 'fast' | 'tank' | 'swarm' | 'boss';
export interface Enemy {
  uid: number; hp: number; maxHp: number; dist: number; speed: number; boss: boolean; reward: number; name: string; path: number; kind: EnemyKind;
  slowT?: number; slowV?: number; stunT?: number; vulnT?: number; vulnV?: number; dotT?: number; dotV?: number; shieldT?: number; skillT?: number;
}
/** 화면 연출용 이벤트 (게임 규칙에는 영향 없음) */
export type FxEvent =
  | { type: 'hit'; x: number; y: number; dmg: number; big: boolean }
  | { type: 'kill'; x: number; y: number; gold: number; boss: boolean }
  | { type: 'shot'; uid: number }
  | { type: 'morph'; x: number; y: number; tier: number }
  | { type: 'boss'; name: string }
  | { type: 'bossSkill'; text: string }
  | { type: 'stun'; uid: number }
  | { type: 'skill'; kind: string; x: number; y: number; tx?: number; ty?: number; r?: number };
export interface Bullet { x: number; y: number; target: number; dmg: number; text: string; color: string; src: number; skill?: Skill }

let uidSeq = 1;
const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export class Game {
  gold = startGold();
  lives = 20;
  wave = 0;
  summonCost = 50;
  towers: Tower[] = [];
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  catalysts: Record<string, number> = Object.fromEntries(CATALYST_IDS.map((id) => [id, 0]));
  drops: string[] = [];
  fx: FxEvent[] = [];
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

  diff: Difficulty;
  get maxWave() { return this.diff.maxWave; }

  constructor(public stage: Stage, public meta: Meta = { cardMult: () => 1, tool: () => undefined }, diffId = 'normal') {
    this.diff = DIFF.get(diffId) ?? DIFF.get('normal')!;
    this.lives = this.diff.lives;
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
    this.gold += 25 * 2 ** (PHIL.get(t.philId)!.tier - 1);
    this.towers = this.towers.filter((x) => x !== t);
  }

  moveTo(t: Tower, cx: number, cy: number) {
    if (this.isRoad(cx, cy)) return;
    const other = this.towerAt(cx, cy);
    if (other) { other.cx = t.cx; other.cy = t.cy; }
    t.cx = cx; t.cy = cy;
  }

  // ---------- 장착 도구 (도감에서 미리 끼워 둔 것) ----------
  toolOf(t: Tower) { return this.meta.tool(t.philId); }

  itemMult(t: Tower) {
    const tool = this.toolOf(t);
    if (!tool) return { dmg: 1, range: 0 };
    return isOwner(tool, PHIL.get(t.philId)!.name)
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
    this.towers = this.towers.filter((t) => !used.includes(t) || t === keep);
    keep.philId = pick(PHILOSOPHERS.filter((x) => x.tier === tier + 1 && !x.hidden)).id;
    keep.cd = 0;
    this.discovered.add(keep.philId);
    this.fx.push({ type: 'morph', x: keep.cx + 0.5, y: keep.cy + 0.5, tier: PHIL.get(keep.philId)!.tier });
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
    this.towers = this.towers.filter((t) => !mats.includes(t) || t === keep);
    keep.philId = r.result;
    keep.cd = 0;
    keep.level = 0;
    this.fx.push({ type: 'morph', x: keep.cx + 0.5, y: keep.cy + 0.5, tier: PHIL.get(r.result)!.tier });
    this.discovered.add(r.result);
    return keep;
  }

  // ---------- 웨이브 ----------
  randomCatalyst() { return pick(CATALYST_IDS); }
  gainCatalyst(id: string) { this.catalysts[id]++; this.drops.push(id); }

  isBossWave() { return BOSS_WAVES.includes(this.wave); }

  /** 웨이브 구성: 2·7·12·17 떼, 3·8·13·18 빠름, 4·9·14·19 단단함 */
  waveKind(): EnemyKind {
    if (this.isBossWave()) return 'boss';
    const r = this.wave % 5;
    return r === 2 ? 'swarm' : r === 3 ? 'fast' : r === 4 ? 'tank' : 'normal';
  }

  startWave() {
    if (this.running || this.over || this.wave >= this.maxWave) return;
    this.wave++;
    this.refreshLayout();
    this.running = true;
    if (this.isBossWave()) this.fx.push({ type: 'boss', name: this.wave === 10 ? this.stage.boss10 : this.stage.boss20 });
    this.countdown = -1;
    const k = this.waveKind();
    const n = 8 + this.wave * 2;
    this.toSpawn = k === 'boss' ? 1 : k === 'swarm' ? Math.round(n * 1.6) : k === 'tank' ? Math.round(n * 0.5) : n;
    this.spawnTimer = 0;
  }

  private spawn() {
    const kind = this.waveKind();
    const base = 25 * HP_GROWTH ** (this.wave - 1) * this.diff.hp;
    const K = { normal: [1, 1], fast: [0.6, 1.7], tank: [2.6, 0.7], swarm: [0.45, 1.1], boss: [30, 0.65] }[kind];
    const hp = Math.round(base * K[0]);
    const s = this.stage;
    const boss = kind === 'boss';
    this.enemies.push({
      uid: uidSeq++, boss, kind, hp, maxHp: hp,
      dist: 0, speed: (1.4 + this.wave * 0.04) * K[1] * (this.layout.speedMult ?? 1) * this.diff.speed,
      path: Math.floor(Math.random() * this.layout.paths.length),
      reward: Math.max(1, Math.round((boss ? 150 * (this.wave / 10) : (5 + Math.floor(this.wave / 2)) * K[0] ** 0.5) * Math.sqrt(this.diff.reward))),
      name: boss ? (this.wave === 10 ? s.boss10 : s.boss20) : this.wave < 10 ? s.enemyEarly : s.enemyLate,
      skillT: 4,
    });
  }

  // ---------- 보스 고유 기술 (스테이지별) ----------
  private bossSkill(e: Enemy) {
    const near = (r: number) => this.towers.filter((t) => { const [x, y] = this.enemyPos(e); return Math.hypot(t.cx + 0.5 - x, t.cy + 0.5 - y) <= r; });
    const stun = (t: Tower, s: number) => { t.stunT = s; this.fx.push({ type: 'stun', uid: t.uid }); };
    switch (this.stage.id) {
      case 'S1': { // 독배: 가까운 철학자 하나를 잠재움
        const c = near(3); if (c.length) stun(pick(c), 2.5);
        this.fx.push({ type: 'bossSkill', text: '🍷 독배! 철학자가 잠들었다' }); break;
      }
      case 'S2': { // 화형: 가장 높은 등급 철학자를 봉인
        const top = [...this.towers].sort((a, b) => PHIL.get(b.philId)!.tier - PHIL.get(a.philId)!.tier)[0];
        if (top && !this.towers.some((t) => t.philId === this.stage.counter)) stun(top, 3);
        this.fx.push({ type: 'bossSkill', text: this.towers.some((t) => t.philId === this.stage.counter) ? '🪒 면도날이 화형을 막았다!' : '🔥 화형! 최고 등급이 봉인됐다' }); break;
      }
      case 'S3': e.shieldT = 1.5; this.fx.push({ type: 'bossSkill', text: '📜 암기 보호막! 잠시 무적' }); break;
      case 'S4': for (const t of this.towers) if (Math.random() < 0.35) stun(t, 1.2); this.fx.push({ type: 'bossSkill', text: '🐋 리바이어던의 포효! 일부가 얼어붙었다' }); break;
      case 'S5': e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.06); this.fx.push({ type: 'bossSkill', text: '📱 확증편향! 보스 체력 회복' }); break;
    }
  }

  // ---------- 피해 처리 ----------
  private damage(e: Enemy, dmg: number) {
    if (e.shieldT && e.shieldT > 0) return 0;
    const d = dmg * (e.vulnT && e.vulnT > 0 ? 1 + (e.vulnV ?? 0) : 1);
    e.hp -= d;
    return d;
  }

  private onHit(e: Enemy, dmg: number, skill: Skill | undefined, src: Tower | undefined) {
    const dealt = this.damage(e, dmg);
    const [ex, ey] = this.enemyPos(e);
    this.fx.push({ type: 'hit', x: ex, y: ey, dmg: dealt, big: dmg > 150 });
    if (!skill) return;
    const fx = (kind: string, extra: Partial<{ tx: number; ty: number; r: number }> = {}) => this.fx.push({ type: 'skill', kind, x: ex, y: ey, ...extra });
    if (skill.kind === 'slow') fx('slow');
    if (skill.kind === 'splash') fx('splash', { r: 1.2 });
    if (skill.kind === 'vuln') fx('vuln');
    if (skill.kind === 'dot') fx('dot');
    switch (skill.kind) {
      case 'slow': e.slowT = 1.5; e.slowV = Math.max(e.slowV ?? 0, skill.v); break;
      case 'stun': if (!e.boss && Math.random() < skill.v) { e.stunT = 0.8; fx('stun'); } break;
      case 'vuln': e.vulnT = 3; e.vulnV = Math.max(e.vulnT > 0 ? e.vulnV ?? 0 : 0, skill.v); break;
      case 'dot': e.dotT = 3; e.dotV = skill.v; break;
      case 'execute': if (!e.boss && e.hp > 0 && e.hp / e.maxHp <= skill.v) { e.hp = 0; fx('execute'); } break;
      case 'splash': for (const o of this.enemies) if (o !== e) { const [ox, oy] = this.enemyPos(o); if (Math.hypot(ox - ex, oy - ey) <= 1.2) this.damage(o, dmg * skill.v); } break;
      case 'chain': {
        const others = this.enemies.filter((o) => o !== e && o.hp > 0).map((o) => { const [ox, oy] = this.enemyPos(o); return { o, d: Math.hypot(ox - ex, oy - ey) }; })
          .filter((x) => x.d <= 2.2).sort((a, b) => a.d - b.d).slice(0, skill.v);
        let px = ex, py = ey;
        for (const { o } of others) { this.damage(o, dmg * 0.7); const [ox, oy] = this.enemyPos(o); this.fx.push({ type: 'skill', kind: 'chain', x: px, y: py, tx: ox, ty: oy }); this.fx.push({ type: 'hit', x: ox, y: oy, dmg: dmg * 0.7, big: false }); px = ox; py = oy; }
        break;
      }
      case 'stack': if (src) src.stacks = Math.min(1 / skill.v, (src.stacks ?? 0) + 1); break;
      case 'gold': if (e.hp <= 0) this.gold += skill.v; break;
    }
  }

  /** 주변 8칸 오라 합산 */
  private auras() {
    const atk = new Map<number, number>(), spd = new Map<number, number>();
    for (const a of this.towers) {
      const s = SKILLS[PHIL.get(a.philId)!.name];
      if (!s || (s.kind !== 'auraAtk' && s.kind !== 'auraSpeed') || (a.stunT ?? 0) > 0) continue;
      for (const t of this.towers) if (t !== a && Math.abs(t.cx - a.cx) <= 1 && Math.abs(t.cy - a.cy) <= 1) {
        const m = s.kind === 'auraAtk' ? atk : spd;
        m.set(t.uid, (m.get(t.uid) ?? 0) + s.v);
      }
    }
    return { atk, spd };
  }

  update(dt: number) {
    if (this.over) return;
    if (this.countdown > 0) { this.countdown -= dt; if (this.countdown <= 0) this.startWave(); }

    if (this.running && this.toSpawn > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) { this.spawn(); this.toSpawn--; this.spawnTimer = this.waveKind() === 'swarm' ? 0.4 : 0.7; }
    }
    if (this.noticeTime > 0) this.noticeTime -= dt;

    // 맵 전체 둔화 (가장 강한 것 하나)
    let gSlow = 0;
    for (const t of this.towers) { const s = SKILLS[PHIL.get(t.philId)!.name]; if (s?.kind === 'globalSlow') gSlow = Math.max(gSlow, s.v); }

    const escaped: Enemy[] = [];
    for (const e of this.enemies) {
      for (const k of ['slowT', 'stunT', 'vulnT', 'dotT', 'shieldT'] as const) if (e[k]) e[k] = Math.max(0, e[k]! - dt);
      if (e.dotT && e.dotT > 0) this.damage(e, e.maxHp * (e.dotV ?? 0) * dt * (e.boss ? 0.2 : 1));
      if (e.boss) { e.skillT = (e.skillT ?? 5) - dt; if (e.skillT <= 0) { e.skillT = 5; this.bossSkill(e); } }
      if (e.stunT && e.stunT > 0) continue;
      const slow = Math.min(0.7, (e.slowT && e.slowT > 0 ? e.slowV ?? 0 : 0) + gSlow);
      const L = pathLength(this.layout.paths[e.path % this.layout.paths.length]);
      const before = Math.floor(e.dist / L);
      e.dist += e.speed * (1 - slow) * dt;
      if (this.layout.loop) { if (Math.floor(e.dist / L) > before) this.lives -= e.boss ? 5 : 1; }
      else if (e.dist >= L) { this.lives -= e.boss ? 5 : 1; escaped.push(e); }
    }
    for (const e of escaped) e.dist = 0;
    if (this.lives <= 0) { this.lives = 0; this.over = 'lose'; return; }

    const { atk, spd } = this.auras();
    for (const t of this.towers) {
      if (t.stunT && t.stunT > 0) { t.stunT -= dt; continue; }
      t.cd -= dt * (1 + (spd.get(t.uid) ?? 0));
      if (t.cd > 0) continue;
      const p = PHIL.get(t.philId)!;
      const st = TIER_STATS[p.tier]!;
      const skill = SKILLS[p.name];
      const tx = t.cx + 0.5, ty = t.cy + 0.5;
      const im = this.itemMult(t);
      let best: Enemy | null = null;
      for (const e of this.enemies) {
        const [ex, ey] = this.enemyPos(e);
        if (Math.hypot(ex - tx, ey - ty) <= st.range + im.range && (!best || e.dist > best.dist)) best = e;
      }
      if (!best) continue;
      t.cd = st.cooldown;
      t.shots = (t.shots ?? 0) + 1;
      this.fx.push({ type: 'shot', uid: t.uid });
      let dmg = st.dmg * (1 + UPGRADE.perLevel * t.level) * im.dmg * this.meta.cardMult(t.philId) * (1 + (atk.get(t.uid) ?? 0));
      if (best.boss && t.philId === this.stage.counter) dmg *= COUNTER_MULT;
      if (skill) {
        if (skill.kind === 'crit' && Math.random() < skill.v) { dmg *= 2; this.fx.push({ type: 'skill', kind: 'crit', x: tx, y: ty }); }
        if (skill.kind === 'third' && t.shots % skill.v === 0) { dmg *= skill.v2 ?? 2; this.fx.push({ type: 'skill', kind: 'crit', x: tx, y: ty }); }
        if (skill.kind === 'boss' && best.boss) dmg *= 1 + skill.v;
        if (skill.kind === 'stack') dmg *= 1 + (t.stacks ?? 0) * skill.v;
        if (skill.kind === 'lonely' && !this.towers.some((o) => o !== t && Math.abs(o.cx - t.cx) <= 1 && Math.abs(o.cy - t.cy) <= 1)) dmg *= 1 + skill.v;
      }
      const color = p.tier >= 6 ? 'rainbow' : p.tier >= 4 ? 'gold' : '';
      this.bullets.push({ x: tx, y: ty, target: best.uid, dmg, text: p.quote, color, src: t.uid, skill });
      if (skill?.kind === 'multi' && Math.random() < skill.v) this.bullets.push({ x: tx, y: ty - 0.3, target: best.uid, dmg, text: p.quote, color, src: t.uid, skill });
    }

    for (const b of this.bullets) {
      const e = this.enemies.find((x) => x.uid === b.target);
      if (!e) { b.dmg = 0; continue; }
      const [ex, ey] = this.enemyPos(e);
      const dx = ex - b.x, dy = ey - b.y, d = Math.hypot(dx, dy), step = 7 * dt;
      if (d <= step) { this.onHit(e, b.dmg, b.skill, this.towers.find((t) => t.uid === b.src)); b.dmg = 0; }
      else { b.x += (dx / d) * step; b.y += (dy / d) * step; }
    }
    this.bullets = this.bullets.filter((b) => b.dmg > 0);

    for (const e of this.enemies) if (e.hp <= 0) {
      this.gold += e.reward;
      { const [kx, ky] = this.enemyPos(e); this.fx.push({ type: 'kill', x: kx, y: ky, gold: e.reward, boss: e.boss }); }
      if (!e.boss && Math.random() < 0.03) this.gainCatalyst(this.randomCatalyst());
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);

    if (this.running && this.toSpawn === 0 && this.enemies.length === 0) {
      this.running = false;
      this.gold += 40 + this.wave * 5;
      this.gainCatalyst(this.randomCatalyst());
      if (this.isBossWave()) { this.gainCatalyst(this.randomCatalyst()); this.gainCatalyst('C001'); }
      if (this.wave >= this.maxWave) this.over = 'win';
      else this.countdown = 3;
    }
  }
}
