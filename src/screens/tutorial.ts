import type { Game } from '../game';
import { $ } from '../ui/dom';
import { progress } from '../state/progress';
import { saveProgress } from '../save';

// main.ts 의 쪼개기 2차(RD-T038): 튜토리얼 두 종류를 이동만. 동작은 그대로. 전투 상태·현재 탭은 main.ts 에 있어 getter 로 받는다.
interface TutDeps { getGame(): Game | null; getTab(): string; }
let deps!: TutDeps;
export function initTutorial(d: TutDeps) { deps = d; }
/** 전투 시작 때: 첫 전투면 0단계부터, 원툴 도전·이미 끝났으면 건너뜀. */
export function tutBegin(skip: boolean) { tutStep = skip ? -1 : 0; tutShown = -2; }
/** QA 미리보기 등에서 안내를 끈다. */
export function tutAbort() { tutStep = -1; tutClear(); }

// ---------- 🎓 전투 튜토리얼 (첫 전투에서 단계별 안내) ----------
const TUT: { sel: string; text: string; done?: (g: Game) => boolean; pos?: 'top' }[] = [
  { sel: '#summon', text: '👋 먼저 <b>소환</b>을 눌러 철학자를 불러 보세요. 흔함 9명 중 한 명이 나와요.', done: (g) => g.towers.length >= 1 },
  { sel: '#summon', text: '좋아요! 철학자는 빈 칸에 자동으로 앉아요. <b>두 번 더</b> 소환해 볼까요?', done: (g) => g.towers.length >= 3 },
  { sel: '#field', text: '칸에 앉은 철학자를 <b>탭</b>하면 정보·강화·판매가 나와요. 선택한 채로 다른 칸을 탭하면 <b>자리를 옮겨요</b>. 맨 아래 <b>대기석</b> 5칸은 싸우지 않지만 조합 재료로 쓰여요. 필드가 차면 소환된 철학자가 대기석으로 가요.', pos: 'top' },
  { sel: '#merge', text: '조합 재료가 모이면 철학자 머리 위에 <b>✦</b>가 뜨고, 여기 <b>합성</b> 버튼이 결과 얼굴과 함께 반짝여요. 누르기만 하면 돼요!', pos: 'top' },
  { sel: '#start', text: '준비 끝! <b>웨이브 시작</b>을 누르면 도그마(적)가 몰려와요.', done: (g) => g.running },
  { sel: '#lives', text: '🧠 이게 <b>멘탈</b>이에요. 도그마가 길 끝에 닿으면 1(보스는 5)씩 깎이고, 못 잡은 적은 <b>다시 돌아와요</b>. 0이 되면 패배!', pos: 'top' },
  { sel: '#cats', text: '웨이브를 깨면 골드와 <b>촉매</b>(🔥💎🌀⚙️🪞)를 얻어요. 촉매는 희귀 이상 조합 재료예요. 보스를 잡으면 🎟 무료 소환권도 줘요. 칩을 누르면 설명이 나와요.', pos: 'top' },
  { sel: '#b-recipes', text: '📜 은 조합표, 1x 는 배속이에요. 이제 20웨이브까지 버텨 보세요. 화이팅! 🏛', pos: 'top' },
];
let tutStep = -1, tutShown = -2;
export function tutClear() { document.querySelector('.tut-bubble')?.remove(); document.querySelectorAll('.tut-glow').forEach((e) => e.classList.remove('tut-glow')); }
function tutFinish() { tutStep = -1; tutClear(); progress.battleTutDone = true; saveProgress(progress); }
export function tutTick() {
  if (document.querySelector('.vn')) { if (tutShown !== -2) { tutClear(); tutShown = -2; } return; }
  const game = deps.getGame();
  if (tutStep < 0 || !game || $('battle').classList.contains('hidden')) { if (tutShown !== -2 && tutStep < 0) { tutClear(); tutShown = -2; } return; }
  const st = TUT[tutStep];
  if (st.done?.(game)) { tutStep++; if (tutStep >= TUT.length) { tutFinish(); return; } return tutTick(); }
  if (tutShown === tutStep) return;
  tutShown = tutStep; tutClear();
  document.querySelector(st.sel)?.classList.add('tut-glow');
  const b = document.createElement('div');
  b.className = `tut-bubble ${st.pos === 'top' ? 'top' : ''}`;
  const manual = !st.done;
  b.innerHTML = `<div class="tut-step">튜토리얼 ${tutStep + 1}/${TUT.length}</div><p>${st.text}</p><div class="tut-btns"><button class="tut-skip">건너뛰기</button>${manual ? `<button class="tut-next">${tutStep === TUT.length - 1 ? '시작!' : '다음 ▶'}</button>` : ''}</div>`;
  document.body.appendChild(b);
  if (st.pos !== 'top') { const row = document.querySelector('#merge')?.parentElement; if (row) b.style.bottom = `${Math.round(innerHeight - row.getBoundingClientRect().top + 8)}px`; }   // J031: 행동 버튼(판매·합성·강화·조합표)을 가리지 않는다
  (b.querySelector('.tut-skip') as HTMLElement).onclick = tutFinish;
  const nx = b.querySelector('.tut-next') as HTMLElement | null;
  if (nx) nx.onclick = () => { tutStep++; if (tutStep >= TUT.length) tutFinish(); else tutTick(); };
}
setInterval(tutTick, 300);

// ---------- 🎓 화면별 튜토리얼 (탭을 처음 열 때) ----------
const PAGE_TUT: Record<string, { sel: string; text: string }[]> = {
  stages: [
    { sel: '.journey-point.open .j-dot', text: '이 긴 지도에서 거점을 고르면 캐릭터와 카메라가 그곳으로 이동해요. 길은 튜토리얼에서 1~6장으로 이어져요.' },
    { sel: '#j-go', text: '아래 목적지 패널에서 <b>출발</b>을 누르면 전투가 시작돼요. 옆 <b>정보</b> 버튼에서 보스와 돌아오는 기억을 확인할 수 있어요.' },
  ],
  stages2: [
    { sel: '#journey-difficulty', text: '난이도는 이 버튼 하나에서 바꿔요. 쉬움으로 튜토리얼과 1~6장을 모두 마치면 난이도 선택과 장 바로가기가 열려요.' },
    { sel: '#open-recipes', text: '📜 <b>조합표</b>에서 모든 조합식을, 🎲 확률에서 소환·등급 정보를 볼 수 있어요. 마음에 드는 조합은 💗로 찜해 두면 전투 중에 따라 보여요.' },
    { sel: '#tabs', text: '아래 탭에서 🤔고민방·🎴뽑기·📖도감·🛍상점으로 가요. 처음 들어가면 거기서도 안내해 드릴게요!' },
  ],
  room: [
    { sel: '#thinker', text: '여기는 <b>고민방</b>. 철학자를 톡톡 두드리면 <b>🤔 고뇌</b>가 나와요.' },
    { sel: '.room-stat', text: '고뇌는 가만히 둬도 쌓여요(최대 8시간). 스테이지를 깰수록 더 빨리 쌓이고, <b>카드·도구 뽑기</b>에 써요.' },
    { sel: '#tap-up', text: '고뇌를 써서 <b>고민의 깊이</b>를 올리면 탭할 때와 가만히 둘 때 나오는 고뇌가 <b>둘 다</b> 늘어요.' },
  ],
  gacha: [
    { sel: '.card-box', text: '🧠 <b>기억 떠올리기</b>: 고뇌를 써서 철학자 카드를 얻어요. 같은 카드가 모이면 레벨이 올라 전투에서 세지고, 일화도 열려요.' },
    { sel: '.card-box .info-btn', text: '<b>i</b>를 누르면 확률, 천장(거장 이상 확정까지 남은 횟수), 성장 규칙을 볼 수 있어요.' },
    { sel: '.master-box', text: '✨ <b>거장 초대</b>는 💎지혜석이나 🎫초대장으로 거장 이상을 확정으로 뽑아요.' },
    { sel: '.tool-box', text: '🧰 <b>도구</b>를 뽑아 도감에서 철학자에게 장착해요. 주인에게 맞는 도구면 <b>찰떡!</b> 공격 +60%.' },
  ],
  codex: [
    { sel: '.codex-tabs', text: '등급별로 나눠 봐요. 만난 철학자를 누르면 <b>카드</b>로 보여요.' },
    { sel: '.codex-grid', text: '카드 아래 <b>📋 정보보기</b>를 누르면 스탯·도구 장착·스킨·💗최애 지정을 할 수 있어요.' },
    { sel: '#tcg-open', text: '🃏 여기를 누르면 카드처럼 <b>옆으로 넘겨 보고</b>, 탭하면 뒤집어서 이야기를 읽을 수 있어요.' },
  ],
  shop: [
    { sel: '.shop-grid', text: '🛍 <b>상점</b>에서 💎지혜석과 🎫초대장을 살 수 있어요. 지금은 시험판이라 실제 결제 없이 바로 지급돼요.' },
  ],
};
let pageTut: { tab: string; i: number } | null = null, pageShown = '';
export const tabOf = (k: string) => k.replace(/2$/, '');     // 'stages2'(첫 전투 뒤 더 알려 주는 안내)도 stages 탭에서 보인다
/** 첫 전투를 마치고 홈으로 돌아왔을 때 나머지 안내 3단계(난이도·조합표·탭)를 한 번 보여 준다(J031: 첫 안내 4단계 → 2단계). */
export function pageTutMore() {
  const done = progress.tabTut ?? [];
  if (done.includes('stages') && !done.includes('stages2') && progress.battleTutDone) pageTutStart('stages2');
}
export function pageTutStart(tab: string) {
  if (!PAGE_TUT[tab] || (progress.tabTut ?? []).includes(tab)) return;
  pageTut = { tab, i: 0 }; pageShown = '';
}
function pageTutEnd() {
  if (pageTut) { progress.tabTut = [...new Set([...(progress.tabTut ?? []), pageTut.tab])]; saveProgress(progress); }
  pageTut = null; pageShown = ''; tutClear();
}
function pageTutTick() {
  if (!pageTut) return;
  if (tabOf(pageTut.tab) !== deps.getTab() || $('home').classList.contains('hidden')) { if (pageShown) { tutClear(); pageShown = ''; } if (tabOf(pageTut.tab) !== deps.getTab()) pageTut = null; return; }
  if (document.querySelector('.overlay, .vn, .prologue')) { if (pageShown) { tutClear(); pageShown = ''; } return; }
  const steps = PAGE_TUT[pageTut.tab], st = steps[pageTut.i], key = pageTut.tab + pageTut.i;
  if (pageShown === key) return;
  const target = document.querySelector(st.sel) as HTMLElement | null;
  if (!target) { pageTut.i++; if (pageTut.i >= steps.length) pageTutEnd(); return; }
  pageShown = key; tutClear();
  target.classList.add('tut-glow');
  target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  const b = document.createElement('div');
  const low = target.getBoundingClientRect().top > innerHeight * 0.5;
  b.className = `tut-bubble ${low ? 'upper' : ''}`;
  b.innerHTML = `<div class="tut-step">안내 ${pageTut.i + 1}/${steps.length}</div><p>${st.text}</p><div class="tut-btns"><button class="tut-skip">건너뛰기</button><button class="tut-next">${pageTut.i === steps.length - 1 ? '알겠어요!' : '다음 ▶'}</button></div>`;
  document.body.appendChild(b);
  (b.querySelector('.tut-skip') as HTMLElement).onclick = pageTutEnd;
  (b.querySelector('.tut-next') as HTMLElement).onclick = () => { if (!pageTut) return; pageTut.i++; if (pageTut.i >= steps.length) pageTutEnd(); else pageTutTick(); };
}
setInterval(pageTutTick, 300);
