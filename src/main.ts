import { Game, GRID, BENCH, QA_MODE, setQA, CATALYST_IDS, type Tower, type FxEvent } from './game';
import { ACCOUNTS, login, lastLogin, rememberLogin, seedVeteran, type Account } from './auth';
import { STAGE_PATHS } from './paths';
import { STAGE_STARS, ERA_BONUS, STAR_BONUS } from './affinity';
import { DIFFICULTIES, DIFF, clearKey } from './difficulty';
import { ITEM, isOwner, ITEM_BONUS } from './items';
import {
  homage, statsOf, TYPE_ICON, PHIL, PHILOSOPHERS, STAGES, TIER_STATS, CAT_ICON, CAT_NAME, ERA_ICON, RECIPES, SUMMON_RATES, TIER_NAME, UPGRADE, type Stage, type Recipe,
} from './data';
import { philosopherSprite, skinnedSprite, SKINS, monsterSprite, monsterSprite2, itemSprite, TIER_AURA } from './sprites';
import { SKILLS } from './skills';
import { sfx, isMuted, toggleMute } from './sfx';
import { daily, bump, MISSIONS, ALL_CLEAR, ATTEND, claimable, claimMission, missionDone, rewardText, canAttend, attend, attendStreak, adFree, adFreeLabel, passOn, passDaysLeft, claimPass, PASS_DAILY, adsLeft, useAd, give, RAID_PER_DAY } from './live';
import { cloudSignUp, cloudLogin, cloudLoad, cloudSave, flush as cloudFlush, cloudLogout, cloudState, cloudMsg } from './cloud';
import { setSaveHook, adoptProgress, setAccount, hasSave, loadProgress, saveProgress, resetProgress, cardLevel, cardMult, nextLevelAt, awakenLevel, CARD_MAX_LEVEL, CARD_ATK_PER_LEVEL, AWAKEN_MAX, AWAKEN_EVERY } from './save';
import { LINES, UNLOCK_LEVELS } from './lines';
import { setCardFilter, settleIdle, idleRate, tapGain, tapUpgradeCost, battleReward, pull, canAfford, PULLS, SHOP, buy, CUR_ICON, PITY_LIMIT, FIRST_CLEAR_GEMS, CARD_RATES, QA_GONOE, QA_GEMS, IDLE_PER_SEC, CARD_COST, type PullOption } from './meta';
const STORY_WAVES = 20; // 스토리 한 판 ≈ 8분 (보스 10·20웨이브)
import { ITEMS } from './items';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const spriteUrl = new Map<string, string>();
import { cardArt, sceneArt } from './tcg';
import { STORY, STORY_MAP, CHAPTERS, START_POOL, type StoryStage, type Line } from './story';
/** 이 등급 이상은 카드가 있어야 조합 가능 (6 = 거장, 예전 5성) */
const LOCK_TIER = 6;
/** 지름길 조합: 얕지만 그 철학자 카드 Lv.5(11장) 이상이어야 열린다 */
const SHORTCUT_LV = 5;
const isShortcut = (r: { logic: string }) => r.logic.startsWith('지름길');
/** 스토리 진행(장)에 따라 만들 수 있는 최고 등급: 1·2장 희귀, 3장 전설, 4장부터 근원 */
function tierCap(prog = progress): number {
  if (QA_MODE) return 7;
  const next = STORY.find((s) => !(prog.storyCleared ?? []).includes(s.id));
  const ch = next ? next.chapter : 99;
  return ch <= 2 ? 4 : ch === 3 ? 5 : 7;
}
/** 왜 잠겼는지 (조합 버튼에 표시) */
function lockReason(r: { result: string; logic: string }): string {
  const p = PHIL.get(r.result)!;
  if (!progress.cards[p.id] && p.tier >= LOCK_TIER) return '🔒카드 필요';
  if (!progress.cards[p.id] && p.tier > tierCap()) return '🔒기억 부족';
  if (isShortcut(r)) return `🔒카드 Lv.${SHORTCUT_LV}`;
  return '🔒';
}
const itemUrl = (id: string) => itemSprite(id).toDataURL();
/** 착용 스킨이 반영된 도트 */
const spriteFor = (id: string) => skinnedSprite(PHIL.get(id)!, progress?.skinOn?.[id]);
const monUrl = new Map<string, string>();
const monsterUrl = (era: string, k: 'normal' | 'fast' | 'tank' | 'swarm' | 'boss') => { const key = era + k; if (!monUrl.has(key)) monUrl.set(key, monsterSprite2(era, k).toDataURL()); return monUrl.get(key)!; };
const portrait = (id: string) => {
  const key = id + (progress?.skinOn?.[id] ?? '');
  if (!spriteUrl.has(key)) spriteUrl.set(key, spriteFor(id).toDataURL());
  return spriteUrl.get(key)!;
};

let progress = loadProgress();
let me: Account | null = null;

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
  // 오늘의 할 일 · 보스 레이드 (시작 튜토리얼을 마치면)
  if (QA_MODE || (progress.storyCleared ?? []).includes('A5')) {
    const live = document.createElement('div');
    live.className = 'live-row';
    const n = claimable(progress), d = daily(progress);
    live.innerHTML = `<button class="live-btn missions">📋 오늘의 할 일${n ? `<i class="dot">${n}</i>` : ''}</button><button class="live-btn raid">👑 보스 레이드 <small>${QA_MODE ? '∞' : `${d.raidsLeft}/${RAID_PER_DAY}`}</small></button>`;
    (live.querySelector('.missions') as HTMLElement).onclick = () => missionsPanel();
    (live.querySelector('.raid') as HTMLElement).onclick = () => startRaid();
    box.appendChild(live);
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
    d.innerHTML = `${progress.favorite === p.id ? '<span class="fav">💗</span>' : ''}${lv ? `<span class="lv ${awakenLevel(n) ? 'aw' : ''}">${awakenLevel(n) ? '✦' + awakenLevel(n) : 'Lv.' + lv}</span>` : ''}<img src="${pedArt(p.id)}"><b>${known ? shortName(p.name) : '???'}</b>`;
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
      return `<button data-skin="${k}" class="${on ? 'on' : ''}">${s.icon} ${s.name}${on ? ' (착용 중)' : own ? '' : ' · 💎' + s.price}</button>`;
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
    else if (progress.gems >= SKINS[k].price && window.confirm(`${SKINS[k].icon} ${SKINS[k].name} 스킨을 💎${SKINS[k].price}에 살까요?`)) { progress.gems -= SKINS[k].price; progress.skins.push(id + ':' + k); progress.skinOn[id] = k; sfx.reveal(5); }
    else if (progress.gems < SKINS[k].price) { toast('💎 지혜석이 부족해요'); return; }
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
  const gap = parseFloat(getComputedStyle(battle).rowGap) || 8, pad = parseFloat(getComputedStyle(battle).paddingTop) + parseFloat(getComputedStyle(battle).paddingBottom);
  const fixed = ['hud', 'cats', 'selbar', 'actions', 'dock'].reduce((a, id) => a + $(id).offsetHeight, 0) + gap * 5 + pad;
  const H = Math.max(150, battle.clientHeight - fixed);
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
// 기기마다 실제 보이는 높이 (iOS 사파리 주소창·안드로이드 내비 바 반영)
function setAppHeight() { const h = window.visualViewport?.height ?? window.innerHeight; document.documentElement.style.setProperty('--app-h', `${Math.round(h)}px`); }
setAppHeight();
window.visualViewport?.addEventListener('resize', setAppHeight);
window.addEventListener('resize', setAppHeight);
window.addEventListener('orientationchange', () => setTimeout(() => { setAppHeight(); resize(); }, 250));
new ResizeObserver(resize).observe($('battle'));

function startBattle(s: Stage, oneTool?: string, story?: StoryStage) {
  if (story) { const base = STAGES.find((x) => x.id === story.base)!; s = { ...base, name: story.title, boss10: story.boss, boss20: story.boss, story: story.when }; }
  spawnAt.clear();
  eraWipe(s.era, story ? story.title : s.name, story ? story.when : '');
  game = new Game(s, {
    cardMult: (id) => cardMult(progress.cards[id] ?? 0),
    awaken: (id) => awakenLevel(progress.cards[id] ?? 0),
    tool: (id) => { const t = progress.loadout[id]; return t && progress.items[t] ? t : undefined; },
  }, story ? 'easy' : oneTool ? 'normal' : diffId, oneTool);
  if (story) game.storyId = story.id;
  if (!oneTool) game.summonPool = summonPool(story);
  if (story) game.waveCap = story.waves ?? STORY_WAVES;
  // 거장 이상은 카드(기억)를 가진 철학자만 조합할 수 있다
  if (!QA_MODE) {
    // 잠금 규칙: ① 거장·근원은 카드 필요 ② 지금 시대의 상한보다 높은 등급은 카드가 있어야만 ③ 지름길 조합은 카드 Lv.3부터
    const cap = tierCap();
    game.locked = new Set(PHILOSOPHERS.filter((p) => !p.hidden && !progress.cards[p.id] && (p.tier >= LOCK_TIER || p.tier > cap)).map((p) => p.id));
    game.lockedRecipes = new Set(RECIPES.filter((r) => isShortcut(r) && cardLevel(progress.cards[r.result] ?? 0) < SHORTCUT_LV).map((r) => r.id));
  }
  // 마스터 계정은 전장에 들어갈 때 무조건 골드 10000
  if (me?.role === 'master') game.gold = 10000;
  selected = null;
  resultShown = false;
  introT = 2.8;
  lastSynthKey = lastInfoKey = lastCatKey = ''; $('merge').dataset.k = '';
  show('battle');
  tutStep = progress.battleTutDone || oneTool ? -1 : 0; tutShown = -2;
  updateUI();
}

function endBattle(opt: { double?: boolean; next?: boolean } = {}) {
  let nextStory: StoryStage | undefined, nextStage: Stage | undefined;
  if (game) {
    progress.seen = [...new Set([...progress.seen, ...game.discovered])];
    const base = game.raid ? raidReward(game.raidDamage).gonoe ?? 0 : Math.round(battleReward(game.wave, game.over === 'win') * game.diff.reward);
    progress.gonoe += base * (opt.double ? 2 : 1);
    if (game.raid) { const r = raidReward(game.raidDamage); if (r.gems) progress.gems += r.gems * (opt.double ? 2 : 1); bump(progress, 'raids'); progress.raidBest = Math.max(progress.raidBest ?? 0, Math.round(game.raidDamage)); }
    if (game.wave > 0) bump(progress, 'battles');
    if (game.over === 'win' && !game.raid) bump(progress, 'wins');
    if (opt.next) {
      if (game.storyId) { const i = STORY.findIndex((x) => x.id === game!.storyId); nextStory = STORY[i + 1]; }
      else if (!game.raid && !game.oneTool) { const i = STAGES.findIndex((x) => x.id === game!.stage.id); nextStage = game.over === 'win' ? STAGES[i + 1] ?? game.stage : game.stage; }
    }
    if (game.oneTool) {
      const best = progress.oneToolBest[game.oneTool] ?? 0;
      if (game.wave > best) { progress.oneToolBest[game.oneTool] = game.wave; setTimeout(() => toast(`💗 원툴 신기록! ${game?.wave ?? ''}웨이브`), 300); }
    }
    const st = game.storyId ? STORY_MAP.get(game.storyId) : undefined;
    // 클리어하면 그 스테이지 철학자의 기억 경험치가 쌓인다 (쉬움 20% · 보통 50% · 어려움 80% · 그 이상 100%)
    let xpMsg = '';
    if (game.over === 'win' && !game.oneTool && !game.raid) {
      const target = st ? PHILOSOPHERS.find((p) => p.realName === st.memories[0])! : PHILOSOPHERS.find((p) => p.realName === (STAGE_STARS[game!.stage.id] ?? [])[0]) ?? PHIL.get(game.stage.counter)!;
      const rate = XP_RATE[game.diff.id] ?? 0.2;
      xpMsg = gainXp(target.id, rate);
      if (!st) setTimeout(() => toast(xpMsg), 600);
    }
    if (st && (game.over === 'win' || st.chapter === 0)) {
      const first = !(progress.storyCleared ?? []).includes(st.id);
      const capBefore = tierCap();
      progress.storyCleared = [...new Set([...(progress.storyCleared ?? []), st.id])];
      const ids = st.memories.map((n) => PHILOSOPHERS.find((p) => p.realName === n)!.id);
      for (const id of ids) { progress.cards[id] = (progress.cards[id] ?? 0) + 1; if (!progress.seen.includes(id)) progress.seen.push(id); }
      if (first) progress.gems += 20;
      saveProgress(progress);
      const capAfter = tierCap();
      const lines: Line[] = [...st.outro, ...(st.qa ? [['💡 오늘의 질문', st.qa[0]], ['💬 답', st.qa[1]]] as Line[] : [])];
      setTimeout(() => playDialogue(lines, st, () => memoryReveal(ids, st, capAfter > capBefore ? capAfter : 0, xpMsg)), 200);
    } else if (game.over === 'win' && !game.raid) {
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
  const wasStory = !!nextStory;
  game = null;
  renderHome();
  show('home');
  switchTab('stages');
  // ▶ 다음: 스토리는 기억 공개가 끝난 뒤 다음 사건으로, 본편은 바로 다음 판
  if (nextStage) setTimeout(() => startBattle(nextStage!), 50);
  if (wasStory) pendingNextStory = nextStory!;
}
let pendingNextStory: StoryStage | null = null;
function startStory(st: StoryStage) { startBattle(STAGES[0], undefined, st); playDialogue(st.intro, st, () => updateUI(), undefined, true); }

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

$('summon').onclick = () => { if (game?.summon()) sfx.summon(); selected = null; $('summon').blur(); updateUI(); };
$('sell').onclick = () => { if (game && selected) { game.sell(selected); selected = null; updateUI(); } };
$('upgrade-btn').onclick = () => { if (game && selected && game.upgrade(selected)) { sfx.merge(); lastInfoKey = ''; updateUI(); } };
$('d-recipes').onclick = () => recipeSheet();
$('merge').onclick = () => {
  if (!game) return;
  const list = mergeChoices(game);
  if (!list.length) { toast(selected ? '이 철학자로 지금 할 수 있는 조합이 없어요 · 📜 조합표를 확인해 보세요' : '지금 할 수 있는 조합이 없어요'); return; }
  if (list.length === 1) { doMerge(list[0]); return; }
  const ov = document.createElement('div');
  ov.className = 'overlay merge-ov';
  ov.innerHTML = `<div class="pop merge-pop"><h3>⚗ 어떤 조합을 할까요?</h3>${list.map((r, i) => { const res = PHIL.get(r.result)!; const seen = QA_MODE || progress.seen.includes(res.id) || !res.hidden;
    return `<button class="mrow t${res.tier}" data-i="${i}"><img src="${portrait(res.id)}"><span><b>${seen ? res.name : '???'}</b><small>${r.materials.map((m) => shortName(PHIL.get(m)!.name)).join(' + ')}${r.catalyst ? ' + ' + CAT_ICON[r.catalyst] : ''}</small></span><em class="tier-chip t${res.tier}">${TIER_NAME[res.tier]}</em></button>`; }).join('')}</div>`;
  ov.onclick = (e) => { const b = (e.target as HTMLElement).closest('.mrow') as HTMLElement | null; if (b) doMerge(list[+b.dataset.i!]); ov.remove(); };
  document.body.appendChild(ov);
};
function doMerge(r: Recipe) { if (game?.synthesize(r)) bump(progress, 'merges'); selected = null; lastInfoKey = ''; updateUI(); }
/** 지금 바로 할 수 있는 조합 (선택한 철학자가 있으면 그 철학자가 재료인 것만) */
function mergeChoices(g: Game): Recipe[] {
  if (g.over) return [];
  return g.availableRecipes().filter((r) => g.hasCatalyst(r) && !g.isLocked(r) && (!selected || r.materials.includes(selected.philId)))
    .sort((a, b) => PHIL.get(b.result)!.tier - PHIL.get(a.result)!.tier);
}
/** 필드 표시용: 조합 가능한 철학자 id, 선택한 철학자의 재료 짝 id */
let readyIds = new Set<string>(), partnerIds = new Set<string>();
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
  $('sell').querySelector('span')!.textContent = selected ? `판매 +${g.sellValue(selected)}G` : '판매';
  const start = $<HTMLButtonElement>('start');
  start.textContent = g.over ? '나가기' : g.raid ? (g.running ? `⏱ ${Math.ceil(g.raidLeft)}초` : '👑 레이드 시작') : g.countdown > 0 ? `다음 웨이브 ${Math.ceil(g.countdown)}` : '웨이브 시작';
  if (g.raid) { $('wave').textContent = `💥${Math.round(g.raidDamage / 1000)}k`; $('wave-max').textContent = ''; $<HTMLElement>('wave-bar').style.width = `${(1 - g.raidLeft / g.raid.time) * 100 * (g.running ? 1 : 0)}%`; }
  start.disabled = !g.over && (g.running || g.countdown > 0);

  if (g.over && !resultShown) {
    resultShown = true;
    if (g.over === 'win') sfx.win(); else sfx.lose();
    const newOnes = [...g.discovered].filter((id) => !progress.seen.includes(id));
    const s = g.stage;
    const unlocks = g.over === 'win' && !g.storyId ? STAGES.filter((x) => x.unlockAfter === s.id && !progress.cleared.includes(s.id)).map((x) => x.name) : [];
    const html = g.raid ? `<h2>👑 레이드 종료</h2><p><b>${g.raid.name}</b>에게 준 피해</p><p class="raid-dmg">${Math.round(g.raidDamage).toLocaleString()}</p><p>${raidTierText(g.raidDamage)}</p>`
      : g.over === 'win'
      ? g.storyId ? `<h2>🏛 ${s.boss20} 논파!</h2><p><b>${s.name}</b>을(를) 지켜 냈어요.</p><p>🧠 이제 이 시대의 기억이 돌아와요.</p>` : `<h2>🏛 ${s.boss20} 논파!</h2><p>${s.name}을(를) 지켜 냈습니다.</p>${unlocks.length ? `<p>🔓 새 스테이지: <b>${unlocks.join(', ')}</b></p>` : ''}${newOnes.length ? `<p>📖 도감 등록 ${newOnes.length}명</p>` : ''}`
      : g.oneTool ? `<h2>💗 원툴 도전 종료</h2><p><b>${PHIL.get(g.oneTool)!.name}</b>와(과) 함께 <b>${g.wave}웨이브</b>까지 버텼어요!</p><p>최고 기록 ${Math.max(g.wave, progress.oneToolBest[g.oneTool] ?? 0)}웨이브</p>`
      : g.storyId && STORY_MAP.get(g.storyId)?.chapter === 0 ? `<h2>💪 좋은 연습이었어요</h2><p>시작 튜토리얼은 져도 괜찮아요. 다음 단계가 열렸어요.</p>`
      : `<h2>💀 멘탈 붕괴</h2><p>${g.wave}웨이브에서 도그마에 잠식당했습니다.</p>${newOnes.length ? `<p>📖 그래도 도감에 ${newOnes.length}명 등록</p>` : ''}`;
    resultPanel(g, html);
  }

  // 선택 카드 / 다음 웨이브
  const info = $('info');
  const ready = mergeChoices(g);
  const allReady = g.over ? [] : g.availableRecipes().filter((r) => g.hasCatalyst(r) && !g.isLocked(r));
  readyIds = new Set(allReady.flatMap((r) => r.materials));
  partnerIds = new Set(selected ? ready.flatMap((r) => r.materials).filter((m) => m !== selected!.philId || ready.some((r) => r.materials.filter((x) => x === m).length > 1)) : []);
  const infoKey = `${g.wave}|${g.running}|${selected?.uid}|${selected?.philId}|${selected?.level}|${g.towers.length}|${selected?.cy}`;
  if (infoKey !== lastInfoKey) {
    lastInfoKey = infoKey;
    if (selected) {
      const p = PHIL.get(selected.philId)!;
      info.className = `scard t${p.tier}`;
      info.innerHTML = `<div class="sc-face"><img src="${pedArt(p.id)}"></div><div class="sc-body"><div class="sc-name"><span class="tier-chip t${p.tier}">${TIER_NAME[p.tier]}</span>${selected.level ? `<span class="tag lv">+${selected.level}</span>` : ''}<b>${p.name}</b></div><div class="sc-skill"><b>✦ ${p.skill}</b> ${p.skillDesc}</div></div>`;
    } else {
      const nk = g.waveKind(), nkName = { normal: g.stage.enemyEarly, fast: '빠른 도그마', tank: '단단한 도그마', swarm: '도그마 떼', boss: g.bossName() }[nk];
      const nkTip = { normal: '기본 무리', fast: '느리게 만드는 철학자가 좋아요', tank: '한 방이 센 철학자가 좋아요', swarm: '범위 공격이 좋아요', boss: '강화를 미리 해 두세요' }[nk];
      info.className = 'scard empty';
      info.innerHTML = `<div class="sc-mon"><img src="${monsterUrl(g.stage.era, nk)}"></div><div class="sc-body"><small>${g.running ? '지금' : '다음'} · ${g.running ? g.wave : g.wave + 1}웨이브</small><b>${nkName}</b><em>${nkTip}</em></div>
        <div class="sc-meta"><span>필드 <b>${g.fielded().length}/25</b></span><span>대기석 <b>${BENCH - g.benchSlots().length}/${BENCH}</b></span><small>철학자를 탭해 보세요</small></div>`;
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

  // 하단 행동 버튼
  const mb = $<HTMLButtonElement>('merge');
  const mKey = ready.map((r) => r.id).join() + (selected?.uid ?? '');
  if (mb.dataset.k !== mKey) {
    mb.dataset.k = mKey;
    mb.classList.toggle('hot', ready.length > 0);
    mb.innerHTML = ready.length ? `<i><img src="${portrait(ready[0].result)}"></i><span>합성</span>${ready.length > 1 ? `<em>${ready.length}</em>` : ''}` : '<i>⚗</i><span>합성</span>';
  }
  mb.disabled = !ready.length;
  const cost = selected ? g.upgradeCost(selected) : null;
  const ub = $<HTMLButtonElement>('upgrade-btn');
  ub.disabled = !selected || cost === null || g.gold < cost;
  ub.querySelector('span')!.textContent = selected && cost !== null ? `강화 ${cost}G` : '강화';
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
  // 대기석: 칸 대신 나무 벤치 한 줄
  ctx.fillStyle = '#d9b98a'; ctx.beginPath(); ctx.roundRect(cellX * 0.95, fh + cell * 0.78, cellX * 5.1, cell * 0.16, cell * 0.08); ctx.fill();
  ctx.fillStyle = '#b08a5a'; for (const lx of [1.2, 5.8]) ctx.fillRect(cellX * lx, fh + cell * 0.94, cell * 0.08, cell * 0.22);
  ctx.save();
  if (shake > 0) ctx.translate(rnd(-1, 1) * shake * 8, rnd(-1, 1) * shake * 8);
  ctx.imageSmoothingEnabled = false;

  // ---- 바닥: 스테이지별 질감 (칸 테두리 없이 하나의 필드처럼) ----
  const th = THEME[g.stage.era] ?? THEME['고대'];
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, fh); ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(eraBackdrop(g.stage.era, w, fh), 0, 0, w, fh);
  ctx.imageSmoothingEnabled = false;
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

  // ---- 오라 철학자: 선택했을 때만 영향 범위를 보여준다 (항상 그리면 배경이 겹쳐 보임) ----
  for (const t of g.towers) {
    if (t !== selected) continue;
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
    if (!spawnAt.has(t.uid)) spawnAt.set(t.uid, tick);
    const age = tick - spawnAt.get(t.uid)!;
    const pedS = Math.min(1, age / 8), drop = age < 22 ? Math.max(0, 1 - (age - 6) / 14) : 0;
    if (pedS < 1) { ctx.save(); ctx.translate(cx, foot); ctx.scale(pedS, pedS); ctx.translate(-cx, -foot); }
    drawPedestal(cx, foot, p, t.uid);
    if (pedS < 1) ctx.restore();
    if (age < 22 && age > 12) { ctx.strokeStyle = `rgba(255,255,255,${(22 - age) / 10})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, foot, cell * (0.3 + (age - 12) * 0.03), cell * (0.1 + (age - 12) * 0.01), 0, 0, Math.PI * 2); ctx.stroke(); }
    if (p.tier >= 7) {
      ctx.save(); ctx.globalAlpha = 0.35 + 0.2 * Math.sin(tick * 0.08);
      ctx.fillStyle = `hsl(${(tick * 2) % 360},90%,60%)`;
      ctx.beginPath(); ctx.arc(cx, foot - cell * 0.45, cell * 0.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    // 스킨 효과: 주변을 도는 반짝이 (등급이 높을수록 많이)
    const skn = SKINS[progress.skinOn?.[t.philId] ?? ''];
    if (skn) for (let k = 0; k < skn.rank + 1; k++) {
      const an = tick * 0.05 + (k * Math.PI * 2) / (skn.rank + 1) + t.uid;
      ctx.fillStyle = skn.sparkle; ctx.globalAlpha = 0.75;
      ctx.beginPath(); ctx.arc(cx + Math.cos(an) * cell * 0.38, foot - cell * 0.45 + Math.sin(an) * cell * 0.18, cell * 0.045, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }
    const bob = Math.sin((tick + t.cx * 9 + t.cy * 5) * 0.1) * cell * 0.03;
    const sz = cell * (p.tier >= 6 ? 1.08 : 0.96);
    const rc = recoil.get(t.uid) ?? 0;
    const sx = sz * (1 + rc * 0.12), sy = sz * (1 - rc * 0.1);
    ctx.save();
    ctx.globalAlpha = age < 6 ? 0 : 1;
    ctx.translate(cx, foot); ctx.rotate(-rc * 0.22); ctx.translate(-cx, -foot);
    ctx.drawImage(spriteFor(p.id), cx - sx / 2, foot - sy * 0.97 + bob - drop * cell * 0.7, sx, sy);
    ctx.restore();
    if ((t.stunT ?? 0) > 0) {
      ctx.font = `${cell * 0.32}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText('💤', cx + cell * 0.28, foot - cell * 0.9 + Math.sin(tick * 0.15) * 3);
    }
    // 이름표 (모든 철학자 발밑)
    {
      const nm = (progress.favorite === t.philId ? '💗' : '') + shortName(p.name);
      const fs = Math.max(9, cell * 0.18);
      ctx.font = `${fs}px "Jua", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const nw = ctx.measureText(nm).width + 8, ny = foot + fs * 0.35 + cell * 0.07;
      ctx.fillStyle = isSel ? '#ffd36b' : 'rgba(255,255,255,.92)'; ctx.strokeStyle = '#3b2a1e'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(cx - nw / 2, ny - fs * 0.62, nw, fs * 1.24, fs * 0.6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3b2a1e'; ctx.fillText(nm, cx, ny + 0.5);
    }
    // 조합 표시: 재료 짝은 금빛 고리, 조합 가능은 ✦ 배지
    if (selected && t !== selected && partnerIds.has(t.philId)) {
      const pr = 0.5 + 0.5 * Math.sin(tick * 0.15);
      ctx.strokeStyle = `rgba(255,190,60,${0.55 + pr * 0.4})`; ctx.lineWidth = 3 + pr * 2;
      ctx.beginPath(); ctx.ellipse(cx, foot - cell * 0.02, cell * 0.42, cell * 0.16, 0, 0, Math.PI * 2); ctx.stroke();
    }
    if (readyIds.has(t.philId) && !(selected === t)) {
      const sx2 = (t.cx + 0.82) * cellX, sy2 = (t.cy + 0.18) * cell + Math.sin(tick * 0.12 + t.uid) * 2, sr = cell * 0.12;
      ctx.fillStyle = '#ff5f8f'; ctx.beginPath(); ctx.arc(sx2, sy2, sr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = `${sr * 1.4}px "Jua", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✦', sx2, sy2 + 0.5);
    }
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
    const ksz = e.kind === 'tank' ? 1.25 : e.kind === 'swarm' ? 0.7 : e.kind === 'fast' ? 0.85 : 1;
    const esz = sz * ksz;
    ctx.fillStyle = 'rgba(60,35,20,.22)';
    ctx.beginPath(); ctx.ellipse(x, y + esz * 0.4, esz * 0.3, esz * 0.09, 0, 0, Math.PI * 2); ctx.fill();
    const hf = hitFlash.get(e.uid) ?? 0;
    const jx = hf > 0.3 ? (hash(e.uid + tick) - 0.5) * cell * 0.12 * hf : 0;
    const squash = 1 + hf * 0.22;
    ctx.drawImage(monsterSprite2(g.stage.era, e.boss ? 'boss' : e.kind, g.wave >= 15), x + jx - (esz * squash) / 2, y - esz / 2 - walk + esz * (1 - 1 / squash), esz * squash, esz / squash);
    if (hf > 0.05) { ctx.save(); ctx.globalAlpha = hf * 0.7; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(whiteSprite(monsterSprite2(g.stage.era, e.boss ? 'boss' : e.kind, g.wave >= 15)), x + jx - (esz * squash) / 2, y - esz / 2 - walk + esz * (1 - 1 / squash), esz * squash, esz / squash); ctx.restore(); }
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
    const src = g.towers.find((t) => t.uid === b.src);
    const sk = src ? SKINS[progress.skinOn?.[src.philId] ?? ''] : undefined;
    const col = sk ? sk.bullet : b.color;
    const x = b.x * cellX, y = b.y * cell, r = cell * (col ? 0.11 : 0.08);
    ctx.fillStyle = col === 'rainbow' ? `hsl(${(tick * 3) % 360},90%,75%)` : col === 'gold' ? '#ffd36b' : col || '#ffffff';
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
// ---------- 시대별 화풍 배경 (고대 항아리 · 동양 수묵 · 중세 필사본 · 근대 동판화 · 현대 바우하우스) ----------
const backdropCache = new Map<string, HTMLCanvasElement>();
const spawnAt = new Map<number, number>();
function eraBackdrop(era: string, w: number, h: number): HTMLCanvasElement {
  const dpr = window.devicePixelRatio || 1, key = `${era}|${Math.round(w)}|${Math.round(h)}|${dpr}`;
  const hit = backdropCache.get(key); if (hit) return hit;
  const c = document.createElement('canvas'); c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  const x = c.getContext('2d')!; x.scale(dpr, dpr);
  const u = Math.min(w, h) / 7; // 한 칸 크기
  const grad = (a: string, b: string) => { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, a); gr.addColorStop(1, b); x.fillStyle = gr; x.fillRect(0, 0, w, h); };
  const band = (y: number, col: string) => { // 미앤더(그리스 뇌문) 띠
    x.strokeStyle = col; x.lineWidth = Math.max(1.5, u * 0.05); x.lineJoin = 'miter';
    const s = u * 0.34;
    for (let i = -1; i * s < w + s; i++) {
      const bx = i * s, by = y;
      x.beginPath(); x.moveTo(bx, by + s * 0.8); x.lineTo(bx + s * 0.85, by + s * 0.8); x.lineTo(bx + s * 0.85, by + s * 0.1);
      x.lineTo(bx + s * 0.25, by + s * 0.1); x.lineTo(bx + s * 0.25, by + s * 0.55); x.lineTo(bx + s * 0.6, by + s * 0.55); x.lineTo(bx + s * 0.6, by + s * 0.35); x.stroke();
    }
  };
  if (era === '동양') {
    grad('#f8f5ea', '#ece7d6');
    // 먹 번진 먼 산
    x.save(); x.filter = `blur(${u * 0.12}px)`;
    for (const [alpha, base, amp, seed] of [[0.18, h * 0.32, h * 0.2, 1], [0.12, h * 0.55, h * 0.14, 5], [0.08, h * 0.85, h * 0.1, 9]] as const) {
      x.fillStyle = `rgba(44,51,48,${alpha})`; x.beginPath(); x.moveTo(0, h);
      for (let i = 0; i <= 24; i++) { const px = (i / 24) * w; x.lineTo(px, base - Math.abs(Math.sin(i * 0.7 + seed)) * amp * (0.5 + hash(i + seed) * 0.6)); }
      x.lineTo(w, h); x.fill();
    }
    x.restore();
    x.fillStyle = 'rgba(229,72,77,.55)'; x.beginPath(); x.arc(w * 0.76, h * 0.24, u * 0.42, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#c8323a'; x.beginPath(); x.roundRect(w - u * 1.55, h - u * 1.55, u * 0.42, u * 0.42, u * 0.06); x.fill();
    x.fillStyle = '#fff'; x.font = `${u * 0.3}px serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('智', w - u * 1.34, h - u * 1.33);
  } else if (era === '중세') {
    grad('#f3e8cf', '#e6d6b2');
    // 장미창 (스테인드글라스)
    const rx = w / 2, ry = h / 2, R = u * 1.25;
    const cols = ['rgba(37,99,235,.16)', 'rgba(220,38,38,.14)', 'rgba(234,179,8,.16)', 'rgba(22,163,74,.13)'];
    for (let i = 0; i < 12; i++) { x.fillStyle = cols[i % 4]; x.beginPath(); x.moveTo(rx, ry); x.arc(rx, ry, R, (i / 12) * Math.PI * 2, ((i + 1) / 12) * Math.PI * 2); x.fill(); }
    x.strokeStyle = 'rgba(120,80,30,.35)'; x.lineWidth = 2; x.beginPath(); x.arc(rx, ry, R, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.arc(rx, ry, R * 0.4, 0, Math.PI * 2); x.stroke();
    // 금박 이중 테두리
    x.strokeStyle = 'rgba(202,138,4,.7)'; x.lineWidth = 3; x.strokeRect(u * 1.08, u * 1.08, w - u * 2.16, h - u * 2.16);
    x.lineWidth = 1; x.strokeRect(u * 1.18, u * 1.18, w - u * 2.36, h - u * 2.36);
  } else if (era === '근대') {
    grad('#f1e8d6', '#e2d4b8');
    // 동판화 해칭
    x.strokeStyle = 'rgba(110,80,40,.07)'; x.lineWidth = 1;
    for (let i = -h; i < w; i += 6) { x.beginPath(); x.moveTo(i, h); x.lineTo(i + h, 0); x.stroke(); }
    // 나침반 장미
    const cx = w * 0.74, cy = h * 0.26, R = u * 0.5;
    x.strokeStyle = 'rgba(90,60,30,.35)'; x.lineWidth = 1.2; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.stroke();
    x.fillStyle = 'rgba(90,60,30,.3)';
    for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2; x.beginPath(); x.moveTo(cx + Math.cos(a) * R * 1.2, cy + Math.sin(a) * R * 1.2); x.lineTo(cx + Math.cos(a + 0.4) * R * 0.25, cy + Math.sin(a + 0.4) * R * 0.25); x.lineTo(cx + Math.cos(a - 0.4) * R * 0.25, cy + Math.sin(a - 0.4) * R * 0.25); x.fill(); }
    x.strokeStyle = 'rgba(90,60,30,.4)'; x.lineWidth = 2; x.strokeRect(u * 1.08, u * 1.08, w - u * 2.16, h - u * 2.16);
  } else if (era === '현대') {
    grad('#eef0f6', '#dfe3ee');
    const shapes: [string, number, number, number][] = [['rgba(239,68,68,.13)', 0.18, 0.2, 0.9], ['rgba(37,99,235,.12)', 0.8, 0.75, 1.1], ['rgba(250,204,21,.18)', 0.75, 0.18, 0.6]];
    for (const [col, fx, fy, r] of shapes) { x.fillStyle = col; x.beginPath(); x.arc(w * fx, h * fy, u * r, 0, Math.PI * 2); x.fill(); }
    x.fillStyle = 'rgba(24,24,27,.07)'; x.fillRect(w * 0.08, h * 0.62, u * 1.6, u * 0.5); x.fillRect(w * 0.6, h * 0.08, u * 0.18, u * 2);
  } else { // 고대: 테라코타 + 흑색상 미앤더
    grad('#f8d9b4', '#efbf8e');
    x.fillStyle = 'rgba(255,227,154,.55)'; x.beginPath(); x.arc(w * 0.74, h * 0.26, u * 0.45, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(201,111,60,.12)';
    for (let i = 0; i < 60; i++) { x.beginPath(); x.arc(hash(i * 7.1) * w, hash(i * 3.3 + 1) * h, 1 + hash(i) * 2.2, 0, Math.PI * 2); x.fill(); }
    x.save(); x.beginPath(); x.rect(u * 1.05, 0, w - u * 2.1, h); x.clip();
    x.fillStyle = 'rgba(217,119,63,.35)'; x.fillRect(0, u * 1.05, w, u * 0.42); x.fillRect(0, h - u * 1.47, w, u * 0.42);
    band(u * 1.09, 'rgba(42,24,16,.5)'); band(h - u * 1.43, 'rgba(42,24,16,.5)'); x.restore();
  }
  backdropCache.set(key, c);
  return c;
}

/** 철학자 받침대: 시대별 원판 + 등급 후광 + 반짝이 (도트 자체는 그대로) */
const PEDESTAL: Record<string, [string, string, string | null]> = {
  고대: ['#e8925a', '#c96f3c', '#2a1810'], 동양: ['#f4f0e2', '#cfcab8', null], 중세: ['#eadcb8', '#b8954a', '#ca8a04'],
  근대: ['#e9dcc2', '#b9a77f', null], 현대: ['#e4e7ee', '#a9b1bf', null],
};
function drawPedestal(cx: number, foot: number, p: { tier: number; era: string }, uid: number, X: CanvasRenderingContext2D = ctx, C: number = cell) {
  const [top, side, deco] = PEDESTAL[p.era] ?? PEDESTAL['고대'];
  const rw = C * 0.44, rh = C * 0.13;
  if (p.tier >= 3) { // 등급 후광
    const gr = X.createRadialGradient(cx, foot - C * 0.42, 0, cx, foot - C * 0.42, C * 0.62);
    const a = 0.22 + 0.08 * Math.sin(tick * 0.06 + uid);
    gr.addColorStop(0, hexA(TIER_AURA[p.tier], a + (p.tier >= 5 ? 0.15 : 0))); gr.addColorStop(1, hexA(TIER_AURA[p.tier], 0));
    X.fillStyle = gr; X.beginPath(); X.arc(cx, foot - C * 0.42, C * 0.62, 0, Math.PI * 2); X.fill();
  }
  if (p.tier >= 7) { // 근원: 금테 두른 대리석 기둥 받침
    const ch = C * 0.16;
    X.fillStyle = 'rgba(42,24,16,.2)'; X.beginPath(); X.ellipse(cx, foot + ch + rh * 0.6, rw * 1.1, rh, 0, 0, Math.PI * 2); X.fill();
    X.fillStyle = '#d9d4cc'; X.beginPath(); X.ellipse(cx, foot + ch, rw, rh, 0, 0, Math.PI * 2); X.fill();
    X.fillStyle = '#f5f2ec'; X.fillRect(cx - rw, foot, rw * 2, ch);
    X.fillStyle = 'rgba(160,150,140,.35)'; for (let k = -2; k <= 2; k++) X.fillRect(cx + k * rw * 0.38 - 1, foot + 2, 2, ch - 2);
    X.fillStyle = '#fbbf24'; X.fillRect(cx - rw, foot + ch - 3, rw * 2, 3);
    X.fillStyle = '#fffdf8'; X.beginPath(); X.ellipse(cx, foot, rw, rh, 0, 0, Math.PI * 2); X.fill();
    X.strokeStyle = '#f59e0b'; X.lineWidth = 2; X.stroke();
    X.strokeStyle = `hsla(${(tick * 2) % 360},90%,65%,.8)`; X.lineWidth = 1.5; X.beginPath(); X.ellipse(cx, foot, rw * 0.75, rh * 0.6, 0, 0, Math.PI * 2); X.stroke();
  } else {
  X.fillStyle = 'rgba(42,24,16,.18)'; X.beginPath(); X.ellipse(cx, foot + rh * 0.9, rw * 1.05, rh * 0.9, 0, 0, Math.PI * 2); X.fill();
  X.fillStyle = side; X.beginPath(); X.ellipse(cx, foot + rh * 0.45, rw, rh, 0, 0, Math.PI * 2); X.fill();
  X.fillStyle = top; X.beginPath(); X.ellipse(cx, foot, rw, rh, 0, 0, Math.PI * 2); X.fill();
  if (deco) { X.strokeStyle = deco; X.lineWidth = 1.2; X.setLineDash([1.5, 3]); X.beginPath(); X.ellipse(cx, foot, rw * 0.78, rh * 0.62, 0, 0, Math.PI * 2); X.stroke(); X.setLineDash([]); }
  if (p.era === '동양') { X.fillStyle = '#c8323a'; X.fillRect(cx + rw * 0.55, foot - rh * 0.2, C * 0.06, C * 0.06); }
  }
  if (p.tier >= 4) { // 반짝이
    const n = p.tier >= 6 ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const ph = (tick * 0.04 + k * 2.1 + uid) % (Math.PI * 2), al = Math.max(0, Math.sin(ph));
      const sx = cx + Math.cos(k * 2.4 + uid) * C * 0.4, sy = foot - C * (0.5 + 0.25 * Math.sin(k * 1.7 + uid));
      X.globalAlpha = al; X.fillStyle = p.tier >= 7 ? '#fff' : TIER_AURA[p.tier];
      const s = C * 0.05; X.fillRect(sx - s / 2, sy - s * 1.5, s, s * 3); X.fillRect(sx - s * 1.5, sy - s / 2, s * 3, s); X.globalAlpha = 1;
    }
  }
}

/** 고민방용 큰 초상: 시대 배경 위 받침대 + 후광 + 도트 */
const heroCache = new Map<string, string>();
function heroPortrait(id: string): string {
  const key = id + (progress?.skinOn?.[id] ?? '');
  const hit = heroCache.get(key); if (hit) return hit;
  const p = PHIL.get(id)!, W = 220, H = 230, C = 150;
  const c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2;
  const X = c.getContext('2d')!; X.scale(2, 2); X.imageSmoothingEnabled = false;
  const foot = H - 40;
  drawPedestal(W / 2, foot, p, 1, X, C);
  const sz = C * 1.05;
  X.drawImage(spriteFor(id), W / 2 - sz / 2, foot - sz * 0.97, sz, sz);
  const url = c.toDataURL(); heroCache.set(key, url); return url;
}
/** 카드용 작은 초상: 받침대 + 후광 + 도트 */
function pedArt(id: string): string {
  const key = 'c' + id + (progress?.skinOn?.[id] ?? '');
  const hit = heroCache.get(key); if (hit) return hit;
  const p = PHIL.get(id)!, W = 100, H = 100, C = 70;
  const c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2;
  const X = c.getContext('2d')!; X.scale(2, 2); X.imageSmoothingEnabled = false;
  const foot = H - 18;
  drawPedestal(W / 2, foot, p, 1, X, C);
  const sz = C * 1.02; X.drawImage(spriteFor(id), W / 2 - sz / 2, foot - sz * 0.97, sz, sz);
  const url = c.toDataURL(); heroCache.set(key, url); return url;
}
function eraSky(era: string): string {
  const k = 'sky' + era; const hit = heroCache.get(k); if (hit) return hit;
  const big = eraBackdrop(era, 560, 560), dpr = big.width / 560;
  const c = document.createElement('canvas'); c.width = 420 * dpr; c.height = 280 * dpr;
  c.getContext('2d')!.drawImage(big, 70 * dpr, 40 * dpr, 420 * dpr, 280 * dpr, 0, 0, c.width, c.height);
  const url = c.toDataURL(); heroCache.set(k, url); return url;
}
function hexA(hex: string, a: number) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

const THEME: Record<string, { ground: string; speck: string; speck2: string; road: string; roadEdge: string; roadLine: string; decor: string[] }> = {
  고대: { ground: '#f6ead2', speck: '#ecdcbc', speck2: '#fff6e4', road: '#fff3d6', roadEdge: '#b88a4f', roadLine: 'rgba(255,255,255,.5)', decor: ['column', 'olive', 'amphora'] },
  중세: { ground: '#d9cdea', speck: '#cbbde0', speck2: '#e6dcf3', road: '#fbf5e6', roadEdge: '#a08458', roadLine: 'rgba(139,122,168,.6)', decor: ['candle', 'stone', 'banner'] },
  동양: { ground: '#cdeeb5', speck: '#bde4a1', speck2: '#ddf5c9', road: '#fffdf6', roadEdge: '#9aa096', roadLine: 'rgba(255,255,255,.45)', decor: ['bamboo', 'pine', 'lantern'] },
  근대: { ground: '#d4dde8', speck: '#c5d0dd', speck2: '#e2e9f1', road: '#fdf8ee', roadEdge: '#9a8462', roadLine: 'rgba(123,142,166,.7)', decor: ['gear', 'lamp', 'crate'] },
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
      <div class="room-sky" style="background-image:url(${eraSky(p.era)})"><div class="room-bubble">“${p.quote}”</div>
        <button id="thinker" class="thinker t${p.tier}"><img src="${heroPortrait(p.id)}"></button>
        <div class="room-floor"></div></div>
      <div class="room-stat"><span>고뇌</span><b id="room-gonoe">${Math.floor(progress.gonoe).toLocaleString()}</b></div>
      <div class="room-rates"><span>👆 탭당 <b>+${tapGain(progress)}</b></span><span>⏳ 초당 <b>+${rate.toFixed(1)}</b></span></div>
      ${idle ? `<p class="hint">자리를 비운 사이 고뇌 <b>+${idle.toLocaleString()}</b></p>` : ''}
      <div class="room-owners">${owned.slice(0, 7).map((o) => `<button data-owner="${o.id}" class="${o.id === roomThinker ? 'on' : ''}"><img src="${portrait(o.id)}"></button>`).join('')}</div>
      <button id="room-ad" class="chunky pink">${adFree(progress) ? '✨' : '📺'} 30분치 고뇌 바로 받기 <small>(+${Math.round(rate * 1800).toLocaleString()} · 오늘 ${adsLeft(progress)}회)</small></button>
      <button id="tap-up" class="chunky blue">💭 고민의 깊이 Lv.${progress.tapLevel + 1} → ${progress.tapLevel + 2}<small>탭 +${tapGain(progress)}→+${tapGain(next)} · 초당 ${rate.toFixed(1)}→${idleRate(next, clearedStages()).toFixed(1)} · 🤔${cost.toLocaleString()}</small></button>
    </div>`;
  for (const b of $('tab-room').querySelectorAll<HTMLButtonElement>('[data-owner]')) b.onclick = () => { roomThinker = b.dataset.owner!; progress.favorite = roomThinker; saveProgress(progress); sfx.click(); renderRoom(); }; // 고민방 주인 = 💗최애
  const ra = $<HTMLButtonElement>('room-ad');
  ra.disabled = adsLeft(progress) <= 0;
  ra.onclick = () => watchAd(() => { if (adFree(progress)) useAd(progress); progress.gonoe += Math.round(rate * 1800); saveProgress(progress); refreshWallet(); sfx.reveal(5); toast(`🤔 고뇌 +${Math.round(rate * 1800).toLocaleString()}`); renderRoom(); });
  $('room-info').onclick = () => alertBox(`<h2>🤔 고민방</h2><p>철학자를 톡톡 두드리면 고뇌가 나와요.<br>가만히 둬도 쌓이고(최대 ${8}시간), 스테이지를 깰수록 더 빨리 쌓여요.</p><p><b>고민의 깊이</b>를 올리면 탭당 고뇌와 초당 고뇌가 함께 올라요.</p><p>고뇌는 🎴 카드·🧰 도구 뽑기에 써요. 고민방 주인은 도감에서 💗최애로 바꿀 수 있어요.</p>`);
  $('thinker').onclick = (ev) => {
    progress.gonoe += tapGain(progress);
    bump(progress, 'taps');
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
      <div class="banner-art">${PHILOSOPHERS.filter((p) => p.tier === 7 && !p.hidden).map((p) => `<img src="${pedArt(p.id)}">`).join('')}</div>
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
    c: `<h2>🧠 기억 떠올리기</h2><p>고뇌를 써서 잊어버린 철학자의 <b>기억(카드)</b>을 떠올려요. <b>거장·근원</b>은 카드가 있어야 전투에서 조합할 수 있어요. 이야기에서 지나온 시대의 철학자만 떠올릴 수 있어요 (지금: ${[...openEras()].join(', ')}).</p><p>같은 카드가 모이면 레벨업(Lv.${CARD_MAX_LEVEL}까지) · 레벨당 공격력 +${CARD_ATK_PER_LEVEL * 100}%<br>그 뒤 ${AWAKEN_EVERY}장마다 <b>각성</b>(최대 ${AWAKEN_MAX}단계): 공격력 +15%, 스킬 강화<br>레벨이 오르면 일화가 열려요.</p><div class="rates-line">${rates}</div><p><b>천장</b>: 거장 이상이 안 나와도 ${PITY_LIMIT}회째엔 확정 · 지금 ${PITY_LIMIT - progress.pity}회 남음</p>`,
    t: `<h2>🧰 도구 상자</h2><p>뽑은 도구는 도감에서 철학자에게 장착해요.<br>그 도구의 주인에게 끼우면 <b>찰떡!</b> 공격력 +60%</p>`,
  };
  for (const b of $('tab-gacha').querySelectorAll<HTMLButtonElement>('[data-ginfo]')) b.onclick = () => alertBox(INFO[b.dataset.ginfo!]);
  for (const b of $('tab-gacha').querySelectorAll<HTMLButtonElement>('[data-pull]')) {
    const o = PULLS.find((x) => x.id === b.dataset.pull)!;
    b.disabled = !canAfford(progress, o);
    b.onclick = () => {
      const before = { ...progress.cards };
      const got = pull(progress, o);
      if (got) bump(progress, 'pulls');
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
      el.innerHTML = `${tag}<img src="${pedArt(id)}"><b>${p.name}</b><small>${TIER_NAME[tier]}</small>`;
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
  const item = (x: (typeof SHOP)[number]) => {
    const sold = x.once && progress.purchases.includes(x.id);
    const active = x.sub === 'pass30' && passOn(progress) ? `<i class="tag-on">이용 중 · ${passDaysLeft(progress)}일</i>` : x.sub?.startsWith('adfree') && adFreeLabel(progress) && (x.sub === 'adfreeLife' ? adFreeLabel(progress) === '평생' : true) ? `<i class="tag-on">${adFreeLabel(progress)}</i>` : '';
    return `<div class="shop-item ${sold ? 'sold' : ''} ${x.big ? 'big' : ''}">${x.tag ? `<i class="tag-hot">${x.tag}</i>` : ''}${active}<div class="shop-icon">${x.icon}</div><b>${x.name}</b><small>${x.desc}</small>
      <button class="chunky ${x.costGems ? 'blue' : 'gold'}" data-buy="${x.id}" ${sold ? 'disabled' : ''}>${sold ? '구매 완료' : x.price}</button></div>`;
  };
  const fav = progress.favorite && progress.cards[progress.favorite] ? progress.favorite : PHILOSOPHERS.filter((p) => progress.cards[p.id]).sort((a, b) => b.tier - a.tier)[0]?.id;
  $('tab-shop').innerHTML = `<div class="tab-head"><h2>🛍 상점</h2><span class="proto-chip">시험판 · 실제 결제 없음</span></div>
    <h3 class="shop-sec">멤버십</h3><div class="shop-grid">${SHOP.filter((x) => x.sub).map(item).join('')}</div>
    <h3 class="shop-sec">지혜석 · 초대장</h3><div class="shop-grid">${SHOP.filter((x) => !x.sub).map(item).join('')}</div>
    ${fav ? `<h3 class="shop-sec">👗 스킨 <small>(${PHIL.get(fav)!.name})</small></h3><div class="skin-shop">${Object.entries(SKINS).map(([k, sk]) => {
      const own = progress.skins.includes(fav + ':' + k), on = progress.skinOn[fav] === k;
      return `<button class="skin-card ${on ? 'on' : ''} r-${sk.rank}" data-skinbuy="${k}"><img src="${skinnedSprite(PHIL.get(fav)!, k).toDataURL()}"><b>${sk.icon} ${sk.name}</b><small>${sk.fxName}</small><em>${on ? '착용 중' : own ? '착용하기' : '💎' + sk.price}</em></button>`;
    }).join('')}</div><p class="hint">스킨은 💗최애(없으면 가장 높은 등급) 철학자에게 적용돼요. 도감 정보보기에서 다른 철학자도 바꿀 수 있어요.</p>` : ''}`;
  for (const b of $('tab-shop').querySelectorAll<HTMLButtonElement>('[data-buy]')) b.onclick = () => {
    const it = SHOP.find((x) => x.id === b.dataset.buy)!;
    if (!it.costGems && !window.confirm(`[모의 결제] ${it.name} (${it.price})\n실제 결제는 일어나지 않아요. 지급할까요?`)) return;
    if (buy(progress, it)) { saveProgress(progress); refreshWallet(); renderShop(); sfx.reveal(5); toast(`🎉 ${it.name} 지급 완료!`); }
    else toast('💎 지혜석이 부족해요');
  };
  for (const b of $('tab-shop').querySelectorAll<HTMLButtonElement>('[data-skinbuy]')) b.onclick = () => {
    const k = b.dataset.skinbuy!, sk = SKINS[k];
    if (!fav) return;
    if (!progress.skins.includes(fav + ':' + k)) {
      if (progress.gems < sk.price) { toast('💎 지혜석이 부족해요'); return; }
      if (!window.confirm(`${sk.icon} ${sk.name} 스킨을 💎${sk.price}에 살까요?`)) return;
      progress.gems -= sk.price; progress.skins.push(fav + ':' + k); sfx.reveal(5);
    }
    progress.skinOn[fav] = k; spriteUrl.clear(); saveProgress(progress); refreshWallet(); renderShop(); toast(`👗 ${sk.name} 착용!`);
  };
}

// ---------- 조합표 · 확률표 ----------
function recipeSheet(filter: 'all' | 'ready' | 'liked' = 'all') {
  const g = game;
  const liked = new Set(progress.likedRecipes ?? []);
  const canNow = (r: Recipe) => !!g && g.ownedMaterials(r).every(Boolean) && g.hasCatalyst(r) && !g.isLocked(r);
  const all = RECIPES.filter((r) => !PHIL.get(r.result)!.hidden || progress.seen.includes(r.result) || QA_MODE);
  const rows = all.filter((r) => filter === 'all' || (filter === 'ready' ? canNow(r) : liked.has(r.id)))
    .sort((a, b) => Number(canNow(b)) - Number(canNow(a)) || Number(liked.has(b.id)) - Number(liked.has(a.id)) || PHIL.get(a.result)!.tier - PHIL.get(b.result)!.tier);
  const face = (id: string, on: boolean, unknown = false) => `<span class="rf t${PHIL.get(id)!.tier} ${on ? 'on' : ''} ${unknown ? 'unk' : ''}"><img src="${portrait(id)}" alt=""><small>${unknown ? '???' : shortName(PHIL.get(id)!.name)}</small></span>`;
  const html = rows.map((r) => {
    const own = g ? g.ownedMaterials(r) : r.materials.map(() => false);
    const known = QA_MODE || progress.seen.includes(r.result) || !PHIL.get(r.result)!.hidden;
    const cat = r.catalyst ? `<b>+</b><span class="rf cat ${g && g.catalysts[r.catalyst] ? 'on' : ''}"><i>${CAT_ICON[r.catalyst]}</i><small>촉매</small></span>` : '';
    return `<div class="req ${canNow(r) ? 'ready' : ''}" data-id="${r.id}">${liked.has(r.id) ? '<em class="hrt">💗</em>' : ''}
      ${r.materials.map((m, i) => face(m, own[i])).join('<b>+</b>')}${cat}<b class="eq">=</b>${face(r.result, true, !known)}
      <button class="req-i" data-info="${r.id}" aria-label="상세">i</button></div>`;
  }).join('') || `<p class="hint" style="text-align:center">${filter === 'ready' ? '지금 바로 할 수 있는 조합이 없어요' : '💗 표시한 조합이 없어요'}</p>`;
  document.querySelector('.overlay.recipes')?.remove();
  const o = document.createElement('div');
  o.className = 'overlay recipes';
  o.innerHTML = `<div class="pop rsheet"><div class="rs-head"><h2>📜 조합표</h2><button class="rs-x" aria-label="닫기">✕</button></div>
    <div class="rs-tabs">${(['all', 'ready', 'liked'] as const).map((f) => `<button data-f="${f}" class="${f === filter ? 'on' : ''}">${{ all: `전체 ${all.length}`, ready: `지금 가능 ${all.filter(canNow).length}`, liked: `💗 목표 ${liked.size}` }[f]}</button>`).join('')}</div>
    <p class="hint rs-hint">진한 얼굴 = 지금 필드에 있는 재료 · <b>i</b> 를 누르면 자세히</p>
    <div class="rs-list">${html}</div></div>`;
  o.onclick = (e) => {
    const el = e.target as HTMLElement;
    if (el === o || el.closest('.rs-x')) { o.remove(); return; }
    const f = el.closest('[data-f]') as HTMLElement | null; if (f) { recipeSheet(f.dataset.f as 'all'); return; }
    const info = el.closest('[data-info]') as HTMLElement | null;
    const row = el.closest('.req') as HTMLElement | null;
    const id = info?.dataset.info ?? row?.dataset.id;
    if (id) recipeDetail(RECIPES.find((r) => r.id === id)!, filter);
  };
  document.body.appendChild(o);
}

function recipeDetail(r: Recipe, back: 'all' | 'ready' | 'liked') {
  const g = game, res = PHIL.get(r.result)!;
  const known = QA_MODE || progress.seen.includes(res.id) || !res.hidden;
  const own = g ? g.ownedMaterials(r) : r.materials.map(() => false);
  const ready = !!g && own.every(Boolean) && g.hasCatalyst(r) && !g.isLocked(r);
  const liked = (progress.likedRecipes ?? []).includes(r.id);
  const o = document.createElement('div');
  o.className = 'overlay rdetail';
  o.innerHTML = `<div class="pop rd-pop t${res.tier}">
    <div class="rd-hero"><img src="${pedArt(res.id)}" alt="" class="${known ? '' : 'unk'}"><div><span class="tier-chip t${res.tier}">${TIER_NAME[res.tier]}</span><h2>${known ? res.name : '??? (처음 조합하면 공개)'}</h2>${known ? `<p class="rd-skill"><b>✦ ${res.skill}</b> ${res.skillDesc}</p>` : ''}</div></div>
    <div class="rd-mats">${r.materials.map((m, i) => { const p = PHIL.get(m)!; return `<div class="${own[i] ? 'have' : ''}"><img src="${portrait(m)}" alt=""><b>${p.name}</b><small>${TIER_NAME[p.tier]} · ${own[i] ? '필드에 있음 ✓' : '없음'}</small></div>`; }).join('')}
      ${r.catalyst ? `<div class="${g && g.catalysts[r.catalyst] ? 'have' : ''}"><i>${CAT_ICON[r.catalyst]}</i><b>촉매 ${CAT_NAME[r.catalyst]}</b><small>보유 ${g ? g.catalysts[r.catalyst] : 0}</small></div>` : ''}</div>
    ${r.logic ? `<p class="rd-logic">💬 ${r.logic}</p>` : ''}
    ${g && g.isLocked(r) ? `<p class="hint">🔒 ${lockReason(r)}</p>` : ''}
    <div class="rd-btns"><button class="chunky rd-like">${liked ? '💔 목표 해제' : '💗 목표로 저장'}</button>${ready ? '<button class="chunky gold rd-go">⚗ 지금 조합</button>' : '<button class="chunky blue rd-back">← 목록</button>'}</div></div>`;
  o.onclick = (e) => {
    const el = e.target as HTMLElement;
    if (el === o || el.closest('.rd-back')) { o.remove(); return; }
    if (el.closest('.rd-like')) {
      const list = new Set(progress.likedRecipes ?? []);
      if (list.has(r.id)) list.delete(r.id); else list.add(r.id);
      progress.likedRecipes = [...list]; saveProgress(progress); lastSynthKey = '';
      o.remove(); recipeSheet(back); return;
    }
    if (el.closest('.rd-go')) { o.remove(); document.querySelector('.overlay.recipes')?.remove(); doMerge(r); }
  };
  document.body.appendChild(o);
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
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; text?: string; star?: boolean; sq?: boolean; rot?: number; g?: number }
const hitFlash = new Map<number, number>();
const BOSS_BAND: Record<string, [string, string, string]> = { 고대: ['#7a3318', '#d9773f', 'rgba(255,211,107,.7)'], 중세: ['#4c1d1d', '#991b1b', 'rgba(251,191,36,.7)'], 동양: ['#1c1917', '#3f3f46', 'rgba(229,72,77,.7)'], 근대: ['#1e293b', '#1e3a8a', 'rgba(147,197,253,.7)'], 현대: ['#3b0764', '#7e22ce', 'rgba(34,211,238,.7)'] };
const ERA_SHARD: Record<string, string[]> = { 고대: ['#e8925a', '#2a1810', '#fff3d6', '#f5c04a'], 중세: ['#ca8a04', '#7f1d1d', '#fde68a', '#94a3b8'], 동양: ['#1c1917', '#c8323a', '#f6f2e4', '#6b7280'], 근대: ['#b45309', '#64748b', '#fde68a', '#e2d4b8'], 현대: ['#a855f7', '#22d3ee', '#f43f5e', '#fde047'] };
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
      if (f.uid !== undefined) hitFlash.set(f.uid, 1);
      shapes.push({ kind: 'impact', x: f.x, y: f.y, r: f.big ? 0.55 : 0.32, life: 0.16, max: 0.16 });
      if (f.big) shake = Math.max(shake, 0.12);
      for (let i = 0; i < (f.big ? 7 : 3); i++) particles.push({ x: f.x, y: f.y, vx: rnd(-2.5, 2.5), vy: rnd(-3, -0.5), life: 0.35, max: 0.35, color: f.big ? '#ffd36b' : '#ffffff', size: rnd(0.04, 0.08), star: f.big });
      particles.push({ x: f.x + rnd(-0.15, 0.15), y: f.y - 0.3, vx: 0, vy: -1.2, life: 0.7, max: 0.7, color: f.big ? '#ffd36b' : '#ffffff', size: f.big ? 0.36 : 0.24, text: fmt(f.dmg) + (f.big ? '!' : '') });
    } else if (f.type === 'kill') {
      const shard = ERA_SHARD[g.stage.era] ?? PASTEL;
      for (let i = 0; i < (f.boss ? 44 : 14); i++) particles.push({ x: f.x, y: f.y, vx: rnd(-3.2, 3.2), vy: rnd(-4, 0.5), life: 0.7, max: 0.7, color: shard[i % shard.length], size: rnd(0.05, 0.12), sq: true, rot: rnd(0, 6), g: 7 });
      shapes.push({ kind: 'pop', x: f.x, y: f.y, r: f.boss ? 1.6 : 0.6, life: 0.3, max: 0.3 });
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
  for (const [k, v] of hitFlash) { const n = v - dt * 9; if (n <= 0) hitFlash.delete(k); else hitFlash.set(k, n); }
  if (shake > 0) shake = Math.max(0, shake - dt);
  for (const [k, v] of speeches) { v.t -= dt; if (v.t <= 0) speeches.delete(k); }
  if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
  if (bossIntro) { bossIntro.t -= dt; if (bossIntro.t <= 0) bossIntro = null; }
}

const whiteCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
function whiteSprite(src: HTMLCanvasElement) {
  const hit = whiteCache.get(src); if (hit) return hit;
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const x = c.getContext('2d')!; x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  whiteCache.set(src, c); return c;
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
      case 'impact': { // 타격 순간 섬광 + 방사선
        const R = (s.r ?? 0.3) * cell;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(X, Y, R * (1 - k * 0.5), 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2.5;
        for (let i = 0; i < 6; i++) { const an = i * 1.047 + s.x * 3; ctx.beginPath(); ctx.moveTo(X + Math.cos(an) * R * (0.6 + k), Y + Math.sin(an) * R * (0.6 + k)); ctx.lineTo(X + Math.cos(an) * R * (1.3 + k * 1.6), Y + Math.sin(an) * R * (1.3 + k * 1.6)); ctx.stroke(); }
        break;
      }
      case 'pop': // 처치 순간 흰 링
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 4 * a + 1; ctx.beginPath(); ctx.arc(X, Y, (s.r ?? 0.6) * cell * (0.2 + k * 0.8), 0, Math.PI * 2); ctx.stroke(); break;
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
      const age = 1 - a, pop = age < 0.15 ? 1 + (0.15 - age) * 5 : 1;
      ctx.font = `900 ${Math.max(10, cell * p.size * pop)}px "Jua", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = Math.min(1, a * 1.8);
      ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = '#3b2a1e'; ctx.strokeText(p.text, p.x * cellX, p.y * cell);
      ctx.fillStyle = p.color; ctx.fillText(p.text, p.x * cellX, p.y * cell);
    } else {
      ctx.fillStyle = p.color;
      if (p.sq) { ctx.save(); ctx.translate(p.x * cellX, p.y * cell); ctx.rotate((p.rot ?? 0) + (1 - a) * 6); const z = p.size * cell; ctx.fillRect(-z / 2, -z / 2, z, z * 0.7); ctx.restore(); }
      else if (p.star) drawStar(p.x * cellX, p.y * cell, p.size * cell);
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
    ctx.fillText(game?.raid ? `👑 ${boss.name} · 피해 ${Math.round(game.raidDamage).toLocaleString()} · ⏱${Math.ceil(game.raidLeft)}` : `👑 ${boss.name}  ${Math.ceil(r * 100)}%`, w / 2, by + cell * 0.22);
  }
  // 보스 등장 컷인
  if (bossIntro) {
    const T = 2.6 - bossIntro.t, slide = 1 - Math.pow(1 - Math.min(1, T * 3.2), 3), out = Math.min(1, bossIntro.t * 3);
    const era = game!.stage.era, [c1, c2, c3] = BOSS_BAND[era] ?? BOSS_BAND['고대'];
    ctx.save(); ctx.globalAlpha = out;
    ctx.fillStyle = 'rgba(30,20,14,.6)'; ctx.fillRect(0, 0, w, fh);
    if (T < 0.15) { ctx.fillStyle = `rgba(255,255,255,${1 - T / 0.15})`; ctx.fillRect(0, 0, w, fh); }
    const bandY = fh * 0.34, bandH = cell * 2.3;
    ctx.save(); ctx.translate(w / 2, bandY + bandH / 2); ctx.rotate(-0.06); ctx.translate(-w / 2, -(bandY + bandH / 2));
    ctx.fillStyle = c1; ctx.fillRect(-20, bandY - 6, w + 40, bandH + 12);
    ctx.fillStyle = c2; ctx.fillRect(-20, bandY, w + 40, bandH);
    for (let i = 0; i < 10; i++) { ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(((T * 700 + i * 80) % (w + 120)) - 100, bandY + 8 + (i % 4) * (bandH / 4.5), 60 + (i % 3) * 20, 3); }
    ctx.restore();
    const bs = cell * 2.9, ix = -bs + slide * (bs + cell * 0.25), iy = bandY - cell * 0.55 + Math.sin(T * 9) * 2;
    const glow = ctx.createRadialGradient(ix + bs / 2, iy + bs / 2, 0, ix + bs / 2, iy + bs / 2, bs * 0.7);
    glow.addColorStop(0, c3); glow.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = glow; ctx.fillRect(ix - bs * 0.2, iy - bs * 0.2, bs * 1.4, bs * 1.4);
    ctx.drawImage(monsterSprite2(era, 'boss'), ix, iy, bs, bs);
    const tx = w - slide * (w - cell * 3.3);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.font = `${cell * 0.28}px "Jua", sans-serif`; ctx.fillStyle = '#fff'; ctx.fillText('WARNING · 도그마의 왕 출현', tx, bandY + cell * 0.55);
    ctx.font = `${cell * 0.58}px "Jua", sans-serif`; ctx.lineWidth = 6; ctx.strokeStyle = c1; ctx.strokeText(bossIntro.name, tx, bandY + cell * 1.35);
    ctx.fillStyle = '#fff'; ctx.fillText(bossIntro.name, tx, bandY + cell * 1.35);
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
$('open-recipes').onclick = () => recipeSheet();
$('open-rates').onclick = rateSheet;
for (const b of document.querySelectorAll<HTMLButtonElement>('#tabs button')) b.onclick = () => { sfx.click(); switchTab(b.dataset.tab!); };
for (const id of ['mute', 'mute-b']) { const b = document.getElementById(id); if (b) { b.textContent = isMuted() ? '🔇' : '🔊'; b.onclick = () => { const mu = toggleMute(); for (const x of ['mute', 'mute-b']) { const e = document.getElementById(x); if (e) e.textContent = mu ? '🔇' : '🔊'; } }; } }
$('b-recipes').onclick = () => recipeSheet();
$('tut-again').onclick = () => { $('settings').classList.add('hidden'); progress.battleTutDone = false; progress.tabTut = []; pageTutStart(currentTab); saveProgress(progress); toast('🎓 화면마다, 그리고 다음 전투에서 튜토리얼이 다시 나와요'); };
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
  freshDevice = isNew;
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
  const idv = $<HTMLInputElement>('login-id').value.trim(), pwv = $<HTMLInputElement>('login-pw').value;
  let acc = await login(idv, pwv);
  // 미리 정한 계정이 아니면: 서버에 가입된 일반 계정으로 로그인
  if (!acc && idv && pwv) { $('login-err').textContent = '☁️ 서버 확인 중…'; if (await cloudLogin(idv, pwv, false)) acc = { id: idv, hash: '', role: 'fresh', label: '일반 계정' }; }
  if (!acc) { $('login-err').textContent = '아이디 또는 비밀번호가 맞지 않아요'; shakeEl($('login-card')); return; }
  $('login-err').textContent = '';
  sfx.reveal(5);
  enter(acc);
  lastPw = $<HTMLInputElement>('login-pw').value;
  void syncCloud(acc.id, lastPw);
};

// ---------- ☁️ 서버 저장 동기화 ----------
let freshDevice = false; // 이 기기에 저장이 없던 상태로 들어왔는지
setSaveHook((p) => cloudSave(p));
async function syncCloud(id: string, pw: string) {
  const ok = await cloudLogin(id, pw);
  if (ok) {
    const remote = await cloudLoad();
    // 서버 쪽이 더 최신이거나, 이 기기가 처음이면 서버 것을 쓴다
    if (remote && (freshDevice || (remote.savedAt ?? 0) > (progress.savedAt ?? 0))) {
      progress = adoptProgress(remote);
      spriteUrl.clear(); renderHome(); refreshWallet();
      toast('☁️ 서버에 저장된 진행을 불러왔어요');
    } else { cloudSave(progress); void cloudFlush(); }
  }
  cloudBadge();
}
function cloudBadge() {
  const el = document.getElementById('cloud-state');
  if (!el) return;
  el.textContent = cloudState === 'ok' ? '☁️ 서버 저장 켜짐' : cloudState === 'confirm' ? '☁️ 설정 필요: ' + cloudMsg : cloudState === 'error' ? `☁️ 서버 연결 실패 (이 기기에만 저장 중)\n원인: ${cloudMsg || '알 수 없음'}` : '☁️ 서버 저장 꺼짐';
  el.className = `cloud-state ${cloudState}`;
  el.title = cloudMsg;
}
// 설정을 열 때마다 서버 상태를 다시 표시하고, 실패 상태면 한 번 더 연결을 시도한다
let lastPw = '';
$('logout').onclick = () => { if (window.confirm('로그아웃할까요?')) { void cloudLogout(); cloudBadge(); $('settings').classList.add('hidden'); rememberLogin(null); showLogin(); } };
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
  { sel: '#merge', text: '조합 재료가 모이면 철학자 머리 위에 <b>✦</b>가 뜨고, 여기 <b>합성</b> 버튼이 결과 얼굴과 함께 반짝여요. 누르기만 하면 돼요!', pos: 'top' },
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
/** 난이도별 카드 기억 경험치 */
const XP_RATE: Record<string, number> = { easy: 0.2, normal: 0.5, hard: 0.8, immortal: 1, challenge: 1 };
function gainXp(id: string, rate: number): string {
  const xp = (progress.cardXp ??= {});
  xp[id] = (xp[id] ?? 0) + rate;
  let got = 0;
  while (xp[id] >= 1 - 1e-9) { xp[id] -= 1; got++; }
  xp[id] = Math.round(xp[id] * 100) / 100;
  if (got) { progress.cards[id] = (progress.cards[id] ?? 0) + got; if (!progress.seen.includes(id)) progress.seen.push(id); }
  const name = PHIL.get(id)!.name;
  return got ? `📈 ${name}의 기억이 또렷해졌다! 카드 +${got}장` : `📈 ${name}의 기억 +${Math.round(rate * 100)}% (${Math.round(xp[id] * 100)}%)`;
}
/** 시작 튜토리얼 뒤: 소크라테스가 화면을 하나씩 짚어 주며 이야기와 버튼을 설명 */
function playTour() {
  progress.tourDone = true; progress.tabTut = [...new Set([...(progress.tabTut ?? []), 'stages'])]; saveProgress(progress); // 홈 안내는 소크라테스가 했으니 홈 말풍선은 생략
  switchTab('stages');
  playDialogue([
    ['소크라테스', '자네에게 꼭 할 말이 있네. 델포이의 신탁이 이렇게 말했다더군.'],
    ['내레이션', '"시대마다 도그마를 뿜는 자들이 나타나리라. 기억을 지닌 이방인이 그들을 하나씩 논파하리라."'],
    ['나', '…기억을 지닌 이방인? 설마 저요?'],
    ['소크라테스', '자네 말고 누가 있겠나. 이제부터 시대를 거슬러 사건들을 지나가야 하네. 이 목록이 그 여정일세.', '#stages'],
    ['소크라테스', '각 사건에서 도그마를 논파하면 그 시대 사람들의 기억이 돌아오지. 다시 도전해도 그 사람의 기억이 조금씩 더 쌓인다네.', '.jnode.done, .jnode.now'],
    ['소크라테스', '머리가 굳으면 고민방으로 가게. 고민할수록 "고뇌"가 쌓이지. 가만히 둬도 조금씩 모인다네.', '[data-tab=room]'],
    ['소크라테스', '모은 고뇌로 잊었던 기억을 떠올릴 수 있네. 뽑기에서 "기억 떠올리기"를 해 보게.', '[data-tab=gacha]'],
    ['소크라테스', '되찾은 기억은 도감에 카드로 남는다네. 같은 기억이 쌓일수록 그 철학자는 강해지지.', '[data-tab=codex]'],
    ['소크라테스', '누가 누구로 이어지는지는 조합표에 다 적혀 있네. 막히면 펼쳐 보게.', '#open-recipes'],
    ['소크라테스', '자, 첫 사건일세. 밀레토스로 가 보게. 하늘의 해가 사라지고 있다는군.', '#j-go'],
  ], null, () => renderHome(), '고대', true);
}
/** 소환되는 흔함: 그리스 여섯 명 + 스토리에서 만난 동양의 셋 */
function summonPool(st?: StoryStage): string[] {
  if (QA_MODE) return [];
  const toIds = (names: Set<string>) => PHILOSOPHERS.filter((p) => p.tier === 1 && names.has(p.realName)).map((p) => p.id);
  if (st?.pool) return toIds(new Set(st.pool)); // 시작 튜토리얼은 판마다 정해진 철학자만
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
let storyChapter = -1;
/** 설정에서 '처음부터 튜토리얼'을 눌렀을 때 (이미 1장을 진행한 계정도 튜토리얼을 다시 열어 둔다) */
let replayTutorial = false;
function renderStory(box: HTMLElement) {
  // 시작 튜토리얼이 생기기 전에 이미 1장을 진행한 계정은 튜토리얼을 마친 것으로 본다
  if (!replayTutorial && (progress.storyCleared ?? []).some((id) => STORY_MAP.get(id)?.chapter) && !(progress.storyCleared ?? []).includes('A5')) {
    progress.storyCleared = [...new Set([...(progress.storyCleared ?? []), 'A1', 'A2', 'A3', 'A4', 'A5'])]; saveProgress(progress);
  }
  const done = progress.storyCleared ?? [];
  const next = STORY.find((x) => !done.includes(x.id) && storyOpen(x)) ?? null;
  const wrap = document.createElement('div');
  wrap.className = 'journey';
  // 아래에서 위로 올라가는 여정: 장마다 시대 배경 구역, 단계마다 길 위의 노드
  let html = '', k = 0;
  const chHtml: string[] = [];
  for (const ch of CHAPTERS) {
    const sts = STORY.filter((x) => x.chapter === ch.n);
    const chDone = sts.every((x) => done.includes(x.id));
    const chOpen = sts.some((x) => storyOpen(x));
    const mem = [...new Set(sts.flatMap((x) => x.memories))].slice(0, 4);
    const nodeList: string[] = [];
    sts.forEach((st, i) => {
      const open = storyOpen(st), cleared = done.includes(st.id), now = next?.id === st.id;
      const face = PHILOSOPHERS.find((p) => p.realName === st.memories[0])!;
      const side = ['c', 'r', 'c', 'l'][(k++) % 4];
      nodeList.unshift(`<div class="jnode ${side} ${cleared ? 'done' : now ? 'now' : open ? 'open' : 'lock'}" data-st="${st.id}">
        ${now ? `<div class="j-me"><img src="${portrait(face.id)}" alt=""><span class="j-hero"></span><em>여기!</em></div>` : ''}
        <button class="j-dot" ${open ? '' : 'disabled'} aria-label="${st.title}">${cleared ? `<img src="${portrait(face.id)}" alt=""><i class="j-star">★</i>` : open ? `<img src="${portrait(face.id)}" alt="">` : '<i class="j-lock">🔒</i>'}</button>
        <span class="j-name">${open ? st.title : '???'}</span><small class="j-num">${ch.n ? `${ch.n}-${i + 1}` : `튜토리얼 ${i + 1}`}</small></div>`);
    });
    const nodes = nodeList.join('');
    html += `<section class="jch ${chOpen ? '' : 'locked'}" style="--sky:url(${eraSky(ch.era)})">
      <div class="j-reward ${chDone ? 'got' : ''}"><div class="j-bubble">${chDone ? '<b>✓</b>' : '<b>🔒</b>'}<span>${mem.map((n) => { const p = PHILOSOPHERS.find((x) => x.realName === n); return p ? `<img src="${portrait(p.id)}" alt="">` : ''; }).join('')}</span><small>${chDone ? '돌아온 기억' : '장을 마치면 기억 회복'}</small></div></div>
      <div class="j-path">${nodes}</div>
      <div class="j-title"><small>${ch.n ? `제${ch.n}장 · ${ch.era}` : '시작 튜토리얼'}</small><b>${ch.title}</b></div></section>`;
    chHtml.unshift(html); html = '';
  }
  wrap.innerHTML = chHtml.join('');
  box.appendChild(wrap);
  wrap.onclick = (e) => {
    const n = (e.target as HTMLElement).closest('.jnode') as HTMLElement | null;
    if (!n || n.classList.contains('lock')) return;
    storyInfo(STORY_MAP.get(n.dataset.st!)!);
  };
  const bar = document.createElement('div');
  bar.className = 'j-bar';
  const n = done.length, total = STORY.length;
  bar.innerHTML = `<div class="j-prog"><small>여정 ${n}/${total}</small><i style="--v:${n / total}"></i>${n >= total ? '<small>완주! 위에서 난이도를 골라 본편에 도전하세요</small>' : ''}</div>
    <button id="j-go" class="chunky gold j-go" ${next ? '' : 'disabled'}><small>${next ? (next.chapter ? `${next.chapter}장 · ${next.when}` : '시작 튜토리얼') : ''}</small><b>${next ? `▶ ${next.title}` : '여정 완주'}</b></button>`;
  if (next) (bar.querySelector('#j-go') as HTMLButtonElement).onclick = () => startStory(next);
  box.appendChild(bar);
  if (STORY.filter((x) => x.chapter === 0).some((x) => !done.includes(x.id))) {
    const skip = document.createElement('button');
    skip.className = 'ghost small tut-skip-all';
    skip.textContent = '튜토리얼 건너뛰기 → 1장으로';
    skip.onclick = () => { if (!window.confirm('시작 튜토리얼을 건너뛸까요? 고대 철학자 여섯 명이 바로 열려요.')) return; progress.storyCleared = [...new Set([...(progress.storyCleared ?? []), ...STORY.filter((x) => x.chapter === 0).map((x) => x.id)])]; saveProgress(progress); renderHome(); };
    bar.appendChild(skip);
  }
  // 지금 위치로 스크롤
  requestAnimationFrame(() => {
    // 노드를 잇는 굽은 점선 길
    const base = wrap.getBoundingClientRect(), pts = [...wrap.querySelectorAll<HTMLElement>('.j-dot')].map((d) => { const r = d.getBoundingClientRect(); return [r.left + r.width / 2 - base.left, r.top + r.height / 2 - base.top + wrap.scrollTop]; });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'j-road'); svg.setAttribute('width', String(wrap.clientWidth)); svg.setAttribute('height', String(wrap.scrollHeight));
    const d = pts.map(([x, y], i) => i ? `Q ${(pts[i - 1][0] + x) / 2 + (i % 2 ? 30 : -30)} ${(pts[i - 1][1] + y) / 2} ${x} ${y}` : `M ${x} ${y}`).join(' ');
    svg.innerHTML = `<path d="${d}" stroke="#fffaf3" stroke-width="16" fill="none" stroke-linecap="round" opacity=".85"/><path d="${d}" stroke="#c9a27e" stroke-width="3.5" fill="none" stroke-dasharray="2 10" stroke-linecap="round"/>`;
    wrap.prepend(svg);
    const cur = wrap.querySelector('.jnode.now .j-dot') as HTMLElement | null;
    if (cur) wrap.scrollTop = cur.getBoundingClientRect().top - base.top + wrap.scrollTop - wrap.clientHeight * 0.5; else wrap.scrollTop = next ? wrap.scrollHeight : 0;
  });
}

function storyInfo(st: StoryStage) {
  const cleared = (progress.storyCleared ?? []).includes(st.id);
  const o = document.createElement('div');
  o.className = 'overlay';
  o.innerHTML = `<div class="pop j-info"><small class="hint">${st.when}</small><h2>${st.title}</h2>
    <div class="stage-info"><div>👑 보스 <b>${st.boss}</b> (${st.waves ?? STORY_WAVES}웨이브)</div>
    <div>🧠 돌아오는 기억: <b>${st.memories.map((n) => PHILOSOPHERS.find((p) => p.realName === n)!.name).join(', ')}</b></div>
    ${st.unlock?.length ? `<div>🎟 소환에 새로 등장: <b>${st.unlock.map((n) => PHILOSOPHERS.find((p) => p.realName === n)!.name).join(', ')}</b></div>` : ''}
    <div>🔓 조합 가능 등급: <b>${TIER_NAME[tierCap()]}</b>까지 (카드를 가진 철학자는 예외)</div></div>
    <div class="rd-btns"><button class="chunky blue j-x">닫기</button><button class="chunky gold j-s">${cleared ? '↻ 다시 도전' : '▶ 출발'}</button></div></div>`;
  o.onclick = (e) => { const el = e.target as HTMLElement; if (el === o || el.closest('.j-x')) o.remove(); else if (el.closest('.j-s')) { o.remove(); startStory(st); } };
  document.body.appendChild(o);
}

/** 대사 재생: 탭하면 글자가 다 나오고, 한 번 더 탭하면 다음 줄 */
function playDialogue(lines: Line[], st: StoryStage | null, done: () => void, era?: string, overBattle = false) {
  const ov = document.createElement('div');
  ov.className = `vn ${overBattle ? 'over' : ''}`;
  const bgEra = era ?? (st ? CHAPTERS.find((c) => c.n === st.chapter)!.era : '고대');
  ov.innerHTML = `<div class="vn-bg" style="background-image:url(${sceneArt(bgEra)})"></div>
    ${st ? `<div class="vn-title"><small>${st.when}</small><b>${st.title}</b></div>` : ''}
    <div class="vn-box"><img class="vn-face"><div class="vn-body"><b class="vn-name"></b><p class="vn-text"></p></div><span class="vn-next">▼</span></div>
    <button class="vn-skip">건너뛰기 ▶▶</button>`;
  document.body.appendChild(ov);
  const face = ov.querySelector('.vn-face') as HTMLImageElement, nameEl = ov.querySelector('.vn-name')!, textEl = ov.querySelector('.vn-text')!;
  let i = -1, full = '', shown = 0, timer = 0;
  const finish = () => { clearInterval(timer); ov.remove(); document.querySelectorAll('.tut-glow').forEach((e) => e.classList.remove('tut-glow')); done(); };
  const next = () => {
    i++;
    if (i >= lines.length) return finish();
    const [who, text] = lines[i];
    full = homage(text); shown = 0;
    const p = PHILOSOPHERS.find((x) => x.realName === who);
    ov.classList.toggle('narr', who === '내레이션');
    face.style.display = p || who === '나' ? '' : 'none';
    if (p) face.src = portrait(p.id); else if (who === '나') face.src = meFace();
    nameEl.textContent = who === '내레이션' ? '' : p ? p.name : who;
    document.querySelectorAll('.tut-glow').forEach((e) => e.classList.remove('tut-glow'));
    if (lines[i][2]) document.querySelector(lines[i][2]!)?.classList.add('tut-glow');
    ov.classList.toggle('qa', who.startsWith('💡') || who.startsWith('💬'));
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
function memoryReveal(ids: string[], st: StoryStage, newCap = 0, xpMsg = '') {
  const ov = document.createElement('div');
  ov.className = 'overlay memory';
  ov.innerHTML = `<div class="pop"><h2>🧠 기억이 돌아왔다</h2><p class="hint">${st.title}의 기억 · 카드 ${ids.length}장</p>
    <div class="mem-cards">${ids.map((id) => tcgCard(id)).join('')}</div>
    ${xpMsg ? `<p class="xp-msg">${xpMsg}</p>` : ''}
    ${newCap ? `<p class="cap-up">✨ 기억이 돌아왔다! 이제 <b>${TIER_NAME[newCap]}</b>까지 조합할 수 있어요.</p>` : ''}
    ${st.unlock?.length ? `<p>🎟 이제 소환에서 <b>${st.unlock.map((n) => PHILOSOPHERS.find((p) => p.realName === n)!.name).join(', ')}</b>도 나와요!</p>` : ''}
    <button class="primary chunky gold close">계속</button></div>`;
  ov.onclick = (e) => { if ((e.target as HTMLElement).classList.contains('close')) { ov.remove(); storyChapter = -1; renderHome(); if (st.id === 'A5' && !progress.tourDone) { pendingNextStory = null; setTimeout(playTour, 300); } else if (pendingNextStory && storyOpen(pendingNextStory)) { const n = pendingNextStory; pendingNextStory = null; setTimeout(() => startStory(n), 200); } else pendingNextStory = null; } };
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
    [300, () => say('…퇴근하고 소파에서 철학책을 펼쳤다. 몇 장 넘기다 책을 베고 깜빡 잠이 들었다.')],
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
      ['내레이션', '먼저 이 광장에서 기억을 떠올리는 연습부터 해 보자. 「아고라 광장」 다섯 단계를 지나면 진짜 이야기가 시작된다.'],
    ], null, () => { renderHome(); }, '고대');
  };
  (ov.querySelector('.vn-skip') as HTMLElement).onclick = end;
  timers.push(window.setTimeout(end, 12600));
}
(window as unknown as { __g: () => Game | null }).__g = () => game; // 테스트용 훅
(window as unknown as { __phil: unknown }).__phil = PHIL;
(window as unknown as { __start: (era: string) => void }).__start = (era) => startBattle(STAGES.find((x) => x.era === era) ?? STAGES[0]);

// ---------- ⚙️ 설정 시트 ----------
$('open-settings').onclick = () => { sfx.click(); $('settings').classList.remove('hidden'); cloudBadge(); if (me && lastPw && cloudState !== 'ok') void syncCloud(me.id, lastPw); };
$('close-settings').onclick = () => $('settings').classList.add('hidden');
$('settings').onclick = (e) => { if (e.target === $('settings')) $('settings').classList.add('hidden'); };

// 처음부터 튜토리얼: 오프닝 → 아고라 광장 5단계 → 소크라테스 안내를 다시 진행 (카드·재화 등 다른 진행은 그대로)
$('replay-start').onclick = () => {
  if (!window.confirm('오프닝부터 시작 튜토리얼을 다시 진행할까요?\n카드·재화·스토리 기록은 그대로 남아요.')) return;
  $('settings').classList.add('hidden');
  const tut = STORY.filter((x) => x.chapter === 0).map((x) => x.id);
  progress.storyCleared = (progress.storyCleared ?? []).filter((id) => !tut.includes(id));
  progress.prologueDone = false; progress.tourDone = false; progress.battleTutDone = false; progress.tabTut = [];
  replayTutorial = true;
  saveProgress(progress);
  storyChapter = 0; diffId = 'easy';
  switchTab('stages');
  playPrologue();
};


// =============== 결과 화면: 보상 · 📺2배 · ▶다음 (한 판 더 하게 만드는 동선) ===============
/** 시대 전환 연출: 시대 화풍이 종이처럼 쓸고 지나가며 이름이 뜬다 */
const ERA_LABEL: Record<string, string> = { 고대: '고대 · 그리스', 중세: '중세 · 신앙의 시대', 동양: '동양 · 백가쟁명', 근대: '근대 · 이성의 시대', 현대: '현대 · 언어와 실존' };
let lastEra = '';
function eraWipe(era: string, title: string, when: string) {
  const changed = era !== lastEra; lastEra = era;
  const ov = document.createElement('div');
  ov.className = `era-wipe ${changed ? 'big' : ''} era-${era}`;
  ov.innerHTML = `<div class="ew-art" style="background-image:url(${eraSky(era)})"></div><div class="ew-text">${changed ? `<small>${ERA_LABEL[era] ?? era}</small>` : ''}<b>${title}</b>${when ? `<em>${when}</em>` : ''}</div>`;
  document.body.appendChild(ov);
  setTimeout(() => ov.remove(), changed ? 2100 : 1500);
}

function resultPanel(g: Game, html: string) {
  const base: { gonoe?: number; gems?: number } = g.raid ? raidReward(g.raidDamage) : { gonoe: Math.round(battleReward(g.wave, g.over === 'win') * g.diff.reward) };
  const win = g.over === 'win';
  const story = g.storyId ? STORY_MAP.get(g.storyId) : undefined;
  const nextLabel = g.raid ? '' : story ? (win || story.chapter === 0 ? '▶ 다음 이야기' : '↻ 다시 도전') : g.oneTool ? '' : win ? '▶ 다음 스테이지' : '↻ 다시 도전';
  const ov = document.createElement('div');
  ov.className = 'overlay result';
  const mvp = [...g.towers].sort((a, b) => PHIL.get(b.philId)!.tier - PHIL.get(a.philId)!.tier)[0];
  const hero = mvp ? `<div class="res-hero ${win ? 'win' : 'lose'}" style="background-image:url(${eraSky(g.stage.era)})">
      ${win ? '<i class="cf"></i><i class="cf"></i><i class="cf"></i><i class="cf"></i><i class="cf"></i><i class="cf"></i>' : ''}
      <img src="${heroPortrait(mvp.philId)}" alt=""><span class="res-ribbon">${win ? '논파 성공' : g.raid ? '레이드 종료' : '다음엔 꼭'}</span><span class="res-mvp">MVP · ${shortName(PHIL.get(mvp.philId)!.name)}</span></div>` : '';
  ov.innerHTML = `<div class="pop">${hero}${html}
    <div class="res-reward">🎁 보상 <b>${rewardText(base)}</b></div>
    <button class="chunky pink res-double">${adFree(progress) ? '✨ 보상 2배 받기 (광고 제거)' : `📺 광고 보고 보상 2배 (오늘 ${adsLeft(progress)}회)`}</button>
    <div class="res-btns"><button class="chunky blue res-home">🏠 홈</button>${nextLabel ? `<button class="chunky gold res-next">${nextLabel}</button>` : ''}</div>
    ${claimable(progress) ? `<p class="hint">📋 받을 수 있는 임무 보상이 있어요!</p>` : ''}</div>`;
  document.body.appendChild(ov);
  let double = false;
  const dbl = ov.querySelector('.res-double') as HTMLButtonElement;
  if (!adFree(progress) && adsLeft(progress) <= 0) dbl.disabled = true;
  dbl.onclick = () => watchAd(() => { double = true; dbl.disabled = true; dbl.textContent = '✅ 보상 2배 적용!'; (ov.querySelector('.res-reward b') as HTMLElement).textContent = rewardText({ gonoe: (base.gonoe ?? 0) * 2, gems: (base.gems ?? 0) * 2 }); });
  (ov.querySelector('.res-home') as HTMLElement).onclick = () => { ov.remove(); endBattle({ double }); };
  const nx = ov.querySelector('.res-next') as HTMLElement | null;
  if (nx) nx.onclick = () => { ov.remove(); endBattle({ double, next: true }); };
}

/** 광고(시험판): 광고 제거·패스가 있으면 바로, 없으면 3초 광고 화면 뒤 보상 */
function watchAd(done: () => void) {
  if (adFree(progress)) { done(); return; }
  if (adsLeft(progress) <= 0) { toast('오늘 볼 수 있는 광고를 다 봤어요'); return; }
  const ov = document.createElement('div');
  ov.className = 'ad-mock';
  ov.innerHTML = `<div class="ad-box"><small>광고 · 시험판 예시</small><b>🏛 여기에 광고가 나와요</b><p class="ad-count">3</p><p class="hint">광고 제거 상품을 사면 이 화면 없이 바로 보상을 받아요</p></div>`;
  document.body.appendChild(ov);
  let n = 3;
  const t = window.setInterval(() => { n--; (ov.querySelector('.ad-count') as HTMLElement).textContent = String(n); if (n <= 0) { clearInterval(t); ov.remove(); useAd(progress); saveProgress(progress); done(); } }, 1000);
}

// =============== 👑 보스 레이드: 하루 3번, 90초 동안 거대 보스에게 준 피해로 보상 ===============
const RAID_TIERS = [20_000, 100_000, 300_000, 1_000_000, 3_000_000];
const RAID_GONOE = [300, 1000, 2500, 5000, 9000, 15000];
const RAID_GEMS = [0, 10, 20, 40, 70, 120];
const raidTier = (d: number) => RAID_TIERS.filter((t) => d >= t).length;
function raidReward(d: number) { const k = raidTier(d); return { gonoe: RAID_GONOE[k], gems: RAID_GEMS[k] }; }
function raidTierText(d: number) {
  const k = raidTier(d);
  return `등급 <b>${['🥉 입문', '🥈 수련', '🥇 숙련', '🏅 대가', '👑 현자', '✨ 전설'][k]}</b>${k < RAID_TIERS.length ? ` · 다음 등급까지 ${(RAID_TIERS[k] - Math.round(d)).toLocaleString()}` : ''}`;
}
/** 요일마다 바뀌는 레이드 보스 */
function raidBoss() { const s = STAGES[new Date().getDay() % STAGES.length]; return { stage: s, name: `${s.boss20}` }; }
function startRaid() {
  const d = daily(progress);
  if (!QA_MODE && d.raidsLeft <= 0) { toast('오늘 레이드 도전을 다 썼어요. 내일 다시!'); return; }
  if (!QA_MODE) { d.raidsLeft--; saveProgress(progress); }
  const { stage, name } = raidBoss();
  startBattle(stage);
  if (!game) return;
  game.raid = { hp: 50_000_000, time: 90, name };
  game.gold = me?.role === 'master' ? 10000 : 1500;
  game.tickets = 15;
  game.storyId = undefined;
  alertBox(`<h2>👑 보스 레이드</h2><p>오늘의 보스: <b>${name}</b></p><p>골드 1,500과 무료 소환권 15장으로 진형을 짜고 <b>레이드 시작</b>을 누르세요.<br>90초 동안 준 피해만큼 보상을 받아요. 멘탈은 깎이지 않아요.</p><p class="hint">최고 기록 ${(progress.raidBest ?? 0).toLocaleString()}</p>`);
}

// =============== 📋 오늘의 할 일: 출석 · 구독 패스 · 일일 임무 ===============
function missionsPanel() {
  const d = daily(progress);
  const streak = attendStreak(progress);
  const dayIdx = canAttend(progress) ? streak % 7 : (streak - 1 + 7) % 7;
  const ov = document.createElement('div');
  ov.className = 'overlay missions-ov';
  const allDone = MISSIONS.every((m) => d.claimed.includes(m.id));
  ov.innerHTML = `<div class="pop"><h2>📋 오늘의 할 일</h2>
    <div class="attend"><b>출석 ${canAttend(progress) ? '' : '✅'}</b><div class="att-row">${ATTEND.map((r, i) => `<span class="${i < dayIdx || (!canAttend(progress) && i === dayIdx) ? 'got' : i === dayIdx && canAttend(progress) ? 'today' : ''}"><small>${i + 1}일</small>${rewardText(r)}</span>`).join('')}</div>
      ${canAttend(progress) ? '<button class="chunky gold" data-act="attend">출석 보상 받기</button>' : ''}</div>
    ${passOn(progress) ? `<div class="pass-box">📜 구독 패스 (${passDaysLeft(progress)}일 남음) · 매일 ${rewardText(PASS_DAILY)} ${d.day && progress ? '' : ''}<button class="chunky pink" data-act="pass" ${claimPassOk() ? '' : 'disabled'}>${claimPassOk() ? '받기' : '받음'}</button></div>` : '<div class="pass-box off">📜 구독 패스가 있으면 매일 💎50 + 🤔2,000, 광고 제거, 고뇌 2배 <button class="chunky blue" data-act="shop">보러 가기</button></div>'}
    <div class="m-list">${MISSIONS.map((m) => { const c = Math.min(d.count[m.key], m.goal), got = d.claimed.includes(m.id); return `<div class="m-row ${got ? 'got' : missionDone(progress, m) ? 'ready' : ''}"><div><b>${m.text}</b><small>${c}/${m.goal} · ${rewardText(m.reward)}</small><i class="bar"><i style="width:${(c / m.goal) * 100}%"></i></i></div><button class="chunky ${got ? '' : 'gold'}" data-m="${m.id}" ${got || !missionDone(progress, m) ? 'disabled' : ''}>${got ? '완료' : '받기'}</button></div>`; }).join('')}
      <div class="m-row all ${d.claimed.includes('all') ? 'got' : allDone ? 'ready' : ''}"><div><b>🎉 오늘 임무 모두 완료</b><small>${rewardText(ALL_CLEAR)}</small></div><button class="chunky gold" data-m="all" ${allDone && !d.claimed.includes('all') ? '' : 'disabled'}>${d.claimed.includes('all') ? '완료' : '받기'}</button></div></div>
    <button class="primary chunky blue close">닫기</button></div>`;
  ov.onclick = (e) => {
    const el = e.target as HTMLElement;
    if (el === ov || el.classList.contains('close')) { ov.remove(); renderHome(); return; }
    let r = null;
    if (el.dataset.act === 'attend') r = attend(progress);
    if (el.dataset.act === 'pass') r = claimPass(progress);
    if (el.dataset.act === 'shop') { ov.remove(); switchTab('shop'); return; }
    if (el.dataset.m) r = claimMission(progress, el.dataset.m);
    if (r) { saveProgress(progress); refreshWallet(); sfx.reveal(5); toast(`🎁 ${rewardText(r)}`); ov.remove(); missionsPanel(); }
  };
  document.body.appendChild(ov);
}
const claimPassOk = () => passOn(progress) && claimable(progress) >= 0 && (progress as unknown as { sub?: { passDay?: string } }).sub?.passDay !== daily(progress).day;

/** 탭 빨간 점: 할 일이 있는 곳을 알려 준다 */
function refreshBadges() {
  const set = (tab: string, on: boolean) => document.querySelector(`#tabs [data-tab=${tab}]`)?.classList.toggle('badge-on', on);
  set('stages', claimable(progress) > 0);
  set('gacha', progress.gonoe >= CARD_COST);
  set('room', progress.gonoe >= tapUpgradeCost(progress));
}
setInterval(() => { if (me) refreshBadges(); }, 1500);

// ---------- 회원가입 (서버 계정) ----------
$('signup').onclick = async () => {
  const id = $<HTMLInputElement>('login-id').value.trim(), pw = $<HTMLInputElement>('login-pw').value;
  const err = $('login-err');
  if (!/^[a-zA-Z0-9]{3,12}$/.test(id)) { err.textContent = '아이디는 영문·숫자 3~12자로 만들어 주세요'; shakeEl($('login-card')); return; }
  if (pw.length < 4) { err.textContent = '비밀번호는 4자 이상이에요'; shakeEl($('login-card')); return; }
  if (ACCOUNTS.some((a) => a.id === id.toLowerCase())) { err.textContent = '이미 쓰고 있는 아이디예요'; return; }
  err.textContent = '☁️ 가입 중…';
  const r = await cloudSignUp(id, pw);
  if (!r.ok) { err.textContent = r.msg; shakeEl($('login-card')); return; }
  err.textContent = '';
  sfx.reveal(5);
  lastPw = pw;
  enter({ id, hash: '', role: 'fresh', label: '일반 계정' });
  void syncCloud(id, pw);
};
