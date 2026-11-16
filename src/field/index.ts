import { T, W, H, type FieldMap, type Poi } from './tilemap';
import { buildTiles, renderStatic, type Palette } from './render';
import { astar, nearestWalkable, Walker, type Pt } from './walk';
import './field.css';

export interface BubbleSpec { text: string; action?: { label: string; run(): void } }
export interface FieldOptions {
  host: HTMLElement;
  map: FieldMap;
  palette: Palette;
  /** 걷는 사람의 도트 (소크라테스 등 최애 철학자) */
  sprite: HTMLCanvasElement;
  start: Pt;
  selectedId: string;
  /** 거점에 닿았을 때 (장면 쪽에서 선택·말풍선을 결정한다) */
  onArrive(poi: Poi, handle: FieldHandle): void;
  /** 걷기가 끝나 서 있는 칸이 바뀔 때 */
  onMove(p: Pt): void;
  bubble(poi: Poi): BubbleSpec;
}
export interface FieldHandle { showBubble(poiId: string): void; destroy(): void; canvas: HTMLCanvasElement; wrap: HTMLElement }

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function mountField(o: FieldOptions): FieldHandle {
  const wrap = document.createElement('div'); wrap.className = 'field-wrap';
  const cv = document.createElement('canvas'); cv.className = 'field-canvas'; cv.setAttribute('aria-hidden', 'true');
  const bubble = document.createElement('div'); bubble.className = 'field-bubble hidden'; bubble.setAttribute('role', 'status');
  const sr = document.createElement('nav'); sr.className = 'field-sr'; sr.setAttribute('aria-label', '거점 목록');
  wrap.append(cv, bubble, sr); o.host.appendChild(wrap);
  const ctx = cv.getContext('2d')!;
  const tiles = buildTiles(o.palette), layer = renderStatic(o.map, tiles);
  const walker = new Walker(o.start.x, o.start.y);
  const cam = { x: 0, y: 0 };
  let Z = 2, dpr = 1, running = false, last = 0, arriveAt: Poi | null = null, mark: { x: number; y: number; t: number } | null = null, destroyed = false;
  const sel = o.map.pois.find((p) => p.id === o.selectedId);

  const view = () => ({ vw: cv.width / Z, vh: cv.height / Z });
  const clampCam = (tx: number, ty: number) => {
    const { vw, vh } = view();
    return { x: vw >= W * T ? (W * T - vw) / 2 : Math.min(Math.max(tx, 0), W * T - vw), y: vh >= H * T ? (H * T - vh) / 2 : Math.min(Math.max(ty, 0), H * T - vh) };
  };
  const camTarget = () => { const { vw, vh } = view(); return clampCam(walker.px * T + T / 2 - vw / 2, walker.py * T + T / 2 - vh * 0.55); };
  const snapCam = () => { const t = camTarget(); cam.x = t.x; cam.y = t.y; };
  function fit() {
    dpr = window.devicePixelRatio || 1;
    cv.width = Math.max(1, Math.round(cv.clientWidth * dpr)); cv.height = Math.max(1, Math.round(cv.clientHeight * dpr));
    ctx.imageSmoothingEnabled = false;
    Z = Math.max(1, Math.floor(cv.width / (W * T))); // 지도 폭이 화면에 한 번에 들어오는 정수 배율
    snapCam(); draw(0);
  }

  const perf = import.meta.env.VITE_QA_ROUTES ? ((window as unknown as { __fieldPerf?: { dt: number[]; draw: number[] } }).__fieldPerf ??= { dt: [], draw: [] }) : null;
  function draw(time: number) {
    const t0 = perf ? performance.now() : 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = o.palette.g[0]; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(Z, 0, 0, Z, -Math.round(cam.x * Z), -Math.round(cam.y * Z));
    ctx.drawImage(layer, 0, 0);
    if (sel) { ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 2; ctx.strokeRect(sel.x * T + 2, sel.y * T + 2, T - 4, T - 4); }
    if (mark) { const k = (mark.t * 3) % 1; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(mark.x * T + 4 - k * 3, mark.y * T + 4 - k * 3, T - 8 + k * 6, T - 8 + k * 6); }
    const bob = walker.moving ? Math.abs(Math.sin(walker.stride * 14)) * 3 : 0;
    ctx.fillStyle = '#00000040'; ctx.fillRect(walker.px * T + 8, walker.py * T + 26, 16, 4);
    ctx.save(); ctx.translate(Math.round(walker.px * T) + (walker.facing < 0 ? T : 0), Math.round(walker.py * T - 8 - bob)); ctx.scale(walker.facing, 1);
    ctx.drawImage(o.sprite, 0, 0, T, T); ctx.restore();
    if (perf && time) perf.draw.push(performance.now() - t0);
  }

  function frame(now: number) {
    if (destroyed || !cv.isConnected) { running = false; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (perf) perf.dt.push(dt * 1000);
    const arrived = walker.step(dt);
    if (mark && (mark.t += dt) > 0.7) mark = null;
    const t = camTarget(), k = Math.min(1, dt * 8);
    cam.x += (t.x - cam.x) * k; cam.y += (t.y - cam.y) * k;
    draw(now);
    if (arrived) finish();
    if (walker.moving || mark || Math.abs(t.x - cam.x) > 0.3 || Math.abs(t.y - cam.y) > 0.3) requestAnimationFrame(frame); else running = false;
  }
  const kick = () => { if (running) return; running = true; last = performance.now(); requestAnimationFrame(frame); };

  function finish() {
    o.onMove(walker.tile);
    const p = arriveAt; arriveAt = null;
    if (p) o.onArrive(p, handle);
  }
  function hideBubble() { bubble.classList.add('hidden'); bubble.textContent = ''; }
  function showBubble(id: string) {
    const p = o.map.pois.find((q) => q.id === id); if (!p) return;
    const spec = o.bubble(p);
    bubble.textContent = ''; const s = document.createElement('span'); s.textContent = spec.text; bubble.appendChild(s);
    if (spec.action) { const b = document.createElement('button'); b.type = 'button'; b.className = 'chunky mint'; b.textContent = spec.action.label; b.onclick = spec.action.run; bubble.appendChild(b); }
    bubble.classList.remove('hidden');
    // 걷는 사람 머리 위에 띄운다 (위가 모자라면 아래)
    const bw = bubble.offsetWidth, bh = bubble.offsetHeight, cw = cv.clientWidth, chh = cv.clientHeight;
    const hx = ((walker.px * T + T / 2 - cam.x) * Z) / dpr, hy = ((walker.py * T - cam.y) * Z) / dpr;
    const left = Math.min(Math.max(hx - bw / 2, 6), cw - bw - 6);
    const above = hy - bh - 14, top = above >= 6 ? above : Math.min(hy + (T * Z) / dpr + 6, chh - bh - 6);
    bubble.style.left = `${left}px`; bubble.style.top = `${top}px`;
  }
  function goTo(goal: Pt, poi: Poi | null) {
    hideBubble();
    const from = walker.tile; walker.teleport(from.x, from.y);
    const dest = nearestWalkable(o.map, goal, from); if (!dest) return;
    arriveAt = poi; mark = { x: dest.x, y: dest.y, t: 0 };
    if (dest.x === from.x && dest.y === from.y) { finish(); kick(); return; }
    const path = astar(o.map, from, dest);
    if (!path.length) { arriveAt = null; return; }
    if (reduceMotion()) { walker.teleport(dest.x, dest.y); snapCam(); draw(0); mark = null; finish(); return; }
    walker.path = path; kick();
  }
  const poiAt = (tx: number, ty: number) => o.map.pois.find((p) => p.x === tx && (p.y === ty || p.y === ty + 1)) ?? null;

  let down: { x: number; y: number; t: number } | null = null;
  cv.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  cv.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10 || performance.now() - down.t > 600) { down = null; return; }
    down = null;
    const r = cv.getBoundingClientRect(), sx = (e.clientX - r.left) * dpr, sy = (e.clientY - r.top) * dpr;
    const tx = Math.floor((sx / Z + cam.x) / T), ty = Math.floor((sy / Z + cam.y) / T);
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return;
    const poi = poiAt(tx, ty);
    goTo(poi ? { x: poi.x, y: poi.y } : { x: tx, y: ty }, poi);
  });
  for (const p of o.map.pois) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = p.name;
    b.setAttribute('aria-label', `${p.name}${p.state === 'lock' ? ' · 잠김' : p.state === 'done' ? ' · 클리어' : ''}로 이동`);
    b.onclick = () => goTo({ x: p.x, y: p.y }, p); sr.appendChild(b);
  }

  const ro = new ResizeObserver(() => fit()); ro.observe(cv);
  const handle: FieldHandle = { showBubble, destroy() { destroyed = true; ro.disconnect(); wrap.remove(); }, canvas: cv, wrap };
  requestAnimationFrame(() => { if (!destroyed) fit(); });
  return handle;
}
