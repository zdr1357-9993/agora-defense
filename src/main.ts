import { Game, GRID, BENCH, QA_MODE, setQA, CATALYST_IDS, type Tower, type FxEvent } from './game';
import { login, lastLogin, rememberLogin, seedVeteran, type Account } from './auth';
import { STAGE_PATHS } from './paths';
import { STAGE_STARS, ERA_BONUS, STAR_BONUS } from './affinity';
import { DIFFICULTIES, DIFF, clearKey } from './difficulty';
import { ITEM, isOwner, ITEM_BONUS } from './items';
import {
  homage, statsOf, TYPE_ICON, PHIL, PHILOSOPHERS, STAGES, TIER_STATS, CAT_ICON, CAT_NAME, ERA_ICON, RECIPES, SUMMON_RATES, TIER_NAME, UPGRADE, type Stage,
} from './data';
import { philosopherSprite, skinnedSprite, SKINS, monsterSprite, itemSprite, TIER_AURA } from './sprites';
import { SKILLS } from './skills';
import { sfx, isMuted, toggleMute } from './sfx';
import { setAccount, hasSave, loadProgress, saveProgress, resetProgress, cardLevel, cardMult, nextLevelAt, awakenLevel, CARD_MAX_LEVEL, CARD_ATK_PER_LEVEL, AWAKEN_MAX, AWAKEN_EVERY } from './save';
import { LINES, UNLOCK_LEVELS } from './lines';
import { setCardFilter, settleIdle, idleRate, tapGain, tapUpgradeCost, battleReward, pull, canAfford, PULLS, SHOP, buy, CUR_ICON, PITY_LIMIT, FIRST_CLEAR_GEMS, CARD_RATES, QA_GONOE, QA_GEMS, IDLE_PER_SEC, type PullOption } from './meta';
import { ITEMS } from './items';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const spriteUrl = new Map<string, string>();
import { cardArt, sceneArt } from './tcg';
import { STORY, STORY_MAP, CHAPTERS, START_POOL, type StoryStage, type Line } from './story';
const itemUrl = (id: string) => itemSprite(id).toDataURL();
/** 착용 스킨이 반영된 도트 */
const spriteFor = (id: string) => skinnedSprite(PHIL.get(id)!, progress?.skinOn?.[id]);
const portrait = (id: string) => {
  const key = id + (progress?.skinOn?.[id] ?? '');
  if (!spriteUrl.has(key)) spriteUrl.set(key, spriteFor(id).toDataURL());
  return spriteUrl.get(key)!;
};

let progress = loadProgress();
let me: Account | null = null;

const SKIN_PRICE = 120;
const clearedStages = () => STAGES.filter((s) => progress.cleared.includes(s.id)).length;

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
  if (i <= 1) return i === 0 || easyAllCleared(); // 보통은 스토리(쉬움)를 다 깨면 열림
  return progress.cleared.includes(clearKey(stageId, DIFFICULTIES[i - 1].id));
};
const isUnlocked = (s: Stage) => QA_MODE || !s.unlockAfter || progress.cleared.includes(s.unlockAfter);

// =============== 홈: 스테이지 지도 ===============
/** 쉬움을 모든 스테이지에서 깨야 난이도 탭이 열린다 (신규 유저는 쉬움만) */
/** 쉬움 = 스토리. 스토리를 끝까지 깨면 난이도 탭(보통 이상 본편)이 열린다 */
const easyAllCleared = () => STORY.every((s) => (progress.storyCleared ?? []).includes(s.id));
function stageInfo(s: Stage) {
  const hero = PHIL.get(s.counter)!;
  const marks = DIFFICULTIES.map((d) => `<span class="${progress.cleared.includes(clearKey(s.id, d.id)) ? 'on' : ''}">${d.icon}</span>`).join('');
  alertBox(`<h2>${ERA_ICON[s.era]} ${s.name}</h2>
    <p class="hint">${s.story}</p>
    <div class="stage-info">
      <div>🗺 ${STAGE_PATHS[s.id].caption}</div>
      <div>👑 최종 보스 <b>${s.boss20}</b> · 10웨이브마다 <b>${s.boss10}</b></div>
      <div>⚔ 보스 카운터 <b>${hero.name}</b> (보스에게 피해 3배)</div>
      <div>🏠 강해지는 철학자 <b>${(STAGE_STARS[s.id] ?? []).map((n) => PHILOSOPHERS.find((p) => p.realName === n)?.name ?? n).join(', ')}</b> +${STAR_BONUS * 100}%<br>${s.era} 철학자 모두 +${ERA_BONUS * 100}%</div>
      <div>🏅 클리어 ${marks}</div>
    </div>`);
}
function renderHome() {
  const box = $('stages');
  box.innerHTML = '';
  const diffOpen = QA_MODE || easyAllCleared();
  if (!diffOpen) diffId = 'easy';
  if (diffOpen) {
    const chips = document.createElement('div');
    chips.className = 'diffs';
    chips.innerHTML = DIFFICULTIES.map((d) => `<button data-diff="${d.id}" class="${d.id === diffId ? 'on' : ''}" style="--c:${d.color}">${d.icon}<span>${d.name}</span></button>`).join('');
    box.appendChild(chips);
    for (const b of chips.querySelectorAll<HTMLButtonElement>('button')) b.onclick = () => { diffId = b.dataset.diff!; renderHome(); };
  }
  if (diffId === 'easy') { renderStory(box); return; }
  for (const s of STAGES) {
    const row = document.createElement('div');
    if (!isUnlocked(s)) {
      row.className = 'srow locked';
      row.innerHTML = `<span class="sname">🔒 ???</span><small>${STAGES.find((x) => x.id === s.unlockAfter)?.name} 클리어 시</small>`;
      box.appendChild(row); continue;
    }
    const open = diffUnlocked(s.id, diffId);
    const cleared = progress.cleared.includes(clearKey(s.id, diffId));
    row.className = `srow ${open ? '' : 'locked'} ${cleared ? 'cleared' : ''}`;
    row.innerHTML = `<button class="sgo" ${open ? '' : 'disabled'}><img src="${portrait(s.counter)}"><span class="sname">${ERA_ICON[s.era]} ${s.name}</span>${cleared ? '<span class="badge">CLEAR</span>' : open ? '' : '<small>🔒</small>'}</button><button class="sinfo" aria-label="스테이지 정보">i</button>`;
    (row.querySelector('.sgo') as HTMLButtonElement).onclick = () => startBattle(s);
    (row.querySelector('.sinfo') as HTMLButtonElement).onclick = () => stageInfo(s);
    box.appendChild(row);
  }
  if (progress.favorite && progress.cards[progress.favorite]) {
    const fav = PHIL.get(progress.favorite)!;
    const ot = document.createElement('div');
    ot.className = 'srow onetool-row';
    ot.innerHTML = `<button class="sgo"><img src="${portrait(fav.id)}"><span class="sname">💗 ${shortName(fav.name)} 원툴 도전</span><small>최고 ${progress.oneToolBest[fav.id] ?? 0}웨이브</small></button><button class="sinfo">i</button>`;
    (ot.querySelector('.sgo') as HTMLButtonElement).onclick = () => startBattle(STAGES[0], fav.id);
    (ot.querySelector('.sinfo') as HTMLButtonElement).onclick = () => alertBox(`<h2>💗 최애 원툴 도전</h2><p>${fav.name} 한 명 + 흔함만으로 어디까지 버틸 수 있을까요? 조합 없이 끝없이 이어지는 웨이브예요.</p>`);
    box.appendChild(ot);
  }
}

// =============== 도감 ===============
let codexTier = 1;
function renderCodex() {
  const box = $('codex-list');
  box.innerHTML = '';
  const seen = new Set(progress.seen);
  $('codex-count').textContent = `${PHILOSOPHERS.filter((p) => seen.has(p.id)).length} / ${PHILOSOPHERS.length}`;
  // 등급 탭: 한 번에 한 등급만 (스크롤 없이)
  const tabs = document.createElement('div');
  tabs.className = 'codex-tabs';
  tabs.innerHTML = [1, 2, 3, 4, 5, 6, 7].map((t) => `<button class="tier-chip t${t} ${t === codexTier ? 'on' : ''}" data-ct="${t}">${TIER_NAME[t]}</button>`).join('');
  box.appendChild(tabs);
  for (const b of tabs.querySelectorAll<HTMLButtonElement>('[data-ct]')) b.onclick = () => { codexTier = Number(b.dataset.ct); renderCodex(); };
  const grid = document.createElement('div');
  grid.className = 'codex-grid';
  for (const p of PHILOSOPHERS.filter((x) => x.tier === codexTier)) {
    const known = seen.has(p.id) || !!progress.cards[p.id] || (QA_MODE && !p.hidden);
    const n = progress.cards[p.id] ?? 0, lv = cardLevel(n);
    const d = document.createElement('div');
    d.className = `card t${p.tier} ${known ? '' : 'unknown'} ${n ? 'owned' : ''}`;
    d.innerHTML = `${progress.favorite === p.id ? '<span class="fav">💗</span>' : ''}${lv ? `<span class="lv ${awakenLevel(n) ? 'aw' : ''}">${awakenLevel(n) ? '✦' + awakenLevel(n) : 'Lv.' + lv}</span>` : ''}<img src="${portrait(p.id)}"><b>${known ? shortName(p.name) : '???'}</b>`;
    if (known) d.onclick = () => openTcg(p.id);
    grid.appendChild(d);
  }
  box.appendChild(grid);
}

const CARD_BG: Record<string, string> = {
  고대: 'linear-gradient(180deg,#bfe3ff,#f5ecd8)', 중세: 'linear-gradient(180deg,#c7b8e8,#e7e5e4)', 동양: 'linear-gradient(180deg,#d9f99d,#fef3c7)',
  근대: 'linear-gradient(180deg,#cbd5e1,#f1f5f9)', 현대: 'linear-gradient(180deg,#f5d0fe,#e0e7ff)', 히든: 'linear-gradient(180deg,#fef9c3,#fff)',
};
function cardHtml(id: string) {
  const p = PHIL.get(id)!;
  const recipes = RECIPES.filter((r) => r.result === id);
  const st = statsOf(id);
  const bar = (v: number, max: number) => `<span class="sbar"><i style="width:${Math.min(100, (v / max) * 100)}%"></i></span>`;
  return `<div class="pcard tc${p.tier}">
    <div class="pc-head"><span class="pc-tier tier-chip t${p.tier}">${TIER_NAME[p.tier]}</span><b>${p.name}</b><span class="pc-era">${ERA_ICON[p.era] ?? ''} ${p.school}</span></div>
    <div class="pc-art" style="background:${CARD_BG[p.era] ?? CARD_BG['고대']}"><img src="${portrait(id)}"></div>
    <div class="pc-quote">“${p.quote}”</div>
    <div class="pc-skill"><b>✦ ${p.skill}</b><span>${p.skillDesc}</span></div>
    <div class="pc-combat"><b>${TYPE_ICON[st.type]} ${st.type}</b> · 노리는 대상 <b>${st.target}</b><small>${st.note}</small></div>
    <div class="pc-stats2">
      <div>⚔ 위력 ${bar(st.dmg, 1800)}<em>${Math.round(st.dmg)}</em></div>
      <div>◎ 사거리 ${bar(st.range, 3.5)}<em>${st.range}칸</em></div>
      <div>⏱ 공속 ${bar(1 / st.cooldown, 2.2)}<em>${(1 / st.cooldown).toFixed(2)}/초</em></div>
      <div>📈 초당 피해 ${bar(st.dmg / st.cooldown, 3200)}<em>${Math.round(st.dmg / st.cooldown)}</em></div>
    </div>
    <div class="pc-lore">${p.lore}</div>
    ${recipes.map((r) => `<div class="pc-recipe">⚗ ${r.materials.map((m) => PHIL.get(m)!.name).join(' + ')}${r.catalyst ? ' + ' + CAT_ICON[r.catalyst] : ''}<small>${r.logic}</small></div>`).join('')}
    <div class="pc-foot">AGORA · ${TIER_NAME[p.tier]}</div>
  </div>`;
}
function showCard(id: string) {
  const p = PHIL.get(id)!;
  const n = progress.cards[id] ?? 0, lv = cardLevel(n), next = nextLevelAt(n);
  const ownedTools = ITEMS.filter((it) => progress.items[it.id]).sort((a, b) => Number(isOwner(b.id, p.realName)) - Number(isOwner(a.id, p.realName)));
  const cur = progress.loadout[id];
  const aw = awakenLevel(n);
  const lines = LINES[p.realName] ?? [p.lore, `대표 문장: ${p.quote}`, `${p.school} 계열의 철학자.`];
  const growth = `<div class="pc-growth"><b>🎴 카드 Lv.${lv}</b>${aw ? ` <b class="awaken">✦ 각성 ${'★'.repeat(aw)}${'☆'.repeat(AWAKEN_MAX - aw)}</b>` : ''} <span>${n}장${next ? ` · 다음 ${lv < CARD_MAX_LEVEL ? '레벨' : '각성'}까지 ${next - n}장` : ' · 완전 각성'}</span>
    <div class="bar"><i style="width:${next ? Math.min(100, (n / next) * 100) : 100}%"></i></div>
    <small>전투 공격력 ×${cardMult(n).toFixed(2)}${aw ? ` · 스킬 위력 +${aw * 20}%` : ''}</small></div>
    <div class="pc-lines"><b>📜 일화</b>${UNLOCK_LEVELS.map((L, i) => lv >= L ? `<p>“${homage(lines[i])}”</p>` : `<p class="locked">🔒 카드 Lv.${L}에 열려요</p>`).join('')}</div>
    ${n ? `<div class="pc-skins"><b>👗 스킨</b>${Object.entries(SKINS).map(([k, s]) => {
      const own = progress.skins.includes(id + ':' + k), on = progress.skinOn[id] === k;
      return `<button data-skin="${k}" class="${on ? 'on' : ''}">${s.icon} ${s.name}${on ? ' (착용 중)' : own ? '' : ' · 💎' + SKIN_PRICE}</button>`;
    }).join('')}${progress.skinOn[id] ? '<button data-skin="">기본 모습</button>' : ''}</div>` : ''}
    <div class="pc-tools"><b>🧰 장착 도구</b>${ownedTools.length ? ownedTools.map((it) => `<button data-equip="${it.id}" class="${cur === it.id ? 'on' : ''} ${isOwner(it.id, p.realName) ? 'own' : ''}"><img src="${itemUrl(it.id)}">${it.name}${isOwner(it.id, p.realName) ? ' ★' : ''}</button>`).join('') + (cur ? '<button data-equip="">해제</button>' : '') : '<small>도구 상자에서 도구를 뽑아 오세요</small>'}</div>
    ${n ? `<button class="chunky ${progress.favorite === id ? 'pink' : 'blue'} fav-set">${progress.favorite === id ? '💗 나의 최애 (해제하기)' : '💗 최애로 지정 · 고민방 주인'}</button>` : ''}`;
  alertBox(cardHtml(id).replace('<div class="pc-foot">', growth + '<button class="chunky blue tcg-from">🃏 카드로 보기</button><div class="pc-foot">'));
  const tf = document.querySelector<HTMLButtonElement>('.tcg-from');
  if (tf) tf.onclick = (e) => { e.stopPropagation(); document.querySelector('.overlay')?.remove(); openTcg(id); };
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-equip]')) b.onclick = (e) => {
    e.stopPropagation();
    if (b.dataset.equip) progress.loadout[id] = b.dataset.equip; else delete progress.loadout[id];
    saveProgress(progress); document.querySelector('.overlay')?.remove(); renderCodex(); showCard(id);
  };
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-skin]')) b.onclick = (e) => {
    e.stopPropagation();
    const k = b.dataset.skin!;
    if (!k) delete progress.skinOn[id];
    else if (progress.skins.includes(id + ':' + k)) progress.skinOn[id] = k;
    else if (progress.gems >= SKIN_PRICE && window.confirm(`${SKINS[k].icon} ${SKINS[k].name} 스킨을 💎${SKIN_PRICE}에 살까요?`)) { progress.gems -= SKIN_PRICE; progress.skins.push(id + ':' + k); progress.skinOn[id] = k; sfx.reveal(5); }
    else if (progress.gems < SKIN_PRICE) { toast('💎 지혜석이 부족해요'); return; }
    else return;
    saveProgress(progress); refreshWallet(); document.querySelector('.overlay')?.remove(); renderCodex(); showCard(id);
  };
  const fs = document.querySelector<HTMLButtonElement>('.fav-set');
  if (fs) fs.onclick = (e) => {
    e.stopPropagation();
    if (progress.favorite === id) delete progress.favorite; else { progress.favorite = id; roomThinker = id; sfx.reveal(5); }
    saveProgress(progress); document.querySelector('.overlay')?.remove(); renderCodex(); showCard(id);
  };
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
let cell = 0, cellX = 0; // cell: 세로 칸(크기 기준), cellX: 가로 칸 (화면 폭에 맞춰 넓어짐)
let tick = 0;
let resultShown = false;
let introT = 0;

/** 필드(7칸) + 대기석 한 줄 높이 */
const ROWS = GRID + 1.4;
/** 화면 높이에 맞춰 필드 크기를 정한다: 남는 공간 안에서 가장 크게 (스크롤 없이 한 화면) */
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const wrap = $('field-wrap');
  const W = wrap.clientWidth;
  // 필드가 먼저: 상단·하단 버튼을 뺀 높이에서 아래 패널 최소 높이(104px)만 남기고 필드에 준다
  const battle = $('battle');
  const fixed = ['hud', 'cats', 'dock'].reduce((a, id) => a + $(id).offsetHeight, 0) + 8 * 4 + 16;
  const H = Math.max(160, battle.clientHeight - fixed - 104);
  if (!W || !battle.clientHeight) return;
  // 세로에 맞춰 칸 크기를 정하고, 가로는 화면 폭까지 넓힌다 (칸이 최대 1.5배까지 옆으로 길어짐)
  const c = Math.min(W / GRID, H / ROWS);
  const width = Math.floor(c * GRID); // 정사각형 칸
  const height = Math.floor(c * ROWS);
  canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cell = height / ROWS;
  cellX = width / GRID;
}
window.addEventListener('resize', resize);
new ResizeObserver(resize).observe($('battle'));

function startBattle(s: Stage, oneTool?: string, story?: StoryStage) {
  if (story) { const base = STAGES.find((x) => x.id === story.base)!; s = { ...base, name: story.title, boss10: story.boss, boss20: story.boss, story: story.when }; }
  game = new Game(s, {
    cardMult: (id) => cardMult(progress.cards[id] ?? 0),
    awaken: (id) => awakenLevel(progress.cards[id] ?? 0),
    tool: (id) => { const t = progress.loadout[id]; return t && progress.items[t] ? t : undefined; },
  }, story ? 'easy' : oneTool ? 'normal' : diffId, oneTool);
  if (story) { game.storyId = story.id; game.summonPool = summonPool(); }
  // 마스터 계정은 전장에 들어갈 때 무조건 골드 10000
  if (me?.role === 'master') game.gold = 10000;
  selected = null;
  resultShown = false;
  introT = 2.8;
  lastSynthKey = lastInfoKey = lastCatKey = '';
  show('battle');
  tutStep = progress.battleTutDone || oneTool ? -1 : 0; tutShown = -2;
  updateUI();
}

function endBattle() {
  if (game) {
    progress.seen = [...new Set([...progress.seen, ...game.discovered])];
    progress.gonoe += Math.round(battleReward(game.wave, game.over === 'win') * game.diff.reward);
    if (game.oneTool) {
      const best = progress.oneToolBest[game.oneTool] ?? 0;
      if (game.wave > best) { progress.oneToolBest[game.oneTool] = game.wave; setTimeout(() => toast(`💗 원툴 신기록! ${game?.wave ?? ''}웨이브`), 300); }
    }
    const st = game.storyId ? STORY_MAP.get(game.storyId) : undefined;
    if (st && game.over === 'win') {
      const first = !(progress.storyCleared ?? []).includes(st.id);
      progress.storyCleared = [...new Set([...(progress.storyCleared ?? []), st.id])];
      const ids = st.memories.map((n) => PHILOSOPHERS.find((p) => p.realName === n)!.id);
      for (const id of ids) { progress.cards[id] = (progress.cards[id] ?? 0) + 1; if (!progress.seen.includes(id)) progress.seen.push(id); }
      if (first) progress.gems += 20;
      saveProgress(progress);
      setTimeout(() => playDialogue(st.outro, st, () => memoryReveal(ids, st)), 200);
    } else if (game.over === 'win') {
      if (!progress.cleared.includes(game.stage.id)) progress.cleared.push(game.stage.id);
      const k = clearKey(game.stage.id, game.diff.id);
      if (!progress.cleared.includes(k)) progress.cleared.push(k);
      if (!progress.firstClears.includes(k)) {
        progress.firstClears.push(k);
        const gems = FIRST_CLEAR_GEMS[DIFFICULTIES.findIndex((d) => d.id === game!.diff.id)] ?? 30;
        progress.gems += gems;
        setTimeout(() => toast(`💎 첫 클리어 보상 +${gems}`), 400);
      }
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
  const cy = Math.min(GRID, Math.floor(((ev.clientY - r.top) / r.height) * ROWS));
  const benchHit = cy === GRID && cx >= 1 && cx <= BENCH;
  if (cx < 0 || cy < 0 || cx >= GRID || (cy === GRID && !benchHit) || (cy < GRID && game.isRoad(cx, cy))) { selected = null; updateUI(); return; }
  const t = game.towerAt(cx, cy);
  if (selected && selected === t) selected = null;
  else if (selected) { game.moveTo(selected, cx, cy); selected = null; }
  else selected = t ?? null;
  updateUI();
});

$('summon').onclick = () => { if (game?.summon()) sfx.summon(); updateUI(); };
$('sell').onclick = () => { if (game && selected) { game.sell(selected); selected = null; updateUI(); } };
// 웨이브 시작 / (판이 끝났으면) 나가기 — 버튼 하나, 상태로 판단
$('start').onclick = () => {
  if (!game) return;
  if (game.over) { endBattle(); return; }
  game.startWave(); updateUI();
};
$('speed').onclick = () => { speed = speed === 3 ? 1 : speed + 1; $('speed').textContent = `${speed}x`; };
$('quit').onclick = () => { if (confirmQuit()) endBattle(); };
const confirmQuit = () => !game || !!game.over || game.wave === 0 || window.confirm('전투를 포기하고 나갈까요?');

let lastSynthKey = '', lastInfoKey = '', lastCatKey = '';
function updateUI() {
  tutTick();
  if (!game) return;
  const g = game;
  $('gold').textContent = String(g.gold);
  $('lives').textContent = String(g.lives);
  $('wave').textContent = String(g.wave);
  $('wave-max').textContent = String(g.maxWave);
  $<HTMLElement>('wave-bar').style.width = `${(g.wave / g.maxWave) * 100}%`;
  $('diff-chip').textContent = g.diff.icon;
  $('diff-chip').title = g.diff.name;
  $('cost').textContent = g.tickets ? `🎟${g.tickets} 무료` : `${g.summonCost}G`;
  $<HTMLButtonElement>('summon').disabled = !g.canSummon() || !!g.over;
  $<HTMLButtonElement>('sell').disabled = !selected;
  const start = $<HTMLButtonElement>('start');
  start.textContent = g.over ? '나가기' : g.countdown > 0 ? `다음 웨이브 ${Math.ceil(g.countdown)}` : '웨이브 시작';
  start.disabled = !g.over && (g.running || g.countdown > 0);

  if (g.over && !resultShown) {
    resultShown = true;
    if (g.over === 'win') sfx.win(); else sfx.lose();
    const newOnes = [...g.discovered].filter((id) => !progress.seen.includes(id));
    const s = g.stage;
    const unlocks = g.over === 'win' ? STAGES.filter((x) => x.unlockAfter === s.id && !progress.cleared.includes(s.id)).map((x) => x.name) : [];
    alertBox(g.over === 'win'
      ? `<h2>🏛 ${s.boss20} 논파!</h2><p>${s.name}을(를) 지켜 냈습니다.</p>${unlocks.length ? `<p>🔓 새 스테이지: <b>${unlocks.join(', ')}</b></p>` : ''}${newOnes.length ? `<p>📖 도감 등록 ${newOnes.length}명</p>` : ''}`
      : g.oneTool ? `<h2>💗 원툴 도전 종료</h2><p><b>${PHIL.get(g.oneTool)!.name}</b>와(과) 함께 <b>${g.wave}웨이브</b>까지 버텼어요!</p><p>최고 기록 ${Math.max(g.wave, progress.oneToolBest[g.oneTool] ?? 0)}웨이브</p>`
      : `<h2>💀 멘탈 붕괴</h2><p>${g.wave}웨이브에서 도그마에 잠식당했습니다.</p>${newOnes.length ? `<p>📖 그래도 도감에 ${newOnes.length}명 등록</p>` : ''}`);
  }

  // 정보창
  const info = $('info');
  const infoKey = `${selected?.uid}|${selected?.philId}|${selected?.level}|${g.towers.length}|${selected?.cy}|${selected && g.upgradeCost(selected) !== null ? g.gold >= g.upgradeCost(selected)! : ''}`;
  if (infoKey !== lastInfoKey) {
    lastInfoKey = infoKey;
    info.className = '';
    if (selected) {
      const p = PHIL.get(selected.philId)!;
      const st = statsOf(p.id);
      const cost = g.upgradeCost(selected);
      const hk = g.home(selected).kind;
      const tags = [
        `${TYPE_ICON[st.type]} ${st.type}`, `◎ ${st.range}칸`,
        hk === 'star' ? `🏠 +${STAR_BONUS * 100}%` : hk === 'era' ? `🏠 +${ERA_BONUS * 100}%` : '',
        p.id === g.stage.counter ? '⚔ 보스×3' : '', g.isBench(selected) ? '💤 대기 중' : '',
      ].filter(Boolean);
      info.className = `icard t${p.tier}`;
      info.innerHTML = `<div class="ic-top"><img src="${portrait(p.id)}"><div><span class="tier-chip t${p.tier}">${TIER_NAME[p.tier]}</span>${selected.level ? ` <span class="tag lv">+${selected.level}</span>` : ''}<b>${p.name}</b></div></div>
        <div class="ic-tags">${tags.map((t) => `<span>${t}</span>`).join('')}</div>
        <div class="ic-skill"><b>✦ ${p.skill}</b> ${p.skillDesc}</div>${toolLine(g, selected)}
        ${cost !== null ? `<button id="upgrade" class="up">⬆ 강화 ${cost}G</button>` : ''}`;
      const up = document.getElementById('upgrade');
      if (up) { (up as HTMLButtonElement).disabled = g.gold < cost!; up.onclick = () => { if (selected && g.upgrade(selected)) { lastInfoKey = ''; updateUI(); } }; }
    } else {
      info.className = 'icard empty';
      info.innerHTML = `<div class="ic-hint">👆 철학자를 눌러 보세요</div><div class="ic-tags"><span>🪑 ${g.fielded().length}/25</span><span>💤 ${BENCH - g.benchSlots().length}/${BENCH}</span></div><small>선택한 뒤 빈 칸을 누르면 옮겨요</small>`;
    }
  }

  // 촉매
  const catKey = JSON.stringify(g.catalysts) + g.running + g.wave;
  if (catKey !== lastCatKey) {
    const fresh = new Set(g.drops.splice(0));
    lastCatKey = catKey;
    $('cats').innerHTML = (QA_MODE ? '<span class="qa">QA</span>' : '') + `<span class="stage-name">${ERA_ICON[g.stage.era]} ${g.stage.name} ${g.running ? { normal: '', fast: '· 💨빠른 적', tank: '· 🛡단단한 적', swarm: '· 🐜떼', boss: '· 👑보스' }[g.waveKind()] : ''}</span>` + CATALYST_IDS.map((id) =>
      `<span class="c ${g.catalysts[id] ? 'on' : ''} ${fresh.has(id) ? 'flash' : ''}" title="촉매: ${CAT_NAME[id]}">${CAT_ICON[id]}${g.catalysts[id]}</span>`).join('');
  }

  // 조합: 지금 만들 수 있는 것 + 하나만 모자란 것
  const recipes = g.over ? [] : g.availableRecipes()
    .sort((a, b) => Number(g.hasCatalyst(b)) - Number(g.hasCatalyst(a)) || PHIL.get(b.result)!.tier - PHIL.get(a.result)!.tier)
    .slice(0, 3);
  const near = g.over || g.oneTool ? [] : RECIPES.filter((r) => !recipes.includes(r) && g.ownedMaterials(r).filter((x) => !x).length === 1 && !PHIL.get(r.result)!.hidden)
    .sort((a, b) => PHIL.get(a.result)!.tier - PHIL.get(b.result)!.tier).slice(0, 2);
  const goals = RECIPES.filter((r) => (progress.likedRecipes ?? []).includes(r.id));
  const key = near.map((r) => r.id).join() + '|' + recipes.map((r) => r.id + g.hasCatalyst(r)).join() + '|' + goals.map((r) => g.ownedMaterials(r).join('')).join();
  if (key !== lastSynthKey) {
    lastSynthKey = key;
    const box = $('synth');
    box.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'sy-head';
    head.textContent = recipes.length ? `⚗ 조합 가능 ${recipes.length}` : '⚗ 조합';
    box.appendChild(head);
    const face = (id: string, known = true) => `<img src="${portrait(id)}" class="${known ? '' : 'unk'}">`;
    for (const r of goals) {
      const res = PHIL.get(r.result)!, own = g.ownedMaterials(r);
      const known = QA_MODE || progress.seen.includes(res.id);
      const el = document.createElement('div');
      el.className = 'sy-row goal';
      el.innerHTML = `<span class="mats">${r.materials.map((m, i) => `<i class="${own[i] ? 'have' : ''}">${face(m)}</i>`).join('')}</span><span class="arrow">💗</span>${face(res.id, known)}<b>${known ? shortName(res.name) : '???'}</b>`;
      box.appendChild(el);
    }
    for (const r of recipes) {
      const b = document.createElement('button');
      const res = PHIL.get(r.result)!;
      const ok = g.hasCatalyst(r);
      const seen = progress.seen.includes(res.id) || QA_MODE;
      b.className = `sy-row ready t${res.tier} ${ok ? '' : 'locked'}`;
      b.innerHTML = `<span class="mats">${r.materials.map((m) => `<i>${face(m)}</i>`).join('')}${r.catalyst ? `<em>${CAT_ICON[r.catalyst]}</em>` : ''}</span><span class="arrow">➜</span>${face(res.id, seen || !res.hidden)}<b>${res.hidden && !seen ? '???' : shortName(res.name)}</b>`;
      if (!ok) b.disabled = true;
      b.onclick = () => { selected = g.synthesize(r); updateUI(); };
      box.appendChild(b);
    }
    for (const r of near) {
      const res = PHIL.get(r.result)!, own = g.ownedMaterials(r);
      const miss = r.materials.find((_, i) => !own[i])!;
      const seen = progress.seen.includes(res.id) || QA_MODE;
      const el = document.createElement('div');
      el.className = 'sy-row near';
      el.innerHTML = `<span class="tip">💡</span><i class="miss">${face(miss)}</i><small>${shortName(PHIL.get(miss)!.name)}만 더</small><span class="arrow">➜</span>${face(res.id, seen)}<b>${seen ? shortName(res.name) : '???'}</b>`;
      box.appendChild(el);
    }
  }
}

// ---------- 그리기 ----------
function draw() {
  if (!game || !cell) return;
  const g = game;
  const w = canvas.clientWidth, hTot = canvas.clientHeight, fh = GRID * cell; // fh: 필드 높이
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  ctx.clearRect(0, 0, w, hTot);
  // 대기석 판 (필드 아래)
  ctx.fillStyle = '#f3e3c3'; ctx.fillRect(0, fh, w, hTot - fh);
  ctx.fillStyle = '#3b2a1e'; ctx.fillRect(0, fh - 1.5, w, 3);
  ctx.font = `${Math.max(10, cell * 0.2)}px "Jua", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('대기석', cellX * 0.5, fh + cell * 0.6); ctx.fillText(`${BENCH - game.benchSlots().length}/${BENCH}`, cellX * 6.5, fh + cell * 0.6);
  for (let x = 1; x <= BENCH; x++) if (!game.towerAt(x, GRID)) { ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.strokeStyle = 'rgba(59,42,30,.25)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.roundRect((x + 0.5) * cellX - cell * 0.4, fh + cell * 0.12, cell * 0.8, cell * 0.95, cell * 0.18); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); }
  ctx.save();
  if (shake > 0) ctx.translate(rnd(-1, 1) * shake * 8, rnd(-1, 1) * shake * 8);
  ctx.imageSmoothingEnabled = false;

  // ---- 바닥: 스테이지별 질감 (칸 테두리 없이 하나의 필드처럼) ----
  const th = THEME[g.stage.era] ?? THEME['고대'];
  ctx.fillStyle = th.ground; ctx.fillRect(0, 0, w, fh);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, fh); ctx.clip();
  for (let i = 0; i < 140; i++) {
    const rx = hash(i * 7.1) * w, ry = hash(i * 3.3 + 1) * fh, r = 1 + hash(i) * 2.5;
    ctx.fillStyle = i % 3 ? th.speck : th.speck2;
    ctx.beginPath(); ctx.arc(rx, ry, r, 0, Math.PI * 2); ctx.fill();
  }
  // ---- 길: 굽이치는 두꺼운 길 + 테두리 ----
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const [color, width] of [[th.roadEdge, 0.9], [th.road, 0.72]] as const) {
    ctx.strokeStyle = color; ctx.lineWidth = cell * width;
    for (const path of g.layout.paths) {
      ctx.beginPath();
      path.forEach(([px, py], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, (px + 0.5) * cellX, (py + 0.5) * cell));
      if (g.layout.loop) ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.strokeStyle = th.roadLine; ctx.lineWidth = 2; ctx.setLineDash([4, 8]);
  for (const path of g.layout.paths) {
    ctx.beginPath();
    path.forEach(([px, py], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, (px + 0.5) * cellX, (py + 0.5) * cell));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // 진행 방향 화살표 (각 변 가운데)
  for (const path of g.layout.paths) for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1], [bx, by] = path[i];
    const mx = ((ax + bx) / 2 + 0.5) * cellX, my = ((ay + by) / 2 + 0.5) * cell, ang = Math.atan2(by - ay, bx - ax);
    ctx.save(); ctx.translate(mx, my); ctx.rotate(ang); ctx.fillStyle = th.roadEdge;
    ctx.beginPath(); ctx.moveTo(cell * 0.18, 0); ctx.lineTo(-cell * 0.1, -cell * 0.14); ctx.lineTo(-cell * 0.1, cell * 0.14); ctx.fill(); ctx.restore();
  }
  // 철학자 자리 25칸 (빈자리만 은은하게)
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
    if (g.isRoad(x, y) || g.towerAt(x, y)) continue;
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.strokeStyle = 'rgba(59,42,30,.12)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect((x + 0.12) * cellX + (cellX - cell) / 2, (y + 0.12) * cell, cell * 0.76, cell * 0.76, cell * 0.18); ctx.fill(); ctx.stroke();
  }
  ctx.font = `${cell * 0.55}px sans-serif`;
  const first = g.layout.paths[0];
  if (!g.layout.loop) {
    ctx.fillText('🚪', (first[0][0] + 0.5) * cellX, (first[0][1] + 0.5) * cell);
    const end = first[first.length - 1];
    ctx.fillText(g.stage.id === 'S2' ? '⛪' : '🏁', (end[0] + 0.5) * cellX, (end[1] + 0.5) * cell);
  }

  // 선택 시: 사거리 + 옮길 수 있는 자리 표시
  if (selected) {
    const st = statsOf(selected.philId);
    ctx.save(); ctx.beginPath();
    ctx.ellipse((selected.cx + 0.5) * cellX, (selected.cy + 0.5) * cell, (st.range + g.itemMult(selected).range) * cellX, (st.range + g.itemMult(selected).range) * cell, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(251,191,36,.10)'; ctx.fill();
    ctx.strokeStyle = 'rgba(251,191,36,.6)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(56,189,248,.28)';
    for (const [x, y] of g.emptyCells()) { ctx.beginPath(); ctx.arc((x + 0.5) * cellX, (y + 0.62) * cell, cell * 0.16, 0, Math.PI * 2); ctx.fill(); }
  }

  // ---- 오라 철학자: 주변 8칸에 은은한 빛 ----
  for (const t of g.towers) {
    const s = SKILLS[PHIL.get(t.philId)!.realName];
    if (!s || (s.kind !== 'auraAtk' && s.kind !== 'auraSpeed' && s.kind !== 'globalSlow')) continue;
    const pulse = 0.5 + 0.5 * Math.sin(tick * 0.06 + t.uid);
    ctx.fillStyle = s.kind === 'auraAtk' ? `rgba(255,159,67,${0.08 + pulse * 0.06})` : s.kind === 'auraSpeed' ? `rgba(95,198,160,${0.08 + pulse * 0.06})` : `rgba(96,165,250,${0.05 + pulse * 0.04})`;
    if (s.kind === 'globalSlow') { ctx.beginPath(); ctx.arc((t.cx + 0.5) * cellX, (t.cy + 0.5) * cell, cell * (1.6 + pulse * 0.3), 0, Math.PI * 2); ctx.fill(); }
    else { ctx.beginPath(); ctx.roundRect((t.cx - 1) * cellX + 4, (t.cy - 1) * cell + 4, cellX * 3 - 8, cell * 3 - 8, cell * 0.5); ctx.fill(); }
  }

  // ---- 철학자: 그림자 + 큰 도트 + 등급 배지 ----
  const towers = [...g.towers].sort((a, b) => a.cy - b.cy);
  ctx.restore(); // 필드 클립 끝 → 대기석 철학자도 그린다
  for (const t of towers) {
    const p = PHIL.get(t.philId)!;
    const cx = (t.cx + 0.5) * cellX, foot = (t.cy + 0.86) * cell;
    const isSel = t === selected;
    if (isSel) { ctx.fillStyle = 'rgba(251,191,36,.55)'; ctx.beginPath(); ctx.ellipse(cx, foot, cell * 0.42, cell * 0.16, 0, 0, Math.PI * 2); ctx.fill(); }
    const hk = g.home(t).kind;
    if (hk) { ctx.fillStyle = hk === 'star' ? 'rgba(255,211,107,.75)' : 'rgba(167,236,210,.6)'; ctx.beginPath(); ctx.ellipse(cx, foot, cell * 0.42, cell * 0.15, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(cx, foot, cell * 0.3, cell * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    if (p.tier >= 7) {
      ctx.save(); ctx.globalAlpha = 0.35 + 0.2 * Math.sin(tick * 0.08);
      ctx.fillStyle = `hsl(${(tick * 2) % 360},90%,60%)`;
      ctx.beginPath(); ctx.arc(cx, foot - cell * 0.45, cell * 0.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    const bob = Math.sin((tick + t.cx * 9 + t.cy * 5) * 0.1) * cell * 0.03;
    const sz = cell * (p.tier >= 6 ? 1.08 : 0.96);
    const rc = recoil.get(t.uid) ?? 0;
    const sx = sz * (1 + rc * 0.12), sy = sz * (1 - rc * 0.1);
    ctx.drawImage(spriteFor(p.id), cx - sx / 2, foot - sy * 0.97 + bob, sx, sy);
    if ((t.stunT ?? 0) > 0) {
      ctx.font = `${cell * 0.32}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText('💤', cx + cell * 0.28, foot - cell * 0.9 + Math.sin(tick * 0.15) * 3);
    }
    // 이름표
    const nm = (progress.favorite === t.philId ? '💗' : '') + shortName(p.name);
    const fs = Math.max(9, cell * 0.18);
    ctx.font = `${fs}px "Jua", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const nw = ctx.measureText(nm).width + 8, ny = foot + fs * 0.35;
    ctx.fillStyle = isSel ? '#ffd36b' : 'rgba(255,255,255,.92)'; ctx.strokeStyle = '#3b2a1e'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(cx - nw / 2, ny - fs * 0.62, nw, fs * 1.24, fs * 0.6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3b2a1e'; ctx.fillText(nm, cx, ny + 0.5);
    // 등급 배지
    const bx = (t.cx + 0.2) * cellX, by = (t.cy + 0.2) * cell, br = cell * 0.13;
    ctx.fillStyle = TIER_AURA[p.tier]; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1c1917'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = `900 ${br * 1.3}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(p.tier), bx, by + 0.5);
    const tool = g.toolOf(t);
    if (tool) {
      const isz = cell * 0.38, ix = (t.cx + 0.62) * cellX, iy = (t.cy + 0.42) * cell;
      if (isOwner(tool, p.realName)) { ctx.fillStyle = 'rgba(253,224,71,.55)'; ctx.beginPath(); ctx.arc(ix + isz / 2, iy + isz / 2, isz * 0.62, 0, Math.PI * 2); ctx.fill(); }
      ctx.drawImage(itemSprite(tool), ix, iy, isz, isz);
    }
    if (hk === 'star') { ctx.font = `${cell * 0.22}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('🏠', (t.cx + 0.86) * cellX, (t.cy + 0.78) * cell); }
    if (t.level) {
      ctx.fillStyle = '#22d3ee'; ctx.font = `900 ${cell * 0.2}px sans-serif`;
      ctx.fillText(`+${t.level}`, (t.cx + 0.85) * cellX, (t.cy + 0.15) * cell);
    }
  }

  for (const e of g.enemies) {
    const [ex, ey] = g.enemyPos(e);
    const x = ex * cellX, y = ey * cell, sz = cell * (e.boss ? 1.25 : 0.85);
    const walk = Math.abs(Math.sin(tick * 0.2 + e.uid)) * 3;
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.beginPath(); ctx.ellipse(x, y + sz * 0.42, sz * 0.32, sz * 0.13, 0, 0, Math.PI * 2); ctx.fill();
    const ksz = e.kind === 'tank' ? 1.25 : e.kind === 'swarm' ? 0.7 : e.kind === 'fast' ? 0.85 : 1;
    const esz = sz * ksz;
    ctx.drawImage(monsterSprite(g.stage.era, e.boss ? 'boss' : g.wave < 10 ? 'early' : 'late'), x - esz / 2, y - esz / 2 - walk, esz, esz);
    if ((e.shieldT ?? 0) > 0) { ctx.strokeStyle = 'rgba(255,211,107,.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - walk, esz * 0.6, 0, Math.PI * 2); ctx.stroke(); }
    if ((e.slowT ?? 0) > 0) { ctx.fillStyle = 'rgba(169,216,255,.35)'; ctx.beginPath(); ctx.arc(x, y - walk, esz * 0.45, 0, Math.PI * 2); ctx.fill(); }
    if ((e.stunT ?? 0) > 0) { ctx.font = `${cell * 0.25}px sans-serif`; ctx.fillText('💫', x, y - esz / 2 - walk); }
    if ((e.vulnT ?? 0) > 0) { ctx.font = `${cell * 0.22}px sans-serif`; ctx.fillText('🎯', x + esz * 0.4, y - walk); }
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
  // 탄환: 작은 빛 구슬 (대사는 스킬이 터질 때만 말풍선으로)
  for (const b of g.bullets) {
    const x = b.x * cellX, y = b.y * cell, r = cell * (b.color ? 0.11 : 0.08);
    ctx.fillStyle = b.color === 'rainbow' ? `hsl(${(tick * 3) % 360},90%,75%)` : b.color === 'gold' ? '#ffd36b' : '#ffffff';
    ctx.strokeStyle = '#3b2a1e'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  // 스킬 대사 말풍선
  ctx.font = `${Math.max(10, cell * 0.2)}px "Jua", sans-serif`;
  for (const [uid, sp] of speeches) {
    const t = g.towers.find((x) => x.uid === uid);
    if (!t) { speeches.delete(uid); continue; }
    const a = Math.min(1, sp.t / 0.3, (2.4 - sp.t) / 0.15 + 0.2);
    const text = sp.text.length > 16 ? sp.text.slice(0, 15) + '…' : sp.text;
    const tw = ctx.measureText(text).width + 14, th = cell * 0.36;
    let x = (t.cx + 0.5) * cellX; const y = t.cy * cell - th * 0.2;
    x = Math.max(tw / 2 + 2, Math.min(w - tw / 2 - 2, x));
    ctx.save(); ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = '#fffdf6'; ctx.strokeStyle = '#3b2a1e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x - tw / 2, y - th, tw, th, th / 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo((t.cx + 0.42) * cellX, y - 1); ctx.lineTo((t.cx + 0.5) * cellX, y + cell * 0.1); ctx.lineTo((t.cx + 0.58) * cellX, y - 1); ctx.fill();
    ctx.fillStyle = '#3b2a1e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y - th / 2 + 1);
    ctx.restore();
  }

  if (g.noticeTime > 0) {
    ctx.save(); ctx.globalAlpha = Math.min(1, g.noticeTime);
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillRect(0, fh / 2 - cell * 0.45, w, cell * 0.9);
    ctx.fillStyle = '#3b2a1e'; ctx.font = `800 ${Math.max(12, cell * 0.32)}px "Noto Sans KR", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(g.notice, w / 2, fh / 2);
    ctx.restore();
  }

  if (introT > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, introT / 0.6, (2.8 - introT) / 0.3);
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(0, fh / 2 - cell * 0.9, w, cell * 1.8);
    ctx.fillStyle = '#3b2a1e'; ctx.font = `800 ${cell * 0.22}px "Nanum Myeongjo", serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 ${cell * 0.4}px "Nanum Myeongjo", serif`;
    ctx.fillText(g.stage.name, w / 2, fh / 2 - cell * 0.35);
    ctx.font = `700 ${cell * 0.22}px "Noto Sans KR", sans-serif`;
    ctx.fillText(STAGE_PATHS[g.stage.id].caption, w / 2, fh / 2 + cell * 0.1);
    ctx.fillText(`${g.diff.icon} ${g.diff.name} · 최종 보스: ${g.stage.boss20} (${g.maxWave}웨이브)`, w / 2, fh / 2 + cell * 0.45);
    ctx.restore();
  }
  drawFx(w, fh);
  ctx.restore();
}

// 스테이지별 필드 테마
const THEME: Record<string, { ground: string; speck: string; speck2: string; road: string; roadEdge: string; roadLine: string; decor: string[] }> = {
  고대: { ground: '#f6ead2', speck: '#ecdcbc', speck2: '#fff6e4', road: '#fff3d6', roadEdge: '#b88a4f', roadLine: 'rgba(255,255,255,.5)', decor: ['column', 'olive', 'amphora'] },
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

const SHORT: Record<string, string> = { '델포이의 소크라테스': '소크라테스', '대성지성 공자': '공자', '마르틴 로우데거': '로우데거', '장 폴 사리티리': '사리티리', '자크 디리타': '디리타', '에마뉘엘 리비나스': '리비나스', '테오도어 아도로노': '아도로노', '알베르 카뮈': '카뮈',  '고타마 붓다': '붓다', '다산 정약용': '정약용', '퇴계 이황': '이황', '루트비히 비트겐슈타인': '비트겐', '아르투어 쇼펜하우어': '쇼펜하우어', '고트프리트 라이프니츠': '라이프니츠', '쇠렌 키르케고르': '키르케고르', '헤라클레이토스': '헤라클레', '아리스토텔레스': '아리스토', '나가르주나': '나가르',  '엘레아의 제논': '제논', '오컴의 윌리엄': '오컴', '이븐 시나': '이븐시나', '이븐 루시드': '이븐루시드', '알 킨디': '알킨디', '힐데가르트 폰 빙엔': '힐데가르트' };
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
  if (lv) parts.push(`🎴 카드 Lv.${lv}${awakenLevel(progress.cards[p.id] ?? 0) ? ' ✦각성' + awakenLevel(progress.cards[p.id] ?? 0) : ''} (공격 ×${cardMult(progress.cards[p.id] ?? 0).toFixed(2)})`);
  if (tool) { const it = ITEM.get(tool)!; parts.push(`<img src="${itemUrl(tool)}">${it.name}${isOwner(tool, p.realName) ? ' <b class="match">찰떡!</b>' : ''}`); }
  return parts.length ? `<small class="equip">${parts.join(' · ')}</small>` : '';
}

// =============== 허브 탭 ===============
let currentTab = 'stages';
function switchTab(tab: string) {
  currentTab = tab;
  for (const b of document.querySelectorAll<HTMLButtonElement>('#tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
  for (const s of document.querySelectorAll<HTMLElement>('.tab')) s.classList.toggle('hidden', s.id !== `tab-${tab}`);
  if (tab === 'stages') renderHome();
  if (tab === 'room') renderRoom();
  if (tab === 'gacha') renderGacha();
  if (tab === 'codex') renderCodex();
  if (tab === 'shop') renderShop();
  refreshWallet();
  pageTutStart(tab);
}
function refreshWallet() {
  const w = document.getElementById('wallet');
  if (w) w.innerHTML = `🤔 ${Math.floor(progress.gonoe).toLocaleString()} <i>💎 ${progress.gems.toLocaleString()}</i>${progress.tickets ? ` <i>🎫 ${progress.tickets}</i>` : ''}`;
  const r = document.getElementById('room-gonoe');
  if (r) r.textContent = Math.floor(progress.gonoe).toLocaleString();
}

// ---------- 고민방 ----------
let roomThinker = 'T104';
function renderRoom() {
  const idle = settleIdle(progress, clearedStages());
  saveProgress(progress);
  if (progress.favorite && progress.cards[progress.favorite]) roomThinker = progress.favorite;
  const owned = PHILOSOPHERS.filter((p) => progress.cards[p.id]);
  if (!progress.cards[roomThinker] && owned.length) roomThinker = owned.sort((a, b) => b.tier - a.tier)[0].id;
  const p = PHIL.get(roomThinker)!;
  const cost = tapUpgradeCost(progress);
  const rate = idleRate(progress, clearedStages());
  const next = { ...progress, tapLevel: progress.tapLevel + 1 };
  $('tab-room').innerHTML = `
    <div class="room">
      <div class="room-head"><h2>🤔 고민방</h2><button class="info-btn" id="room-info">i</button></div>
      <div class="room-sky"><div class="room-bubble">“${p.quote}”</div>
        <button id="thinker" class="thinker"><img src="${portrait(p.id)}"></button>
        <div class="room-floor"></div></div>
      <div class="room-stat"><span>고뇌</span><b id="room-gonoe">${Math.floor(progress.gonoe).toLocaleString()}</b></div>
      <div class="room-rates"><span>👆 탭당 <b>+${tapGain(progress)}</b></span><span>⏳ 초당 <b>+${rate.toFixed(1)}</b></span></div>
      ${idle ? `<p class="hint">자리를 비운 사이 고뇌 <b>+${idle.toLocaleString()}</b></p>` : ''}
      <button id="tap-up" class="chunky blue">💭 고민의 깊이 Lv.${progress.tapLevel + 1} → ${progress.tapLevel + 2}<small>탭 +${tapGain(progress)}→+${tapGain(next)} · 초당 ${rate.toFixed(1)}→${idleRate(next, clearedStages()).toFixed(1)} · 🤔${cost.toLocaleString()}</small></button>
    </div>`;
  $('room-info').onclick = () => alertBox(`<h2>🤔 고민방</h2><p>철학자를 톡톡 두드리면 고뇌가 나와요.<br>가만히 둬도 쌓이고(최대 ${8}시간), 스테이지를 깰수록 더 빨리 쌓여요.</p><p><b>고민의 깊이</b>를 올리면 탭당 고뇌와 초당 고뇌가 함께 올라요.</p><p>고뇌는 🎴 카드·🧰 도구 뽑기에 써요. 고민방 주인은 도감에서 💗최애로 바꿀 수 있어요.</p>`);
  $('thinker').onclick = (ev) => {
    progress.gonoe += tapGain(progress);
    saveProgress(progress);
    refreshWallet();
    sfx.tap();
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
function pullBtn(id: string, cls: string) {
  const o = PULLS.find((x) => x.id === id)!;
  return `<button class="chunky ${cls}" data-pull="${id}">${o.label}<small>${CUR_ICON[o.currency]} ${o.cost.toLocaleString()}</small></button>`;
}
function renderGacha() {
  const rates = CARD_RATES.map((r) => `<span class="tier-chip t${r.tier}">${TIER_NAME[r.tier]} ${(r.rate * 100).toFixed(1)}%</span>`).join(' ');
  $('tab-gacha').innerHTML = `
    <div class="gacha-box master-box">
      <div class="gb-head"><h2>✨ 거장 초대</h2><button class="info-btn" data-ginfo="m">i</button></div>
      <div class="banner-art">${PHILOSOPHERS.filter((p) => p.tier === 7 && !p.hidden).map((p) => `<img src="${portrait(p.id)}">`).join('')}</div>
      <div class="row">${pullBtn('m10', 'gold')}${pullBtn('m1', 'pink')}</div>
    </div>
    <div class="gacha-box card-box">
      <div class="gb-head"><h2>🧠 기억 떠올리기</h2><button class="info-btn" data-ginfo="c">i</button></div>
      <div class="row">${pullBtn('c1', 'pink')}${pullBtn('c10', 'gold')}${pullBtn('c10g', 'blue')}</div>
    </div>
    <div class="gacha-box tool-box">
      <div class="gb-head"><h2>🧰 도구 상자</h2><button class="info-btn" data-ginfo="t">i</button></div>
      <div class="row">${pullBtn('t1', 'mint')}${pullBtn('t10', 'gold')}${pullBtn('t10g', 'blue')}</div>
    </div>`;
  const INFO: Record<string, string> = {
    m: `<h2>✨ 거장 초대</h2><p>💎 지혜석 10회 뽑기의 마지막 1장은 반드시 <b>거장 또는 근원</b>이에요.<br>🎫 초대장 1장으로 거장 이상 1명을 바로 불러올 수도 있어요.</p>`,
    c: `<h2>🧠 기억 떠올리기</h2><p>고뇌를 써서 잊어버린 철학자의 <b>기억(카드)</b>을 떠올려요. 이야기에서 지나온 시대의 철학자만 떠올릴 수 있어요 (지금: ${[...openEras()].join(', ')}).</p><p>같은 카드가 모이면 레벨업(Lv.${CARD_MAX_LEVEL}까지) · 레벨당 공격력 +${CARD_ATK_PER_LEVEL * 100}%<br>그 뒤 ${AWAKEN_EVERY}장마다 <b>각성</b>(최대 ${AWAKEN_MAX}단계): 공격력 +15%, 스킬 강화<br>레벨이 오르면 일화가 열려요.</p><div class="rates-line">${rates}</div><p><b>천장</b>: 거장 이상이 안 나와도 ${PITY_LIMIT}회째엔 확정 · 지금 ${PITY_LIMIT - progress.pity}회 남음</p>`,
    t: `<h2>🧰 도구 상자</h2><p>뽑은 도구는 도감에서 철학자에게 장착해요.<br>그 도구의 주인에게 끼우면 <b>찰떡!</b> 공격력 +60%</p>`,
  };
  for (const b of $('tab-gacha').querySelectorAll<HTMLButtonElement>('[data-ginfo]')) b.onclick = () => alertBox(INFO[b.dataset.ginfo!]);
  for (const b of $('tab-gacha').querySelectorAll<HTMLButtonElement>('[data-pull]')) {
    const o = PULLS.find((x) => x.id === b.dataset.pull)!;
    b.disabled = !canAfford(progress, o);
    b.onclick = () => {
      const before = { ...progress.cards };
      const got = pull(progress, o);
      if (!got) return;
      saveProgress(progress); refreshWallet(); renderGacha();
      gachaShow(o, got, before);
    };
  }
}

/** 뽑기 연출: 봉인된 두루마리(최고 등급 색으로 빛남) → 터치 → 광선 폭발 → 한 장씩 공개 */
function gachaShow(o: PullOption, got: string[], before: Record<string, number>) {
  const isTool = o.kind === 'tool';
  const tiers = got.map((id) => (isTool ? 3 : PHIL.get(id)!.tier));
  const top = Math.max(...tiers);
  const glow = top >= 7 ? 'rainbow' : top >= 6 ? 'gold' : top >= 5 ? 'orange' : 'blue';
  const ov = document.createElement('div');
  ov.className = `gacha-stage glow-${glow}`;
  ov.innerHTML = `<div class="rays"></div><div class="scroll-wrap"><div class="scroll">${isTool ? '🧰' : '📜'}</div><p>터치해서 펼치기</p></div>
    <div class="cards ${got.length === 1 ? 'single' : ''}"></div><div class="g-actions"><button class="chunky blue skip">모두 열기</button><button class="chunky gold done hidden">확인</button></div>`;
  document.body.appendChild(ov);
  sfx.drumroll(1.2);
  const counted: Record<string, number> = { ...before };
  const cardsEl = ov.querySelector('.cards')!;
  let opened = false, idx = 0, timer = 0;
  const flipNext = (chain = true) => {
    if (idx >= got.length) { ov.querySelector('.skip')!.classList.add('hidden'); ov.querySelector('.done')!.classList.remove('hidden'); return; }
    const id = got[idx], tier = tiers[idx];
    const el = document.createElement('div');
    if (isTool) {
      const it = ITEMS.find((x) => x.id === id)!;
      el.className = 'gcard tool';
      el.innerHTML = `<img src="${itemUrl(id)}"><b>${it.name}</b><small>${it.owners.map((x) => homage(x).split(' ').pop()).join('·')}의 찰떡</small>`;
    } else {
      const p = PHIL.get(id)!;
      const prev = cardLevel(counted[id] ?? 0);
      counted[id] = (counted[id] ?? 0) + 1;
      const now = cardLevel(counted[id]);
      const tag = prev === 0 ? '<i class="new">NEW</i>' : now > prev ? `<i class="lvup">Lv.${now}!</i>` : '';
      el.className = `gcard t${tier} ${tier >= 6 ? 'legend' : ''} ${tier >= 7 ? 'mythic' : ''}`;
      el.innerHTML = `${tag}<img src="${portrait(id)}"><b>${p.name}</b><small>${TIER_NAME[tier]}</small>`;
      if (tier >= 6) { burst(ov, tier - 1); shakeEl(ov); }
    }
    sfx.reveal(tier - 1);
    cardsEl.appendChild(el);
    idx++;
    if (chain) timer = window.setTimeout(() => flipNext(), tier >= 6 ? 700 : 160);
    else if (idx >= got.length) flipNext(false);
  };
  const open = () => {
    if (opened) return; opened = true;
    ov.classList.add('opened');
    setTimeout(() => flipNext(), 450);
  };
  ov.querySelector('.scroll-wrap')!.addEventListener('click', open);
  setTimeout(open, 1400);
  ov.querySelector('.skip')!.addEventListener('click', (e) => {
    e.stopPropagation();
    opened = true; ov.classList.add('opened'); clearTimeout(timer);
    while (idx < got.length) flipNext(false);
  });
  ov.querySelector('.done')!.addEventListener('click', () => { ov.remove(); renderGacha(); });
}

function burst(host: HTMLElement, tier: number) {
  for (let i = 0; i < (tier >= 6 ? 60 : 30); i++) {
    const s = document.createElement('span');
    s.className = 'confetti';
    s.style.left = '50%'; s.style.top = '45%';
    s.style.setProperty('--dx', `${(Math.random() - 0.5) * 600}px`);
    s.style.setProperty('--dy', `${(Math.random() - 0.7) * 600}px`);
    s.style.background = ['#ffb3c7', '#ffd36b', '#a7ecd2', '#a9d8ff', '#c7a6ff'][i % 5];
    host.appendChild(s);
    setTimeout(() => s.remove(), 1200);
  }
}
function shakeEl(el: HTMLElement) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }

// ---------- 상점 ----------
function renderShop() {
  $('tab-shop').innerHTML = `<h2>🛍 상점</h2>
    <p class="hint">프로토타입이라 실제 결제 없이 바로 지급돼요. 가격과 구성은 출시 전 조정합니다.</p>
    <div class="shop-grid">${SHOP.map((s) => {
      const sold = s.once && progress.purchases.includes(s.id);
      return `<div class="shop-item ${sold ? 'sold' : ''}">${s.tag ? `<i class="tag-hot">${s.tag}</i>` : ''}<div class="shop-icon">${s.icon}</div><b>${s.name}</b><small>${s.desc}</small>
        <button class="chunky ${s.costGems ? 'blue' : 'gold'}" data-buy="${s.id}" ${sold ? 'disabled' : ''}>${sold ? '구매 완료' : s.price}</button></div>`;
    }).join('')}</div>`;
  for (const b of $('tab-shop').querySelectorAll<HTMLButtonElement>('[data-buy]')) b.onclick = () => {
    const item = SHOP.find((x) => x.id === b.dataset.buy)!;
    if (!item.costGems && !window.confirm(`[모의 결제] ${item.name} (${item.price})\n실제 결제는 일어나지 않아요. 지급할까요?`)) return;
    if (buy(progress, item)) { saveProgress(progress); refreshWallet(); renderShop(); sfx.reveal(5); toast(`🎉 ${item.name} 지급 완료!`); }
    else toast('💎 지혜석이 부족해요');
  };
}

// ---------- 조합표 · 확률표 ----------
function recipeSheet() {
  const g = game;
  const liked = new Set(progress.likedRecipes ?? []);
  const rows = RECIPES.filter((r) => !PHIL.get(r.result)!.hidden || progress.seen.includes(r.result))
    .sort((a, b) => Number(liked.has(b.id)) - Number(liked.has(a.id)) || PHIL.get(a.result)!.tier - PHIL.get(b.result)!.tier);
  const html = rows.map((r) => {
    const res = PHIL.get(r.result)!;
    const owned = g ? g.ownedMaterials(r) : r.materials.map(() => false);
    const mats = r.materials.map((m, i) => {
      const p = PHIL.get(m)!;
      return `<span class="mat t${p.tier} ${owned[i] ? 'have' : ''}"><img src="${portrait(m)}">${p.name}<i>${TIER_NAME[p.tier]}</i></span>`;
    }).join('<b class="plus">+</b>');
    const cat = r.catalyst ? `<b class="plus">+</b><span class="mat cat ${g && g.catalysts[r.catalyst] ? 'have' : ''}">${CAT_ICON[r.catalyst]}</span>` : '';
    const ready = g && owned.every(Boolean) && g.hasCatalyst(r);
    const known = QA_MODE || progress.seen.includes(res.id);
    return `<div class="rrow ${ready ? 'ready' : ''} ${liked.has(r.id) ? 'liked' : ''}"><button class="like" data-like="${r.id}">${liked.has(r.id) ? '💗' : '🤍'}</button><div class="res t${res.tier} ${known ? '' : 'unknown'}"><img src="${portrait(res.id)}"><b>${known ? res.name : '??? (처음 연성하면 공개)'}</b><i>${'★'.repeat(res.tier)}</i></div>
      <div class="mats">${mats}${cat}</div><small>${r.logic}</small></div>`;
  }).join('');
  alertBox(`<h2>📜 조합표</h2><p class="hint">초록 테두리 = 지금 전장에 있는 재료 · 🤍를 누르면 목표 조합으로 저장돼 전투 중 계속 보여요</p><div class="rlist">${html}</div>`);
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-like]')) b.onclick = (e) => {
    e.stopPropagation();
    const id = b.dataset.like!;
    const list = new Set(progress.likedRecipes ?? []);
    if (list.has(id)) list.delete(id); else list.add(id);
    progress.likedRecipes = [...list];
    saveProgress(progress);
    document.querySelector('.overlay')?.remove();
    lastSynthKey = '';
    recipeSheet();
  };
}

function rateSheet() {
  const commons = PHILOSOPHERS.filter((p) => p.tier === 1 && !p.hidden);
  const rows = [1, 2, 3, 4, 5, 6, 7].map((t) => `<tr><td><span class="tier-chip t${t}">${TIER_NAME[t]}</span></td><td>${PHILOSOPHERS.filter((p) => p.tier === t).length}명</td><td>${t === 1 ? '소환' : '📜 조합'}</td></tr>`).join('');
  alertBox(`<h2>🎲 소환과 등급</h2><p>소환하면 <b>흔함 ${commons.length}명</b> 중 한 명이 똑같은 확률(각 ${(100 / commons.length).toFixed(1)}%)로 나와요.<br>그 위 등급은 전부 조합표대로 만들어요.</p>
    <p class="hint">${commons.map((p) => p.name).join(' · ')}</p>
    <table class="rates"><tr><th>등급</th><th>인원</th><th>얻는 법</th></tr>${rows}</table>
    <p class="hint">🎟 무료 소환권: 10웨이브마다 보스를 잡으면 ${3}장, 5·15·25·35·45웨이브 광장 집회에서 1장</p>`);
}

// ---------- 타격감 연출 ----------
interface Shape { kind: string; x: number; y: number; tx?: number; ty?: number; r?: number; life: number; max: number }
const shapes: Shape[] = [];
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; text?: string; star?: boolean }
const particles: Particle[] = [];
const recoil = new Map<number, number>();
let shake = 0;
let banner: { text: string; t: number } | null = null;
let bossIntro: { name: string; t: number } | null = null;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const PASTEL = ['#ffb3c7', '#ffd36b', '#a7ecd2', '#a9d8ff', '#c7a6ff'];

function soundFor(f: FxEvent) {
  if (f.type === 'hit') sfx.hit();
  else if (f.type === 'kill') { if (f.boss) sfx.coin(); else sfx.kill(); }
}

function consumeFx(g: Game) {
  for (const f of g.fx.splice(0)) {
    soundFor(f);
    if (f.type === 'skill') {
      const life = { splash: 0.35, chain: 0.25, slow: 0.5, stun: 0.6, execute: 0.45, crit: 0.3, vuln: 0.5, dot: 0.5 }[f.kind] ?? 0.4;
      shapes.push({ kind: f.kind, x: f.x, y: f.y, tx: f.tx, ty: f.ty, r: f.r, life, max: life });
      if (f.kind === 'execute') particles.push({ x: f.x, y: f.y - 0.4, vx: 0, vy: -1, life: 0.7, max: 0.7, color: '#dc2626', size: 0.3, text: '처형!' });
      if (f.kind === 'crit') particles.push({ x: f.x, y: f.y - 0.6, vx: 0, vy: -1.2, life: 0.5, max: 0.5, color: '#f59e0b', size: 0.26, text: '치명!' });
      continue;
    }
    if (f.type === 'shot') recoil.set(f.uid, 1);
    else if (f.type === 'hit') {
      for (let i = 0; i < (f.big ? 7 : 3); i++) particles.push({ x: f.x, y: f.y, vx: rnd(-2.5, 2.5), vy: rnd(-3, -0.5), life: 0.35, max: 0.35, color: f.big ? '#ffd36b' : '#ffffff', size: rnd(0.04, 0.08), star: f.big });
      particles.push({ x: f.x + rnd(-0.15, 0.15), y: f.y - 0.3, vx: 0, vy: -1.2, life: 0.7, max: 0.7, color: f.big ? '#ff7a59' : '#3b2a1e', size: f.big ? 0.32 : 0.24, text: fmt(f.dmg) });
    } else if (f.type === 'kill') {
      for (let i = 0; i < (f.boss ? 40 : 12); i++) particles.push({ x: f.x, y: f.y, vx: rnd(-3, 3), vy: rnd(-3.5, 1), life: 0.6, max: 0.6, color: PASTEL[i % PASTEL.length], size: rnd(0.06, 0.13) });
      particles.push({ x: f.x, y: f.y - 0.2, vx: 0, vy: -0.8, life: 0.9, max: 0.9, color: '#e3a72f', size: 0.28, text: `+${f.gold}G` });
      if (f.boss) { shake = 0.6; banner = { text: '🎉 논파 성공!', t: 1.8 }; }
    } else if (f.type === 'morph') {
      if (f.tier >= 5) sfx.synth(f.tier - 1); else sfx.merge();
      for (let i = 0; i < 24 + f.tier * 6; i++) { const a = (i / 24) * Math.PI * 2; particles.push({ x: f.x, y: f.y, vx: Math.cos(a) * rnd(1.5, 3), vy: Math.sin(a) * rnd(1.5, 3), life: 0.7, max: 0.7, color: f.tier >= 5 ? PASTEL[i % 5] : '#fff3b0', size: rnd(0.06, 0.11), star: true }); }
      if (f.tier >= 5) shake = 0.35;
    } else if (f.type === 'boss') { bossIntro = { name: f.name, t: 2.6 }; shake = 0.4; sfx.boss(); }
    else if (f.type === 'bossSkill' && f.text) { banner = { text: f.text, t: 1.6 }; shake = 0.25; sfx.bossSkill(); }
    else if (f.type === 'say') speeches.set(f.uid, { text: f.text, t: 2.4 });
    else if (f.type === 'ticket') { banner = { text: `${f.why}! 🎟 무료 소환권 +${f.n}`, t: 2 }; sfx.reveal(5); }
    else if (f.type === 'stun') { const t = g.towers.find((x) => x.uid === f.uid); if (t) for (let i = 0; i < 8; i++) particles.push({ x: t.cx + 0.5, y: t.cy + 0.3, vx: rnd(-1, 1), vy: rnd(-2, -0.5), life: 0.6, max: 0.6, color: '#c7a6ff', size: 0.07 }); }
  }
}
const speeches = new Map<number, { text: string; t: number }>();
const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));

function updateFx(dt: number) {
  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; if (!p.text) p.vy += 6 * dt; p.life -= dt; }
  for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
  for (const s of shapes) s.life -= dt;
  for (let i = shapes.length - 1; i >= 0; i--) if (shapes[i].life <= 0) shapes.splice(i, 1);
  for (const [k, v] of recoil) { const n = v - dt * 6; if (n <= 0) recoil.delete(k); else recoil.set(k, n); }
  if (shake > 0) shake = Math.max(0, shake - dt);
  for (const [k, v] of speeches) { v.t -= dt; if (v.t <= 0) speeches.delete(k); }
  if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
  if (bossIntro) { bossIntro.t -= dt; if (bossIntro.t <= 0) bossIntro = null; }
}

function drawStar(x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}

function drawShapes() {
  for (const s of shapes) {
    const k = 1 - s.life / s.max, a = s.life / s.max, X = s.x * cellX, Y = s.y * cell;
    ctx.save(); ctx.globalAlpha = a;
    switch (s.kind) {
      case 'splash': // 원형 폭발
        ctx.fillStyle = 'rgba(255,179,107,.35)'; ctx.strokeStyle = '#ff9f43'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(X, Y, (s.r ?? 1) * cell * (0.3 + k * 0.7), 0, Math.PI * 2); ctx.fill(); ctx.stroke(); break;
      case 'chain': { // 지그재그 번개
        const TX = (s.tx ?? s.x) * cellX, TY = (s.ty ?? s.y) * cell;
        ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 3; ctx.shadowColor = '#e0f2fe'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(X, Y);
        for (let i = 1; i < 5; i++) { const t = i / 5; ctx.lineTo(X + (TX - X) * t + rnd(-6, 6), Y + (TY - Y) * t + rnd(-6, 6)); }
        ctx.lineTo(TX, TY); ctx.stroke(); break;
      }
      case 'slow': // 파란 물결
        ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 2;
        for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(X, Y, cell * (0.2 + k * 0.4 + i * 0.12), 0, Math.PI * 2); ctx.stroke(); } break;
      case 'stun': // 빙글 별
        ctx.fillStyle = '#facc15';
        for (let i = 0; i < 3; i++) { const an = k * 6 + (i * Math.PI * 2) / 3; drawStar(X + Math.cos(an) * cell * 0.3, Y - cell * 0.4 + Math.sin(an) * cell * 0.1, cell * 0.08); } break;
      case 'execute': // 붉은 사선 베기
        ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 4 * a + 1;
        ctx.beginPath(); ctx.moveTo(X - cell * 0.5, Y - cell * 0.5); ctx.lineTo(X - cell * 0.5 + cell * k, Y - cell * 0.5 + cell * k); ctx.stroke(); break;
      case 'crit': // 노란 섬광
        ctx.fillStyle = '#fde047';
        drawStar(X, Y - cell * 0.3, cell * (0.2 + k * 0.35)); break;
      case 'vuln': // 표적 고리
        ctx.strokeStyle = '#f43f5e'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.arc(X, Y, cell * (0.45 - k * 0.15), 0, Math.PI * 2); ctx.stroke(); break;
      case 'dot': // 보라 연기
        ctx.fillStyle = 'rgba(168,85,247,.4)';
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(X + (i - 1) * cell * 0.15, Y - k * cell * 0.4 - i * 4, cell * 0.1, 0, Math.PI * 2); ctx.fill(); } break;
    }
    ctx.restore();
  }
}

function drawFx(w: number, fh: number) {
  drawShapes();
  for (const p of particles) {
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    if (p.text) {
      ctx.font = `900 ${Math.max(10, cell * p.size)}px "Jua", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.strokeText(p.text, p.x * cellX, p.y * cell);
      ctx.fillStyle = p.color; ctx.fillText(p.text, p.x * cellX, p.y * cell);
    } else {
      ctx.fillStyle = p.color;
      if (p.star) drawStar(p.x * cellX, p.y * cell, p.size * cell);
      else { ctx.beginPath(); ctx.arc(p.x * cellX, p.y * cell, p.size * cell, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  ctx.globalAlpha = 1;
  // 은은한 비네트
  const v = ctx.createRadialGradient(w / 2, fh / 2, fh * 0.35, w / 2, fh / 2, w * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(59,42,30,.18)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, fh);
  // 대형 보스 HP바 (상단)
  const boss = game?.enemies.find((e) => e.boss);
  if (boss) {
    const bw = w - cell * 1.2, bx = cell * 0.6, by = cell * 0.18, r = Math.max(0, boss.hp / boss.maxHp);
    ctx.fillStyle = '#3b2a1e'; ctx.beginPath(); ctx.roundRect(bx - 3, by - 3, bw + 6, cell * 0.42 + 6, 12); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(bx, by, bw, cell * 0.42, 10); ctx.fill();
    const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0); grad.addColorStop(0, '#ff8f8f'); grad.addColorStop(1, '#ffb3c7');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.roundRect(bx, by, Math.max(8, bw * r), cell * 0.42, 10); ctx.fill();
    if ((boss.shieldT ?? 0) > 0) { ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 3; ctx.stroke(); }
    ctx.fillStyle = '#3b2a1e'; ctx.font = `${cell * 0.26}px "Jua", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`👑 ${boss.name}  ${Math.ceil(r * 100)}%`, w / 2, by + cell * 0.22);
  }
  // 보스 등장 컷인
  if (bossIntro) {
    const T = 2.6 - bossIntro.t, slide = Math.min(1, T * 4), out = Math.min(1, bossIntro.t * 3);
    ctx.save(); ctx.globalAlpha = out;
    ctx.fillStyle = 'rgba(59,42,30,.55)'; ctx.fillRect(0, 0, w, fh);
    const bandY = fh * 0.36, bandH = cell * 2.2;
    ctx.fillStyle = '#ff8f8f'; ctx.fillRect(0, bandY, w, bandH);
    ctx.fillStyle = '#ffb3c7'; ctx.fillRect(0, bandY + 6, w, bandH - 12);
    for (let i = 0; i < 8; i++) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(((T * 600 + i * 90) % (w + 80)) - 80, bandY + 10 + (i % 3) * 18, 50, 4); }
    const ix = -cell * 2 + slide * (cell * 2.6);
    ctx.drawImage(monsterSprite(game!.stage.era, 'boss'), ix, bandY - cell * 0.4, cell * 2.6, cell * 2.6);
    ctx.fillStyle = '#3b2a1e'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = `${cell * 0.3}px "Jua", sans-serif`; ctx.fillText('WARNING · 도그마 출현', w - slide * (w - cell * 3.1), bandY + cell * 0.6);
    ctx.font = `${cell * 0.55}px "Jua", sans-serif`; ctx.fillText(bossIntro.name, w - slide * (w - cell * 3.1), bandY + cell * 1.35);
    ctx.restore();
  }
  if (banner) {
    const s = Math.min(1, (2.2 - banner.t) * 6, banner.t * 3);
    ctx.save(); ctx.translate(w / 2, fh * 0.3); ctx.scale(s, s);
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

// ---------- 모바일: 두 번 탭 확대 / 핀치 확대 막기 (iOS 사파리는 viewport 설정을 무시함) ----------
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  const el = e.target as HTMLElement;
  if (now - lastTouchEnd < 350 && !el.closest('input')) {
    e.preventDefault(); // 확대 막기
    const b = el.closest('button') as HTMLButtonElement | null;
    if (b && !b.disabled) b.click(); // 대신 연타는 그대로 눌리게
  }
  lastTouchEnd = now;
}, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// ---------- 시작 ----------
$('open-recipes').onclick = recipeSheet;
$('open-rates').onclick = rateSheet;
for (const b of document.querySelectorAll<HTMLButtonElement>('#tabs button')) b.onclick = () => { sfx.click(); switchTab(b.dataset.tab!); };
for (const id of ['mute', 'mute-b']) { const b = document.getElementById(id); if (b) { b.textContent = isMuted() ? '🔇' : '🔊'; b.onclick = () => { const mu = toggleMute(); for (const x of ['mute', 'mute-b']) { const e = document.getElementById(x); if (e) e.textContent = mu ? '🔇' : '🔊'; } }; } }
$('b-recipes').onclick = recipeSheet;
$('tut-again').onclick = () => { progress.battleTutDone = false; progress.tabTut = []; pageTutStart(currentTab); saveProgress(progress); toast('🎓 화면마다, 그리고 다음 전투에서 튜토리얼이 다시 나와요'); };
$('reset').onclick = () => { if (window.confirm('클리어 기록·카드·도구를 모두 지울까요?')) { resetProgress(); progress = loadProgress(); bootQA(); renderHome(); switchTab('stages'); } };
function bootQA() { if (QA_MODE && !progress.purchases.includes('qa')) { progress.gonoe += QA_GONOE; progress.gems += QA_GEMS; progress.tickets += 5; progress.purchases.push('qa'); saveProgress(progress); } }

function welcome() {
  if (progress.tutorialDone) return;
  progress.tutorialDone = true; saveProgress(progress);
  setTimeout(() => alertBox(`<h2>🏛 아고라에 오신 걸 환영해요!</h2>
    <p>도그마들이 아고라로 몰려오고 있어요.<br>철학자를 소환하고, 합치고, 조합해서 막아 주세요.</p>
    <div class="welcome">
      <div>🎲 <b>소환</b> 골드로 철학자를 불러요</div>
      <div>🎟 <b>소환</b>은 흔함 9명 중 한 명</div>
      <div>📜 <b>조합</b> 그 위는 전부 조합표대로 모아야 탄생</div>
      <div>🤔 <b>고민방</b> 고뇌를 모아 카드를 뽑고 성장</div>
    </div>
    <p>첫 선물로 🤔 300 · 💎 100 · 탈레스 카드를 드려요.<br>먼저 <b>아테네의 광장 · 쉬움</b>부터!</p>`), 300);
}

/** 로그인 후 계정 진입 */
function enter(acc: Account) {
  me = acc;
  rememberLogin(acc.id);
  setAccount(acc.id);
  setQA(acc.role === 'master' || new URLSearchParams(location.search).get('qa') === '1');
  const isNew = !hasSave();
  progress = loadProgress();
  if (isNew && acc.role === 'veteran') { seedVeteran(progress); saveProgress(progress); }
  bootQA();
  spriteUrl.clear();
  $('who').textContent = `👤 ${acc.id}${acc.role === 'master' ? ' 👑' : ''}`;
  $('admin-bar').classList.toggle('hidden', acc.role !== 'master');
  $('login').classList.add('hidden');
  if (!progress.prologueDone && !QA_MODE && acc.role !== 'veteran') playPrologue(); else welcome();
  renderHome();
  show('home');
  switchTab('stages');
}

function showLogin() {
  me = null;
  show('home');
  $('login').classList.remove('hidden');
  const id = $<HTMLInputElement>('login-id'), pw = $<HTMLInputElement>('login-pw');
  pw.value = ''; $('login-err').textContent = '';
  setTimeout(() => (id.value ? pw : id).focus(), 50);
}

$<HTMLFormElement>('login-form').onsubmit = async (e) => {
  e.preventDefault();
  const acc = await login($<HTMLInputElement>('login-id').value, $<HTMLInputElement>('login-pw').value);
  if (!acc) { $('login-err').textContent = '아이디 또는 비밀번호가 맞지 않아요'; shakeEl($('login-card')); return; }
  sfx.reveal(5);
  enter(acc);
};
$('logout').onclick = () => { if (window.confirm('로그아웃할까요?')) { rememberLogin(null); showLogin(); } };
$('admin-gems').onclick = () => { progress.gems += 10000; progress.gonoe += 100000; progress.tickets += 10; saveProgress(progress); refreshWallet(); toast('👑 재화 지급 완료'); };
$('admin-unlock').onclick = () => { for (const s of STAGES) for (const d of DIFFICULTIES) { const k = clearKey(s.id, d.id); if (!progress.cleared.includes(k)) progress.cleared.push(k); } for (const s of STAGES) if (!progress.cleared.includes(s.id)) progress.cleared.push(s.id); saveProgress(progress); renderHome(); toast('👑 전 스테이지·난이도 클리어 처리'); };
$('admin-cards').onclick = () => { for (const p of PHILOSOPHERS) { progress.cards[p.id] = (progress.cards[p.id] ?? 0) + 16; if (!progress.seen.includes(p.id)) progress.seen.push(p.id); } for (const it of ITEMS) progress.items[it.id] = (progress.items[it.id] ?? 0) + 1; saveProgress(progress); toast('👑 모든 카드 +16장 · 도구 전부 지급'); };

const remembered = lastLogin();
if (remembered) { $<HTMLInputElement>('login-id').value = remembered.id; }
showLogin();
setInterval(() => { if (!game && me) { settleIdle(progress, clearedStages()); saveProgress(progress); refreshWallet(); } }, 1000);
requestAnimationFrame(loop);

// ---------- 🃏 TCG 카드 넘겨보기 ----------
function tcgCard(id: string) {
  const p = PHIL.get(id)!, st = statsOf(id);
  const n = progress.cards[id] ?? 0, lv = cardLevel(n);
  const art = cardArt(p, spriteFor(id), progress?.skinOn?.[id] ?? '');
  return `<div class="tcg tcg-t${p.tier}" data-id="${id}"><div class="tcg-inner">
    <div class="tcg-face tcg-front">
      <div class="tcg-top"><b>${p.name}</b><span class="tcg-type">${TYPE_ICON[st.type]} ${st.type}</span></div>
      <div class="tcg-stars">${'★'.repeat(p.tier)}<small>${TIER_NAME[p.tier]} · ${ERA_ICON[p.era] ?? ''} ${p.school}</small></div>
      <div class="tcg-art"><img src="${art}">${lv ? `<span class="tcg-lv">Lv.${lv}</span>` : ''}</div>
      <div class="tcg-skill"><b>✦ ${p.skill}</b><p>${p.skillDesc}</p></div>
      <div class="tcg-stat"><span>⚔ ${Math.round(st.dmg)}</span><span>◎ ${st.range}칸</span><span>⏱ ${(1 / st.cooldown).toFixed(2)}/초</span></div>
      <div class="tcg-quote">“${p.quote}”</div>
      <div class="tcg-no">No.${p.id} · AGORA</div>
    </div>
    <div class="tcg-face tcg-back">
      <div class="tcg-backlogo">AGORA</div>
      <b>${p.name}</b>
      <p>${p.lore}</p>
      <small>🎯 ${st.target} 우선 · ${st.note}</small>
      <small class="tcg-tip">탭하면 앞면으로</small>
    </div>
  </div></div>`;
}
function openTcg(startId?: string) {
  const seen = new Set(progress.seen);
  const list = [...PHILOSOPHERS].filter((p) => seen.has(p.id) || !!progress.cards[p.id] || (QA_MODE && !p.hidden)).sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
  if (!list.length) { toast('아직 만난 철학자가 없어요'); return; }
  const ov = document.createElement('div');
  ov.className = 'overlay tcg-ov';
  ov.innerHTML = `<button class="close">✕</button><div class="tcg-track">${list.map((p) => tcgCard(p.id)).join('')}</div>
    <div class="tcg-nav"><button class="prev">◀</button><span class="tcg-count"></span><button class="next">▶</button></div><button class="chunky gold tcg-detail">📋 정보보기</button>`;
  document.body.appendChild(ov);
  const track = ov.querySelector('.tcg-track') as HTMLElement;
  const count = ov.querySelector('.tcg-count') as HTMLElement;
  const cardW = () => (track.firstElementChild as HTMLElement).offsetWidth + 16;
  const idx = () => Math.round(track.scrollLeft / cardW());
  const upd = () => { count.textContent = `${idx() + 1} / ${list.length}`; };
  const go = (i: number) => track.scrollTo({ left: Math.max(0, Math.min(list.length - 1, i)) * cardW(), behavior: 'smooth' });
  track.addEventListener('scroll', upd);
  (ov.querySelector('.prev') as HTMLElement).onclick = () => go(idx() - 1);
  (ov.querySelector('.next') as HTMLElement).onclick = () => go(idx() + 1);
  (ov.querySelector('.close') as HTMLElement).onclick = () => ov.remove();
  (ov.querySelector('.tcg-detail') as HTMLElement).onclick = () => { const id = list[idx()].id; ov.remove(); showCard(id); };
  track.querySelectorAll('.tcg').forEach((el) => el.addEventListener('click', () => el.classList.toggle('flip')));
  requestAnimationFrame(() => { const i = startId ? list.findIndex((p) => p.id === startId) : 0; track.scrollLeft = Math.max(0, i) * cardW(); upd(); });
}
$('tcg-open').onclick = () => openTcg();
// 촉매 칩을 누르면 무엇인지 알려 준다
$('cats').addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest('.c');
  if (!el) return;
  const i = [...$('cats').querySelectorAll('.c')].indexOf(el);
  const id = CATALYST_IDS[i];
  toast(`${CAT_ICON[id]} 촉매 「${CAT_NAME[id]}」 — 희귀 이상 조합 재료예요. 웨이브를 깰 때마다 1개, 보스 웨이브는 추가로, 적 처치 시 가끔 떨어져요`);
});

// ---------- 🎓 전투 튜토리얼 (첫 전투에서 단계별 안내) ----------
const TUT: { sel: string; text: string; done?: (g: Game) => boolean; pos?: 'top' }[] = [
  { sel: '#summon', text: '👋 먼저 <b>소환</b>을 눌러 철학자를 불러 보세요. 흔함 9명 중 한 명이 나와요.', done: (g) => g.towers.length >= 1 },
  { sel: '#summon', text: '좋아요! 철학자는 빈 칸에 자동으로 앉아요. <b>두 번 더</b> 소환해 볼까요?', done: (g) => g.towers.length >= 3 },
  { sel: '#field', text: '칸에 앉은 철학자를 <b>탭</b>하면 정보·강화·판매가 나와요. 선택한 채로 다른 칸을 탭하면 <b>자리를 옮겨요</b>. 맨 아래 <b>대기석</b> 5칸은 싸우지 않지만 조합 재료로 쓰여요. 필드가 차면 소환된 철학자가 대기석으로 가요.', pos: 'top' },
  { sel: '#synth', text: '조합 재료가 모이면 여기 <b>⚗ 조합</b> 버튼이 떠요. 하나만 모자란 조합은 💡로 알려 줘요. 예: 소크라테스 둘 → 플라톤!', pos: 'top' },
  { sel: '#start', text: '준비 끝! <b>웨이브 시작</b>을 누르면 도그마(적)가 몰려와요.', done: (g) => g.running },
  { sel: '#lives', text: '🧠 이게 <b>멘탈</b>이에요. 도그마가 길 끝에 닿으면 1(보스는 5)씩 깎이고, 못 잡은 적은 <b>다시 돌아와요</b>. 0이 되면 패배!', pos: 'top' },
  { sel: '#cats', text: '웨이브를 깨면 골드와 <b>촉매</b>(🔥💎🌀⚙️🪞)를 얻어요. 촉매는 희귀 이상 조합 재료예요. 보스를 잡으면 🎟 무료 소환권도 줘요. 칩을 누르면 설명이 나와요.', pos: 'top' },
  { sel: '#b-recipes', text: '📜 은 조합표, 1x 는 배속이에요. 이제 20웨이브까지 버텨 보세요. 화이팅! 🏛', pos: 'top' },
];
let tutStep = -1, tutShown = -2;
function tutClear() { document.querySelector('.tut-bubble')?.remove(); document.querySelectorAll('.tut-glow').forEach((e) => e.classList.remove('tut-glow')); }
function tutFinish() { tutStep = -1; tutClear(); progress.battleTutDone = true; saveProgress(progress); }
function tutTick() {
  if (document.querySelector('.vn')) { if (tutShown !== -2) { tutClear(); tutShown = -2; } return; }
  if (tutStep < 0 || !game || $('battle').classList.contains('hidden')) { if (tutShown !== -2 && tutStep < 0) { tutClear(); tutShown = -2; } return; }
  const st = TUT[tutStep];
  if (st.done?.(game)) { tutStep++; if (tutStep >= TUT.length) { tutFinish(); return; } return tutTick(); }
  if (tutShown === tutStep) return;
  tutShown = tutStep; tutClear();
  document.querySelector(st.sel)?.classList.add('tut-glow');
  const b = document.createElement('div');
  b.className = `tut-bubble ${st.pos === 'top' ? 'top' : ''}`;
  const manual = !st.done;
  b.innerHTML = `<div class="tut-step">튜토리얼 ${tutStep + 1}/${TUT.length}</div><p>${st.text}</p><div class="tut-btns"><button class="tut-skip">건너뛰기</button>${manual ? `<button class="tut-next">${tutStep === TUT.length - 1 ? '시작!' : '다음 ▶'}</button>` : ''}</div>`;
  document.body.appendChild(b);
  (b.querySelector('.tut-skip') as HTMLElement).onclick = tutFinish;
  const nx = b.querySelector('.tut-next') as HTMLElement | null;
  if (nx) nx.onclick = () => { tutStep++; if (tutStep >= TUT.length) tutFinish(); else tutTick(); };
}
setInterval(tutTick, 300);

// ---------- 🎓 화면별 튜토리얼 (탭을 처음 열 때) ----------
const PAGE_TUT: Record<string, { sel: string; text: string }[]> = {
  stages: [
    { sel: '.srow:not(.locked) .sgo', text: '스테이지 이름을 누르면 바로 전투 시작! 처음엔 <b>쉬움</b>으로 해요. 모든 스테이지의 쉬움을 깨면 난이도 탭이 열려요.' },
    { sel: '.srow:not(.locked) .sinfo', text: '<b>i</b>를 누르면 보스, 길 모양, 이 맵에서 강해지는 철학자 같은 정보를 볼 수 있어요.' },
    { sel: '#open-recipes', text: '📜 <b>조합표</b>에서 모든 조합식을, 🎲 확률에서 소환·등급 정보를 볼 수 있어요. 마음에 드는 조합은 💗로 찜해 두면 전투 중에 따라 보여요.' },
    { sel: '#tabs', text: '아래 탭에서 🤔고민방·🎴뽑기·📖도감·🛍상점으로 가요. 처음 들어가면 거기서도 안내해 드릴게요!' },
  ],
  room: [
    { sel: '#thinker', text: '여기는 <b>고민방</b>. 철학자를 톡톡 두드리면 <b>🤔 고뇌</b>가 나와요.' },
    { sel: '.room-stat', text: '고뇌는 가만히 둬도 쌓여요(최대 8시간). 스테이지를 깰수록 더 빨리 쌓이고, <b>카드·도구 뽑기</b>에 써요.' },
    { sel: '#tap-up', text: '고뇌를 써서 <b>고민의 깊이</b>를 올리면 탭할 때와 가만히 둘 때 나오는 고뇌가 <b>둘 다</b> 늘어요.' },
  ],
  gacha: [
    { sel: '.card-box', text: '🧠 <b>기억 떠올리기</b>: 고뇌를 써서 철학자 카드를 얻어요. 같은 카드가 모이면 레벨이 올라 전투에서 세지고, 일화도 열려요.' },
    { sel: '.card-box .info-btn', text: '<b>i</b>를 누르면 확률, 천장(거장 이상 확정까지 남은 횟수), 성장 규칙을 볼 수 있어요.' },
    { sel: '.master-box', text: '✨ <b>거장 초대</b>는 💎지혜석이나 🎫초대장으로 거장 이상을 확정으로 뽑아요.' },
    { sel: '.tool-box', text: '🧰 <b>도구</b>를 뽑아 도감에서 철학자에게 장착해요. 주인에게 맞는 도구면 <b>찰떡!</b> 공격 +60%.' },
  ],
  codex: [
    { sel: '.codex-tabs', text: '등급별로 나눠 봐요. 만난 철학자를 누르면 <b>카드</b>로 보여요.' },
    { sel: '.codex-grid', text: '카드 아래 <b>📋 정보보기</b>를 누르면 스탯·도구 장착·스킨·💗최애 지정을 할 수 있어요.' },
    { sel: '#tcg-open', text: '🃏 여기를 누르면 카드처럼 <b>옆으로 넘겨 보고</b>, 탭하면 뒤집어서 이야기를 읽을 수 있어요.' },
  ],
  shop: [
    { sel: '.shop-grid', text: '🛍 <b>상점</b>에서 💎지혜석과 🎫초대장을 살 수 있어요. 지금은 시험판이라 실제 결제 없이 바로 지급돼요.' },
  ],
};
let pageTut: { tab: string; i: number } | null = null, pageShown = '';
function pageTutStart(tab: string) {
  if (!PAGE_TUT[tab] || (progress.tabTut ?? []).includes(tab)) return;
  pageTut = { tab, i: 0 }; pageShown = '';
}
function pageTutEnd() {
  if (pageTut) { progress.tabTut = [...new Set([...(progress.tabTut ?? []), pageTut.tab])]; saveProgress(progress); }
  pageTut = null; pageShown = ''; tutClear();
}
function pageTutTick() {
  if (!pageTut) return;
  if (pageTut.tab !== currentTab || $('home').classList.contains('hidden')) { if (pageShown) { tutClear(); pageShown = ''; } if (pageTut.tab !== currentTab) pageTut = null; return; }
  if (document.querySelector('.overlay, .vn, .prologue')) { if (pageShown) { tutClear(); pageShown = ''; } return; }
  const steps = PAGE_TUT[pageTut.tab], st = steps[pageTut.i], key = pageTut.tab + pageTut.i;
  if (pageShown === key) return;
  const target = document.querySelector(st.sel) as HTMLElement | null;
  if (!target) { pageTut.i++; if (pageTut.i >= steps.length) pageTutEnd(); return; }
  pageShown = key; tutClear();
  target.classList.add('tut-glow');
  target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  const b = document.createElement('div');
  const low = target.getBoundingClientRect().top > innerHeight * 0.5;
  b.className = `tut-bubble ${low ? 'upper' : ''}`;
  b.innerHTML = `<div class="tut-step">안내 ${pageTut.i + 1}/${steps.length}</div><p>${st.text}</p><div class="tut-btns"><button class="tut-skip">건너뛰기</button><button class="tut-next">${pageTut.i === steps.length - 1 ? '알겠어요!' : '다음 ▶'}</button></div>`;
  document.body.appendChild(b);
  (b.querySelector('.tut-skip') as HTMLElement).onclick = pageTutEnd;
  (b.querySelector('.tut-next') as HTMLElement).onclick = () => { if (!pageTut) return; pageTut.i++; if (pageTut.i >= steps.length) pageTutEnd(); else pageTutTick(); };
}
setInterval(pageTutTick, 300);


// =============== 📖 스토리 모드 ===============
/** 지금 소환할 수 있는 흔함 ID (기억이 돌아온 철학자만) */
function summonPool(): string[] {
  if (QA_MODE || easyAllCleared()) return [];
  const names = new Set(START_POOL);
  for (const st of STORY) if ((progress.storyCleared ?? []).includes(st.id)) for (const n of st.unlock ?? []) names.add(n);
  return PHILOSOPHERS.filter((p) => p.tier === 1 && names.has(p.realName)).map((p) => p.id);
}
/** 기억이 열린 시대: 지금 진행 중인 장까지 */
function openEras(): Set<string> {
  const done = progress.storyCleared ?? [];
  const next = STORY.find((s) => !done.includes(s.id));
  const upto = QA_MODE || !next ? 5 : next.chapter;
  return new Set(CHAPTERS.filter((c) => c.n <= upto).map((c) => c.era));
}
setCardFilter((p) => openEras().has(p.era));
const storyOpen = (st: StoryStage) => { const i = STORY.indexOf(st); return QA_MODE || i === 0 || (progress.storyCleared ?? []).includes(STORY[i - 1].id); };
let storyChapter = 0;
function renderStory(box: HTMLElement) {
  const done = progress.storyCleared ?? [];
  if (!storyChapter) storyChapter = (STORY.find((s) => !done.includes(s.id)) ?? STORY[STORY.length - 1]).chapter;
  const ch = CHAPTERS[storyChapter - 1];
  const head = document.createElement('div');
  head.className = 'chapter-head';
  head.innerHTML = `<button class="ch-prev" ${storyChapter <= 1 ? 'disabled' : ''}>◀</button><div><small>제${ch.n}장</small><b>${ch.icon} ${ch.title}</b></div><button class="ch-next" ${storyChapter >= CHAPTERS.length || !STORY.some((s) => s.chapter === storyChapter + 1 && storyOpen(s)) ? 'disabled' : ''}>▶</button>`;
  (head.querySelector('.ch-prev') as HTMLButtonElement).onclick = () => { storyChapter--; renderHome(); };
  (head.querySelector('.ch-next') as HTMLButtonElement).onclick = () => { storyChapter++; renderHome(); };
  box.appendChild(head);
  for (const st of STORY.filter((x) => x.chapter === storyChapter)) {
    const row = document.createElement('div');
    const open = storyOpen(st), cleared = done.includes(st.id);
    row.className = `srow ${open ? '' : 'locked'} ${cleared ? 'cleared' : ''}`;
    const face = PHILOSOPHERS.find((p) => p.realName === st.memories[0])!;
    row.innerHTML = `<button class="sgo" ${open ? '' : 'disabled'}><img src="${portrait(face.id)}"><span class="sname">${open ? st.title : '🔒 ???'}</span>${cleared ? '<span class="badge">CLEAR</span>' : ''}</button><button class="sinfo" ${open ? '' : 'disabled'}>i</button>`;
    (row.querySelector('.sgo') as HTMLButtonElement).onclick = () => { startBattle(STAGES[0], undefined, st); playDialogue(st.intro, st, () => updateUI(), undefined, true); };
    (row.querySelector('.sinfo') as HTMLButtonElement).onclick = () => alertBox(`<h2>${st.title}</h2><p class="hint">${st.when}</p>
      <div class="stage-info"><div>👑 보스 <b>${st.boss}</b> (${DIFF.get('easy')!.maxWave}웨이브)</div>
      <div>🧠 깨면 돌아오는 기억: <b>${st.memories.map((n) => PHILOSOPHERS.find((p) => p.realName === n)!.name).join(', ')}</b></div>
      ${st.unlock?.length ? `<div>🎟 소환에 새로 등장: <b>${st.unlock.map((n) => PHILOSOPHERS.find((p) => p.realName === n)!.name).join(', ')}</b></div>` : ''}
      <div>🎲 지금 소환되는 흔함: ${(summonPool().length ? summonPool() : PHILOSOPHERS.filter((p) => p.tier === 1).map((p) => p.id)).map((id) => PHIL.get(id)!.name).join(' · ')}</div></div>`);
    box.appendChild(row);
  }
  const total = STORY.length, n = done.length;
  const prog = document.createElement('p');
  prog.className = 'hint story-prog';
  prog.innerHTML = n >= total ? '📖 이야기를 모두 마쳤어요! 위에서 난이도를 골라 본편에 도전하세요.' : `📖 이야기 ${n}/${total} · 다 깨면 <b>보통 이상</b> 난이도가 열려요`;
  box.appendChild(prog);
}

/** 대사 재생: 탭하면 글자가 다 나오고, 한 번 더 탭하면 다음 줄 */
function playDialogue(lines: Line[], st: StoryStage | null, done: () => void, era?: string, overBattle = false) {
  const ov = document.createElement('div');
  ov.className = `vn ${overBattle ? 'over' : ''}`;
  const bgEra = era ?? (st ? CHAPTERS[st.chapter - 1].era : '고대');
  ov.innerHTML = `<div class="vn-bg" style="background-image:url(${sceneArt(bgEra)})"></div>
    ${st ? `<div class="vn-title"><small>${st.when}</small><b>${st.title}</b></div>` : ''}
    <div class="vn-box"><img class="vn-face"><div class="vn-body"><b class="vn-name"></b><p class="vn-text"></p></div><span class="vn-next">▼</span></div>
    <button class="vn-skip">건너뛰기 ▶▶</button>`;
  document.body.appendChild(ov);
  const face = ov.querySelector('.vn-face') as HTMLImageElement, nameEl = ov.querySelector('.vn-name')!, textEl = ov.querySelector('.vn-text')!;
  let i = -1, full = '', shown = 0, timer = 0;
  const finish = () => { clearInterval(timer); ov.remove(); done(); };
  const next = () => {
    i++;
    if (i >= lines.length) return finish();
    const [who, text] = lines[i];
    full = homage(text); shown = 0;
    const p = PHILOSOPHERS.find((x) => x.realName === who);
    ov.classList.toggle('narr', who === '내레이션');
    face.style.display = p || who === '나' ? '' : 'none';
    if (p) face.src = portrait(p.id); else if (who === '나') face.src = meFace();
    nameEl.textContent = who === '내레이션' ? '' : p ? p.name : '나';
    clearInterval(timer);
    timer = window.setInterval(() => { shown++; textEl.textContent = full.slice(0, shown); if (shown >= full.length) clearInterval(timer); }, 22);
  };
  ov.onclick = (e) => {
    if ((e.target as HTMLElement).classList.contains('vn-skip')) return finish();
    sfx.click(); next(); // 한 번 누르면 바로 다음 대사
  };
  next();
}
/** 주인공 얼굴: 현대 옷의 학생 */
let meUrl = '';
function meFace() {
  if (meUrl) return meUrl;
  const c = document.createElement('canvas'); c.width = c.height = 48;
  const x = c.getContext('2d')!; const px = (a: number, b: number, w: number, h: number, col: string) => { x.fillStyle = col; x.fillRect(a * 2, b * 2, w * 2, h * 2); };
  px(7, 13, 10, 8, '#60a5fa'); px(11, 13, 2, 8, '#f8fafc'); px(8, 5, 8, 8, '#fde68a'); px(7, 3, 10, 3, '#3f2a1e'); px(7, 5, 2, 3, '#3f2a1e');
  px(9, 8, 2, 2, '#0f172a'); px(13, 8, 2, 2, '#0f172a'); px(8, 10, 1, 1, '#fda4af'); px(15, 10, 1, 1, '#fda4af'); px(10, 11, 4, 1, '#c2410c');
  px(17, 14, 4, 5, '#fef3c7'); px(17, 14, 4, 1, '#d97706');
  return (meUrl = c.toDataURL());
}

/** 기억이 돌아오는 연출: 카드 공개 */
function memoryReveal(ids: string[], st: StoryStage) {
  const ov = document.createElement('div');
  ov.className = 'overlay memory';
  ov.innerHTML = `<div class="pop"><h2>🧠 기억이 돌아왔다</h2><p class="hint">${st.title}의 기억 · 카드 ${ids.length}장</p>
    <div class="mem-cards">${ids.map((id) => tcgCard(id)).join('')}</div>
    ${st.unlock?.length ? `<p>🎟 이제 소환에서 <b>${st.unlock.map((n) => PHILOSOPHERS.find((p) => p.realName === n)!.name).join(', ')}</b>도 나와요!</p>` : ''}
    <button class="primary chunky gold close">계속</button></div>`;
  ov.onclick = (e) => { if ((e.target as HTMLElement).classList.contains('close')) { ov.remove(); storyChapter = 0; renderHome(); } };
  document.body.appendChild(ov);
  sfx.reveal(5);
}

/** 오프닝: 어느 날 눈을 떠 보니 고대의 광장 */
function playPrologue() {
  const ov = document.createElement('div');
  ov.className = 'prologue';
  ov.innerHTML = `<div class="pr-scene" style="background-image:url(${sceneArt('고대')})"></div>
    <div class="pr-people">${['소크라테스', '피타고라스', '탈레스', '헤라클레이토스'].map((n) => `<img src="${portrait(PHILOSOPHERS.find((p) => p.realName === n)!.id)}">`).join('')}</div>
    <div class="lid top"></div><div class="lid bottom"></div>
    <p class="pr-text"></p><button class="vn-skip">건너뛰기 ▶▶</button>`;
  document.body.appendChild(ov);
  const text = ov.querySelector('.pr-text')!;
  const say = (t: string) => { text.classList.remove('show'); void (text as HTMLElement).offsetWidth; text.textContent = t; text.classList.add('show'); };
  const steps: [number, () => void][] = [
    [300, () => say('…시험 기간. 철학사 책을 베고 깜빡 잠이 들었다.')],
    [2600, () => say('누군가 웅성거리는 소리. 햇볕이 따갑다.')],
    [4800, () => { say(''); ov.classList.add('blink1'); }],
    [5900, () => ov.classList.add('open')],
    [7600, () => say('여긴… 대리석 기둥? 토가를 입은 사람들?')],
    [10000, () => say('기원전 그리스, 아테네의 광장 — 아고라.')],
  ];
  const timers = steps.map(([t, f]) => window.setTimeout(f, t));
  const end = () => {
    timers.forEach(clearTimeout); ov.remove();
    progress.prologueDone = true; progress.tutorialDone = true; saveProgress(progress);
    playDialogue([
      ['나', '꿈인가…? 그런데 저기 사람들을 홀리고 다니는 저 검은 그림자들은 뭐지?'],
      ['소크라테스', '도그마들일세. 생각 없이 믿기만 하게 만드는 것들이지. 자넨 처음 보는 얼굴이군.'],
      ['나', '(머릿속에 공부했던 철학자들이 떠오른다. 떠올리면… 그들이 나타난다?)'],
      ['소크라테스', '자네 머릿속에 든 걸 하나씩 꺼내 보게. 기억을 되찾을수록 강해질 걸세.'],
      ['내레이션', '고뇌를 모아 기억(카드)을 떠올리고, 철학자들을 불러 도그마를 논파하자. 이야기는 기원전 585년, 밀레토스에서 시작된다.'],
    ], null, () => { renderHome(); }, '고대');
  };
  (ov.querySelector('.vn-skip') as HTMLElement).onclick = end;
  timers.push(window.setTimeout(end, 12600));
}
(window as unknown as { __g: () => Game | null }).__g = () => game; // 테스트용 훅
