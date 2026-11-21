import { PHIL, PHILOSOPHERS, RECIPES, SUMMON_RATES, GRADE_STEPS, gradeRank, gradeCode, gradeAt, gradeLabel, materialGroups, CAT_ICON, CAT_NAME, type Recipe } from '../data';
import { QA_MODE, type Game } from '../game';
import { saveProgress } from '../save';
import { alertBox } from '../ui/overlay';
import { portrait } from '../ui/sprites';
import { progress } from '../state/progress';

interface RecipeDeps { game(): Game | null; lockReason(r: { result: string; logic: string }): string; doMerge(r: Recipe): void; resetSynthKey(): void; shortName(name: string): string; pedArt(id: string): string; summonPool(): string[]; }
let deps!: RecipeDeps;
/** 전투 상태(game)·조합 실행·도트 캐시는 main.ts 에 남아 있어서 시작 때 한 번 넘겨받는다. */
export function initRecipes(d: RecipeDeps) { deps = d; }

// ---------- 조합표 · 확률표 ----------
let recipeQuery='', recipeTier=0;
export function recipeSheet(filter: 'all' | 'ready' | 'liked' = 'all') {
  const g = deps.game();
  const liked = new Set(progress.likedRecipes ?? []);
  const canNow = (r: Recipe) => !!g && g.ownedMaterials(r).every(Boolean) && g.hasCatalyst(r) && !g.isLocked(r);
  const all = RECIPES.filter((r) => !PHIL.get(r.result)!.hidden || progress.seen.includes(r.result) || QA_MODE);
  const rows = all.filter((r) => filter === 'all' || (filter === 'ready' ? canNow(r) : liked.has(r.id)))
    .sort((a, b) => Number(canNow(b)) - Number(canNow(a)) || Number(liked.has(b.id)) - Number(liked.has(a.id)) || gradeRank(PHIL.get(a.result)!) - gradeRank(PHIL.get(b.result)!));
  const face = (id: string, on: boolean, unknown = false, count = 1) => `<span class="rf t${PHIL.get(id)!.tier} ${on ? 'on' : ''} ${unknown ? 'unk' : ''}"><img src="${portrait(id)}" alt=""><small>${unknown ? '???' : deps.shortName(PHIL.get(id)!.name)}${count>1 ? ' ×'+count : ''}</small><i class="recipe-rank">${gradeCode(PHIL.get(id)!)}</i></span>`;
  const html = rows.map((r) => {
    const own = g ? g.ownedMaterials(r) : r.materials.map(() => false);
    const known = QA_MODE || progress.seen.includes(r.result) || !PHIL.get(r.result)!.hidden;
    const cat = r.catalyst ? `<b>+</b><span class="rf cat ${g && g.catalysts[r.catalyst] ? 'on' : ''}"><i>${CAT_ICON[r.catalyst]}</i><small>촉매</small></span>` : '';
    return `<div class="req ${canNow(r) ? 'ready' : ''}" data-id="${r.id}" data-grade="${gradeRank(PHIL.get(r.result)!)}" data-search="${PHIL.get(r.result)!.name} ${PHIL.get(r.result)!.realName} ${r.materials.map(id=>PHIL.get(id)!.name+' '+PHIL.get(id)!.realName).join(' ')}">${liked.has(r.id) ? '<em class="hrt">💗</em>' : ''}
      ${materialGroups(r.materials).map(({id,count})=>face(id,!!g && g.towers.filter(t=>t.philId===id).length>=count,false,count)).join('<b>+</b>')}${cat}<b class="eq">=</b>${face(r.result, true, !known)}
      <button class="req-i" data-info="${r.id}" aria-label="상세">i</button></div>`;
  }).join('') || `<p class="hint" style="text-align:center">${filter === 'ready' ? '지금 바로 할 수 있는 조합이 없어요' : '💗 표시한 조합이 없어요'}</p>`;
  document.querySelector('.overlay.recipes')?.remove();
  const o = document.createElement('div');
  o.className = 'overlay recipes';
  o.innerHTML = `<div class="pop rsheet"><div class="rs-head"><h2>📜 조합표</h2><button class="rs-x" aria-label="닫기">✕</button></div>
    <div class="rs-tabs">${(['all', 'ready', 'liked'] as const).map((f) => `<button data-f="${f}" class="${f === filter ? 'on' : ''}">${{ all: `전체 ${all.length}`, ready: `지금 가능 ${all.filter(canNow).length}`, liked: `💗 목표 ${liked.size}` }[f]}</button>`).join('')}</div>
    <div class="recipe-filters"><label>찾기<input id="recipe-search" placeholder="철학자 이름 또는 재료"></label><label>완성 등급<select id="recipe-grade"><option value="0">모든 등급</option>${GRADE_STEPS.filter(t=>t>1).map(t=>`<option value="${t}">${gradeCode(gradeAt(t))}</option>`).join('')}</select></label></div><p class="hint rs-hint">진한 얼굴 = 재료 수량 충족 · ×숫자 = 필요한 인원 · +는 별도 조합 단계</p>
    <div class="rs-list">${html}</div></div>`;
  const search=o.querySelector<HTMLInputElement>('#recipe-search')!, grade=o.querySelector<HTMLSelectElement>('#recipe-grade')!;
  search.value=recipeQuery; grade.value=String(recipeTier);
  const applyFilters=()=>{for(const row of o.querySelectorAll<HTMLElement>('.req')) row.hidden=!!((recipeTier && Number(row.dataset.grade)!==recipeTier) || !(row.dataset.search??'').toLowerCase().includes(recipeQuery.toLowerCase().trim()));};
  search.oninput=()=>{recipeQuery=search.value;applyFilters();}; grade.onchange=()=>{recipeTier=Number(grade.value);applyFilters();};applyFilters();
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
  const g = deps.game(), res = PHIL.get(r.result)!;
  const known = QA_MODE || progress.seen.includes(res.id) || !res.hidden;
  const own = g ? g.ownedMaterials(r) : r.materials.map(() => false);
  const ready = !!g && own.every(Boolean) && g.hasCatalyst(r) && !g.isLocked(r);
  const liked = (progress.likedRecipes ?? []).includes(r.id);
  const o = document.createElement('div');
  o.className = 'overlay rdetail';
  o.innerHTML = `<div class="pop rd-pop t${res.tier}">
    <div class="rd-hero"><img src="${deps.pedArt(res.id)}" alt="" class="${known ? '' : 'unk'}"><div><span class="tier-chip t${res.tier}">${gradeLabel(res)}</span><h2>${known ? res.name : '??? (처음 조합하면 공개)'}</h2>${known ? `<p class="rd-skill"><b>✦ ${res.skill}</b> ${res.skillDesc}</p>` : ''}</div></div>
    <div class="rd-mats">${materialGroups(r.materials).map(({id,count})=>{const p=PHIL.get(id)!,have=g?g.towers.filter(t=>t.philId===id).length:0;return `<div class="${have>=count?'have':''}"><img src="${portrait(id)}" alt=""><b>${p.name} ×${count}</b><small>${gradeLabel(p)} · ${g?`보유 ${have}/${count}`:'필요 '+count+'명'}</small></div>`;}).join('')}
      ${r.catalyst ? `<div class="${g && g.catalysts[r.catalyst] ? 'have' : ''}"><i>${CAT_ICON[r.catalyst]}</i><b>촉매 ${CAT_NAME[r.catalyst]}</b><small>보유 ${g ? g.catalysts[r.catalyst] : 0}</small></div>` : ''}</div>
    <p class="recipe-cost">1성부터 모두 조합할 때: <b>${res.materialCost}명분</b> · 지금 필요한 직접 재료 ${r.materials.length}명</p>${res.origin?'<p class="hint">근원은 후대의 기억을 모아 원래 인물을 깨우는 특별 조합이에요.</p>':''}${r.logic ? `<p class="rd-logic">${r.provisional?'🧩 게임적 축약 · ':''}${r.logic}</p>` : ''}
    ${g && g.isLocked(r) ? `<p class="hint">🔒 ${deps.lockReason(r)}</p>` : ''}
    <div class="rd-btns"><button class="chunky rd-like">${liked ? '💔 목표 해제' : '💗 목표로 저장'}</button>${ready ? '<button class="chunky gold rd-go">⚗ 지금 조합</button>' : '<button class="chunky blue rd-back">← 목록</button>'}</div></div>`;
  o.onclick = (e) => {
    const el = e.target as HTMLElement;
    if (el === o || el.closest('.rd-back')) { o.remove(); return; }
    if (el.closest('.rd-like')) {
      const list = new Set(progress.likedRecipes ?? []);
      if (list.has(r.id)) list.delete(r.id); else list.add(r.id);
      progress.likedRecipes = [...list]; saveProgress(progress); deps.resetSynthKey();
      o.remove(); recipeSheet(back); return;
    }
    if (el.closest('.rd-go')) { o.remove(); document.querySelector('.overlay.recipes')?.remove(); deps.doMerge(r); }
  };
  document.body.appendChild(o);
}

export function rateSheet() {
 const ids=deps.summonPool(), pool=ids.length?PHILOSOPHERS.filter(p=>ids.includes(p.id)):PHILOSOPHERS;
 const bands=SUMMON_RATES.filter(r=>pool.some(p=>gradeRank(p)===gradeRank(r))), total=bands.reduce((n,r)=>n+r.rate,0);
 const rows=GRADE_STEPS.map(t=>{const r=bands.find(r=>gradeRank(r)===t);return `<tr><td><span class="tier-chip t${Math.floor(t)}">${gradeLabel(gradeAt(t))}</span></td><td>${PHILOSOPHERS.filter(p=>gradeRank(p)===t).length}명</td><td>${r?((r.rate/total)*100).toFixed(4)+'%':'기억 해금 필요'}</td></tr>`;}).join('');
 alertBox(`<h2>🎲 전투 소환과 등급</h2><p>기본 1성에 더해, <b>카드를 보유한 상위 철학자</b>도 낮은 확률로 등장해요. 열린 등급끼리 확률을 다시 나눠요. 해금한 근원은 첫 소환부터 등장할 수 있어요.</p><p class="hint">튜토리얼은 지정된 1성만 나와요. 3성+·4성+·5성+·6성+는 별도 조합 단계이며 전투 강화 +1과 달라요.</p><table class="rates"><tr><th>등급</th><th>전체 인원</th><th>현재 확률</th></tr>${rows}</table><p class="hint">카드 뽑기의 확률은 뽑기 화면의 안내에서 확인해요.</p>`);
}
