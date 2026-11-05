// 매일 들어올 이유: 일일 임무 · 출석 · 구독 패스 · 광고(시험판) 보상
// 저장은 Progress 안의 작은 객체 몇 개뿐이라 서버 저장에도 부담이 없다.
import type { Progress } from './save';

export const today = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const DAY = 24 * 3600 * 1000;

// ---------- 일일 임무 ----------
export interface Mission { id: string; text: string; goal: number; key: keyof DailyCount; reward: Reward }
export interface Reward { gonoe?: number; gems?: number; tickets?: number }
export interface DailyCount { battles: number; wins: number; merges: number; pulls: number; taps: number; raids: number }
export const MISSIONS: Mission[] = [
  { id: 'tap', text: '고민방에서 50번 고민하기', goal: 50, key: 'taps', reward: { gonoe: 500 } },
  { id: 'battle', text: '전투 1번 하기', goal: 1, key: 'battles', reward: { gonoe: 800 } },
  { id: 'win', text: '스테이지 1번 깨기', goal: 1, key: 'wins', reward: { gems: 20 } },
  { id: 'merge', text: '조합 10번 하기', goal: 10, key: 'merges', reward: { gonoe: 1000 } },
  { id: 'pull', text: '기억 떠올리기(뽑기) 1번', goal: 1, key: 'pulls', reward: { gems: 10 } },
  { id: 'raid', text: '보스 레이드 1번 도전', goal: 1, key: 'raids', reward: { gems: 30 } },
];
/** 임무를 다 깨면 받는 보너스 */
export const ALL_CLEAR: Reward = { gems: 50, tickets: 0 };

export interface Daily { day: string; count: DailyCount; claimed: string[]; adsUsed: number; raidsLeft: number }
const freshDaily = (): Daily => ({ day: today(), count: { battles: 0, wins: 0, merges: 0, pulls: 0, taps: 0, raids: 0 }, claimed: [], adsUsed: 0, raidsLeft: RAID_PER_DAY });
export const RAID_PER_DAY = 3;
export const AD_PER_DAY = 5;

/** 날짜가 바뀌었으면 새 하루로 */
export function daily(p: Progress): Daily {
  const d = (p as Progress & { daily?: Daily }).daily;
  if (!d || d.day !== today()) { const n = freshDaily(); (p as Progress & { daily?: Daily }).daily = n; return n; }
  return d;
}
export function bump(p: Progress, key: keyof DailyCount, n = 1) { daily(p).count[key] += n; }
export const missionDone = (p: Progress, m: Mission) => daily(p).count[m.key] >= m.goal;
export const claimable = (p: Progress) => {
  const d = daily(p);
  const ms = MISSIONS.filter((m) => missionDone(p, m) && !d.claimed.includes(m.id)).length;
  const all = MISSIONS.every((m) => d.claimed.includes(m.id)) && !d.claimed.includes('all') ? 1 : 0;
  return ms + all + (canAttend(p) ? 1 : 0) + (passClaimable(p) ? 1 : 0);
};
export function give(p: Progress, r: Reward) { p.gonoe += r.gonoe ?? 0; p.gems += r.gems ?? 0; p.tickets += r.tickets ?? 0; }
export const rewardText = (r: Reward) => [r.gonoe ? `🤔${r.gonoe.toLocaleString()}` : '', r.gems ? `💎${r.gems}` : '', r.tickets ? `🎫${r.tickets}` : ''].filter(Boolean).join(' ');
export function claimMission(p: Progress, id: string): Reward | null {
  const d = daily(p);
  if (d.claimed.includes(id)) return null;
  if (id === 'all') { if (!MISSIONS.every((m) => d.claimed.includes(m.id))) return null; d.claimed.push('all'); give(p, ALL_CLEAR); return ALL_CLEAR; }
  const m = MISSIONS.find((x) => x.id === id);
  if (!m || !missionDone(p, m)) return null;
  d.claimed.push(id); give(p, m.reward); return m.reward;
}

// ---------- 출석 (7일 주기) ----------
export const ATTEND: Reward[] = [
  { gonoe: 1000 }, { gems: 30 }, { gonoe: 2000 }, { gems: 50 }, { gonoe: 3000 }, { gems: 80 }, { tickets: 1, gems: 100 },
];
interface Attend { last: string; streak: number }
const att = (p: Progress) => ((p as Progress & { attend?: Attend }).attend ??= { last: '', streak: 0 });
export const canAttend = (p: Progress) => att(p).last !== today();
export const attendStreak = (p: Progress) => att(p).streak;
export function attend(p: Progress): Reward | null {
  const a = att(p);
  if (a.last === today()) return null;
  const yesterday = today(Date.now() - DAY);
  a.streak = a.last === yesterday ? a.streak + 1 : 1;
  a.last = today();
  const r = ATTEND[(a.streak - 1) % ATTEND.length];
  give(p, r);
  return r;
}

// ---------- 광고 제거 · 구독 패스 ----------
interface Sub { adFreeUntil?: number; adFreeLife?: boolean; passUntil?: number; passDay?: string }
const sub = (p: Progress) => ((p as Progress & { sub?: Sub }).sub ??= {});
export const adFree = (p: Progress) => !!sub(p).adFreeLife || (sub(p).adFreeUntil ?? 0) > Date.now() || passOn(p);
export const passOn = (p: Progress) => (sub(p).passUntil ?? 0) > Date.now();
export const passDaysLeft = (p: Progress) => Math.max(0, Math.ceil(((sub(p).passUntil ?? 0) - Date.now()) / DAY));
export const adFreeLabel = (p: Progress) => sub(p).adFreeLife ? '평생' : (sub(p).adFreeUntil ?? 0) > Date.now() ? `${Math.ceil(((sub(p).adFreeUntil ?? 0) - Date.now()) / DAY)}일 남음` : '';
/** 구독 패스 매일 보상 */
export const PASS_DAILY: Reward = { gems: 50, gonoe: 2000 };
export const passClaimable = (p: Progress) => passOn(p) && sub(p).passDay !== today();
export function claimPass(p: Progress): Reward | null { if (!passClaimable(p)) return null; sub(p).passDay = today(); give(p, PASS_DAILY); return PASS_DAILY; }
export function grantSub(p: Progress, kind: 'adfree30' | 'adfreeLife' | 'pass30') {
  const s = sub(p);
  if (kind === 'adfreeLife') s.adFreeLife = true;
  if (kind === 'adfree30') s.adFreeUntil = Math.max(Date.now(), s.adFreeUntil ?? 0) + 30 * DAY;
  if (kind === 'pass30') s.passUntil = Math.max(Date.now(), s.passUntil ?? 0) + 30 * DAY;
}
export const adsLeft = (p: Progress) => AD_PER_DAY - daily(p).adsUsed;
export function useAd(p: Progress) { daily(p).adsUsed++; }
