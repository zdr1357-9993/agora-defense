import { Game, GRID, QA_MODE, setQA, CATALYST_IDS, type Tower, type FxEvent } from './game';
import { login, lastLogin, rememberLogin, seedVeteran, type Account } from './auth';
import { STAGE_PATHS } from './paths';
import { STAGE_STARS, ERA_BONUS, STAR_BONUS } from './affinity';
import { DIFFICULTIES, DIFF, clearKey } from './difficulty';
import { ITEM, isOwner, ITEM_BONUS } from './items';
import {
  homage, statsOf, TYPE_ICON, PHIL, PHILOSOPHERS, STAGES, TIER_STATS, CAT_ICON, CAT_NAME, ERA_ICON, RECIPES, SUMMON_RATES, TIER_NAME, MAX_MERGE_TIER, UPGRADE, type Stage,
} from './data';
import { philosopherSprite, skinnedSprite, SKINS, monsterSprite, itemSprite, TIER_AURA } from './sprites';
import { SKILLS } from './skills';
import { sfx, isMuted, toggleMute } from './sfx';
import { setAccount, hasSave, loadProgress, saveProgress, resetProgress, cardLevel, cardMult, nextLevelAt, awakenLevel, CARD_MAX_LEVEL, CARD_ATK_PER_LEVEL, AWAKEN_MAX, AWAKEN_EVERY } from './save';
import { LINES, UNLOCK_LEVELS } from './lines';
import { settleIdle, tapGain, tapUpgradeCost, battleReward, pull, canAfford, PULLS, SHOP, buy, CUR_ICON, PITY_LIMIT, FIRST_CLEAR_GEMS, CARD_RATES, QA_GONOE, QA_GEMS, IDLE_PER_SEC, type PullOption } from './meta';
import { ITEMS } from './items';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const spriteUrl = new Map<string, string>();
import { cardArt } from './tcg';
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
  if (progress.favorite && progress.cards[progress.favorite]) {
    const fav = PHIL.get(progress.favorite)!;
    const ot = document.createElement('button');
    ot.className = 'onetool';
    ot.innerHTML = `<img src="${portrait(fav.id)}"><div><b>💗 최애 원툴 도전</b><small>${fav.name} 한 명 + 1성만으로 어디까지 버틸까? · 최고 기록 ${progress.oneToolBest[fav.id] ?? 0}웨이브</small></div>`;
    ot.onclick = () => startBattle(STAGES[0], fav.id);
    box.appendChild(ot);
  }
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
    if (!isUnlocked(s)) {
      const b2 = document.createElement('button');
      b2.className = 'stage locked mystery'; b2.disabled = true;
      b2.innerHTML = `<img src="${portrait(hero.id)}"><div><b>🔒 ???</b><small>${STAGES.find((x) => x.id === s.unlockAfter)?.name ?? '이전 스테이지'}을(를) 깨면 열립니다</small></div>`;
      box.appendChild(b2);
      continue;
    }
    b.innerHTML = `<img src="${portrait(hero.id)}"><div><b>${ERA_ICON[s.era]} ${s.name}</b>${cleared ? ' <span class="badge">CLEAR</span>' : ''}
      <small><span class="marks">${marks}</span> ${open ? `${STAGE_PATHS[s.id].caption}<br>최종 보스: ${s.boss20} · 수호자: ${hero.name}<br><span class="stars-line">🏠 강해지는 철학자: ${(STAGE_STARS[s.id] ?? []).map((n) => shortName(PHILOSOPHERS.find((p) => p.realName === n)?.name ?? n)).join('·')} (+${STAR_BONUS * 100}%) · ${s.era} 철학자 +${ERA_BONUS * 100}%</span>` : !isUnlocked(s) ? `🔒 ${STAGES.find((x) => x.id === s.unlockAfter)?.name} 클리어 시 해금` : `🔒 이 스테이지의 ${DIFFICULTIES[DIFFICULTIES.findIndex((d) => d.id === diffId) - 1]?.name} 클리어 시 해금`}</small></div>`;
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
      d.innerHTML = `${progress.favorite === p.id ? '<span class="fav">💗</span>' : ''}${lv ? `<span class="lv ${awakenLevel(n) ? 'aw' : ''}">${awakenLevel(n) ? '✦' + awakenLevel(n) : 'Lv.' + lv}</span>` : ''}${tool ? `<img class="tool-badge" src="${itemUrl(tool)}">` : ''}<img src="${portrait(p.id)}"><b>${known ? p.name : '???'}</b><small>${n ? `🎴${n}` : ERA_ICON[p.era] ?? ''}</small>`;
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
  const st = statsOf(id);
  const bar = (v: number, max: number) => `<span class="sbar"><i style="width:${Math.min(100, (v / max) * 100)}%"></i></span>`;
  return `<div class="pcard tc${p.tier}">
    <div class="pc-head"><span class="pc-tier">${'★'.repeat(p.tier)}</span><b>${p.name}</b><span class="pc-era">${ERA_ICON[p.era] ?? ''} ${p.school}</span></div>
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
  const lines = LINES[p.realName] ?? ['', '', ''];
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

function startBattle(s: Stage, oneTool?: string) {
  game = new Game(s, {
    cardMult: (id) => cardMult(progress.cards[id] ?? 0),
    awaken: (id) => awakenLevel(progress.cards[id] ?? 0),
    tool: (id) => { const t = progress.loadout[id]; return t && progress.items[t] ? t : undefined; },
  }, oneTool ? 'normal' : diffId, oneTool);
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
    if (game.over === 'win') {
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
  const cy = Math.floor(((ev.clientY - r.top) / r.height) * GRID);
  if (cx < 0 || cy < 0 || cx >= GRID || cy >= GRID || game.isRoad(cx, cy)) { selected = null; updateUI(); return; }
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
  $('cost').textContent = String(g.summonCost);
  $<HTMLButtonElement>('summon').disabled = g.gold < g.summonCost || !!g.over;
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
  const infoKey = `${selected?.uid}|${selected?.philId}|${selected?.level}|${g.towers.length > 0}|${selected && g.upgradeCost(selected) !== null ? g.gold >= g.upgradeCost(selected)! : ''}`;
  if (infoKey !== lastInfoKey) {
    lastInfoKey = infoKey;
    info.className = '';
    if (selected) {
      const p = PHIL.get(selected.philId)!;
      const cost = g.upgradeCost(selected);
      const lv = selected.level ? ` <span class="tag lv">Lv.${selected.level}</span>` : '';
      info.className = `t${p.tier}`;
      info.innerHTML = `<img src="${portrait(p.id)}"><div><b>${'★'.repeat(p.tier)} ${p.name}</b>${lv} · ${p.school}<br>“${p.quote}”<br><small class="type-line">${TYPE_ICON[statsOf(p.id).type]} ${statsOf(p.id).type} · ${statsOf(p.id).target} 우선 · 사거리 ${statsOf(p.id).range}칸</small><br><small class="skill-line">✦ ${p.skill}: ${p.skillDesc}</small>${p.id === g.stage.counter ? '<br><small class="counter">⚔ 이 스테이지 보스에게 피해 3배</small>' : ''}${g.home(selected).kind === 'star' ? `<br><small class="home">🏠 ${g.stage.name}의 핵심 인물! 공격력 +${STAR_BONUS * 100}%</small>` : g.home(selected).kind === 'era' ? `<br><small class="home">🏠 ${g.stage.era} 철학자 · 공격력 +${ERA_BONUS * 100}%</small>` : ''}
        ${toolLine(g, selected)}
        ${cost !== null ? `<br><button id="upgrade" class="up">⬆ 강화 Lv.${selected.level + 1} (${cost}G) · 공격력 +${Math.round(UPGRADE.perLevel * 100)}%</button>` : ''}</div>`;
      const up = document.getElementById('upgrade');
      if (up) { (up as HTMLButtonElement).disabled = g.gold < cost!; up.onclick = () => { if (selected && g.upgrade(selected)) { lastInfoKey = ''; updateUI(); } }; }
    } else info.innerHTML = g.towers.length
      ? '<small>같은 등급 3명이면 🎲 합성(1~3성)! 5성 이상은 📜 조합표의 재료를 모아 특수 연성.<br>철학자를 눌러 선택 → 빈 칸을 누르면 이동, 다른 철학자를 누르면 자리 바꾸기.</small>'
      : `<small><b>${g.stage.name}</b> — ${g.stage.story}<br>소환 버튼으로 철학자를 불러오세요.</small>`;
  }

  // 촉매
  const catKey = JSON.stringify(g.catalysts) + g.running + g.wave;
  if (catKey !== lastCatKey) {
    const fresh = new Set(g.drops.splice(0));
    lastCatKey = catKey;
    $('cats').innerHTML = (QA_MODE ? '<span class="qa">QA</span>' : '') + `<span class="stage-name">${ERA_ICON[g.stage.era]} ${g.stage.name} ${g.running ? { normal: '', fast: '· 💨빠른 적', tank: '· 🛡단단한 적', swarm: '· 🐜떼', boss: '· 👑보스' }[g.waveKind()] : ''}</span>` + CATALYST_IDS.map((id) =>
      `<span class="c ${g.catalysts[id] ? 'on' : ''} ${fresh.has(id) ? 'flash' : ''}" title="촉매: ${CAT_NAME[id]}">${CAT_ICON[id]}${g.catalysts[id]}</span>`).join('');
  }

  // 합성 / 특수 연성
  const merges = g.over ? [] : g.mergeable();
  const recipes = g.over ? [] : g.availableRecipes()
    .sort((a, b) => Number(g.hasCatalyst(b)) - Number(g.hasCatalyst(a)) || PHIL.get(b.result)!.tier - PHIL.get(a.result)!.tier)
    .slice(0, 3);
  const goals = RECIPES.filter((r) => (progress.likedRecipes ?? []).includes(r.id));
  const key = merges.join() + '|' + recipes.map((r) => r.id + g.hasCatalyst(r)).join() + '|' + goals.map((r) => g.ownedMaterials(r).join('')).join();
  if (key !== lastSynthKey) {
    lastSynthKey = key;
    const box = $('synth');
    box.innerHTML = '';
    for (const r of goals) {
      const res = PHIL.get(r.result)!, own = g.ownedMaterials(r);
      const known = QA_MODE || progress.seen.includes(res.id);
      const el = document.createElement('div');
      el.className = 'goal';
      el.innerHTML = `💗 <b>${known ? res.name : '???'}</b> ${r.materials.map((m, i) => `<span class="${own[i] ? 'have' : ''}">${own[i] ? '✔' : '·'}${shortName(PHIL.get(m)!.name)}</span>`).join('')}${r.catalyst ? `<span class="${g.catalysts[r.catalyst] ? 'have' : ''}">${CAT_ICON[r.catalyst]}</span>` : ''} <i>${own.filter(Boolean).length}/${own.length}</i>`;
      box.appendChild(el);
    }
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
    const st = statsOf(selected.philId);
    ctx.save(); ctx.beginPath();
    ctx.arc((selected.cx + 0.5) * cell, (selected.cy + 0.5) * cell, (st.range + g.itemMult(selected).range) * cell, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(251,191,36,.10)'; ctx.fill();
    ctx.strokeStyle = 'rgba(251,191,36,.6)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(56,189,248,.28)';
    for (const [x, y] of g.emptyCells()) { ctx.beginPath(); ctx.arc((x + 0.5) * cell, (y + 0.62) * cell, cell * 0.16, 0, Math.PI * 2); ctx.fill(); }
  }

  // ---- 오라 철학자: 주변 8칸에 은은한 빛 ----
  for (const t of g.towers) {
    const s = SKILLS[PHIL.get(t.philId)!.realName];
    if (!s || (s.kind !== 'auraAtk' && s.kind !== 'auraSpeed' && s.kind !== 'globalSlow')) continue;
    const pulse = 0.5 + 0.5 * Math.sin(tick * 0.06 + t.uid);
    ctx.fillStyle = s.kind === 'auraAtk' ? `rgba(255,159,67,${0.08 + pulse * 0.06})` : s.kind === 'auraSpeed' ? `rgba(95,198,160,${0.08 + pulse * 0.06})` : `rgba(96,165,250,${0.05 + pulse * 0.04})`;
    if (s.kind === 'globalSlow') { ctx.beginPath(); ctx.arc((t.cx + 0.5) * cell, (t.cy + 0.5) * cell, cell * (1.6 + pulse * 0.3), 0, Math.PI * 2); ctx.fill(); }
    else { ctx.beginPath(); ctx.roundRect((t.cx - 1) * cell + 4, (t.cy - 1) * cell + 4, cell * 3 - 8, cell * 3 - 8, cell * 0.5); ctx.fill(); }
  }

  // ---- 철학자: 그림자 + 큰 도트 + 등급 배지 ----
  const towers = [...g.towers].sort((a, b) => a.cy - b.cy);
  for (const t of towers) {
    const p = PHIL.get(t.philId)!;
    const cx = (t.cx + 0.5) * cell, foot = (t.cy + 0.9) * cell;
    const isSel = t === selected;
    if (isSel) { ctx.fillStyle = 'rgba(251,191,36,.55)'; ctx.beginPath(); ctx.ellipse(cx, foot, cell * 0.42, cell * 0.16, 0, 0, Math.PI * 2); ctx.fill(); }
    const hk = g.home(t).kind;
    if (hk) { ctx.fillStyle = hk === 'star' ? 'rgba(255,211,107,.75)' : 'rgba(167,236,210,.6)'; ctx.beginPath(); ctx.ellipse(cx, foot, cell * 0.42, cell * 0.15, 0, 0, Math.PI * 2); ctx.fill(); }
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
    ctx.drawImage(spriteFor(p.id), cx - sx / 2, foot - sy * 0.97 + bob, sx, sy);
    if ((t.stunT ?? 0) > 0) {
      ctx.font = `${cell * 0.32}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText('💤', cx + cell * 0.28, foot - cell * 0.9 + Math.sin(tick * 0.15) * 3);
    }
    // 이름표
    const nm = (progress.favorite === t.philId ? '💗' : '') + shortName(p.name);
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
      if (isOwner(tool, p.realName)) { ctx.fillStyle = 'rgba(253,224,71,.55)'; ctx.beginPath(); ctx.arc(ix + isz / 2, iy + isz / 2, isz * 0.62, 0, Math.PI * 2); ctx.fill(); }
      ctx.drawImage(itemSprite(tool), ix, iy, isz, isz);
    }
    if (hk === 'star') { ctx.font = `${cell * 0.22}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('🏠', (t.cx + 0.86) * cell, (t.cy + 0.78) * cell); }
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

const SHORT: Record<string, string> = { '마르틴 로우데거': '로우데거', '장 폴 사리티리': '사리티리', '자크 디리타': '디리타', '에마뉘엘 리비나스': '리비나스', '테오도어 아도로노': '아도로노', '알베르 카뮈': '카뮈',  '고타마 붓다': '붓다', '다산 정약용': '정약용', '퇴계 이황': '이황', '루트비히 비트겐슈타인': '비트겐', '아르투어 쇼펜하우어': '쇼펜하우어', '고트프리트 라이프니츠': '라이프니츠', '쇠렌 키르케고르': '키르케고르', '헤라클레이토스': '헤라클레', '아리스토텔레스': '아리스토', '나가르주나': '나가르',  '엘레아의 제논': '제논', '오컴의 윌리엄': '오컴', '이븐 시나': '이븐시나', '이븐 루시드': '이븐루시드', '알 킨디': '알킨디', '힐데가르트 폰 빙엔': '힐데가르트' };
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
  return parts.length ? `<br><small class="equip">${parts.join(' · ')}</small>` : '';
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
  $('tab-room').innerHTML = `
    <div class="room">
      <div class="room-sky"><div class="room-bubble">“${p.quote}”</div>
        <button id="thinker" class="thinker"><img src="${portrait(p.id)}"></button>
        <div class="room-floor"></div></div>
      <div class="room-stat"><span>고뇌</span><b id="room-gonoe">${Math.floor(progress.gonoe).toLocaleString()}</b></div>
      <p class="hint">${p.name}을(를) 톡톡 두드려 고뇌를 짜내세요. 가만히 둬도 초당 ${(IDLE_PER_SEC * (1 + clearedStages() * 0.5)).toFixed(1)}씩 쌓여요 (스테이지 클리어마다 증가, 최대 8시간).${idle ? `<br><b>자리를 비운 사이 고뇌 +${idle.toLocaleString()}</b>` : ''}</p>
      <div class="row"><button id="tap-up" class="chunky blue">💭 고민의 깊이 Lv.${progress.tapLevel + 1} → ${progress.tapLevel + 2}<small>탭당 +${tapGain(progress)} → +${tapGain(progress) + 1} · ${cost.toLocaleString()} 고뇌</small></button></div>
      <p class="hint">고민방 주인은 도감에서 바꿀 수 있어요.</p>
    </div>`;
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
  const rates = CARD_RATES.map((r) => `<span class="tier-chip t${r.tier}">${r.tier}★ ${(r.rate * 100).toFixed(1)}%</span>`).join(' ');
  $('tab-gacha').innerHTML = `
    <div class="gacha-box master-box">
      <div class="banner-art">${PHILOSOPHERS.filter((p) => p.tier === 6 && !p.hidden).map((p) => `<img src="${portrait(p.id)}">`).join('')}</div>
      <h2>✨ 거장 초대 <span class="hot">5성 이상 확정</span></h2>
      <p class="hint">10회 중 마지막 1장은 반드시 5성 또는 6성! 🎫 초대장으로 1장 확정 소환도 가능해요.</p>
      <div class="row">${pullBtn('m10', 'gold')}${pullBtn('m1', 'pink')}</div>
    </div>
    <div class="gacha-box card-box">
      <h2>🎴 철학자 카드</h2>
      <p class="hint">카드가 모이면 레벨업(Lv.${CARD_MAX_LEVEL}까지) · 레벨당 공격력 +${CARD_ATK_PER_LEVEL * 100}% · 이후 ${AWAKEN_EVERY}장마다 <b>각성</b>(최대 ${AWAKEN_MAX}단계): 공격력 +15%, 스킬 강화 · 레벨이 오르면 일화가 열려요</p>
      <div class="rates-line">${rates}</div>
      <div class="pity">천장까지 <b>${PITY_LIMIT - progress.pity}</b>회 <span class="bar"><i style="width:${(progress.pity / PITY_LIMIT) * 100}%"></i></span></div>
      <div class="row">${pullBtn('c1', 'pink')}${pullBtn('c10', 'gold')}${pullBtn('c10g', 'blue')}</div>
    </div>
    <div class="gacha-box tool-box">
      <h2>🧰 도구 상자</h2>
      <p class="hint">도감에서 철학자에게 장착 · 주인에게 끼우면 <b>찰떡!</b> 공격 +60%</p>
      <div class="row">${pullBtn('t1', 'mint')}${pullBtn('t10', 'gold')}${pullBtn('t10g', 'blue')}</div>
    </div>`;
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
  const glow = top >= 6 ? 'rainbow' : top >= 5 ? 'gold' : top >= 4 ? 'orange' : 'blue';
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
      el.className = `gcard t${tier} ${tier >= 5 ? 'legend' : ''} ${tier >= 6 ? 'mythic' : ''}`;
      el.innerHTML = `${tag}<img src="${portrait(id)}"><b>${p.name}</b><small>${'★'.repeat(tier)}</small>`;
      if (tier >= 5) { burst(ov, tier); shakeEl(ov); }
    }
    sfx.reveal(tier);
    cardsEl.appendChild(el);
    idx++;
    if (chain) timer = window.setTimeout(() => flipNext(), tier >= 5 ? 700 : 160);
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
      return `<span class="mat t${p.tier} ${owned[i] ? 'have' : ''}"><img src="${portrait(m)}">${p.name}<i>${p.tier}성</i></span>`;
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
      if (f.tier >= 5) sfx.synth(f.tier); else sfx.merge();
      for (let i = 0; i < 24 + f.tier * 6; i++) { const a = (i / 24) * Math.PI * 2; particles.push({ x: f.x, y: f.y, vx: Math.cos(a) * rnd(1.5, 3), vy: Math.sin(a) * rnd(1.5, 3), life: 0.7, max: 0.7, color: f.tier >= 5 ? PASTEL[i % 5] : '#fff3b0', size: rnd(0.06, 0.11), star: true }); }
      if (f.tier >= 5) shake = 0.35;
    } else if (f.type === 'boss') { bossIntro = { name: f.name, t: 2.6 }; shake = 0.4; sfx.boss(); }
    else if (f.type === 'bossSkill' && f.text) { banner = { text: f.text, t: 1.6 }; shake = 0.25; sfx.bossSkill(); }
    else if (f.type === 'stun') { const t = g.towers.find((x) => x.uid === f.uid); if (t) for (let i = 0; i < 8; i++) particles.push({ x: t.cx + 0.5, y: t.cy + 0.3, vx: rnd(-1, 1), vy: rnd(-2, -0.5), life: 0.6, max: 0.6, color: '#c7a6ff', size: 0.07 }); }
  }
}
const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));

function updateFx(dt: number) {
  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; if (!p.text) p.vy += 6 * dt; p.life -= dt; }
  for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
  for (const s of shapes) s.life -= dt;
  for (let i = shapes.length - 1; i >= 0; i--) if (shapes[i].life <= 0) shapes.splice(i, 1);
  for (const [k, v] of recoil) { const n = v - dt * 6; if (n <= 0) recoil.delete(k); else recoil.set(k, n); }
  if (shake > 0) shake = Math.max(0, shake - dt);
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
    const k = 1 - s.life / s.max, a = s.life / s.max, X = s.x * cell, Y = s.y * cell;
    ctx.save(); ctx.globalAlpha = a;
    switch (s.kind) {
      case 'splash': // 원형 폭발
        ctx.fillStyle = 'rgba(255,179,107,.35)'; ctx.strokeStyle = '#ff9f43'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(X, Y, (s.r ?? 1) * cell * (0.3 + k * 0.7), 0, Math.PI * 2); ctx.fill(); ctx.stroke(); break;
      case 'chain': { // 지그재그 번개
        const TX = (s.tx ?? s.x) * cell, TY = (s.ty ?? s.y) * cell;
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

function drawFx(w: number) {
  drawShapes();
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
    ctx.fillStyle = 'rgba(59,42,30,.55)'; ctx.fillRect(0, 0, w, w);
    const bandY = w * 0.36, bandH = cell * 2.2;
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
$('tut-again').onclick = () => { progress.battleTutDone = false; saveProgress(progress); toast('🎓 다음 전투에서 튜토리얼이 다시 나와요'); };
$('reset').onclick = () => { if (window.confirm('클리어 기록·카드·도구를 모두 지울까요?')) { resetProgress(); progress = loadProgress(); bootQA(); renderHome(); switchTab('stages'); } };
function bootQA() { if (QA_MODE && !progress.purchases.includes('qa')) { progress.gonoe += QA_GONOE; progress.gems += QA_GEMS; progress.tickets += 5; progress.purchases.push('qa'); saveProgress(progress); } }

function welcome() {
  if (progress.tutorialDone) return;
  progress.tutorialDone = true; saveProgress(progress);
  setTimeout(() => alertBox(`<h2>🏛 아고라에 오신 걸 환영해요!</h2>
    <p>도그마들이 아고라로 몰려오고 있어요.<br>철학자를 소환하고, 합치고, 조합해서 막아 주세요.</p>
    <div class="welcome">
      <div>🎲 <b>소환</b> 골드로 철학자를 불러요</div>
      <div>🔁 <b>합성</b> 같은 등급 3명 → 한 등급 위</div>
      <div>📜 <b>조합</b> 5성 이상은 조합표대로 모아야 탄생</div>
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
  welcome();
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
  const list = [...PHILOSOPHERS].filter((p) => seen.has(p.id) || (QA_MODE && !p.hidden)).sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
  if (!list.length) { toast('아직 만난 철학자가 없어요'); return; }
  const ov = document.createElement('div');
  ov.className = 'overlay tcg-ov';
  ov.innerHTML = `<button class="close">✕</button><div class="tcg-track">${list.map((p) => tcgCard(p.id)).join('')}</div>
    <div class="tcg-nav"><button class="prev">◀</button><span class="tcg-count"></span><button class="next">▶</button></div>`;
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
  toast(`${CAT_ICON[id]} 촉매 「${CAT_NAME[id]}」 — 5·6성 조합 재료예요. 웨이브를 깰 때마다 1개, 보스 웨이브는 추가로, 적 처치 시 가끔 떨어져요`);
});

// ---------- 🎓 전투 튜토리얼 (첫 전투에서 단계별 안내) ----------
const TUT: { sel: string; text: string; done?: (g: Game) => boolean; pos?: 'top' }[] = [
  { sel: '#summon', text: '👋 먼저 <b>소환</b>을 눌러 철학자를 불러 보세요. 골드가 들고, 누를수록 조금씩 비싸져요.', done: (g) => g.towers.length >= 1 },
  { sel: '#summon', text: '좋아요! 철학자는 빈 칸에 자동으로 앉아요. <b>두 번 더</b> 소환해 볼까요?', done: (g) => g.towers.length >= 3 },
  { sel: '#field', text: '칸에 앉은 철학자를 <b>탭</b>하면 정보·강화·판매가 나와요. 선택한 채로 다른 칸을 탭하면 <b>자리를 옮겨요</b>.', pos: 'top' },
  { sel: '#synth', text: '같은 등급 3명이 모이면 여기 <b>🎲 합성</b> 버튼이 떠요 → 한 등급 위 철학자가 무작위로! 5성 이상은 📜 조합표대로 모아야 해요.', pos: 'top' },
  { sel: '#start', text: '준비 끝! <b>웨이브 시작</b>을 누르면 도그마(적)가 몰려와요.', done: (g) => g.running },
  { sel: '#lives', text: '🧠 이게 <b>멘탈</b>이에요. 도그마가 길 끝에 닿으면 1(보스는 5)씩 깎이고, 못 잡은 적은 <b>다시 돌아와요</b>. 0이 되면 패배!', pos: 'top' },
  { sel: '#cats', text: '웨이브를 깨면 골드와 <b>촉매</b>(🔥💎🌀⚙️🪞)를 얻어요. 촉매는 5·6성 조합 재료예요. 칩을 누르면 설명이 나와요.', pos: 'top' },
  { sel: '#b-recipes', text: '📜 은 조합표, 1x 는 배속이에요. 이제 20웨이브까지 버텨 보세요. 화이팅! 🏛', pos: 'top' },
];
let tutStep = -1, tutShown = -2;
function tutClear() { document.querySelector('.tut-bubble')?.remove(); document.querySelectorAll('.tut-glow').forEach((e) => e.classList.remove('tut-glow')); }
function tutFinish() { tutStep = -1; tutClear(); progress.battleTutDone = true; saveProgress(progress); }
function tutTick() {
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
