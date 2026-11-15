import { loadProgress } from '../save';

/** 저장 데이터. 다른 모듈은 읽기만 하고, 바꿔 끼울 때는 setProgress 로만 한다 (ES 모듈 live binding). */
export let progress: ReturnType<typeof loadProgress> = loadProgress();
export function setProgress(next: typeof progress) { progress = next; }
