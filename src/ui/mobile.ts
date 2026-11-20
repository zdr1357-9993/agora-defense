// ---------- 모바일: 두 번 탭 확대 / 핀치 확대 막기 (iOS 사파리는 viewport 설정을 무시함) ----------
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  const el = e.target as HTMLElement;
  if (now - lastTouchEnd < 350 && !el.closest('input')) {
    e.preventDefault(); // 확대 막기
    const b = el.closest('button') as HTMLButtonElement | null;
    if (b && !b.disabled) b.click(); // 대신 연타는 그대로 눌리게
  }
  lastTouchEnd = now;
}, { passive: false });
// Browser pinch zoom stays available for reading.
document.addEventListener('dblclick', (e) => e.preventDefault());
