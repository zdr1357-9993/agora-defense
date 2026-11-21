// 계정: 로그인은 Supabase Auth(cloud.ts)가 유일한 기준이다. 이 파일에는 계정 목록·비밀번호 해시를 두지 않는다 (RD-T052).
// 역할(master/veteran/fresh)은 서버 player_roles 에서 받는다(cloud.ts cloudRole). 서버에 닿지 못해 기기 저장으로 계속할 때는 언제나 'fresh'.
import type { Progress } from './save';

export type Role = 'master' | 'veteran' | 'fresh';
export interface Account { id: string; role: Role; label: string; offline?: boolean }

/** 서버에 닿지 않을 때: 이 기기에서 마지막으로 로그인했던 아이디로 기기 저장만 쓰며 계속한다. 관리자 권한은 주지 않는다 */
export const offlineAccount = (id: string): Account => ({ id, role: 'fresh', label: '오프라인 (이 기기 저장)', offline: true });

const LAST = 'agora_last_login';
export function rememberLogin(id: string | null) {
  try { if (id) localStorage.setItem(LAST, id); else localStorage.removeItem(LAST); } catch { /* 무시 */ }
}
export function lastLoginId(): string | null {
  try { return localStorage.getItem(LAST); } catch { return null; }
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
