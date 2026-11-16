import { PHIL, PHILOSOPHERS, STAGES, gradeRank } from '../data';
import { iconHtml, artUrl } from '../artwork';
import { settleIdle, idleRate, tapGain, tapUpgradeCost } from '../meta';
import { bump, adFree, adsLeft, useAd } from '../live';
import { saveProgress } from '../save';
import { sfx } from '../sfx';
import { $ } from '../ui/dom';
import { portrait } from '../ui/sprites';
import { toast, alertBox } from '../ui/overlay';
import { refreshWallet } from '../ui/wallet';
import { progress } from '../state/progress';
import { watchAd } from './ad';

const clearedStages = () => STAGES.filter((s) => progress.cleared.includes(s.id)).length;

let roomThinker = 'T106';
export const setRoomThinker = (id: string) => { roomThinker = id; };
export function renderRoom() {
  const idle = settleIdle(progress, clearedStages());
  saveProgress(progress);
  if (progress.favorite && PHIL.has(progress.favorite) && progress.cards[progress.favorite]) roomThinker = progress.favorite;
  const owned = PHILOSOPHERS.filter((p) => progress.cards[p.id]);
  if ((!PHIL.has(roomThinker) || !progress.cards[roomThinker]) && owned.length) roomThinker = owned.sort((a, b) => gradeRank(b) - gradeRank(a))[0].id;
  const p = PHIL.get(roomThinker)!;
  const cost = tapUpgradeCost(progress);
  const rate = idleRate(progress, clearedStages());
  const next = { ...progress, tapLevel: progress.tapLevel + 1 };
  $('tab-room').innerHTML = `
    <div class="room">
      <div class="room-head"><h2>${iconHtml('room')} 고민방</h2><button class="info-btn" id="room-info" aria-label="고민방 안내">i</button></div>
      <div class="room-sky" style="background-image:url(${artUrl('room')})"><div class="room-bubble">“${p.quote}”</div>
        <button id="thinker" class="thinker t${p.tier}" aria-label="${p.name}와 고민하고 고뇌 얻기"><img src="${portrait(p.id)}" alt="${p.name}"></button>
        <div class="room-floor"></div></div>
      <div class="room-favorite"><small>${progress.favorite === p.id ? '💗 나의 최애 철학자' : '오늘의 고민 친구'}</small><b id="room-favorite-name">${p.name}</b></div>
      <label class="room-owner-select">함께 고민할 최애<select id="room-owner-select">${owned.map(o => `<option value="${o.id}" ${o.id === p.id ? 'selected' : ''}>${o.name}</option>`).join('')}</select></label>
      <div class="room-stat"><span>고뇌</span><b id="room-gonoe">${Math.floor(progress.gonoe).toLocaleString()}</b></div>
      <div class="room-rates"><span>👆 탭당 <b>+${tapGain(progress)}</b></span><span>⏳ 초당 <b>+${rate.toFixed(1)}</b></span></div>
      ${idle ? `<p class="hint">자리를 비운 사이 고뇌 <b>+${idle.toLocaleString()}</b></p>` : ''}
      <div class="room-owners">${[...owned].sort((a,b) => Number(b.id === p.id) - Number(a.id === p.id)).slice(0, 7).map((o) => `<button data-owner="${o.id}" aria-label="${o.name}를 고민방 주인으로 선택" aria-pressed="${o.id === roomThinker}" class="${o.id === roomThinker ? 'on' : ''}"><img src="${portrait(o.id)}"></button>`).join('')}</div>
      <button id="room-ad" class="chunky pink">${adFree(progress) ? '✨' : '📺'} 30분치 고뇌 바로 받기 <small>(+${Math.round(rate * 1800).toLocaleString()} · 오늘 ${adsLeft(progress)}회)</small></button>
      <button id="tap-up" class="chunky blue">💭 고민의 깊이 Lv.${progress.tapLevel + 1} → ${progress.tapLevel + 2}<small>탭 +${tapGain(progress)}→+${tapGain(next)} · 초당 ${rate.toFixed(1)}→${idleRate(next, clearedStages()).toFixed(1)} · 🤔${cost.toLocaleString()}</small></button>
    </div>`;
  const roomSelect = $('room-owner-select') as HTMLSelectElement;
  roomSelect.onchange = () => { roomThinker = roomSelect.value; progress.favorite = roomThinker; saveProgress(progress); renderRoom(); };
  for (const b of $('tab-room').querySelectorAll<HTMLButtonElement>('[data-owner]')) b.onclick = () => { roomThinker = b.dataset.owner!; progress.favorite = roomThinker; saveProgress(progress); sfx.click(); renderRoom(); }; // 고민방 주인 = 💗최애
  const ra = $<HTMLButtonElement>('room-ad');
  ra.disabled = adsLeft(progress) <= 0;
  ra.onclick = () => watchAd(() => { if (adFree(progress)) useAd(progress); progress.gonoe += Math.round(rate * 1800); saveProgress(progress); refreshWallet(); sfx.reveal(5); toast(`🤔 고뇌 +${Math.round(rate * 1800).toLocaleString()}`); renderRoom(); });
  $('room-info').onclick = () => alertBox(`<h2>${iconHtml('room')} 고민방</h2><p>철학자를 톡톡 두드리면 고뇌가 나와요.<br>가만히 둬도 쌓이고(최대 ${8}시간), 스테이지를 깰수록 더 빨리 쌓여요.</p><p><b>고민의 깊이</b>를 올리면 탭당 고뇌와 초당 고뇌가 함께 올라요.</p><p>고뇌는 🎴 카드·🧰 도구 뽑기에 써요. 고민방 주인은 도감에서 💗최애로 바꿀 수 있어요.</p>`);
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
