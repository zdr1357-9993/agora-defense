/** 토스트·알림 팝업. main.ts 에서 분리, 동작 동일 (다른 모듈 의존 없음) */
export function toast(text: string) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

export function alertBox(html: string) {
  const o = document.createElement('div');
  o.className = 'overlay';
  o.innerHTML = `<div class="pop">${html}<button class="primary chunky gold close">확인</button></div>`;
  o.onclick = (e) => { const el = e.target as HTMLElement; if (el === o || el.classList.contains('close')) o.remove(); };
  document.body.appendChild(o);
}
