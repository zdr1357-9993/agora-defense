import { daily, MISSIONS, ALL_CLEAR, ATTEND, claimable, claimMission, missionDone, rewardText, canAttend, attend, attendStreak, passOn, passDaysLeft, claimPass, PASS_DAILY } from '../live';
import { saveProgress } from '../save';
import { CARD_COST, tapUpgradeCost } from '../meta';
import { sfx } from '../sfx';
import { progress } from '../state/progress';
import { me } from '../state/account';

/** main.ts 에 남아 있는 화면 함수들: 순환 import 를 피하려고 시작 때 한 번 넘겨받는다. */
interface Deps { toast(text: string): void; refreshWallet(): void; renderHome(): void; switchTab(tab: string): void }
let toast!: Deps['toast'], refreshWallet!: Deps['refreshWallet'], renderHome!: Deps['renderHome'], switchTab!: Deps['switchTab'];
export function initDaily(deps: Deps) {
  ({ toast, refreshWallet, renderHome, switchTab } = deps);
  setInterval(() => { if (me) refreshBadges(); }, 1500);
}

// =============== 📋 오늘의 할 일: 출석 · 구독 패스 · 일일 임무 ===============
export function missionsPanel() {
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
export function refreshBadges() {
  const set = (tab: string, on: boolean) => document.querySelector(`#tabs [data-tab=${tab}]`)?.classList.toggle('badge-on', on);
  set('stages', claimable(progress) > 0);
  set('gacha', progress.gonoe >= CARD_COST);
  set('room', progress.gonoe >= tapUpgradeCost(progress));
}

