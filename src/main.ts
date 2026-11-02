import { Game, GRID, QA_MODE, CATALYST_IDS, MAX_WAVE, type Tower } from './game';
import { STAGE_PATHS } from './paths';
import { ITEM, isOwner, ITEM_BONUS } from './items';
import {
  PHIL, PHILOSOPHERS, STAGES, TIER_STATS, CAT_ICON, ERA_ICON, RECIPES, SUMMON_RATES, TIER_NAME, MAX_MERGE_TIER, UPGRADE, type Stage,
} from './data';
import { philosopherSprite, monsterSprite, itemSprite, TIER_AURA } from './sprites';
import { loadProgress, saveProgress, resetProgress } from './save';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const spriteUrl = new Map<string, string>();
const itemUrl = (id: string) => itemSprite(id).toDataURL();
const portrait = (id: string) => {
  if (!spriteUrl.has(id)) spriteUrl.set(id, philosopherSprite(PHIL.get(id)!).toDataURL());
  return spriteUrl.get(id)!;
};

let progress = loadProgress();

// =============== 화면 전환 ===============
function show(id: 'home' | 'codex' | 'battle') {
  for (const s of document.querySelectorAll<HTMLElement>('.screen')) s.classList.toggle('hidden', s.id !== id);
  if (id === 'battle') requestAnimationFrame(resize);
}

const isUnlocked = (s: Stage) => QA_MODE || !s.unlockAfter || progress.cleared.includes(s.unlockAfter);

// =============== 홈: 스테이지 지도 ===============
function renderHome() {
  const box = $('stages');
  box.innerHTML = '';
  for (const s of STAGES) {
    const open = isUnlocked(s);
    const cleared = progress.cleared.includes(s.id);
    const b = document.createElement('button');
    b.className = `stage ${open ? '' : 'locked'} ${cleared ? 'cleared' : ''}`;
    b.disabled = !open;
    const hero = PHIL.get(s.counter)!;
    b.innerHTML = `<img src="${portrait(hero.id)}"><div><b>${ERA_ICON[s.era]} ${s.name}</b>${cleared ? ' <span class="badge">CLEAR</span>' : ''}
      <small>${open ? `${STAGE_PATHS[s.id].caption}<br>최종 보스: ${s.boss20} · 수호자: ${hero.name}` : `🔒 ${STAGES.find((x) => x.id === s.unlockAfter)!.name} 클리어 시 해금`}</small></div>`;
    b.onclick = () => startBattle(s);
    box.appendChild(b);
  }
}

// =============== 도감 ===============
function renderCodex() {
  const box = $('codex-list');
  box.innerHTML = '';
  const seen = new Set(progress.seen);
  $('codex-count').textContent = `${PHILOSOPHERS.filter((p) => seen.has(p.id)).length} / ${PHILOSOPHERS.length}`;
  for (let tier = 6; tier >= 1; tier--) {
    const list = PHILOSOPHERS.filter((x) => x.tier === tier);
    const h = document.createElement('h3');
    h.innerHTML = `<span class="tier-chip t${tier}">${'★'.repeat(tier)}</span> ${tier}성 · ${TIER_NAME[tier]} ${tier >= 5 ? '<small>(조합으로만)</small>' : ''}`;
    box.appendChild(h);
    const grid = document.createElement('div');
    grid.className = 'codex-grid';
    for (const p of list) {
      const known = seen.has(p.id) || (QA_MODE && !p.hidden);
      const d = document.createElement('div');
      d.className = `card t${p.tier} ${known ? '' : 'unknown'}`;
      d.innerHTML = `<img src="${portrait(p.id)}"><b>${known ? p.name : p.hidden ? '???' : '미발견'}</b><small>${ERA_ICON[p.era] ?? ''}</small>`;
      if (known) d.onclick = () => showCard(p.id);
      grid.appendChild(d);
    }
    box.appendChild(grid);
  }
}

const CARD_BG: Record<string, string> = {
  고대: 'linear-gradient(180deg,#bfe3ff,#f5ecd8)', 중세: 'linear-gradient(180deg,#c7b8e8,#e7e5e4)', 동양: 'linear-gradient(180deg,#d9f99d,#fef3c7)',
  근대: 'linear-gradient(180deg,#cbd5e1,#f1f5f9)', 현대: 'linear-gradient(180deg,#f5d0fe,#e0e7ff)', 히든: 'linear-gradient(180deg,#fef9c3,#fff)',
};
function cardHtml(id: string) {
  const p = PHIL.get(id)!;
  const recipes = RECIPES.filter((r) => r.result === id);
  const st = TIER_STATS[p.tier]!;
  return `<div class="pcard tc${p.tier}">
    <div class="pc-head"><span class="pc-tier">${'★'.repeat(p.tier)}</span><b>${p.name}</b><span class="pc-era">${ERA_ICON[p.era] ?? ''} ${p.school}</span></div>
    <div class="pc-art" style="background:${CARD_BG[p.era] ?? CARD_BG['고대']}"><img src="${portrait(id)}"></div>
    <div class="pc-quote">“${p.quote}”</div>
    <div class="pc-skill"><b>✦ ${p.skill}</b><span>${p.skillDesc}</span></div>
    <div class="pc-stats"><span>⚔ ${st.dmg}</span><span>◎ ${st.range}</span><span>⏱ ${st.cooldown}s</span></div>
    <div class="pc-lore">${p.lore}</div>
    ${recipes.map((r) => `<div class="pc-recipe">⚗ ${r.materials.map((m) => PHIL.get(m)!.name).join(' + ')}${r.catalyst ? ' + ' + CAT_ICON[r.catalyst] : ''}<small>${r.logic}</small></div>`).join('')}
    <div class="pc-foot">AGORA · ${TIER_NAME[p.tier]}</div>
  </div>`;
}
function showCard(id: string) { alertBox(cardHtml(id)); }

function toast(text: string) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

function alertBox(html: string) {
  const o = document.createElement('div');
  o.className = 'overlay';
  o.innerHTML = `<div class="pop">${html}<button class="primary">확인</button></div>`;
  o.onclick = (e) => { if (e.target === o || (e.target as HTMLElement).tagName === 'BUTTON') o.remove(); };
  document.body.appendChild(o);
}

// =============== 전투 ===============
const canvas = $<HTMLCanvasElement>('field');
const ctx = canvas.getContext('2d')!;
let game: Game | null = null;
let selected: Tower | null = null;
let speed = 1;
let cell = 0;
let tick = 0;
let resultShown = false;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const size = canvas.clientWidth;
  if (!size) return;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cell = size / GRID;
}
window.addEventListener('resize', resize);

function startBattle(s: Stage) {
  game = new Game(s);
  selected = null;
  resultShown = false;
  lastSynthKey = lastInfoKey = lastCatKey = '';
  show('battle');
  updateUI();
}

function endBattle() {
  if (game) {
    progress.seen = [...new Set([...progress.seen, ...game.discovered])];
    if (game.over === 'win' && !progress.cleared.includes(game.stage.id)) progress.cleared.push(game.stage.id);
    saveProgress(progress);
  }
  game = null;
  renderHome();
  show('home');
}

canvas.addEventListener('pointerdown', (ev) => {
  if (!game) return;
  const r = canvas.getBoundingClientRect();
  const cx = Math.floor(((ev.clientX - r.left) / r.width) * GRID);
  const cy = Math.floor(((ev.clientY - r.top) / r.height) * GRID);
  if (cx < 0 || cy < 0 || cx >= GRID || cy >= GRID || game.isRoad(cx, cy)) { selected = null; updateUI(); return; }
  const t = game.towerAt(cx, cy);
  if (selected && selected === t) selected = null;
  else if (selected) { game.moveTo(selected, cx, cy); selected = null; }
  else selected = t ?? null;
  updateUI();
});

$('summon').onclick = () => { game?.summon(); updateUI(); };
$('sell').onclick = () => { if (game && selected) { game.sell(selected); selected = null; updateUI(); } };
$('start').onclick = () => { game?.startWave(); updateUI(); };
$('speed').onclick = () => { speed = speed === 3 ? 1 : speed + 1; $('speed').textContent = `${speed}x`; };
$('quit').onclick = () => { if (confirmQuit()) endBattle(); };
const confirmQuit = () => !game || !!game.over || game.wave === 0 || window.confirm('전투를 포기하고 나갈까요?');

let lastSynthKey = '', lastInfoKey = '', lastCatKey = '';
function updateUI() {
  if (!game) return;
  const g = game;
  $('gold').textContent = String(g.gold);
  $('lives').textContent = String(g.lives);
  $('wave').textContent = String(g.wave);
  $('cost').textContent = String(g.summonCost);
  $<HTMLButtonElement>('summon').disabled = g.gold < g.summonCost || !!g.over;
  $<HTMLButtonElement>('sell').disabled = !selected;
  const start = $<HTMLButtonElement>('start');
  start.textContent = g.countdown > 0 ? `다음 웨이브 ${Math.ceil(g.countdown)}` : '웨이브 시작';
  start.disabled = !!g.over || g.running || g.countdown > 0;

  if (g.over && !resultShown) {
    resultShown = true;
    const newOnes = [...g.discovered].filter((id) => !progress.seen.includes(id));
    const s = g.stage;
    const unlocks = g.over === 'win' ? STAGES.filter((x) => x.unlockAfter === s.id && !progress.cleared.includes(s.id)).map((x) => x.name) : [];
    alertBox(g.over === 'win'
      ? `<h2>🏛 ${s.boss20} 논파!</h2><p>${s.name}을(를) 지켜 냈습니다.</p>${unlocks.length ? `<p>🔓 새 스테이지: <b>${unlocks.join(', ')}</b></p>` : ''}${newOnes.length ? `<p>📖 도감 등록 ${newOnes.length}명</p>` : ''}`
      : `<h2>💀 멘탈 붕괴</h2><p>${g.wave}웨이브에서 도그마에 잠식당했습니다.</p>${newOnes.length ? `<p>📖 그래도 도감에 ${newOnes.length}명 등록</p>` : ''}`);
    start.textContent = '나가기';
    start.disabled = false;
    start.onclick = () => { start.onclick = () => { game?.startWave(); updateUI(); }; endBattle(); };
  }

  // 정보창
  const info = $('info');
  const infoKey = `${selected?.uid}|${selected?.philId}|${selected?.level}|${selected?.item}|${g.bag.join()}|${g.towers.length > 0}|${selected && g.upgradeCost(selected) !== null ? g.gold >= g.upgradeCost(selected)! : ''}`;
  if (infoKey !== lastInfoKey) {
    lastInfoKey = infoKey;
    info.className = '';
    if (selected) {
      const p = PHIL.get(selected.philId)!;
      const cost = g.upgradeCost(selected);
      const lv = selected.level ? ` <span class="tag lv">Lv.${selected.level}</span>` : '';
      info.className = `t${p.tier}`;
      info.innerHTML = `<img src="${portrait(p.id)}"><div><b>${'★'.repeat(p.tier)} ${p.name}</b>${lv} · ${p.school}<br>“${p.quote}”<br><small>${p.lore}</small>${p.id === g.stage.counter ? '<br><small class="counter">⚔ 이 스테이지 보스에게 피해 3배</small>' : ''}
        ${equipHtml(g, selected)}
        ${cost !== null ? `<br><button id="upgrade" class="up">⬆ 강화 Lv.${selected.level + 1} (${cost}G) · 공격력 +${Math.round(UPGRADE.perLevel * 100)}%</button>` : ''}</div>`;
      for (const b of info.querySelectorAll<HTMLButtonElement>('button[data-item]'))
        b.onclick = () => { if (selected) { g.equip(selected, b.dataset.item!); lastInfoKey = ''; updateUI(); } };
      const up = document.getElementById('upgrade');
      if (up) { (up as HTMLButtonElement).disabled = g.gold < cost!; up.onclick = () => { if (selected && g.upgrade(selected)) { lastInfoKey = ''; updateUI(); } }; }
    } else info.innerHTML = g.towers.length
      ? '<small>같은 등급 3명이면 🎲 합성(1~3성)! 5성 이상은 📜 조합표의 재료를 모아 특수 연성.<br>철학자를 눌러 선택 → 빈 칸을 누르면 이동, 다른 철학자를 누르면 자리 바꾸기.</small>'
      : `<small><b>${g.stage.name}</b> — ${g.stage.story}<br>소환 버튼으로 철학자를 불러오세요.</small>`;
  }

  // 촉매
  if (g.itemDrops.length) {
    const got = g.itemDrops.splice(0).map((id) => ITEM.get(id)!.name);
    toast(`🎁 소품 획득: ${got.join(', ')}`);
  }
  const catKey = JSON.stringify(g.catalysts) + g.bag.length;
  if (catKey !== lastCatKey) {
    const fresh = new Set(g.drops.splice(0));
    lastCatKey = catKey;
    $('cats').innerHTML = (QA_MODE ? '<span class="qa">QA</span>' : '') + `<span class="stage-name">${ERA_ICON[g.stage.era]} ${g.stage.name}</span>` + CATALYST_IDS.map((id) =>
      `<span class="c ${g.catalysts[id] ? 'on' : ''} ${fresh.has(id) ? 'flash' : ''}">${CAT_ICON[id]}${g.catalysts[id]}</span>`).join('') + `<span class="c ${g.bag.length ? 'on' : ''}">🎒${g.bag.length}</span>`;
  }

  // 합성 / 특수 연성
  const merges = g.over ? [] : g.mergeable();
  const recipes = g.over ? [] : g.availableRecipes()
    .sort((a, b) => Number(g.hasCatalyst(b)) - Number(g.hasCatalyst(a)) || PHIL.get(b.result)!.tier - PHIL.get(a.result)!.tier)
    .slice(0, 3);
  const key = merges.join() + '|' + recipes.map((r) => r.id + g.hasCatalyst(r)).join();
  if (key !== lastSynthKey) {
    lastSynthKey = key;
    const box = $('synth');
    box.innerHTML = '';
    for (const tier of merges.slice(0, 2)) {
      const b = document.createElement('button');
      b.className = 'merge';
      b.textContent = `🎲 ${tier}성 ×3 → 무작위 ${tier + 1}성`;
      b.onclick = () => { selected = g.mergeThree(tier); updateUI(); };
      box.appendChild(b);
    }
    for (const r of recipes) {
      const b = document.createElement('button');
      const res = PHIL.get(r.result)!;
      const ok = g.hasCatalyst(r);
      const seen = progress.seen.includes(res.id) || QA_MODE;
      b.textContent = `⚗ ${ok ? '특수 연성!' : '촉매 부족'} ${r.materials.map((m) => PHIL.get(m)!.name).join('+')}${r.catalyst ? ' + ' + CAT_ICON[r.catalyst] : ''} → ${res.hidden && !seen ? '???' : res.name}`;
      if (!ok) { b.disabled = true; b.classList.add('locked'); }
      b.onclick = () => { selected = g.synthesize(r); updateUI(); };
      box.appendChild(b);
    }
  }
}

// ---------- 그리기 ----------
function draw() {
  if (!game || !cell) return;
  const g = game;
  const w = canvas.clientWidth;
  ctx.clearRect(0, 0, w, w);
  ctx.imageSmoothingEnabled = false;

  // ---- 바닥: 스테이지별 질감 (칸 테두리 없이 하나의 필드처럼) ----
  const th = THEME[g.stage.era] ?? THEME['고대'];
  ctx.fillStyle = th.ground; ctx.fillRect(0, 0, w, w);
  for (let i = 0; i < 140; i++) {
    const rx = hash(i * 7.1) * w, ry = hash(i * 3.3 + 1) * w, r = 1 + hash(i) * 2.5;
    ctx.fillStyle = i % 3 ? th.speck : th.speck2;
    ctx.beginPath(); ctx.arc(rx, ry, r, 0, Math.PI * 2); ctx.fill();
  }
  // 장식 (길·타워 없는 칸에 고정 배치)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
    if (g.isRoad(x, y) || g.towerAt(x, y)) continue;
    const r = hash(x * 13 + y * 31 + g.stage.id.length);
    if (r < 0.28) drawDecor(th.decor[Math.floor(r * 100) % th.decor.length], (x + 0.5) * cell, (y + 0.55) * cell, cell);
  }

  // ---- 길: 굽이치는 두꺼운 길 + 테두리 ----
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const [color, width] of [[th.roadEdge, 0.86], [th.road, 0.7]] as const) {
    ctx.strokeStyle = color; ctx.lineWidth = cell * width;
    for (const path of g.layout.paths) {
      ctx.beginPath();
      path.forEach(([px, py], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, (px + 0.5) * cell, (py + 0.5) * cell));
      if (g.layout.loop) ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.strokeStyle = th.roadLine; ctx.lineWidth = 2; ctx.setLineDash([4, 8]);
  for (const path of g.layout.paths) {
    ctx.beginPath();
    path.forEach(([px, py], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, (px + 0.5) * cell, (py + 0.5) * cell));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.font = `${cell * 0.55}px sans-serif`;
  const first = g.layout.paths[0];
  if (!g.layout.loop) {
    ctx.fillText('🚪', (first[0][0] + 0.5) * cell, (first[0][1] + 0.5) * cell);
    const end = first[first.length - 1];
    ctx.fillText(g.stage.id === 'S2' ? '⛪' : '🏁', (end[0] + 0.5) * cell, (end[1] + 0.5) * cell);
  }

  // 선택 시: 사거리 + 옮길 수 있는 자리 표시
  if (selected) {
    const st = TIER_STATS[PHIL.get(selected.philId)!.tier]!;
    ctx.save(); ctx.beginPath();
    ctx.arc((selected.cx + 0.5) * cell, (selected.cy + 0.5) * cell, st.range * cell, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(251,191,36,.10)'; ctx.fill();
    ctx.strokeStyle = 'rgba(251,191,36,.6)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(56,189,248,.28)';
    for (const [x, y] of g.emptyCells()) { ctx.beginPath(); ctx.arc((x + 0.5) * cell, (y + 0.62) * cell, cell * 0.16, 0, Math.PI * 2); ctx.fill(); }
  }

  // ---- 철학자: 그림자 + 큰 도트 + 등급 배지 ----
  const towers = [...g.towers].sort((a, b) => a.cy - b.cy);
  for (const t of towers) {
    const p = PHIL.get(t.philId)!;
    const cx = (t.cx + 0.5) * cell, foot = (t.cy + 0.9) * cell;
    const isSel = t === selected;
    if (isSel) { ctx.fillStyle = 'rgba(251,191,36,.55)'; ctx.beginPath(); ctx.ellipse(cx, foot, cell * 0.42, cell * 0.16, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(cx, foot, cell * 0.32, cell * 0.11, 0, 0, Math.PI * 2); ctx.fill();
    if (p.tier >= 6) {
      ctx.save(); ctx.globalAlpha = 0.35 + 0.2 * Math.sin(tick * 0.08);
      ctx.fillStyle = `hsl(${(tick * 2) % 360},90%,60%)`;
      ctx.beginPath(); ctx.arc(cx, foot - cell * 0.45, cell * 0.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    const bob = Math.sin((tick + t.cx * 9 + t.cy * 5) * 0.1) * cell * 0.03;
    const sz = cell * (p.tier >= 5 ? 1.12 : 1.0);
    ctx.drawImage(philosopherSprite(p), cx - sz / 2, foot - sz * 0.97 + bob, sz, sz);
    // 등급 배지
    const bx = (t.cx + 0.14) * cell, by = (t.cy + 0.14) * cell, br = cell * 0.15;
    ctx.fillStyle = TIER_AURA[p.tier]; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1c1917'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = `900 ${br * 1.3}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(p.tier), bx, by + 0.5);
    if (t.item) {
      const isz = cell * 0.38, ix = (t.cx + 0.62) * cell, iy = (t.cy + 0.42) * cell;
      if (isOwner(t.item, p.name)) { ctx.fillStyle = 'rgba(253,224,71,.55)'; ctx.beginPath(); ctx.arc(ix + isz / 2, iy + isz / 2, isz * 0.62, 0, Math.PI * 2); ctx.fill(); }
      ctx.drawImage(itemSprite(t.item), ix, iy, isz, isz);
    }
    if (t.level) {
      ctx.fillStyle = '#22d3ee'; ctx.font = `900 ${cell * 0.2}px sans-serif`;
      ctx.fillText(`+${t.level}`, (t.cx + 0.85) * cell, (t.cy + 0.15) * cell);
    }
  }

  for (const e of g.enemies) {
    const [ex, ey] = g.enemyPos(e);
    const x = ex * cell, y = ey * cell, sz = cell * (e.boss ? 1.25 : 0.85);
    const walk = Math.abs(Math.sin(tick * 0.2 + e.uid)) * 3;
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.beginPath(); ctx.ellipse(x, y + sz * 0.42, sz * 0.32, sz * 0.13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(monsterSprite(g.stage.era, e.boss ? 'boss' : g.wave < 10 ? 'early' : 'late'), x - sz / 2, y - sz / 2 - walk, sz, sz);
    const bw = sz * 0.9, r = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = '#0f172a'; ctx.fillRect(x - bw / 2, y - sz / 2 - 8, bw, 5);
    ctx.fillStyle = r > 0.4 ? '#10b981' : '#ef4444'; ctx.fillRect(x - bw / 2, y - sz / 2 - 8, bw * r, 5);
    if (e.boss) {
      ctx.fillStyle = '#fca5a5'; ctx.font = `700 ${cell * 0.15}px "Noto Sans KR", sans-serif`; ctx.textAlign = 'center';
      ctx.fillText(e.name, x, y - sz / 2 - 12);
    }
  }

  ctx.font = `700 ${Math.max(9, cell * 0.14)}px "Noto Sans KR", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const b of g.bullets) {
    const text = b.text.length > 9 ? b.text.slice(0, 8) + '…' : b.text;
    const tw = ctx.measureText(text).width + 10, x = b.x * cell, y = b.y * cell;
    ctx.fillStyle = b.color === 'rainbow' ? `hsl(${(tick * 3) % 360},90%,72%)` : b.color === 'gold' ? '#fbbf24' : '#fef3c7';
    ctx.beginPath(); ctx.roundRect(x - tw / 2, y - 9, tw, 18, 8); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 3, y + 8); ctx.lineTo(x + 3, y + 8); ctx.lineTo(x - 5, y + 13); ctx.fill();
    ctx.fillStyle = '#1c1917'; ctx.fillText(text, x, y);
  }

  if (g.noticeTime > 0) {
    ctx.save(); ctx.globalAlpha = Math.min(1, g.noticeTime);
    ctx.fillStyle = 'rgba(7,9,14,.85)'; ctx.fillRect(0, w / 2 - cell * 0.45, w, cell * 0.9);
    ctx.fillStyle = '#fde68a'; ctx.font = `800 ${Math.max(12, cell * 0.32)}px "Noto Sans KR", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(g.notice, w / 2, w / 2);
    ctx.restore();
  }

  if (g.wave === 0 && !g.running && g.countdown < 0) {
    ctx.fillStyle = 'rgba(7,9,14,.75)'; ctx.fillRect(0, w / 2 - cell * 0.9, w, cell * 1.8);
    ctx.fillStyle = 'rgba(254,243,199,.85)'; ctx.font = `800 ${cell * 0.22}px "Nanum Myeongjo", serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 ${cell * 0.4}px "Nanum Myeongjo", serif`;
    ctx.fillText(g.stage.name, w / 2, w / 2 - cell * 0.35);
    ctx.font = `700 ${cell * 0.22}px "Noto Sans KR", sans-serif`;
    ctx.fillText(STAGE_PATHS[g.stage.id].caption, w / 2, w / 2 + cell * 0.1);
    ctx.fillText(`최종 보스: ${g.stage.boss20} (${MAX_WAVE}웨이브)`, w / 2, w / 2 + cell * 0.45);
  }
}

// 스테이지별 필드 테마
const THEME: Record<string, { ground: string; speck: string; speck2: string; road: string; roadEdge: string; roadLine: string; decor: string[] }> = {
  고대: { ground: '#e7dcc4', speck: '#d6c8a8', speck2: '#f5ecd8', road: '#c8b48a', roadEdge: '#a8916a', roadLine: 'rgba(255,255,255,.5)', decor: ['column', 'olive', 'amphora'] },
  중세: { ground: '#6b6560', speck: '#57534e', speck2: '#7c766f', road: '#a8a29e', roadEdge: '#44403c', roadLine: 'rgba(253,224,71,.45)', decor: ['candle', 'stone', 'banner'] },
  동양: { ground: '#9cc77a', speck: '#86b564', speck2: '#b4d896', road: '#d9c39a', roadEdge: '#a68a5b', roadLine: 'rgba(255,255,255,.45)', decor: ['bamboo', 'pine', 'lantern'] },
  근대: { ground: '#9aa5b1', speck: '#87929e', speck2: '#adb7c2', road: '#6b7280', roadEdge: '#374151', roadLine: 'rgba(250,204,21,.6)', decor: ['gear', 'lamp', 'crate'] },
  현대: { ground: '#2e1065', speck: '#3b0f84', speck2: '#4c1d95', road: '#1e1b4b', roadEdge: '#a855f7', roadLine: 'rgba(244,114,182,.7)', decor: ['letter', 'crystal', 'screen'] },
};
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
function drawDecor(kind: string, x: number, y: number, c: number) {
  const r = (dx: number, dy: number, w: number, h: number, col: string) => { ctx.fillStyle = col; ctx.fillRect(x + dx * c, y + dy * c, w * c, h * c); };
  const o = (dx: number, dy: number, rad: number, col: string) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + dx * c, y + dy * c, rad * c, 0, Math.PI * 2); ctx.fill(); };
  switch (kind) {
    case 'column': r(-0.12, -0.3, 0.24, 0.55, '#f5f5f4'); r(-0.18, -0.34, 0.36, 0.07, '#d6d3d1'); r(-0.18, 0.22, 0.36, 0.07, '#d6d3d1'); break;
    case 'olive': o(0, -0.1, 0.22, '#65a30d'); r(-0.03, 0.05, 0.06, 0.2, '#78350f'); o(0.08, -0.15, 0.04, '#1c1917'); break;
    case 'amphora': o(0, 0.02, 0.15, '#c2410c'); r(-0.05, -0.2, 0.1, 0.12, '#c2410c'); r(-0.15, -0.03, 0.3, 0.03, '#1c1917'); break;
    case 'candle': r(-0.05, -0.12, 0.1, 0.3, '#fef3c7'); o(0, -0.18, 0.06, '#f59e0b'); break;
    case 'stone': o(0, 0.05, 0.18, '#57534e'); o(-0.05, 0, 0.08, '#78716c'); break;
    case 'banner': r(-0.02, -0.35, 0.04, 0.6, '#44403c'); r(0.02, -0.33, 0.22, 0.28, '#b91c1c'); break;
    case 'bamboo': r(-0.12, -0.35, 0.07, 0.6, '#15803d'); r(0.05, -0.25, 0.07, 0.5, '#16a34a'); break;
    case 'pine': o(0, -0.12, 0.2, '#166534'); o(0, -0.25, 0.13, '#15803d'); r(-0.03, 0.05, 0.06, 0.15, '#78350f'); break;
    case 'lantern': r(-0.1, -0.15, 0.2, 0.25, '#dc2626'); r(-0.06, -0.2, 0.12, 0.05, '#1c1917'); o(0, -0.03, 0.05, '#fde047'); break;
    case 'gear': o(0, 0, 0.18, '#475569'); o(0, 0, 0.07, '#9aa5b1'); break;
    case 'lamp': r(-0.02, -0.3, 0.04, 0.55, '#1f2937'); o(0, -0.32, 0.08, '#fde047'); break;
    case 'crate': r(-0.15, -0.1, 0.3, 0.25, '#a16207'); r(-0.15, 0.02, 0.3, 0.02, '#78350f'); break;
    case 'letter': ctx.fillStyle = 'rgba(244,114,182,.7)'; ctx.font = `900 ${c * 0.35}px serif`; ctx.fillText('ㅋ?A@'[Math.floor(hash(x + y) * 4)], x, y); break;
    case 'crystal': ctx.fillStyle = '#c084fc'; ctx.beginPath(); ctx.moveTo(x, y - 0.25 * c); ctx.lineTo(x + 0.12 * c, y); ctx.lineTo(x, y + 0.2 * c); ctx.lineTo(x - 0.12 * c, y); ctx.fill(); break;
    case 'screen': r(-0.16, -0.12, 0.32, 0.22, '#0f172a'); r(-0.13, -0.09, 0.26, 0.16, '#22d3ee'); break;
  }
}

const SHORT: Record<string, string> = { '엘레아의 제논': '제논', '오컴의 윌리엄': '오컴', '이븐 시나': '이븐시나', '이븐 루시드': '이븐루시드', '알 킨디': '알킨디', '힐데가르트 폰 빙엔': '힐데가르트' };
function shortName(name: string) {
  const s = SHORT[name] ?? name.split(' ').pop()!;
  return s.length > 5 ? s.slice(0, 5) : s;
}

// ---------- 장착 ----------
function equipHtml(g: Game, t: Tower) {
  const p = PHIL.get(t.philId)!;
  const cur = t.item ? ITEM.get(t.item)! : null;
  const curHtml = cur ? `<br><small class="equip">🎒 장착: <img src="${itemUrl(cur.id)}">${cur.name}${isOwner(cur.id, p.name) ? ' <b class="match">찰떡! 공격 +60% · 사거리 +</b>' : ' (공격 +20%)'}</small>` : '';
  if (!g.bag.length) return curHtml;
  const uniq = [...new Set(g.bag)].sort((a, b) => Number(isOwner(b, p.name)) - Number(isOwner(a, p.name)));
  return curHtml + `<div class="bag">${uniq.map((id) => {
    const it = ITEM.get(id)!; const own = isOwner(id, p.name);
    const n = g.bag.filter((x) => x === id).length;
    return `<button data-item="${id}" class="${own ? 'own' : ''}" title="${it.desc}"><img src="${itemUrl(id)}">${it.name}${n > 1 ? '×' + n : ''}${own ? ' ★' : ''}</button>`;
  }).join('')}</div>`;
}

// ---------- 조합표 · 확률표 ----------
function recipeSheet() {
  const g = game;
  const rows = RECIPES.filter((r) => !PHIL.get(r.result)!.hidden || progress.seen.includes(r.result))
    .sort((a, b) => PHIL.get(a.result)!.tier - PHIL.get(b.result)!.tier);
  const html = rows.map((r) => {
    const res = PHIL.get(r.result)!;
    const owned = g ? g.ownedMaterials(r) : r.materials.map(() => false);
    const mats = r.materials.map((m, i) => {
      const p = PHIL.get(m)!;
      return `<span class="mat t${p.tier} ${owned[i] ? 'have' : ''}"><img src="${portrait(m)}">${p.name}<i>${p.tier}성</i></span>`;
    }).join('<b class="plus">+</b>');
    const cat = r.catalyst ? `<b class="plus">+</b><span class="mat cat ${g && g.catalysts[r.catalyst] ? 'have' : ''}">${CAT_ICON[r.catalyst]}</span>` : '';
    const ready = g && owned.every(Boolean) && g.hasCatalyst(r);
    return `<div class="rrow ${ready ? 'ready' : ''}"><div class="res t${res.tier}"><img src="${portrait(res.id)}"><b>${res.name}</b><i>${'★'.repeat(res.tier)}</i></div>
      <div class="mats">${mats}${cat}</div><small>${r.logic}</small></div>`;
  }).join('');
  alertBox(`<h2>📜 조합표</h2><p class="hint">초록 테두리 = 지금 전장에 있는 재료</p><div class="rlist">${html}</div>`);
}

function rateSheet() {
  const rates = SUMMON_RATES.map((r) => {
    const n = PHILOSOPHERS.filter((p) => p.tier === r.tier && !p.hidden).length;
    return `<tr><td><span class="tier-chip t${r.tier}">${'★'.repeat(r.tier)}</span></td><td><b>${(r.rate * 100).toFixed(0)}%</b></td><td>${n}명 · 1인당 ${(r.rate * 100 / n).toFixed(2)}%</td></tr>`;
  }).join('');
  const merges = [1, 2, 3].filter((t) => t <= MAX_MERGE_TIER).map((t) => {
    const n = PHILOSOPHERS.filter((p) => p.tier === t + 1 && !p.hidden).length;
    return `<tr><td>${t}성 ×3</td><td>→ ${t + 1}성</td><td>${n}명 중 1명 (각 ${(100 / n).toFixed(1)}%)</td></tr>`;
  }).join('');
  alertBox(`<h2>🎲 확률표</h2><table class="rates"><tr><th>등급</th><th>소환</th><th>인원</th></tr>${rates}</table>
    <table class="rates"><tr><th>합성</th><th>결과</th><th>확률</th></tr>${merges}<tr><td>5·6성</td><td colspan=2>📜 조합표로만 획득</td></tr></table>`);
}

// ---------- 루프 ----------
let last = performance.now();
let uiTimer = 0;
function loop(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000) * speed;
  last = now;
  if (game) {
    game.update(dt);
    tick += dt * 60;
    if ((uiTimer += dt) > 0.15) { uiTimer = 0; updateUI(); }
    draw();
  }
  requestAnimationFrame(loop);
}

// ---------- 시작 ----------
$('open-recipes').onclick = recipeSheet;
$('open-rates').onclick = rateSheet;
$('b-recipes').onclick = recipeSheet;
$('open-codex').onclick = () => { renderCodex(); show('codex'); };
$('codex-back').onclick = () => show('home');
$('reset').onclick = () => { if (window.confirm('클리어 기록과 도감을 모두 지울까요?')) { resetProgress(); progress = loadProgress(); renderHome(); } };
renderHome();
show('home');
requestAnimationFrame(loop);
