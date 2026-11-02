import { Game, GRID, trackPos, QA_MODE, CATALYST_IDS, MAX_WAVE, type Tower } from './game';
import {
  PHIL, PHILOSOPHERS, STAGES, TIER_STATS, CAT_ICON, ERAS, ERA_ICON, RECIPES, type Stage,
} from './data';
import { philosopherSprite, monsterSprite, TIER_AURA } from './sprites';
import { loadProgress, saveProgress, resetProgress } from './save';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const spriteUrl = new Map<string, string>();
const portrait = (id: string) => {
  if (!spriteUrl.has(id)) spriteUrl.set(id, philosopherSprite(PHIL.get(id)!).toDataURL());
  return spriteUrl.get(id)!;
};

let progress = loadProgress();

// =============== 화면 전환 ===============
function show(id: 'home' | 'deck' | 'codex' | 'battle') {
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
      <small>${open ? `최종 보스: ${s.boss20} · 수호자: ${hero.name}` : `🔒 ${STAGES.find((x) => x.id === s.unlockAfter)!.name} 클리어 시 해금`}</small></div>`;
    b.onclick = () => openDeck(s);
    box.appendChild(b);
  }
}

// =============== 덱 선택 ===============
let pendingStage: Stage = STAGES[0];
let chosen = new Set<string>();
// 해금된 시대 = 클리어한 스테이지의 시대 + 고대(시작). QA는 전부
const unlockedEras = () => QA_MODE ? ERAS : ERAS.filter((e) => e === '고대' || STAGES.some((s) => s.era === e && (progress.cleared.includes(s.id) || isUnlocked(s))));

function openDeck(s: Stage) {
  pendingStage = s;
  chosen = new Set([s.era]);
  $('deck-title').textContent = `${ERA_ICON[s.era]} ${s.name}`;
  $('deck-story').textContent = s.story;
  renderEras();
  show('deck');
}

function renderEras() {
  const box = $('eras');
  box.innerHTML = '';
  const avail = unlockedEras();
  for (const era of ERAS) {
    const b = document.createElement('button');
    const on = chosen.has(era);
    const locked = !avail.includes(era);
    const fixed = era === pendingStage.era;
    b.className = `era ${on ? 'on' : ''}`;
    b.disabled = locked || fixed;
    const ones = PHILOSOPHERS.filter((p) => p.era === era && p.tier === 1).map((p) => p.name).join(', ');
    b.innerHTML = `<b>${ERA_ICON[era]} ${era}</b>${fixed ? ' <span class="badge">현지</span>' : ''}${locked ? ' 🔒' : ''}<small>1성: ${ones}</small>`;
    b.onclick = () => {
      if (on) chosen.delete(era); else if (chosen.size < 3) chosen.add(era);
      renderEras();
    };
    box.appendChild(b);
  }
}

// =============== 도감 ===============
function renderCodex() {
  const box = $('codex-list');
  box.innerHTML = '';
  const seen = new Set(progress.seen);
  $('codex-count').textContent = `${PHILOSOPHERS.filter((p) => seen.has(p.id)).length} / ${PHILOSOPHERS.length}`;
  for (const era of [...ERAS, '히든']) {
    const h = document.createElement('h3');
    h.textContent = `${ERA_ICON[era]} ${era}`;
    box.appendChild(h);
    const grid = document.createElement('div');
    grid.className = 'codex-grid';
    for (const p of PHILOSOPHERS.filter((x) => x.era === era).sort((a, b) => b.tier - a.tier)) {
      const known = seen.has(p.id) || QA_MODE;
      const d = document.createElement('div');
      d.className = `card t${p.tier} ${known ? '' : 'unknown'}`;
      d.innerHTML = known
        ? `<img src="${portrait(p.id)}"><b>${p.name}</b><small>${'★'.repeat(p.tier)}</small>`
        : `<img src="${portrait(p.id)}"><b>${p.hidden ? '???' : '미발견'}</b><small>${'★'.repeat(p.tier)}</small>`;
      if (known) d.onclick = () => showCard(p.id);
      grid.appendChild(d);
    }
    box.appendChild(grid);
  }
}

function showCard(id: string) {
  const p = PHIL.get(id)!;
  const recipes = RECIPES.filter((r) => r.result === id);
  alertBox(`<div class="t${p.tier}" id="cardpop"><img src="${portrait(id)}"><div>
    <b>${'★'.repeat(p.tier)} ${p.name}</b> · ${p.era} · ${p.school}<br>“${p.quote}”<br>
    <small><b>${p.skill}</b> ${p.skillDesc}</small><br><small>${p.lore}</small>
    ${recipes.map((r) => `<br><small class="recipe">⚗ ${r.materials.map((m) => PHIL.get(m)!.name).join(' + ')}${r.catalyst ? ' + ' + CAT_ICON[r.catalyst] : ''}<br>${r.logic}</small>`).join('')}
  </div></div>`);
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

function startBattle() {
  game = new Game(pendingStage, [...chosen]);
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
  const inner = cx >= 1 && cy >= 1 && cx < GRID - 1 && cy < GRID - 1;
  if (!inner) { selected = null; return; }
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
  const infoKey = `${selected?.uid}|${selected?.philId}|${g.towers.length > 0}|${selected ? g.powerMult(selected) : ''}`;
  if (infoKey !== lastInfoKey) {
    lastInfoKey = infoKey;
    info.className = '';
    if (selected) {
      const p = PHIL.get(selected.philId)!;
      const foreign = g.isForeign(selected);
      const status = !foreign ? '<span class="tag home">현지</span>'
        : g.inDialogue(selected) ? '<span class="tag talk">💬 대화 중</span>' : `<span class="tag away">원정 (힘 ${Math.round(g.powerMult(selected) * 100)}%)</span>`;
      info.className = `t${p.tier}`;
      info.innerHTML = `<img src="${portrait(p.id)}"><div><b>${'★'.repeat(p.tier)} ${p.name}</b> · ${ERA_ICON[p.era]} ${p.era} ${status}<br>“${p.quote}”<br><small>${p.lore}</small>${p.id === g.stage.counter ? '<br><small class="counter">⚔ 이 스테이지 보스에게 피해 3배</small>' : ''}</div>`;
    } else info.innerHTML = g.towers.length
      ? '<small>철학자를 눌러 선택 → 빈 칸을 누르면 이동, 다른 철학자를 누르면 자리 바꾸기.<br>원정 온 철학자는 <b>현지 철학자 옆</b>에 두면 💬 대화로 힘을 되찾아요.</small>'
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
    for (const id of merges.slice(0, 2)) {
      const p = PHIL.get(id)!;
      const b = document.createElement('button');
      b.className = 'merge';
      b.textContent = `🎲 ${p.name} ×3 → ${p.era} ${p.tier + 1}성`;
      b.onclick = () => { selected = g.mergeThree(id); updateUI(); };
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

  const pad = cell * 0.06;
  for (let y = 1; y < GRID - 1; y++) for (let x = 1; x < GRID - 1; x++) {
    const t = g.towerAt(x, y);
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
    const weak = g.powerMult(t) < 1;
    ctx.fillStyle = TIER_AURA[p.tier];
    ctx.fillRect(x * cell + cell * 0.18, y * cell + pad + 2, cell * 0.64, 3);
    const bob = Math.sin((tick + x * 9 + y * 5) * 0.1) * 2;
    const sz = cell * 0.62;
    ctx.globalAlpha = weak ? 0.55 : 1;
    ctx.drawImage(philosopherSprite(p), cx - sz / 2, y * cell + cell * 0.07 + bob, sz, sz);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f8fafc'; ctx.font = `700 ${cell * 0.15}px "Noto Sans KR", sans-serif`;
    ctx.fillText(shortName(p.name), cx, y * cell + cell * 0.8);
    ctx.fillStyle = '#fbbf24'; ctx.font = `${cell * 0.12}px sans-serif`;
    ctx.fillText('★'.repeat(p.tier), cx, y * cell + cell * 0.93);
    // 원정 / 대화 표시
    if (g.isForeign(t)) {
      ctx.font = `${cell * 0.18}px sans-serif`;
      ctx.fillText(weak ? '🧳' : '💬', x * cell + cell * 0.82, y * cell + cell * 0.3);
    }
  }

  for (const e of g.enemies) {
    const [ex, ey] = trackPos(e.dist);
    const x = ex * cell, y = ey * cell, sz = cell * (e.boss ? 0.95 : 0.62);
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
    ctx.fillStyle = b.color === 'gold' ? '#fbbf24' : b.color === 'dim' ? '#94a3b8' : '#fef3c7';
    ctx.beginPath(); ctx.roundRect(x - tw / 2, y - 9, tw, 18, 8); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 3, y + 8); ctx.lineTo(x + 3, y + 8); ctx.lineTo(x - 5, y + 13); ctx.fill();
    ctx.fillStyle = '#1c1917'; ctx.fillText(text, x, y);
  }

  if (g.wave === 0 && !g.running && g.countdown < 0) {
    ctx.fillStyle = 'rgba(254,243,199,.85)'; ctx.font = `800 ${cell * 0.22}px "Nanum Myeongjo", serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(g.stage.name, w / 2, w / 2 - cell * 0.18);
    ctx.font = `700 ${cell * 0.14}px "Noto Sans KR", sans-serif`;
    ctx.fillText(`최종 보스: ${g.stage.boss20} (${MAX_WAVE}웨이브)`, w / 2, w / 2 + cell * 0.18);
  }
}

const SHORT: Record<string, string> = { '엘레아의 제논': '제논', '오컴의 윌리엄': '오컴', '이븐 시나': '이븐시나', '이븐 루시드': '이븐루시드', '알 킨디': '알킨디', '힐데가르트 폰 빙엔': '힐데가르트' };
function shortName(name: string) {
  const s = SHORT[name] ?? name.split(' ').pop()!;
  return s.length > 5 ? s.slice(0, 5) : s;
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
$('open-codex').onclick = () => { renderCodex(); show('codex'); };
$('codex-back').onclick = () => show('home');
$('deck-back').onclick = () => show('home');
$('deck-go').onclick = startBattle;
$('reset').onclick = () => { if (window.confirm('클리어 기록과 도감을 모두 지울까요?')) { resetProgress(); progress = loadProgress(); renderHome(); } };
renderHome();
show('home');
requestAnimationFrame(loop);
