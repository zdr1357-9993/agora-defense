/** 보스 레이드 보상 표·등급 계산 (순수 함수만; 전투 시작은 main.ts 의 startRaid). main.ts 에서 분리, 동작 동일 */
export const RAID_TIERS = [20_000, 100_000, 300_000, 1_000_000, 3_000_000];
export const RAID_GONOE = [300, 1000, 2500, 5000, 9000, 15000];
export const RAID_GEMS = [0, 10, 20, 40, 70, 120];
export const raidTier = (d: number) => RAID_TIERS.filter((t) => d >= t).length;
export function raidReward(d: number) { const k = raidTier(d); return { gonoe: RAID_GONOE[k], gems: RAID_GEMS[k] }; }
export function raidTierText(d: number) {
  const k = raidTier(d);
  return `등급 <b>${['🥉 입문', '🥈 수련', '🥇 숙련', '🏅 대가', '👑 현자', '✨ 전설'][k]}</b>${k < RAID_TIERS.length ? ` · 다음 등급까지 ${(RAID_TIERS[k] - Math.round(d)).toLocaleString()}` : ''}`;
}
