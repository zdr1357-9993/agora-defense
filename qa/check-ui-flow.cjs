// RD-T062: exercise the real screen handlers without login, network, or a browser.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const path = require('node:path');

function handler(file, name, scope) {
  const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const node = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
  assert.ok(node, `${file}: ${name}`);
  const js = ts.transpileModule(node.getText(ast).replace(/^export\s+/, ''), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.createContext(scope);
  vm.runInContext(js, scope);
  return scope[name];
}

const stories = [
  { id: 'A5', chapter: 0, memories: ['test'], outro: [] },
  { id: 'P1', chapter: 1, memories: ['test'], outro: [] },
  { id: 'P2', chapter: 1, memories: ['test'], outro: [] },
];
function battleScope(storyId, over, next) {
  const timers = [], started = [];
  const scope = {
    game: { storyId, over, discovered: [], wave: 2, diff: { reward: 1, id: 'easy' } },
    STORY: stories, STORY_MAP: new Map(stories.map(s => [s.id, s])),
    progress: { seen: [], gonoe: 0, cards: {}, storyCleared: [], gems: 0 },
    PHILOSOPHERS: [{ realName: 'test', id: 'T1' }],
    XP_RATE: { easy: .2 }, pendingNextStory: stories[2],
    battleReward: () => 30, bump() {}, tierCap: () => 4, gainXp: () => '',
    saveProgress() {}, renderHome() {}, show() {}, switchTab() {},
    setTimeout: (fn, delay) => { timers.push({ fn, delay }); },
    startStory: st => started.push(st.id),
  };
  handler('main.ts', 'endBattle', scope)({ next });
  return { scope, timers, started };
}

let result = battleScope('P1', 'lose', true);
result.timers.forEach(t => t.fn());
assert.deepEqual(result.started, ['P1'], 'Loss retries the same story immediately');
assert.equal(result.scope.pendingNextStory, null, 'Retry does not leave a stale next-story request');
assert.deepEqual(result.scope.progress.storyCleared, [], 'Loss does not grant a clear');

result = battleScope('P1', 'win', true);
assert.equal(result.scope.pendingNextStory.id, 'P2', 'Win queues the next story after memory reveal');
assert.equal(result.scope.progress.storyCleared[0], 'P1');
assert.equal(result.timers.some(t => t.delay === 50), false, 'Win waits for the outro');

result = battleScope('A5', 'lose', true);
assert.equal(result.scope.pendingNextStory.id, 'P1', 'Tutorial still progresses after its scripted loss');
assert.equal(result.scope.progress.storyCleared[0], 'A5');

result = battleScope('P1', 'lose', false);
assert.equal(result.timers.length, 0, 'Home does not automatically restart a loss');
assert.equal(result.scope.pendingNextStory, null, 'Home cancels a previous next-story request');

const classList = { contains: () => false, toggle() {}, remove() {} };
const elements = Object.fromEntries(['.vn-face', '.vn-name', '.vn-text'].map(k => [k, { style: {}, textContent: '' }]));
let overlay, completed = 0, cleared = 0;
const dialogueScope = {
  document: {
    createElement: () => (overlay = { classList, querySelector: k => elements[k], remove() {} }),
    body: { appendChild() {} }, querySelectorAll: () => [],
  },
  sceneArt: () => '', PHILOSOPHERS: [], homage: s => s,
  window: { setInterval: () => 1 }, clearInterval: () => cleared++,
  sfx: { click() {} },
};
handler('main.ts', 'playDialogue', dialogueScope)([['나레이션', '첫 대사 전체'], ['나레이션', '둘째 대사']], null, () => completed++);
const tap = () => overlay.onclick({ target: { classList } });
tap();
assert.equal(elements['.vn-text'].textContent, '첫 대사 전체', 'First tap reveals the full current line');
assert.equal(completed, 0);
tap();
tap();
assert.equal(elements['.vn-text'].textContent, '둘째 대사', 'The next line can also be revealed without skipping');
assert.equal(completed, 0);
tap();
assert.equal(completed, 1, 'Only a tap after the final full line finishes the dialogue');
assert.ok(cleared > 0);

let watches = 0, rewardDone;
const buttons = { '.res-double': { disabled: false }, '.res-home': {}, '.res-next': {} };
const reward = { textContent: '' };
const rewardScope = {
  PHIL: new Map(), gradeRank: () => 1, STORY_MAP: new Map(),
  battleReward: () => 20, rewardText: r => String(r.gonoe),
  adFree: () => false, adsLeft: () => 3, claimable: () => false, progress: {},
  document: {
    createElement: () => ({ querySelector: k => k === '.res-reward b' ? reward : buttons[k], remove() {} }),
    body: { appendChild() {} },
  },
  watchAd: cb => { watches++; rewardDone = cb; },
};
handler('screens/result.ts', 'resultPanel', rewardScope)({ towers: [], wave: 2, over: 'lose', diff: { reward: 1 } }, '');
buttons['.res-double'].onclick();
buttons['.res-double'].onclick();
assert.equal(watches, 1, 'Rapid taps cannot start multiple reward ads');
rewardDone();
assert.equal(reward.textContent, '40', 'The applied reward is exactly doubled');
console.log('PASS UI flow: loss retry, victory continuation, tutorial continuation, home cancellation, dialogue reveal/advance, reward double-click');
