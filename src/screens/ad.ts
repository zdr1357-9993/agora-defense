import { adFree, adsLeft, useAd } from '../live';
import { saveProgress } from '../save';
import { progress } from '../state/progress';

let toast!: (text: string) => void;
/** main.ts 에 남아 있는 toast 를 시작 때 한 번 넘겨받는다 (순환 import 방지). */
export function initAd(deps: { toast(text: string): void }) { toast = deps.toast; }

/** 광고(시험판): 광고 제거·패스가 있으면 바로, 없으면 3초 광고 화면 뒤 보상 */
export function watchAd(done: () => void) {
  if (adFree(progress)) { done(); return; }
  if (adsLeft(progress) <= 0) { toast('오늘 볼 수 있는 광고를 다 봤어요'); return; }
  const ov = document.createElement('div');
  ov.className = 'ad-mock';
  ov.innerHTML = `<div class="ad-box"><small>광고 · 시험판 예시</small><b>🏛 여기에 광고가 나와요</b><p class="ad-count">3</p><p class="hint">광고 제거 상품을 사면 이 화면 없이 바로 보상을 받아요</p></div>`;
  document.body.appendChild(ov);
  let n = 3;
  const t = window.setInterval(() => { n--; (ov.querySelector('.ad-count') as HTMLElement).textContent = String(n); if (n <= 0) { clearInterval(t); ov.remove(); useAd(progress); saveProgress(progress); done(); } }, 1000);
}
