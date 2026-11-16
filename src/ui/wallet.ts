import { iconHtml } from '../artwork';
import { progress } from '../state/progress';

/** 상단 지갑·고민방 고뇌 숫자 갱신. main.ts 에서 분리, 동작 동일 */
export function refreshWallet() {
  const w = document.getElementById('wallet');
  if (w) w.innerHTML = `<span class="wallet-part">${iconHtml('coin', '고뇌')} ${Math.floor(progress.gonoe).toLocaleString()}</span><span class="wallet-part">${iconHtml('gem', '지혜석')} ${progress.gems.toLocaleString()}</span>${progress.tickets ? `<span class="wallet-part">${iconHtml('ticket', '초대장')} ${progress.tickets}</span>` : ''}`;
  const r = document.getElementById('room-gonoe');
  if (r) r.textContent = Math.floor(progress.gonoe).toLocaleString();
}
