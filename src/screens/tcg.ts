import { PHIL, PHILOSOPHERS, statsOf, gradeLabel, gradeRank, TYPE_ICON, ERA_ICON } from '../data';
import { cardArt } from '../tcg';
import { cardLevel } from '../save';
import { QA_MODE } from '../game';
import { spriteFor } from '../ui/sprites';
import { $ } from '../ui/dom';
import { progress } from '../state/progress';
import { isAdmin } from '../state/account';

let toast!: (text: string) => void;
let showCard!: (id: string) => void;
/** main.ts 에 남아 있는 toast·showCard 를 시작 때 한 번 넘겨받는다 (순환 import 방지). */
export function initTcg(deps: { toast(text: string): void; showCard(id: string): void }) { toast = deps.toast; showCard = deps.showCard; $('tcg-open').onclick = () => openTcg(); }
export function tcgCard(id: string) {
  const p = PHIL.get(id)!, st = statsOf(id);
  const n = progress.cards[id] ?? 0, lv = cardLevel(n);
  const art = cardArt(p, spriteFor(id), progress?.skinOn?.[id] ?? '');
  return `<div class="tcg tcg-t${p.tier}" data-id="${id}"><div class="tcg-inner">
    <div class="tcg-face tcg-front">
      <div class="tcg-top"><b>${p.name}</b><span class="tcg-type">${TYPE_ICON[st.type]} ${st.type}</span></div>
      <div class="tcg-stars">${'★'.repeat(p.tier)}${p.plus ? '⁺' : ''}<small>${gradeLabel(p)} · ${ERA_ICON[p.era] ?? ''} ${p.school}</small></div>
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
export function openTcg(startId?: string) {
  const seen = new Set(progress.seen);
  const list = [...PHILOSOPHERS].filter((p) => seen.has(p.id) || !!progress.cards[p.id] || (isAdmin() || (QA_MODE && !p.hidden))).sort((a, b) => gradeRank(a) - gradeRank(b) || a.id.localeCompare(b.id));
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
