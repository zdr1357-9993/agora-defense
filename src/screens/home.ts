import { PHIL, PHILOSOPHERS, STAGES, ERA_ICON, type Stage } from '../data';
import { QA_MODE } from '../game';
import { ENEMY_ROLES, ENEMY_NAMES } from '../enemy-designs';
import { STAGE_PATHS } from '../paths';
import { STAGE_STARS, ERA_BONUS, STAR_BONUS } from '../affinity';
import { DIFFICULTIES, clearKey } from '../difficulty';
import { $ } from '../ui/dom';
import { portrait, monsterUrl } from '../ui/sprites';
import { alertBox } from '../ui/overlay';
import { progress } from '../state/progress';
import { daily, claimable, RAID_PER_DAY } from '../live';
import { missionsPanel } from './daily';

interface HomeDeps {
  easyAllCleared(): boolean; getDiffId(): string; setDiffId(id: string): void; renderStory(box: HTMLElement): void;
  startBattle(s: Stage, oneTool?: string): void; startRaid(): void; shortName(name: string): string;
  difficultyName(d: { id: string; name: string }): string; isUnlocked(s: Stage): boolean; diffUnlocked(stageId: string, id: string): boolean; modernLockText(): string;
}
let deps!: HomeDeps;
/** 스토리 지도·전투 시작·난이도 규칙은 main.ts 에 남아 있어서 시작 때 한 번 넘겨받는다. */
export function initHome(d: HomeDeps) { deps = d; }

export function stageInfo(s: Stage) {
  const hero = PHIL.get(s.counter)!;
  const marks = DIFFICULTIES.map((d) => `<span class="${progress.cleared.includes(clearKey(s.id, d.id)) ? 'on' : ''}">${d.icon}</span>`).join('');
  alertBox(`<h2>${ERA_ICON[s.era]} ${s.name}</h2>
    <p class="hint">${s.story}</p>
    <div class="stage-info">
      <div>🗺 ${STAGE_PATHS[s.id].caption}</div>
      <div>👑 최종 보스 <b>${s.boss20}</b> · 10웨이브마다 <b>${s.boss10}</b></div>
      <div>⚔ 보스 카운터 <b>${hero.name}</b> (보스에게 피해 3배)</div>
      <div>🏠 강해지는 철학자 <b>${(STAGE_STARS[s.id] ?? []).map((n) => PHILOSOPHERS.find((p) => p.realName === n)?.name ?? n).join(', ')}</b> +${STAR_BONUS * 100}%<br>${s.era === '현대' ? '근현대의 기억을 가진' : s.era} 철학자 모두 +${ERA_BONUS * 100}%</div>
      <div>🏅 클리어 ${marks}</div>
    </div><h3>이 시대의 도그마</h3><div class="enemy-guide">${ENEMY_ROLES.map((role,i)=>`<figure><img src="${monsterUrl(s.era,role.kind)}" alt="${role.label}"><figcaption><b>${ENEMY_NAMES[s.era]?.[i] ?? role.label}</b><small>${role.label} · ${role.tip}</small></figcaption></figure>`).join('')}</div>`);
}
export function renderHome() {
  const box = $('stages');
  box.innerHTML = '';
  const diffOpen = QA_MODE || deps.easyAllCleared();
  if (!diffOpen) deps.setDiffId('easy');
  if (diffOpen) {
    const chips = document.createElement('div');
    chips.className = 'diffs';
    chips.innerHTML = DIFFICULTIES.map((d) => `<button data-diff="${d.id}" class="${d.id === deps.getDiffId() ? 'on' : ''}" style="--c:${d.color}">${d.icon}<span>${deps.difficultyName(d)}</span></button>`).join('');
    box.appendChild(chips);
    for (const b of chips.querySelectorAll<HTMLButtonElement>('button')) b.onclick = () => { deps.setDiffId(b.dataset.diff!); renderHome(); };
  }
  // 오늘의 할 일 · 보스 레이드 (시작 튜토리얼을 마치면)
  if (QA_MODE || (progress.storyCleared ?? []).includes('A5')) {
    const live = document.createElement('div');
    live.className = 'live-row';
    const n = claimable(progress), d = daily(progress);
    live.innerHTML = `<button class="live-btn missions">📋 오늘의 할 일${n ? `<i class="dot">${n}</i>` : ''}</button><button class="live-btn raid">👑 보스 레이드 <small>${QA_MODE ? '∞' : `${d.raidsLeft}/${RAID_PER_DAY}`}</small></button>`;
    (live.querySelector('.missions') as HTMLElement).onclick = () => missionsPanel();
    (live.querySelector('.raid') as HTMLElement).onclick = () => deps.startRaid();
    box.appendChild(live);
  }
  if (deps.getDiffId() === 'easy') { deps.renderStory(box); return; }
  for (const s of STAGES) {
    const row = document.createElement('div');
    if (!deps.isUnlocked(s)) {
      row.className = 'srow locked';
      row.innerHTML = `<span class="sname">🔒 ${s.id === 'S6' ? '현대 · 연결된 세계의 광장' : '???'}</span><small>${s.id === 'S6' ? deps.modernLockText() : `${STAGES.find((x) => x.id === s.unlockAfter)?.name} 클리어 시`}</small>`;
      box.appendChild(row); continue;
    }
    const open = deps.diffUnlocked(s.id, deps.getDiffId());
    const cleared = progress.cleared.includes(clearKey(s.id, deps.getDiffId()));
    row.className = `srow ${open ? '' : 'locked'} ${cleared ? 'cleared' : ''}`;
    row.innerHTML = `<button class="sgo" ${open ? '' : 'disabled'}><img src="${portrait(s.counter)}"><span class="sname">${ERA_ICON[s.era]} ${s.name}</span>${cleared ? '<span class="badge">CLEAR</span>' : open ? '' : '<small>🔒</small>'}</button><button class="sinfo" aria-label="스테이지 정보">i</button>`;
    (row.querySelector('.sgo') as HTMLButtonElement).onclick = () => deps.startBattle(s);
    (row.querySelector('.sinfo') as HTMLButtonElement).onclick = () => stageInfo(s);
    box.appendChild(row);
  }
  if (progress.favorite && PHIL.has(progress.favorite) && progress.cards[progress.favorite]) {
    const fav = PHIL.get(progress.favorite)!;
    const ot = document.createElement('div');
    ot.className = 'srow onetool-row';
    ot.innerHTML = `<button class="sgo"><img src="${portrait(fav.id)}"><span class="sname">💗 ${deps.shortName(fav.name)} 원툴 도전</span><small>최고 ${progress.oneToolBest[fav.id] ?? 0}웨이브</small></button><button class="sinfo">i</button>`;
    (ot.querySelector('.sgo') as HTMLButtonElement).onclick = () => deps.startBattle(STAGES[0], fav.id);
    (ot.querySelector('.sinfo') as HTMLButtonElement).onclick = () => alertBox(`<h2>💗 최애 원툴 도전</h2><p>${fav.name} 한 명 + 흔함만으로 어디까지 버틸 수 있을까요? 조합 없이 끝없이 이어지는 웨이브예요.</p>`);
    box.appendChild(ot);
  }
}
