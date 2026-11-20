import { PHIL, PHILOSOPHERS, RECIPES, ARCHIVED_PHILOSOPHERS, GRADE_STEPS, gradeRank, gradeCode, gradeAt, gradeLabel, materialGroups, homage, statsOf, TYPE_ICON, CAT_ICON, ERA_ICON } from '../data';
import { QA_MODE } from '../game';
import { journeyArt } from '../pastel-art';
import { canWearSkin } from '../ui-policy';
import { ITEMS, isOwner } from '../items';
import { LINES, UNLOCK_LEVELS } from '../lines';
import { SKINS } from '../sprites';
import { sfx } from '../sfx';
import { saveProgress, cardLevel, cardMult, nextLevelAt, awakenLevel, CARD_MAX_LEVEL, AWAKEN_MAX } from '../save';
import { $ } from '../ui/dom';
import { portrait, itemUrl } from '../ui/sprites';
import { toast, alertBox } from '../ui/overlay';
import { refreshWallet } from '../ui/wallet';
import { progress } from '../state/progress';
import { isAdmin } from '../state/account';
import { openTcg } from './tcg';
import { setRoomThinker } from './room';

// =============== 도감 ===============
let codexTier = 1;
export function renderCodex() {
  const box = $('codex-list');
  box.innerHTML = '';
  const seen = new Set(progress.seen);
  $('codex-count').textContent = `${PHILOSOPHERS.filter((p) => seen.has(p.id)).length} / ${PHILOSOPHERS.length}`;
  // 등급 탭: 한 번에 한 등급만 (스크롤 없이)
  const tabs = document.createElement('div');
  tabs.className = 'codex-tabs';
  tabs.innerHTML = GRADE_STEPS.map(t=>`<button class="tier-chip t${Math.floor(t)} ${t===codexTier?'on':''}" data-ct="${t}">${gradeCode(gradeAt(t))}</button>`).join('');
  box.appendChild(tabs);
  for (const b of tabs.querySelectorAll<HTMLButtonElement>('[data-ct]')) b.onclick = () => { codexTier = Number(b.dataset.ct); renderCodex(); };
  const grid = document.createElement('div');
  grid.className = 'codex-grid';
  for (const p of PHILOSOPHERS.filter((x) => gradeRank(x) === codexTier)) {
    const known = seen.has(p.id) || !!progress.cards[p.id] || (isAdmin() || (QA_MODE && !p.hidden));
    const n = progress.cards[p.id] ?? 0, lv = cardLevel(n);
    const d = document.createElement('div');
    d.className = `card t${p.tier} ${known ? '' : 'unknown'} ${n ? 'owned' : ''}`;
    d.innerHTML = `${progress.favorite === p.id ? '<span class="fav">💗</span>' : ''}${lv ? `<span class="lv ${awakenLevel(n) ? 'aw' : ''}">${awakenLevel(n) ? '✦' + awakenLevel(n) : 'Lv.' + lv}</span>` : ''}<img src="${portrait(p.id)}"><b>${known ? p.name : '???'}</b>`;
    if (known) d.onclick = () => openTcg(p.id);
    grid.appendChild(d);
  }
  box.appendChild(grid);
  const archived=ARCHIVED_PHILOSOPHERS.filter(p=>(progress.cards[p.id]??0)>0);
  if(archived.length){
    const archive=document.createElement('details'); archive.className='collection-archive';
    archive.innerHTML=`<summary>이전 카드 보관함 · ${archived.length}종</summary><p>이전 버전의 카드·경험치·장착·스킨 기록은 그대로 보존돼요. 현재 소환과 조합에는 사용하지 않아요.</p>${archived.map(p=>`<div><b>${homage(p.name)}</b><span>${progress.cards[p.id]}장 · Lv.${cardLevel(progress.cards[p.id])}</span></div>`).join('')}`;
    box.appendChild(archive);
  }
}

function cardHtml(id: string) {
  const p = PHIL.get(id)!;
  const recipes = RECIPES.filter((r) => r.result === id);
  const st = statsOf(id);
  const bar = (v: number, max: number) => `<span class="sbar"><i style="width:${Math.min(100, (v / max) * 100)}%"></i></span>`;
  return `<div class="pcard tc${p.tier}">
    <div class="pc-head"><span class="pc-tier tier-chip t${p.tier}">${gradeLabel(p)}</span><b>${p.name}</b><span class="pc-era">${ERA_ICON[p.era] ?? ''} ${p.era} · ${p.school}</span></div>
    <div class="pc-art" style="background-color:#f5f0e7;background-image:url('${journeyArt(p.era)}')"><img src="${portrait(id)}"></div>
    <div class="pc-quote">“${p.quote}”</div>
    <div class="pc-skill"><b>✦ ${p.skill}</b><span>${p.skillDesc}</span></div>
    <div class="pc-combat"><b>${TYPE_ICON[st.type]} ${st.type}</b> · 노리는 대상 <b>${st.target}</b><small>${st.note}</small></div>
    <details class="card-section"><summary>전투 능력치 자세히 보기</summary><div class="pc-stats2">
      <div>⚔ 위력 ${bar(st.dmg, 1800)}<em>${Math.round(st.dmg)}</em></div>
      <div>◎ 사거리 ${bar(st.range, 3.5)}<em>${st.range}칸</em></div>
      <div>⏱ 공속 ${bar(1 / st.cooldown, 2.2)}<em>${(1 / st.cooldown).toFixed(2)}/초</em></div>
      <div>📈 초당 피해 ${bar(st.dmg / st.cooldown, 3200)}<em>${Math.round(st.dmg / st.cooldown)}</em></div>
    </div></details>
    <div class="pc-lore">${p.lore}</div>
    ${recipes.length ? `<details class="card-section"><summary>만드는 방법 · 조합 ${recipes.length}개</summary>${recipes.map((r) => `<div class="pc-recipe">⚗ ${materialGroups(r.materials).map(({id,count})=>PHIL.get(id)!.name+(count>1 ? ' ×'+count : '')).join(' + ')}${r.catalyst ? ' + ' + CAT_ICON[r.catalyst] : ''}<small>${r.logic}</small></div>`).join('')}</details>` : '<p class="hint">기본 소환으로 만나는 철학자예요.</p>'}
    <div class="pc-foot">AGORA · ${gradeLabel(p)}</div>
  </div>`;
}
export function showCard(id: string) {
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
    ${n && canWearSkin(p.tier) ? `<div class="pc-skins"><b>👗 스킨</b>${Object.entries(SKINS).map(([k, s]) => {
      const own = progress.skins.includes(id + ':' + k), on = progress.skinOn[id] === k;
      return `<button data-skin="${k}" class="${on ? 'on' : ''}">${s.icon} ${s.name}${on ? ' (착용 중)' : own ? '' : ' · 💎' + s.price}</button>`;
    }).join('')}${progress.skinOn[id] ? '<button data-skin="">기본 모습</button>' : ''}</div>` : ''}
    ${n && !canWearSkin(p.tier) ? '<p class="skin-lock-note">스킨은 거장·근원 철학자부터 착용할 수 있어요.</p>' : ''}
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
    if (!canWearSkin(p.tier)) { toast('스킨은 거장 이상부터 열려요'); return; }
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
    if (progress.favorite === id) delete progress.favorite; else { progress.favorite = id; setRoomThinker(id); sfx.reveal(5); }
    saveProgress(progress); document.querySelector('.overlay')?.remove(); renderCodex(); showCard(id);
  };
}
