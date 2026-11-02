import { Game, GRID, QA_MODE, CATALYST_IDS, type Tower } from './game';
import { STAGE_PATHS } from './paths';
import { DIFFICULTIES, DIFF, clearKey } from './difficulty';
import { ITEM, isOwner, ITEM_BONUS } from './items';
import {
  PHIL, PHILOSOPHERS, STAGES, TIER_STATS, CAT_ICON, ERA_ICON, RECIPES, SUMMON_RATES, TIER_NAME, MAX_MERGE_TIER, UPGRADE, type Stage,
} from './data';
import { philosopherSprite, monsterSprite, itemSprite, TIER_AURA } from './sprites';
import { loadProgress, saveProgress, resetProgress, cardLevel, cardMult, nextLevelAt, CARD_MAX_LEVEL, CARD_ATK_PER_LEVEL } from './save';
import { settleIdle, tapGain, tapUpgradeCost, battleReward, pull, CARD_COST, CARD_COST_10, TOOL_COST, TOOL_COST_10, CARD_RATES, QA_GONOE, IDLE_PER_SEC } from './meta';
import { ITEMS } from './items';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const spriteUrl = new Map<string, string>();
const itemUrl = (id: string) => itemSprite(id).toDataURL();
const portrait = (id: string) => {
  if (!spriteUrl.has(id)) spriteUrl.set(id, philosopherSprite(PHIL.get(id)!).toDataURL());
  return spriteUrl.get(id)!;
};

let progress = loadProgress();

// =============== 화면 전환 ===============
function show(id: 'home' | 'battle') {
  for (const s of document.querySelectorAll<HTMLElement>('.screen')) s.classList.toggle('hidden', s.id !== id);
  if (id === 'battle') requestAnimationFrame(resize);
}

let diffId = 'easy';
/** 스테이지별 난이도 해금: 쉬움은 항상, 다음 단계는 앞 단계를 깨야 */
const diffUnlocked = (stageId: string, id: string) => {
  if (QA_MODE) return true;
  const i = DIFFICULTIES.findIndex((d) => d.id === id);
  return i === 0 || progress.cleared.includes(clearKey(stageId, DIFFICULTIES[i - 1].id));
};
const isUnlocked = (s: Stage) => QA_MODE || !s.unlockAfter || progress.cleared.includes(s.unlockAfter);

// =============== 홈: 스테이지 지도 ===============
function renderHome() {
  const box = $('stages');
  box.innerHTML = '';
  const chips = document.createElement('div');
  chips.className = 'diffs';
  chips.innerHTML = DIFFICULTIES.map((d) => `<button data-diff="${d.id}" class="${d.id === diffId ? 'on' : ''}" style="--c:${d.color}">${d.icon}<span>${d.name}</span></button>`).join('');
  box.appendChild(chips);
  for (const b of chips.querySelectorAll<HTMLButtonElement>('button')) b.onclick = () => { diffId = b.dataset.diff!; renderHome(); };
  const cur = DIFF.get(diffId)!;
  const note = document.createElement('p');
  note.className = 'hint diff-note';
  note.innerHTML = `${cur.icon} <b>${cur.name}</b> · 적 체력 ×${cur.hp} · 멘탈 ${cur.lives} · 보상 ×${cur.reward} · ${cur.maxWave}웨이브${cur.goalWave ? ` <i>(챌린지 최종 목표 ${cur.goalWave}웨이브 · 현재 ${cur.maxWave}까지 개방)</i>` : ''}`;
  box.appendChild(note);
  for (const s of STAGES) {
    const open = isUnlocked(s) && diffUnlocked(s.id, diffId);
    const cleared = progress.cleared.includes(clearKey(s.id, diffId));
    const marks = DIFFICULTIES.map((d) => progress.cleared.includes(clearKey(s.id, d.id)) ? d.icon : '·').join('');
    const b = document.createElement('button');
    b.className = `stage ${open ? '' : 'locked'} ${cleared ? 'cleared' : ''}`;
    b.disabled = !open;
    const hero = PHIL.get(s.counter)!;
    b.innerHTML = `<img src="${portrait(hero.id)}"><div><b>${ERA_ICON[s.era]} ${s.name}</b>${cleared ? ' <span class="badge">CLEAR</span>' : ''}
      <small><span class="marks">${marks}</span> ${open ? `${STAGE_PATHS[s.id].caption}<br>최종 보스: ${s.boss20} · 수호자: ${hero.name}` : !isUnlocked(s) ? `🔒 ${STAGES.find((x) => x.id === s.unlockAfter)?.name} 클리어 시 해금` : `🔒 이 스테이지의 ${DIFFICULTIES[DIFFICULTIES.findIndex((d) => d.id === diffId) - 1]?.name} 클리어 시 해금`}</small></div>`;
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
      const n = progress.cards[p.id] ?? 0, lv = cardLevel(n);
      const tool = progress.loadout[p.id];
      const d = document.createElement('div');
      d.className = `card t${p.tier} ${known ? '' : 'unknown'} ${n ? 'owned' : ''}`;
      d.innerHTML = `${lv ? `<span class="lv">Lv.${lv}</span>` : ''}${tool ? `<img class="tool-badge" src="${itemUrl(tool)}">` : ''}<img src="${portrait(p.id)}"><b>${known ? p.name : p.hidden ? '???' : '미발견'}</b><small>${n ? `🎴${n}` : ERA_ICON[p.era] ?? ''}</small>`;
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
function showCard(id: string) {
  const p = PHIL.get(id)!;
  const n = progress.cards[id] ?? 0, lv = cardLevel(n), next = nextLevelAt(n);
  const ownedTools = ITEMS.filter((it) => progress.items[it.id]).sort((a, b) => Number(isOwner(b.id, p.name)) - Number(isOwner(a.id, p.name)));
  const cur = progress.loadout[id];
  const growth = `<div class="pc-growth"><b>🎴 카드 Lv.${lv}</b> <span>${n}장${next ? ` · 다음 레벨까지 ${next - n}장` : ' · MAX'}</span>
    <div class="bar"><i style="width:${next ? Math.min(100, (n / next) * 100) : 100}%"></i></div>
    <small>전투 공격력 ×${cardMult(n).toFixed(1)}</small></div>
    <div class="pc-tools"><b>🧰 장착 도구</b>${ownedTools.length ? ownedTools.map((it) => `<button data-equip="${it.id}" class="${cur === it.id ? 'on' : ''} ${isOwner(it.id, p.name) ? 'own' : ''}"><img src="${itemUrl(it.id)}">${it.name}${isOwner(it.id, p.name) ? ' ★' : ''}</button>`).join('') + (cur ? '<button data-equip="">해제</button>' : '') : '<small>도구 상자에서 도구를 뽑아 오세요</small>'}</div>
    ${n ? '<button class="chunky blue room-set">🤔 고민방 주인으로 삼기</button>' : ''}`;
  alertBox(cardHtml(id).replace('<div class="pc-foot">', growth + '<div class="pc-foot">'));
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-equip]')) b.onclick = (e) => {
    e.stopPropagation();
    if (b.dataset.equip) progress.loadout[id] = b.dataset.equip; else delete progress.loadout[id];
    saveProgress(progress); document.querySelector('.overlay')?.remove(); renderCodex(); showCard(id);
  };
  const rs = document.querySelector<HTMLButtonElement>('.room-set');
  if (rs) rs.onclick = (e) => { e.stopPropagation(); roomThinker = id; document.querySelector('.overlay')?.remove(); switchTab('room'); };
}

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
  o.innerHTML = `<div class="pop">${html}<button class="primary chunky gold close">확인</button></div>`;
  o.onclick = (e) => { const el = e.target as HTMLElement; if (el === o || el.classList.contains('close')) o.remove(); };
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
let introT = 0;

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
  game = new Game(s, {
    cardMult: (id) => cardMult(progress.cards[id] ?? 0),
    tool: (id) => { const t = progress.loadout[id]; return t && progress.items[t] ? t : undefined; },
  }, diffId);
  selected = null;
  resultShown = false;
  introT = 2.8;
  lastSynthKey = lastInfoKey = lastCatKey = '';
  show('battle');
  updateUI();
}

function endBattle() {
  if (game) {
    progress.seen = [...new Set([...progress.seen, ...game.discovered])];
    progress.gonoe += Math.round(battleReward(game.wave, game.over === 'win') * game.diff.reward);
    if (game.over === 'win') {
      if (!progress.cleared.includes(game.stage.id)) progress.cleared.push(game.stage.id);
      const k = clearKey(game.stage.id, game.diff.id);
      if (!progress.cleared.includes(k)) progress.cleared.push(k);
    }
    saveProgress(progress);
  }
  game = null;
  renderHome();
  show('home');
  switchTab('stages');
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
  $('wave-max').textContent = String(g.maxWave);
  $<HTMLElement>('wave-bar').style.width = `${(g.wave / g.maxWave) * 100}%`;
  $('diff-chip').textContent = `${g.diff.icon} ${g.diff.name}`;
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
  const infoKey = `${selected?.uid}|${selected?.philId}|${selected?.level}|${g.towers.length > 0}|${selected && g.upgradeCost(selected) !== null ? g.gold >= g.upgradeCost(selected)! : ''}`;
  if (infoKey !== lastInfoKey) {
    lastInfoKey = infoKey;
    info.className = '';
    if (selected) {
      const p = PHIL.get(selected.philId)!;
      const cost = g.upgradeCost(selected);
      const lv = selected.level ? ` <span class="tag lv">Lv.${selected.level}</span>` : '';
      info.className = `t${p.tier}`;
      info.innerHTML = `<img src="${portrait(p.id)}"><div><b>${'★'.repeat(p.tier)} ${p.name}</b>${lv} · ${p.school}<br>“${p.quote}”<br><small>${p.lore}</small>${p.id === g.stage.counter ? '<br><small class="counter">⚔ 이 스테이지 보스에게 피해 3배</small>' : ''}
        ${toolLine(g, selected)}
        ${cost !== null ? `<br><button id="upgrade" class="up">⬆ 강화 Lv.${selected.level + 1} (${cost}G) · 공격력 +${Math.round(UPGRADE.perLevel * 100)}%</button>` : ''}</div>`;
      const up = document.getElementById('upgrade');
      if (up) { (up as HTMLButtonElement).disabled = g.gold < cost!; up.onclick = () => { if (selected && g.upgrade(selected)) { lastInfoKey = ''; updateUI(); } }; }
    } else info.innerHTML = g.towers.length
      ? '<small>같은 등급 3명이면 🎲 합성(1~3성)! 5성 이상은 📜 조합표의 재료를 모아 특수 연성.<br>철학자를 눌러 선택 → 빈 칸을 누르면 이동, 다른 철학자를 누르면 자리 바꾸기.</small>'
      : `<small><b>${g.stage.name}</b> — ${g.stage.story}<br>소환 버튼으로 철학자를 불러오세요.</small>`;
  }

  // 촉매
  const catKey = JSON.stringify(g.catalysts);
  if (catKey !== lastCatKey) {
    const fresh = new Set(g.drops.splice(0));
    lastCatKey = catKey;
    $('cats').innerHTML = (QA_MODE ? '<span class="qa">QA</span>' : '') + `<span class="stage-name">${ERA_ICON[g.stage.era]} ${g.stage.name}</span>` + CATALYST_IDS.map((id) =>
      `<span class="c ${g.catalysts[id] ? 'on' : ''} ${fresh.has(id) ? 'flash' : ''}">${CAT_ICON[id]}${g.catalysts[id]}</span>`).join('');
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
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  ctx.clearRect(0, 0, w, w);
  ctx.save();
  if (shake > 0) ctx.translate(rnd(-1, 1) * shake * 8, rnd(-1, 1) * shake * 8);
  ctx.imageSmoothingEnabled = false;

  // ---- 바닥: 스테이지별 질감 (칸 테두리 없이 하나의 필드처럼) ----
  const th = THEME[g.stage.era] ?? THEME['고대'];
  ctx.fillStyle = th.ground; ctx.fillRect(0, 0, w, w);
  for (let i = 0; i < 140; i++) {
    const rx = hash(i * 7.1) * w, ry = hash(i * 3.3 + 1) * w, r = 1 + hash(i) * 2.5;
    ctx.fillStyle = i % 3 ? th.speck : th.speck2;
    ctx.beginPath(); ctx.arc(rx, ry, r, 0, Math.PI * 2); ctx.fill();
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
    const rc = recoil.get(t.uid) ?? 0;
    const sx = sz * (1 + rc * 0.12), sy = sz * (1 - rc * 0.1);
    ctx.drawImage(philosopherSprite(p), cx - sx / 2, foot - sy * 0.97 + bob, sx, sy);
    // 이름표
    const nm = shortName(p.name);
    const fs = Math.max(9, cell * 0.21);
    ctx.font = `${fs}px "Jua", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const nw = ctx.measureText(nm).width + 8, ny = foot + fs * 0.35;
    ctx.fillStyle = isSel ? '#ffd36b' : 'rgba(255,255,255,.92)'; ctx.strokeStyle = '#3b2a1e'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(cx - nw / 2, ny - fs * 0.62, nw, fs * 1.24, fs * 0.6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3b2a1e'; ctx.fillText(nm, cx, ny + 0.5);
    // 등급 배지
    const bx = (t.cx + 0.14) * cell, by = (t.cy + 0.14) * cell, br = cell * 0.15;
    ctx.fillStyle = TIER_AURA[p.tier]; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1c1917'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = `900 ${br * 1.3}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(p.tier), bx, by + 0.5);
    const tool = g.toolOf(t);
    if (tool) {
      const isz = cell * 0.38, ix = (t.cx + 0.62) * cell, iy = (t.cy + 0.42) * cell;
      if (isOwner(tool, p.name)) { ctx.fillStyle = 'rgba(253,224,71,.55)'; ctx.beginPath(); ctx.arc(ix + isz / 2, iy + isz / 2, isz * 0.62, 0, Math.PI * 2); ctx.fill(); }
      ctx.drawImage(itemSprite(tool), ix, iy, isz, isz);
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
    const bw = sz * 0.9, r = Math.max(0, e.hp / e.maxHp), by = y - sz / 2 - 9;
    ctx.fillStyle = '#3b2a1e'; ctx.beginPath(); ctx.roundRect(x - bw / 2 - 1.5, by - 1.5, bw + 3, 8, 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(x - bw / 2, by, bw, 5, 3); ctx.fill();
    ctx.fillStyle = r > 0.5 ? '#5fc6a0' : r > 0.25 ? '#ffd36b' : '#ff8f8f'; ctx.beginPath(); ctx.roundRect(x - bw / 2, by, Math.max(2, bw * r), 5, 3); ctx.fill();
    if (e.boss) {
      ctx.font = `${Math.max(10, cell * 0.22)}px "Jua", sans-serif`; ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.strokeText(e.name, x, by - 8);
      ctx.fillStyle = '#c2410c'; ctx.fillText(e.name, x, by - 8);
    }
  }

  ctx.font = `700 ${Math.max(9, cell * 0.14)}px "Noto Sans KR", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const b of g.bullets) {
    const text = b.text.length > 9 ? b.text.slice(0, 8) + '…' : b.text;
    const tw = ctx.measureText(text).width + 10, x = b.x * cell, y = b.y * cell;
    ctx.fillStyle = b.color === 'rainbow' ? `hsl(${(tick * 3) % 360},90%,80%)` : b.color === 'gold' ? '#ffd36b' : '#ffffff';
    ctx.strokeStyle = '#3b2a1e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x - tw / 2, y - 9, tw, 18, 9); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3b2a1e'; ctx.fillText(text, x, y);
  }

  if (g.noticeTime > 0) {
    ctx.save(); ctx.globalAlpha = Math.min(1, g.noticeTime);
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillRect(0, w / 2 - cell * 0.45, w, cell * 0.9);
    ctx.fillStyle = '#3b2a1e'; ctx.font = `800 ${Math.max(12, cell * 0.32)}px "Noto Sans KR", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(g.notice, w / 2, w / 2);
    ctx.restore();
  }

  if (introT > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, introT / 0.6, (2.8 - introT) / 0.3);
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(0, w / 2 - cell * 0.9, w, cell * 1.8);
    ctx.fillStyle = '#3b2a1e'; ctx.font = `800 ${cell * 0.22}px "Nanum Myeongjo", serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 ${cell * 0.4}px "Nanum Myeongjo", serif`;
    ctx.fillText(g.stage.name, w / 2, w / 2 - cell * 0.35);
    ctx.font = `700 ${cell * 0.22}px "Noto Sans KR", sans-serif`;
    ctx.fillText(STAGE_PATHS[g.stage.id].caption, w / 2, w / 2 + cell * 0.1);
    ctx.fillText(`${g.diff.icon} ${g.diff.name} · 최종 보스: ${g.stage.boss20} (${g.maxWave}웨이브)`, w / 2, w / 2 + cell * 0.45);
    ctx.restore();
  }
  drawFx(w);
  ctx.restore();
}

// 스테이지별 필드 테마
const THEME: Record<string, { ground: string; speck: string; speck2: string; road: string; roadEdge: string; roadLine: string; decor: string[] }> = {
  고대: { ground: '#f6ead2', speck: '#ecdcbc', speck2: '#fff6e4', road: '#fffaf0', roadEdge: '#c9a877', roadLine: 'rgba(255,255,255,.5)', decor: ['column', 'olive', 'amphora'] },
  중세: { ground: '#d9cdea', speck: '#cbbde0', speck2: '#e6dcf3', road: '#f3eadb', roadEdge: '#8b7aa8', roadLine: 'rgba(139,122,168,.6)', decor: ['candle', 'stone', 'banner'] },
  동양: { ground: '#cdeeb5', speck: '#bde4a1', speck2: '#ddf5c9', road: '#fff7e2', roadEdge: '#9cbf7a', roadLine: 'rgba(255,255,255,.45)', decor: ['bamboo', 'pine', 'lantern'] },
  근대: { ground: '#d4dde8', speck: '#c5d0dd', speck2: '#e2e9f1', road: '#fdf6e9', roadEdge: '#7b8ea6', roadLine: 'rgba(123,142,166,.7)', decor: ['gear', 'lamp', 'crate'] },
  현대: { ground: '#e9d8ff', speck: '#dcc6ff', speck2: '#f3e9ff', road: '#fff0fa', roadEdge: '#b388ff', roadLine: 'rgba(236,72,153,.6)', decor: ['letter', 'crystal', 'screen'] },
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

const SHORT: Record<string, string> = { '고타마 붓다': '붓다', '다산 정약용': '정약용', '퇴계 이황': '이황', '루트비히 비트겐슈타인': '비트겐', '아르투어 쇼펜하우어': '쇼펜하우어', '고트프리트 라이프니츠': '라이프니츠', '쇠렌 키르케고르': '키르케고르', '헤라클레이토스': '헤라클레', '아리스토텔레스': '아리스토', '나가르주나': '나가르',  '엘레아의 제논': '제논', '오컴의 윌리엄': '오컴', '이븐 시나': '이븐시나', '이븐 루시드': '이븐루시드', '알 킨디': '알킨디', '힐데가르트 폰 빙엔': '힐데가르트' };
function shortName(name: string) {
  const s = SHORT[name] ?? name.split(' ').pop()!;
  return s.length > 5 ? s.slice(0, 4) + '…' : s;
}

// ---------- 장착 ----------
function toolLine(g: Game, t: Tower) {
  const p = PHIL.get(t.philId)!;
  const lv = cardLevel(progress.cards[p.id] ?? 0);
  const tool = g.toolOf(t);
  const parts: string[] = [];
  if (lv) parts.push(`🎴 카드 Lv.${lv} (공격 ×${cardMult(progress.cards[p.id] ?? 0).toFixed(1)})`);
  if (tool) { const it = ITEM.get(tool)!; parts.push(`<img src="${itemUrl(tool)}">${it.name}${isOwner(tool, p.name) ? ' <b class="match">찰떡!</b>' : ''}`); }
  return parts.length ? `<br><small class="equip">${parts.join(' · ')}</small>` : '';
}

// =============== 허브 탭 ===============
let currentTab = 'stages';
function switchTab(tab: string) {
  currentTab = tab;
  for (const b of document.querySelectorAll<HTMLButtonElement>('#tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
  for (const s of document.querySelectorAll<HTMLElement>('.tab')) s.classList.toggle('hidden', s.id !== `tab-${tab}`);
  if (tab === 'room') renderRoom();
  if (tab === 'gacha') renderGacha();
  if (tab === 'codex') renderCodex();
  refreshWallet();
}
function refreshWallet() {
  const w = document.getElementById('wallet');
  if (w) w.textContent = `🤔 ${Math.floor(progress.gonoe).toLocaleString()}`;
  const r = document.getElementById('room-gonoe');
  if (r) r.textContent = Math.floor(progress.gonoe).toLocaleString();
}

// ---------- 고민방 ----------
let roomThinker = 'T104';
function renderRoom() {
  const idle = settleIdle(progress);
  saveProgress(progress);
  const owned = PHILOSOPHERS.filter((p) => progress.cards[p.id]);
  if (!progress.cards[roomThinker] && owned.length) roomThinker = owned.sort((a, b) => b.tier - a.tier)[0].id;
  const p = PHIL.get(roomThinker)!;
  const cost = tapUpgradeCost(progress);
  $('tab-room').innerHTML = `
    <div class="room">
      <div class="room-sky"><div class="room-bubble">“${p.quote}”</div>
        <button id="thinker" class="thinker"><img src="${portrait(p.id)}"></button>
        <div class="room-floor"></div></div>
      <div class="room-stat"><span>고뇌</span><b id="room-gonoe">${Math.floor(progress.gonoe).toLocaleString()}</b></div>
      <p class="hint">${p.name}을(를) 톡톡 두드려 고뇌를 짜내세요. 가만히 둬도 초당 ${(IDLE_PER_SEC * (1 + STAGES.filter((s) => progress.cleared.includes(s.id)).length * 0.5)).toFixed(1)}씩 쌓여요 (스테이지 클리어마다 증가, 최대 8시간).${idle ? `<br><b>자리를 비운 사이 고뇌 +${idle.toLocaleString()}</b>` : ''}</p>
      <div class="row"><button id="tap-up" class="chunky blue">💭 고민의 깊이 Lv.${progress.tapLevel + 1} → ${progress.tapLevel + 2}<small>탭당 +${tapGain(progress)} → +${tapGain(progress) + 1} · ${cost.toLocaleString()} 고뇌</small></button></div>
      <p class="hint">고민방 주인은 도감에서 바꿀 수 있어요.</p>
    </div>`;
  $('thinker').onclick = (ev) => {
    progress.gonoe += tapGain(progress);
    saveProgress(progress);
    refreshWallet();
    const f = document.createElement('span');
    f.className = 'float'; f.textContent = `+${tapGain(progress)}`;
    f.style.left = `${(ev as MouseEvent).offsetX + 20}px`;
    $('thinker').appendChild(f); setTimeout(() => f.remove(), 900);
    $('thinker').classList.remove('squish'); void $('thinker').offsetWidth; $('thinker').classList.add('squish');
  };
  const up = $<HTMLButtonElement>('tap-up');
  up.disabled = progress.gonoe < cost;
  up.onclick = () => { if (progress.gonoe >= cost) { progress.gonoe -= cost; progress.tapLevel++; saveProgress(progress); renderRoom(); } };
}

// ---------- 뽑기 ----------
function renderGacha() {
  const rates = CARD_RATES.map((r) => `<span class="tier-chip t${r.tier}">${r.tier}★ ${(r.rate * 100).toFixed(1)}%</span>`).join(' ');
  $('tab-gacha').innerHTML = `
    <div class="gacha-box card-box">
      <h2>🎴 철학자 카드</h2>
      <p class="hint">같은 철학자 카드가 1·2·4·8·16…장 모일 때마다 레벨업! 레벨당 전투 공격력 +${CARD_ATK_PER_LEVEL * 100}% (최대 Lv.${CARD_MAX_LEVEL})</p>
      <div class="rates-line">${rates}</div>
      <div class="row"><button class="chunky pink" data-pull="card1">1회 <small>${CARD_COST} 고뇌</small></button><button class="chunky gold" data-pull="card10">10회 <small>${CARD_COST_10} 고뇌</small></button></div>
    </div>
    <div class="gacha-box tool-box">
      <h2>🧰 도구 상자</h2>
      <p class="hint">뽑은 도구는 도감에서 철학자에게 장착해요. 아무에게나 공격 +20%, <b>주인에게 끼우면 찰떡!</b> 공격 +60%·사거리 증가</p>
      <div class="row"><button class="chunky mint" data-pull="tool1">1회 <small>${TOOL_COST} 고뇌</small></button><button class="chunky gold" data-pull="tool10">10회 <small>${TOOL_COST_10} 고뇌</small></button></div>
    </div>`;
  for (const b of $('tab-gacha').querySelectorAll<HTMLButtonElement>('[data-pull]')) {
    const kind = b.dataset.pull!.startsWith('card') ? 'card' : 'tool';
    const times = b.dataset.pull!.endsWith('10') ? 10 : 1;
    const cost = kind === 'card' ? (times === 1 ? CARD_COST : CARD_COST_10) : (times === 1 ? TOOL_COST : TOOL_COST_10);
    b.disabled = progress.gonoe < cost;
    b.onclick = () => {
      const before = { ...progress.cards };
      const got = pull(progress, kind, times as 1 | 10);
      if (!got) return;
      saveProgress(progress); refreshWallet(); renderGacha();
      revealPulls(kind, got, before);
    };
  }
}

function revealPulls(kind: 'card' | 'tool', got: string[], before: Record<string, number>) {
  const counted: Record<string, number> = { ...before };
  const cells = got.map((id, i) => {
    if (kind === 'tool') {
      const it = ITEMS.find((x) => x.id === id)!;
      return `<div class="reveal tool" style="animation-delay:${i * 0.08}s"><img src="${itemUrl(id)}"><b>${it.name}</b><small>${it.owners.map((o) => o.split(' ').pop()).join('·')}의 찰떡</small></div>`;
    }
    const p = PHIL.get(id)!;
    const prev = cardLevel(counted[id] ?? 0);
    counted[id] = (counted[id] ?? 0) + 1;
    const now = cardLevel(counted[id]);
    const tag = prev === 0 ? '<i class="new">NEW</i>' : now > prev ? `<i class="lvup">Lv.${now}!</i>` : '';
    return `<div class="reveal t${p.tier} ${p.tier >= 5 ? 'shine' : ''}" style="animation-delay:${i * 0.08}s">${tag}<img src="${portrait(id)}"><b>${p.name}</b><small>${'★'.repeat(p.tier)}</small></div>`;
  }).join('');
  alertBox(`<h2>${kind === 'card' ? '🎴 카드 공개!' : '🧰 도구 획득!'}</h2><div class="reveal-grid ${got.length === 1 ? 'single' : ''}">${cells}</div>`);
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

// ---------- 타격감 연출 ----------
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; text?: string; star?: boolean }
const particles: Particle[] = [];
const recoil = new Map<number, number>();
let shake = 0;
let banner: { text: string; t: number } | null = null;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const PASTEL = ['#ffb3c7', '#ffd36b', '#a7ecd2', '#a9d8ff', '#c7a6ff'];

function consumeFx(g: Game) {
  for (const f of g.fx.splice(0)) {
    if (f.type === 'shot') recoil.set(f.uid, 1);
    else if (f.type === 'hit') {
      for (let i = 0; i < (f.big ? 7 : 3); i++) particles.push({ x: f.x, y: f.y, vx: rnd(-2.5, 2.5), vy: rnd(-3, -0.5), life: 0.35, max: 0.35, color: f.big ? '#ffd36b' : '#ffffff', size: rnd(0.04, 0.08), star: f.big });
      particles.push({ x: f.x + rnd(-0.15, 0.15), y: f.y - 0.3, vx: 0, vy: -1.2, life: 0.7, max: 0.7, color: f.big ? '#ff7a59' : '#3b2a1e', size: f.big ? 0.32 : 0.24, text: fmt(f.dmg) });
    } else if (f.type === 'kill') {
      for (let i = 0; i < (f.boss ? 40 : 12); i++) particles.push({ x: f.x, y: f.y, vx: rnd(-3, 3), vy: rnd(-3.5, 1), life: 0.6, max: 0.6, color: PASTEL[i % PASTEL.length], size: rnd(0.06, 0.13) });
      particles.push({ x: f.x, y: f.y - 0.2, vx: 0, vy: -0.8, life: 0.9, max: 0.9, color: '#e3a72f', size: 0.28, text: `+${f.gold}G` });
      if (f.boss) { shake = 0.6; banner = { text: '🎉 논파 성공!', t: 1.8 }; }
    } else if (f.type === 'morph') {
      for (let i = 0; i < 24 + f.tier * 6; i++) { const a = (i / 24) * Math.PI * 2; particles.push({ x: f.x, y: f.y, vx: Math.cos(a) * rnd(1.5, 3), vy: Math.sin(a) * rnd(1.5, 3), life: 0.7, max: 0.7, color: f.tier >= 5 ? PASTEL[i % 5] : '#fff3b0', size: rnd(0.06, 0.11), star: true }); }
      if (f.tier >= 5) shake = 0.35;
    } else if (f.type === 'boss') { banner = { text: `⚠️ ${f.name} 등장!`, t: 2.2 }; shake = 0.4; }
  }
}
const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));

function updateFx(dt: number) {
  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; if (!p.text) p.vy += 6 * dt; p.life -= dt; }
  for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
  for (const [k, v] of recoil) { const n = v - dt * 6; if (n <= 0) recoil.delete(k); else recoil.set(k, n); }
  if (shake > 0) shake = Math.max(0, shake - dt);
  if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
}

function drawStar(x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}

function drawFx(w: number) {
  for (const p of particles) {
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    if (p.text) {
      ctx.font = `900 ${Math.max(10, cell * p.size)}px "Jua", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.strokeText(p.text, p.x * cell, p.y * cell);
      ctx.fillStyle = p.color; ctx.fillText(p.text, p.x * cell, p.y * cell);
    } else {
      ctx.fillStyle = p.color;
      if (p.star) drawStar(p.x * cell, p.y * cell, p.size * cell);
      else { ctx.beginPath(); ctx.arc(p.x * cell, p.y * cell, p.size * cell, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  ctx.globalAlpha = 1;
  // 은은한 비네트
  const v = ctx.createRadialGradient(w / 2, w / 2, w * 0.35, w / 2, w / 2, w * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(59,42,30,.18)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, w);
  if (banner) {
    const s = Math.min(1, (2.2 - banner.t) * 6, banner.t * 3);
    ctx.save(); ctx.translate(w / 2, w * 0.3); ctx.scale(s, s);
    ctx.font = `${cell * 0.5}px "Jua", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(banner.text).width + cell;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#3b2a1e'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(-tw / 2, -cell * 0.45, tw, cell * 0.9, cell * 0.45); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c2410c'; ctx.fillText(banner.text, 0, 2);
    ctx.restore();
  }
}

// ---------- 루프 ----------
let last = performance.now();
let uiTimer = 0;
function loop(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000) * speed;
  last = now;
  if (game) {
    game.update(dt);
    consumeFx(game);
    updateFx(dt);
    if (introT > 0) introT -= dt / speed;
    tick += dt * 60;
    if ((uiTimer += dt) > 0.15) { uiTimer = 0; updateUI(); }
    draw();
  }
  requestAnimationFrame(loop);
}

// ---------- 시작 ----------
$('open-recipes').onclick = recipeSheet;
$('open-rates').onclick = rateSheet;
for (const b of document.querySelectorAll<HTMLButtonElement>('#tabs button')) b.onclick = () => switchTab(b.dataset.tab!);
$('b-recipes').onclick = recipeSheet;
$('reset').onclick = () => { if (window.confirm('클리어 기록·카드·도구를 모두 지울까요?')) { resetProgress(); progress = loadProgress(); bootQA(); renderHome(); switchTab('stages'); } };
function bootQA() { if (QA_MODE && progress.gonoe < 1000 && !progress.cards.qa) { progress.gonoe += QA_GONOE; progress.cards.qa = 1; saveProgress(progress); } }
bootQA();
renderHome();
show('home');
switchTab('stages');
setInterval(() => { if (!game) { settleIdle(progress); saveProgress(progress); refreshWallet(); } }, 1000);
requestAnimationFrame(loop);
