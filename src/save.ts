// 진행 상황 저장 (브라우저 localStorage, 실패해도 게임은 계속)
const KEY = 'agora_progress_v1';

export interface Progress { cleared: string[]; seen: string[] }

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { cleared: [], seen: [], ...JSON.parse(raw) };
  } catch { /* 저장소 사용 불가 */ }
  return { cleared: [], seen: [] };
}

export function saveProgress(p: Progress) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* 무시 */ }
}

export function resetProgress() {
  try { localStorage.removeItem(KEY); } catch { /* 무시 */ }
}
