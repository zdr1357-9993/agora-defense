import { PHIL, PHILOSOPHERS } from '../data';
import { iconHtml } from '../artwork';
import { canWearSkin } from '../ui-policy';
import { passOn, passDaysLeft, adFreeLabel } from '../live';
import { SHOP, buy } from '../meta';
import { skinnedSprite, SKINS } from '../sprites';
import { sfx } from '../sfx';
import { saveProgress } from '../save';
import { $ } from '../ui/dom';
import { spriteUrl } from '../ui/sprites';
import { progress } from '../state/progress';

let toast!: (text: string) => void;
let refreshWallet!: () => void;
/** main.ts 에 남아 있는 toast·refreshWallet 을 시작 때 한 번 넘겨받는다 (순환 import 방지). */
export function initShop(deps: { toast(text: string): void; refreshWallet(): void }) { toast = deps.toast; refreshWallet = deps.refreshWallet; }

let skinShopId = '';
export function renderShop() {
  const item = (x: (typeof SHOP)[number]) => {
    const sold = x.once && progress.purchases.includes(x.id);
    const active = x.sub === 'pass30' && passOn(progress) ? `<i class="tag-on">이용 중 · ${passDaysLeft(progress)}일</i>` : x.sub?.startsWith('adfree') && adFreeLabel(progress) && (x.sub === 'adfreeLife' ? adFreeLabel(progress) === '평생' : true) ? `<i class="tag-on">${adFreeLabel(progress)}</i>` : '';
    return `<div class="shop-item ${sold ? 'sold' : ''} ${x.big ? 'big' : ''}">${x.tag ? `<i class="tag-hot">${x.tag}</i>` : ''}${active}<div class="shop-icon">${iconHtml(x.tickets ? 'ticket' : x.gems ? 'gem' : x.gonoe ? 'coin' : 'codex', x.icon)}</div><b>${x.name}</b><small>${x.desc}</small>
      <button class="chunky ${x.costGems ? 'blue' : 'gold'}" data-buy="${x.id}" ${sold ? 'disabled' : ''}>${sold ? '구매 완료' : x.price}</button></div>`;
  };
  const skinCandidates = PHILOSOPHERS.filter(p => progress.cards[p.id] && canWearSkin(p.tier));
  const fav = skinShopId && skinCandidates.some(p => p.id === skinShopId) ? skinShopId : progress.favorite && skinCandidates.some(p => p.id === progress.favorite) ? progress.favorite : skinCandidates[0]?.id;
  $('tab-shop').innerHTML = `<div class="tab-head"><h2>🛍 상점</h2><span class="proto-chip">시험판 · 실제 결제 없음</span></div>
    <h3 class="shop-sec">멤버십</h3><div class="shop-grid">${SHOP.filter((x) => x.sub).map(item).join('')}</div>
    <h3 class="shop-sec">지혜석 · 초대장</h3><div class="shop-grid">${SHOP.filter((x) => !x.sub).map(item).join('')}</div>
    ${fav ? `<label class="skin-target">스킨을 입힐 철학자<select id="skin-target">${skinCandidates.map(p => `<option value="${p.id}" ${p.id === fav ? 'selected' : ''}>${p.name}</option>`).join('')}</select></label><h3 class="shop-sec">👗 스킨 <small>(${PHIL.get(fav)!.name})</small></h3><div class="skin-shop">${Object.entries(SKINS).map(([k, sk]) => {
      const own = progress.skins.includes(fav + ':' + k), on = progress.skinOn[fav] === k;
      return `<button class="skin-card ${on ? 'on' : ''} r-${sk.rank}" data-skinbuy="${k}"><img src="${skinnedSprite(PHIL.get(fav)!, k).toDataURL()}"><b>${sk.icon} ${sk.name}</b><small>${sk.fxName}</small><em>${on ? '착용 중' : own ? '착용하기' : '💎' + sk.price}</em></button>`;
    }).join('')}</div><p class="hint">보유한 거장·근원 철학자를 위에서 고른 뒤 스킨을 착용해요. 도감 정보보기에서도 바꿀 수 있어요.</p>` : '<p class="skin-lock-note">거장 이상 철학자의 기억을 얻으면 스킨이 열려요.</p>'}`;
  for (const b of $('tab-shop').querySelectorAll<HTMLButtonElement>('[data-buy]')) b.onclick = () => {
    const it = SHOP.find((x) => x.id === b.dataset.buy)!;
    if (!it.costGems && !window.confirm(`[모의 결제] ${it.name} (${it.price})\n실제 결제는 일어나지 않아요. 지급할까요?`)) return;
    if (buy(progress, it)) { saveProgress(progress); refreshWallet(); renderShop(); sfx.reveal(5); toast(`🎉 ${it.name} 지급 완료!`); }
    else toast('💎 지혜석이 부족해요');
  };
  const skinTarget = document.getElementById('skin-target') as HTMLSelectElement | null;
  if (skinTarget) skinTarget.onchange = () => { skinShopId = skinTarget.value; renderShop(); };
  for (const b of $('tab-shop').querySelectorAll<HTMLButtonElement>('[data-skinbuy]')) b.onclick = () => {
    const k = b.dataset.skinbuy!, sk = SKINS[k];
    if (!fav || !canWearSkin(PHIL.get(fav)!.tier)) return;
    if (!progress.skins.includes(fav + ':' + k)) {
      if (progress.gems < sk.price) { toast('💎 지혜석이 부족해요'); return; }
      if (!window.confirm(`${sk.icon} ${sk.name} 스킨을 💎${sk.price}에 살까요?`)) return;
      progress.gems -= sk.price; progress.skins.push(fav + ':' + k); sfx.reveal(5);
    }
    progress.skinOn[fav] = k; spriteUrl.clear(); saveProgress(progress); refreshWallet(); renderShop(); toast(`👗 ${sk.name} 착용!`);
  };
}
