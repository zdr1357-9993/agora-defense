import { PHIL, PHILOSOPHERS, gradeRank, gradeLabel, homage } from '../data';
import { gachaLayout } from '../gacha-layout';
import { iconHtml, artUrl } from '../artwork';
import { pull, canAfford, PULLS, CUR_ICON, PITY_LIMIT, CARD_RATES, type PullOption } from '../meta';
import { bump } from '../live';
import { CARD_MAX_LEVEL, CARD_ATK_PER_LEVEL, AWAKEN_MAX, AWAKEN_EVERY, cardLevel, saveProgress } from '../save';
import { ITEMS } from '../items';
import { sfx } from '../sfx';
import { $ } from '../ui/dom';
import { itemUrl } from '../ui/sprites';
import { alertBox } from '../ui/overlay';
import { refreshWallet } from '../ui/wallet';
import { progress } from '../state/progress';

let pedArt!: (id: string) => string;
let openEras!: () => Set<string>;
/** main.ts 에 남아 있는 pedArt(전투 도트 캐시)·openEras(스토리 진행)를 시작 때 한 번 넘겨받는다. */
export function initGacha(deps: { pedArt(id: string): string; openEras(): Set<string> }) { pedArt = deps.pedArt; openEras = deps.openEras; }

// ---------- 뽑기 ----------
function pullBtn(id: string, cls: string) {
  const o = PULLS.find((x) => x.id === id)!;
  return `<button class="chunky ${cls}" data-pull="${id}">${o.label}<small>${CUR_ICON[o.currency]} ${o.cost.toLocaleString()}</small></button>`;
}
export function renderGacha() {
  const rates = CARD_RATES.map((r) => `<span class="tier-chip t${r.tier}">${gradeLabel(r)} ${(r.rate * 100).toFixed(2)}%</span>`).join(' ');
  $('tab-gacha').innerHTML = `
    <div class="gacha-box master-box">
      <div class="gb-head"><h2>${iconHtml('gacha')} 거장 초대</h2><button class="info-btn" aria-label="거장 초대 안내" data-ginfo="m">i</button></div>
      <div class="banner-art" style="background-image:url(${artUrl('memory-banner')})">${PHILOSOPHERS.filter((p) => p.tier === 7 && !p.hidden).map((p) => `<img src="${pedArt(p.id)}">`).join('')}</div>
      <div class="row">${pullBtn('m10', 'gold')}${pullBtn('m1', 'pink')}</div>
    </div>
    <div class="gacha-box card-box">
      <div class="gb-head"><h2>${iconHtml('codex')} 기억 떠올리기</h2><button class="info-btn" aria-label="기억 떠올리기 안내" data-ginfo="c">i</button></div>
      <div class="row">${pullBtn('c1', 'pink')}${pullBtn('c10', 'gold')}${pullBtn('c10g', 'blue')}</div>
    </div>
    <div class="gacha-box tool-box">
      <div class="gb-head"><h2>🧰 도구 상자</h2><button class="info-btn" aria-label="도구 상자 안내" data-ginfo="t">i</button></div>
      <div class="row">${pullBtn('t1', 'mint')}${pullBtn('t10', 'gold')}${pullBtn('t10g', 'blue')}</div>
    </div>`;
  const INFO: Record<string, string> = {
    m: `<h2>${iconHtml('gacha')} 거장 초대</h2><p>💎 지혜석 10회 뽑기의 마지막 1장은 반드시 <b>거장 또는 근원</b>이에요.<br>🎫 초대장 1장으로 거장 이상 1명을 바로 불러올 수도 있어요.</p>`,
    c: `<h2>${iconHtml('codex')} 기억 떠올리기</h2><p>고뇌를 써서 잊어버린 철학자의 <b>기억(카드)</b>을 떠올려요. <b>거장·근원</b>은 카드가 있어야 전투에서 조합할 수 있어요. 고뇌 뽑기는 열린 시대 또는 이미 가진 카드에서 뽑아요. 지혜석·초대장은 모든 시대에서 뽑아요 (지금: ${[...openEras()].join(', ')}).</p><p>같은 카드가 모이면 레벨업(Lv.${CARD_MAX_LEVEL}까지) · 레벨당 공격력 +${CARD_ATK_PER_LEVEL * 100}%<br>그 뒤 ${AWAKEN_EVERY}장마다 <b>각성</b>(최대 ${AWAKEN_MAX}단계): 공격력 +15%, 스킬 강화<br>레벨이 오르면 일화가 열려요.</p><p class="hint">아래는 전체 등급 기본 확률이에요. 고뇌 뽑기는 열린 등급끼리 합계 100%로 다시 나눠요.</p><div class="rates-line">${rates}</div><p><b>천장</b>: 거장 이상이 안 나와도 ${PITY_LIMIT}회째엔 확정 (열린 거장 등급이 없으면 모든 시대에서 해금) · 지금 ${PITY_LIMIT - progress.pity}회 남음</p>`,
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

/** A rare result takes center stage once; the rest stay visible together. */
function gachaShow(o: PullOption, got: string[], before: Record<string, number>) {
  if (!got.length) return;
  const isTool = o.kind === 'tool';
  const tiers = got.map(id => isTool ? 3 : gradeRank(PHIL.get(id)!));
  const { top, hero, rest } = gachaLayout(tiers, isTool);
  const rare = hero >= 0, multiple = got.length > 1;
  const ov = document.createElement('div');
  ov.className = `gacha-stage memory-reveal result-board ${rare ? 'has-spotlight' : 'ordinary-results'} rarity-${Math.floor(top)}`;
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', '뽑기 결과');
  const previousFocus = document.activeElement as HTMLElement | null;
  ov.innerHTML = `<header class="memory-caption"><small>아고라 기억 우체국</small><h2>${rare ? '잠깐, 묵직한 기억이 도착했어요' : '기억이 도착했어요'}</h2><p class="reveal-progress" aria-live="polite">${rare ? '리본이 풀리는 중…' : `${got.length}개의 결과를 모두 확인해 보세요`}</p></header>
    ${rare ? `<section class="memory-spotlight" aria-label="최고 등급 카드"><div class="spotlight-rays" aria-hidden="true"><i></i><i></i><i></i></div><div class="rare-card-back"><img src="${artUrl('memory-seal')}" alt="봉인된 기억"><b>어떤 철학자일까요?</b></div><div class="rare-card-front"></div></section>` : ''}
    <section class="result-rest"><p class="rest-caption">${rare && multiple ? '함께 도착한 나머지 기억' : '전체 결과'}</p><div class="cards ${!multiple ? 'single' : ''}"></div></section>
    <div class="g-actions"><button class="chunky blue skip ${rare ? '' : 'hidden'}">연출 건너뛰기</button><button class="chunky gold done ${rare ? 'hidden' : ''}">확인</button></div>`;
  document.body.appendChild(ov);
  const counted = { ...before };
  // Build in original draw order, so duplicate-card level changes remain correct.
  const cards = got.map((id, i) => {
    const el = document.createElement('div');
    el.dataset.resultIndex = String(i);
    if (isTool) {
      const it = ITEMS.find(x => x.id === id)!;
      el.className = 'gcard tool';
      el.innerHTML = `<img src="${itemUrl(id)}"><b>${it.name}</b><small>${it.owners.map(x => homage(x).split(' ').pop()).join('·')}의 찰떡</small>`;
    } else {
      const p = PHIL.get(id)!, prev = cardLevel(counted[id] ?? 0);
      counted[id] = (counted[id] ?? 0) + 1;
      const now = cardLevel(counted[id]);
      const tag = prev === 0 ? '<i class="new">NEW</i>' : now > prev ? `<i class="lvup">Lv.${now}!</i>` : '';
      el.className = `gcard t${Math.floor(tiers[i])} ${i === hero ? 'spotlight-card' : ''}`;
      el.innerHTML = `${tag}<img src="${pedArt(id)}"><b>${p.name}</b><small>${gradeLabel(p)}</small>`;
    }
    return el;
  });
  const grid = ov.querySelector('.cards')!;
  for (const i of rest) grid.appendChild(cards[i]);
  if (rare) ov.querySelector('.rare-card-front')!.appendChild(cards[hero]);
  if (rare && !multiple) ov.querySelector('.result-rest')!.classList.add('hidden');
  let timer = 0, revealed = !rare, closed = false;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const skip = ov.querySelector<HTMLButtonElement>('.skip')!, done = ov.querySelector<HTMLButtonElement>('.done')!;
  const reveal = (animate: boolean) => {
    if (revealed || closed) return;
    revealed = true; window.clearTimeout(timer);
    ov.classList.add('results-ready'); ov.classList.toggle('instant-reveal', !animate);
    ov.querySelector('h2')!.textContent = `${gradeLabel(PHIL.get(got[hero])!)}의 기억을 찾았어요!`;
    ov.querySelector('.reveal-progress')!.textContent = multiple ? `최고 등급 1장과 나머지 ${rest.length}장 · 총 ${got.length}장` : '소중한 기억이 한 장 더해졌어요';
    skip.classList.add('hidden'); done.classList.remove('hidden'); done.focus();
    if (animate) sfx.reveal(Math.floor(top) - 1);
  };
  skip.onclick = () => reveal(false);
  done.onclick = () => {
    if (closed) return; closed = true; window.clearTimeout(timer); ov.remove(); renderGacha();
    if (previousFocus?.isConnected) previousFocus.focus(); else $('tab-gacha').querySelector<HTMLButtonElement>('button')?.focus();
  };
  ov.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); if (!revealed) reveal(false); else done.click(); }
    if (event.key === 'Tab') { event.preventDefault(); (revealed ? done : skip).focus(); }
  });
  if (rare) {
    skip.focus(); sfx.drumroll(.6);
    timer = window.setTimeout(() => reveal(!reduced), reduced ? 0 : top >= 7 ? 1300 : top >= 6 ? 1050 : 800);
  } else { ov.classList.add('results-ready'); done.focus(); sfx.reveal(1); }
}
