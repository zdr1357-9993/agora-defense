import { PHIL, gradeRank } from '../data';
import type { Game } from '../game';
import { STORY_MAP } from '../story';
import { battleReward } from '../meta';
import { adFree, adsLeft, claimable, rewardText } from '../live';
import { progress } from '../state/progress';
import { raidReward } from './raid';
import { watchAd } from './ad';

// main.ts 쪼개기 2차(RD-T038): 결과 화면(시대 전환 연출 + 결과 패널)을 이동만. 동작은 그대로. 전투 종료·그림 함수는 main.ts 에 있어 시작 때 한 번 넘겨받는다.
interface ResultDeps { endBattle(opt: { double?: boolean; next?: boolean }): void; eraSky(era: string): string; heroPortrait(id: string): string; shortName(name: string): string; }
let deps!: ResultDeps;
export function initResult(d: ResultDeps) { deps = d; }

/** 시대 전환 연출: 시대 화풍이 종이처럼 쓸고 지나가며 이름이 뜬다 */
const ERA_LABEL: Record<string, string> = { 고대: '고대 · 그리스', 중세: '중세 · 신앙의 시대', 동양: '동양 · 백가쟁명', 근대: '근대 · 이성의 시대', 근현대: '근현대 · 언어와 실존', 현대: '현대 · 연결과 책임' };
let lastEra = '';
export function eraWipe(era: string, title: string, when: string) {
  const changed = era !== lastEra; lastEra = era;
  const ov = document.createElement('div');
  ov.className = `era-wipe ${changed ? 'big' : ''} era-${era}`;
  ov.innerHTML = `<div class="ew-art" style="background-image:url(${deps.eraSky(era)})"></div><div class="ew-text">${changed ? `<small>${ERA_LABEL[era] ?? era}</small>` : ''}<b>${title}</b>${when ? `<em>${when}</em>` : ''}</div>`;
  document.body.appendChild(ov);
  setTimeout(() => ov.remove(), changed ? 2100 : 1500);
}

export function resultPanel(g: Game, html: string) {
  const base: { gonoe?: number; gems?: number } = g.raid ? raidReward(g.raidDamage) : { gonoe: Math.round(battleReward(g.wave, g.over === 'win') * g.diff.reward) };
  const win = g.over === 'win';
  const story = g.storyId ? STORY_MAP.get(g.storyId) : undefined;
  const nextLabel = g.raid ? '' : story ? (win || story.chapter === 0 ? '▶ 다음 이야기' : '↻ 다시 도전') : g.oneTool ? '' : win ? '▶ 다음 스테이지' : '↻ 다시 도전';
  const ov = document.createElement('div');
  ov.className = 'overlay result';
  const mvp = [...g.towers].sort((a, b) => gradeRank(PHIL.get(b.philId)!) - gradeRank(PHIL.get(a.philId)!))[0];
  const hero = mvp ? `<div class="res-hero ${win ? 'win' : 'lose'}" style="background-image:url(${deps.eraSky(g.stage.era)})">
      ${win ? '<i class="cf"></i><i class="cf"></i><i class="cf"></i><i class="cf"></i><i class="cf"></i><i class="cf"></i>' : ''}
      <img src="${deps.heroPortrait(mvp.philId)}" alt=""><span class="res-ribbon">${win ? '논파 성공' : g.raid ? '레이드 종료' : '다음엔 꼭'}</span><span class="res-mvp">MVP · ${deps.shortName(PHIL.get(mvp.philId)!.name)}</span></div>` : '';
  ov.innerHTML = `<div class="pop">${hero}${html}
    <div class="res-reward">🎁 보상 <b>${rewardText(base)}</b></div>
    <button class="chunky pink res-double">${adFree(progress) ? '✨ 보상 2배 받기 (광고 제거)' : `📺 광고 보고 보상 2배 (오늘 ${adsLeft(progress)}회)`}</button>
    <div class="res-btns"><button class="chunky blue res-home">🏠 홈</button>${nextLabel ? `<button class="chunky gold res-next">${nextLabel}</button>` : ''}</div>
    ${claimable(progress) ? `<p class="hint">📋 받을 수 있는 임무 보상이 있어요!</p>` : ''}</div>`;
  document.body.appendChild(ov);
  let double = false;
  const dbl = ov.querySelector('.res-double') as HTMLButtonElement;
  if (!adFree(progress) && adsLeft(progress) <= 0) dbl.disabled = true;
  dbl.onclick = () => watchAd(() => { double = true; dbl.disabled = true; dbl.textContent = '✅ 보상 2배 적용!'; (ov.querySelector('.res-reward b') as HTMLElement).textContent = rewardText({ gonoe: (base.gonoe ?? 0) * 2, gems: (base.gems ?? 0) * 2 }); });
  (ov.querySelector('.res-home') as HTMLElement).onclick = () => { ov.remove(); deps.endBattle({ double }); };
  const nx = ov.querySelector('.res-next') as HTMLElement | null;
  if (nx) nx.onclick = () => { ov.remove(); deps.endBattle({ double, next: true }); };
}
