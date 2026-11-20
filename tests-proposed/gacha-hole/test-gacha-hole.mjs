// 뽑기/카드 저장 구멍 재현 시험 (의존성 없음, Node 22)
// 목적:
//   시험 계정 A로 "카드 30장 추가 + 고뇌 1억" data 를 save_progress 로 저장했을 때,
//   progress_guard 가 고뇌(재화)는 자르지만 cards(카드 목록)는 검사하지 않아 30장이 그대로 남는지 확인한다.
//   현재 코드에서는 "구멍 있음"이 나와야 정상이다.
//
// 환경 변수:
//   API_URL     (기본 http://127.0.0.1:3300)
//   JWT_SECRET  (필수)
//   EXPECT_FIXED=1  (선택: 구멍이 막혔을 때만 exit 0 하도록 전환)

import crypto from 'node:crypto';

const API = process.env.API_URL || 'http://127.0.0.1:3300';
const SECRET = process.env.JWT_SECRET;
const EXPECT_FIXED = process.env.EXPECT_FIXED === '1';

if (!SECRET) {
  console.log('BLOCKED: JWT_SECRET 없음');
  process.exit(2);
}

const USER_A = '00000000-0000-0000-0000-00000000000a';
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
function jwt(sub, role = 'authenticated') {
  const h = b64({ alg: 'HS256', typ: 'JWT' });
  const p = b64({ sub, role, exp: Math.floor(Date.now() / 1000) + 3600 });
  const sig = crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${sig}`;
}

async function api(method, path, { token, body, timeout = 5000 } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(API + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitApi(maxS = 30) {
  for (let i = 0; i < maxS; i++) {
    try {
      const r = await api('GET', '/progress?limit=0');
      if (r.status === 200) return true;
    } catch {}
    await sleep(500);
  }
  return false;
}

const saveA = (data, baseRev) =>
  api('POST', '/rpc/save_progress', {
    token: jwt(USER_A),
    body: { p_login_id: 'qa-a', p_data: data, p_base_revision: baseRev },
  });

async function readA() {
  const r = await api('GET', `/progress?user_id=eq.${USER_A}&select=revision,data`, {
    token: jwt(USER_A),
  });
  return Array.isArray(r.json) ? r.json[0] : undefined;
}

const sumCards = (cards = {}) =>
  Object.values(cards).reduce((acc, n) => acc + (typeof n === 'number' ? n : 0), 0);

const ready = await waitApi();
if (!ready) {
  console.log(`BLOCKED: PostgREST 응답 없음 (${API})`);
  process.exit(2);
}

// 1) 계정 A 초기 기준선 확보
let row = await readA();
if (!row) {
  const init = await saveA({ gonoe: 300, gems: 100, tickets: 0, cards: { T106: 1 } }, null);
  if (init.status !== 200 || init.json?.status !== 'ok') {
    console.log(`BLOCKED: 계정 A 초기 저장 실패 (${init.status}) ${init.text}`);
    process.exit(2);
  }
  row = await readA();
}

const beforeData = row.data || {};
const beforeCards = { ...(beforeData.cards || {}) };
const beforeCardSum = sumCards(beforeCards);
const beforeGonoe = Number(beforeData.gonoe ?? 0);

// 2) 공격 시나리오: 카드 +30장 추가 & 고뇌 1억(100,000,000)으로 저장 요청
const forgedCards = { ...beforeCards, T106: (beforeCards.T106 ?? 0) + 30 };
const forgedData = {
  ...beforeData,
  gonoe: 100_000_000,
  cards: forgedCards,
};

const res = await saveA(forgedData, row.revision);
if (res.status !== 200 || res.json?.status !== 'ok') {
  console.log(`BLOCKED: save_progress 호출 실패 (${res.status}) ${res.text}`);
  process.exit(2);
}

const after = await readA();
const afterGonoe = Number(after?.data?.gonoe ?? -1);
const afterCards = after?.data?.cards || {};
const afterCardSum = sumCards(afterCards);
const cardDelta = afterCardSum - beforeCardSum;

const gonoeClamped = afterGonoe < 100_000_000 && res.json?.clamped?.gonoe !== undefined;
const cardsSaved = cardDelta === 30;

console.log(`기준선: gonoe=${beforeGonoe}, cardsSum=${beforeCardSum}, rev=${row.revision}`);
console.log(`요청값: gonoe=100000000, cardsSum=${beforeCardSum + 30} (+30)`);
console.log(`저장응답: ${JSON.stringify(res.json)}`);
console.log(`서버결과: gonoe=${afterGonoe}, cardsSum=${afterCardSum} (delta=${cardDelta}), rev=${after?.revision}`);

if (gonoeClamped && cardsSaved) {
  console.log('구멍 있음: 고뇌(1억 → 잘림)는 progress_guard 가 차단했지만, 카드 +30장은 검사 없이 그대로 저장됨');
  process.exit(EXPECT_FIXED ? 1 : 0);
}

if (!cardsSaved && gonoeClamped) {
  console.log('구멍 막힘: 고뇌가 잘렸고, 비정상 카드 +30장도 서버에 저장되지 않음');
  process.exit(0);
}

console.log(`예상 외 결과: gonoeClamped=${gonoeClamped}, cardsSaved=${cardsSaved}`);
process.exit(1);
