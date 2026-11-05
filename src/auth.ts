// 프로토타입 로그인: 서버 없이 계정마다 진행 상황을 따로 저장하는 장치 (보안 장치 아님)
// 비밀번호는 sha256("agora:아이디:비밀번호") 앞 16자리로만 보관
import type { Progress } from './save';

export type Role = 'master' | 'veteran' | 'fresh';
export interface Account { id: string; hash: string; role: Role; label: string }

export const ACCOUNTS: Account[] = [
  { id: 'admin', hash: '299e4a47fc692a97', role: 'master', label: '마스터 · 전부 해금, 재화 무제한' },
  { id: 'hyebin', hash: 'a7074eb5877857f3', role: 'veteran', label: '기존 플레이어' },
  { id: 'zdr1357', hash: 'b84c58249bdfe6bc', role: 'fresh', label: '1레벨부터 시작' },
  { id: 'sun', hash: '914c64c5ae02eba3', role: 'fresh', label: '1레벨부터 시작' },
];

async function sha(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

export async function login(id: string, pw: string): Promise<Account | null> {
  const acc = ACCOUNTS.find((a) => a.id === id.trim());
  if (!acc) return null;
  return (await sha(`agora:${acc.id}:${pw}`)) === acc.hash ? acc : null;
}

const LAST = 'agora_last_login';
export function rememberLogin(id: string | null) {
  try { if (id) localStorage.setItem(LAST, id); else localStorage.removeItem(LAST); } catch { /* 무시 */ }
}
export function lastLogin(): Account | null {
  try { const id = localStorage.getItem(LAST); return ACCOUNTS.find((a) => a.id === id) ?? null; } catch { return null; }
}

/** 기존 플레이어 계정의 첫 진행 상태: 고대·중세·동양 일부 클리어, 카드와 도구 보유 */
export function seedVeteran(p: Progress) {
  p.cleared = ['S1', 'S2', 'S3', 'S1:easy', 'S1:normal', 'S1:hard', 'S2:easy', 'S2:normal', 'S3:easy'];
  p.firstClears = [...p.cleared.filter((x) => x.includes(':'))];
  p.gonoe = 4200; p.gems = 650; p.tickets = 1; p.tapLevel = 6; p.tutorialDone = true; p.battleTutDone = true; p.prologueDone = true; p.tourDone = true; p.storyCleared = ['A1', 'A2', 'A3', 'A4', 'A5', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8']; p.tabTut = ['stages', 'room', 'gacha', 'codex', 'shop'];
  p.cards = {
    T101: 9, T103: 6, T102: 7, T207: 12, T301: 10, T107: 5, T402: 5, T308: 6, T405: 4, T408: 3, T211: 4, T309: 2, T311: 3, T411: 3,
    T410: 2, T501: 4, T510: 2, T502: 1, T508: 2, T312: 1, T505: 2, T509: 1, T504: 2, T503: 1, T413: 1, T601: 1, T607: 1, T701: 1,
  };
  p.idv2 = true;
  p.items = { cup: 1, hammer: 2, razor: 1, book: 1, lotus: 1, owl: 1 };
  p.loadout = { T701: 'cup', T505: 'hammer', T402: 'razor', T501: 'owl' };
  p.seen = [...Object.keys(p.cards)];
}
