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
  p.gonoe = 4200; p.gems = 650; p.tickets = 1; p.tapLevel = 6; p.tutorialDone = true;
  p.cards = {
    T101: 9, T102: 6, T103: 7, T104: 12, T105: 10, T106: 5,
    T201: 5, T202: 6, T203: 4, T204: 3, T205: 4, T206: 2, T207: 3,
    T301: 3, T302: 2, T303: 4, T304: 2, T305: 1, T306: 2, T307: 1,
    T401: 2, T402: 1, T403: 2, T405: 1, T406: 1,
    T501: 1, T507: 1, T601: 1,
  };
  p.items = { cup: 1, hammer: 2, razor: 1, book: 1, lotus: 1, owl: 1 };
  p.loadout = { T601: 'cup', T401: 'hammer', T201: 'razor', T303: 'owl' };
  p.seen = [...Object.keys(p.cards)];
}
