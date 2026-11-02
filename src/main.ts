import { Game, GRID, trackPos, QA_MODE, CATALYST_IDS, type Tower } from './game';
import catalystsJson from './data/catalysts.json';
const CAT_ICON: Record<string, string> = Object.fromEntries(catalystsJson.map((c) => [c.id, c.name.split(' ')[0]]));
import { PHIL, TIER_STATS } from './data';
import { philosopherSprite, monsterSprite, TIER_AURA } from './sprites';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('field');
const ctx = canvas.getContext('2d')!;

let game = new Game();
let selected: Tower | null = null;
let speed = 1;
let cell = 0;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const size = canvas.clientWidth;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cell = size / GRID;
}
window.addEventListener('resize', resize);
resize();

// ---------- 입력: 탭으로 선택 / 이동 / 스왑 ----------
canvas.addEventListener('pointerdown', (ev) => {
  const r = canvas.getBoundingClientRect();
  const cx = Math.floor(((ev.clientX - r.left) / r.width) * GRID);
  const cy = Math.floor(((ev.clientY - r.top) / r.height) * GRID);
  const inner = cx >= 1 && cy >= 1 && cx < GRID - 1 && cy < GRID - 1;
  if (!inner) { selected = null; return; }
  const t = game.towerAt(cx, cy);
  if (selected && selected === t) selected = null;
  else if (selected) { game.moveTo(selected, cx, cy); selected = null; }
  else selected = t ?? null;
  updateUI();
});

$('summon').onclick = () => { game.summon(); updateUI(); };
$('sell').onclick = () => { if (selected) { game.sell(selected); selected = null; updateUI(); } };
$('start').onclick = () => {
  if (game.over) { game = new Game(); selected = null; } else game.startWave();
  updateUI();
};
$('speed').onclick = () => { speed = speed === 3 ? 1 : speed + 1; $('speed').textContent = `${speed}x`; };

// ---------- 하단 UI ----------
let lastSynthKey = '';
let lastCatKey = '';
let lastInfoKey = '';
function updateUI() {
  $('gold').textContent = String(game.gold);
  $('lives').textContent = String(game.lives);
  $('wave').textContent = String(game.wave);
  $('cost').textContent = String(game.summonCost);
  $<HTMLButtonElement>('summon').disabled = game.gold < game.summonCost || !!game.over;
  $<HTMLButtonElement>('sell').disabled = !selected;
  const start = $<HTMLButtonElement>('start');
  start.textContent = game.over ? '다시 하기' : game.countdown > 0 ? `다음 웨이브 ${Math.ceil(game.countdown)}` : '웨이브 시작';
  start.disabled = !game.over && (game.running || game.countdown > 0);

  const info = $('info');
  const infoKey = `${game.over}|${selected?.uid}|${selected?.philId}|${game.towers.length > 0}`;
  if (infoKey !== lastInfoKey) {
  lastInfoKey = infoKey;
  info.className = '';
  if (game.over) info.innerHTML = game.over === 'win' ? '<b>🏛 아고라 수호 성공!</b> 30웨이브를 모두 논파했습니다.' : '<b>💀 멘탈 붕괴...</b> 도그마가 아고라를 점령했습니다.';
  else if (selected) {
    const p = PHIL.get(selected.philId)!;
    info.className = `t${p.tier}`;
    info.innerHTML = `<img src="${philosopherSprite(p).toDataURL()}"><div><b>${'★'.repeat(p.tier)} ${p.name}</b> · ${p.school}<br>“${p.quote}”<br><small>${p.lore}</small><br><small style="color:#38bdf8">빈 칸 → 이동 · 다른 철학자 → 자리 바꾸기</small></div>`;
  } else info.textContent = game.towers.length ? '철학자를 눌러 선택하세요. 재료가 모이면 아래에 연성 버튼이 뜹니다.' : '소환 버튼으로 1성 철학자를 불러오세요.';

  }

  // 촉매 보유 현황
  const cats = $('cats');
  const catKey = JSON.stringify(game.catalysts);
  if (catKey !== lastCatKey) {
    const fresh = new Set(game.drops.splice(0));
    lastCatKey = catKey;
    cats.innerHTML = (QA_MODE ? '<span class="qa">QA</span>' : '') + CATALYST_IDS.map((id) =>
      `<span class="c ${game.catalysts[id] ? 'on' : ''} ${fresh.has(id) ? 'flash' : ''}">${CAT_ICON[id]} ${game.catalysts[id]}</span>`).join('');
  }

  // 원터치 연성 버튼 (목록이 바뀔 때만 다시 그림)
  const recipes = game.over ? [] : game.availableRecipes()
    .sort((a, b) => Number(game.hasCatalyst(b)) - Number(game.hasCatalyst(a)) || PHIL.get(b.result)!.tier - PHIL.get(a.result)!.tier)
    .slice(0, 3);
  const merges = game.over ? [] : game.mergeable();
  const key = merges.join() + '|' + recipes.map((r) => r.id + game.hasCatalyst(r)).join();
  if (key !== lastSynthKey) {
    lastSynthKey = key;
    const box = $('synth');
    box.innerHTML = '';
    for (const id of merges.slice(0, 2)) {
      const p = PHIL.get(id)!;
      const b = document.createElement('button');
      b.className = 'merge';
      b.textContent = `🎲 ${p.name} ×3 → 무작위 ${p.tier + 1}성`;
      b.onclick = () => { selected = game.mergeThree(id); updateUI(); };
      box.appendChild(b);
    }
    for (const r of recipes) {
      const b = document.createElement('button');
      const res = PHIL.get(r.result)!;
      const cat = r.catalyst ? ` + ${CAT_ICON[r.catalyst]}` : '';
      const ok = game.hasCatalyst(r);
      b.textContent = `⚗ ${ok ? '특수 연성!' : '촉매 부족'} ${r.materials.map((m) => PHIL.get(m)!.name).join('+')}${cat} → ${res.name}`;
      if (!ok) { b.disabled = true; b.classList.add('locked'); }
      b.onclick = () => { const t = game.synthesize(r); selected = t; updateUI(); };
      box.appendChild(b);
    }
  }
}

// ---------- 그리기 (이전 버전 아고라 전장 스타일) ----------
let tick = 0;
function draw() {
  const w = canvas.clientWidth;
  ctx.clearRect(0, 0, w, w);
  ctx.imageSmoothingEnabled = false;

  // 외곽 트랙 도로 + 금색 점선
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = cell * 0.9;
  ctx.strokeRect(cell / 2, cell / 2, w - cell, w - cell);
  ctx.strokeStyle = 'rgba(245,158,11,.25)'; ctx.lineWidth = 2; ctx.setLineDash([8, 8]);
  ctx.strokeRect(cell / 2, cell / 2, w - cell, w - cell);
  ctx.setLineDash([]);

  if (selected) {
    const st = TIER_STATS[PHIL.get(selected.philId)!.tier]!;
    ctx.save(); ctx.beginPath();
    ctx.arc((selected.cx + 0.5) * cell, (selected.cy + 0.5) * cell, st.range * cell, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(251,191,36,.07)'; ctx.fill();
    ctx.strokeStyle = 'rgba(251,191,36,.45)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]); ctx.stroke();
    ctx.restore();
  }

  // 안쪽 타일 + 철학자 도트
  const pad = cell * 0.06;
  for (let y = 1; y < GRID - 1; y++) for (let x = 1; x < GRID - 1; x++) {
    const t = game.towerAt(x, y);
    const isSel = !!t && t === selected;
    ctx.fillStyle = t ? '#182032' : selected ? '#132338' : '#0f1420';
    ctx.strokeStyle = isSel ? '#fbbf24' : selected ? 'rgba(56,189,248,.5)' : t ? '#475569' : '#1e293b';
    ctx.lineWidth = isSel ? 3 : 1.5;
    ctx.beginPath(); ctx.roundRect(x * cell + pad, y * cell + pad, cell - pad * 2, cell - pad * 2, cell * 0.14);
    ctx.fill(); ctx.stroke();
    const cx = (x + 0.5) * cell;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    if (!t) {
      ctx.fillStyle = selected ? '#38bdf8' : '#334155';
      ctx.font = `700 ${cell * 0.16}px "Noto Sans KR", sans-serif`;
      ctx.fillText(selected ? '이동' : '+', cx, (y + 0.56) * cell);
      continue;
    }
    const p = PHIL.get(t.philId)!;
    ctx.fillStyle = TIER_AURA[p.tier];
    ctx.fillRect(x * cell + cell * 0.18, y * cell + pad + 2, cell * 0.64, 3);
    const bob = Math.sin((tick + x * 9 + y * 5) * 0.1) * 2;
    const sz = cell * 0.62;
    ctx.drawImage(philosopherSprite(p), cx - sz / 2, y * cell + cell * 0.07 + bob, sz, sz);
    ctx.fillStyle = '#f8fafc'; ctx.font = `700 ${cell * 0.15}px "Noto Sans KR", sans-serif`;
    ctx.fillText(shortName(p.name), cx, y * cell + cell * 0.8);
    ctx.fillStyle = '#fbbf24'; ctx.font = `${cell * 0.12}px sans-serif`;
    ctx.fillText('★'.repeat(p.tier), cx, y * cell + cell * 0.93);
  }

  // 적: 그림자 + 도트 + HP바
  for (const e of game.enemies) {
    const [ex, ey] = trackPos(e.dist);
    const x = ex * cell, y = ey * cell, sz = cell * (e.boss ? 0.95 : 0.62);
    const walk = Math.abs(Math.sin(tick * 0.2 + e.uid)) * 3;
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.beginPath(); ctx.ellipse(x, y + sz * 0.42, sz * 0.32, sz * 0.13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(monsterSprite(game.wave, e.boss), x - sz / 2, y - sz / 2 - walk, sz, sz);
    const bw = sz * 0.9, r = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = '#0f172a'; ctx.fillRect(x - bw / 2, y - sz / 2 - 8, bw, 5);
    ctx.fillStyle = r > 0.4 ? '#10b981' : '#ef4444'; ctx.fillRect(x - bw / 2, y - sz / 2 - 8, bw * r, 5);
  }

  // 말풍선 탄환 (4성 이상은 금색)
  ctx.font = `700 ${Math.max(9, cell * 0.14)}px "Noto Sans KR", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const b of game.bullets) {
    const text = b.text.length > 9 ? b.text.slice(0, 8) + '…' : b.text;
    const tw = ctx.measureText(text).width + 10, x = b.x * cell, y = b.y * cell;
    ctx.fillStyle = b.color === 'gold' ? '#fbbf24' : '#fef3c7';
    ctx.beginPath(); ctx.roundRect(x - tw / 2, y - 9, tw, 18, 8); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 3, y + 8); ctx.lineTo(x + 3, y + 8); ctx.lineTo(x - 5, y + 13); ctx.fill();
    ctx.fillStyle = '#1c1917'; ctx.fillText(text, x, y);
  }

  if (game.wave === 0 && !game.running && game.countdown < 0) {
    ctx.fillStyle = 'rgba(254,243,199,.85)'; ctx.font = `800 ${cell * 0.22}px "Nanum Myeongjo", serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('사유하라, 조합하라,', w / 2, w / 2 - cell * 0.18);
    ctx.fillText('도그마를 논파하라!', w / 2, w / 2 + cell * 0.18);
  }
}

function shortName(name: string) {
  const parts = name.split(' ');
  const last = parts.length > 1 && !name.includes('&') ? parts[parts.length - 1] : name.split(' ')[0];
  return last.length > 5 ? last.slice(0, 5) : last;
}

// ---------- 루프 ----------
let last = performance.now();
let uiTimer = 0;
function loop(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000) * speed;
  last = now;
  game.update(dt);
  tick += dt * 60;
  if ((uiTimer += dt) > 0.15) { uiTimer = 0; updateUI(); }
  draw();
  requestAnimationFrame(loop);
}
updateUI();
requestAnimationFrame(loop);
