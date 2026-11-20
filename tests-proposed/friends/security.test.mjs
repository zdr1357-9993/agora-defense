import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

const base = process.env.API_URL ?? 'http://127.0.0.1:3300';
const secret = process.env.JWT_SECRET;
assert.ok(secret, 'JWT_SECRET must be the local test PostgREST secret');
const ids = {
  a: process.env.FRIEND_A_ID ?? '00000000-0000-0000-0000-00000000000a',
  b: process.env.FRIEND_B_ID ?? '00000000-0000-0000-0000-00000000000b',
  c: process.env.FRIEND_C_ID ?? '00000000-0000-0000-0000-00000000000c',
};
const b64 = (x) => Buffer.from(JSON.stringify(x)).toString('base64url');
const tokenFor = (sub) => {
  const data = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role: 'authenticated', sub, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 900 })}`;
  return `${data}.${createHmac('sha256', secret).update(data).digest('base64url')}`;
};
async function request(uid, path, method = 'GET', body, prefer = '') {
  return fetch(`${base}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: 'test', authorization: `Bearer ${tokenFor(uid)}`,
      'content-type': 'application/json', ...(prefer ? { prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const readRows = async (uid, table) => {
  const path = table.includes('?') ? `${table}&select=*` : `${table}?select=*`;
  const r = await request(uid, path);
  assert.equal(r.status, 200, `${table} read failed: ${await r.text()}`);
  return r.json();
};

const sent = await request(ids.a, 'rpc/send_friend_request', 'POST', { p_target_login_id: 'qa-m' });
assert.equal(sent.status, 200, `A could not send request: ${await sent.text()}`);
const [pending] = await readRows(ids.c, 'friendships');
assert.ok(pending?.id, 'M cannot see A\'s incoming request');
const accepted = await request(ids.c, 'rpc/respond_friend_request', 'POST', { p_friendship_id: pending.id, p_action: 'accept' });
assert.equal(accepted.status, 200, `M could not accept request: ${await accepted.text()}`);

const aRows = await readRows(ids.a, 'friendships');
assert.ok(aRows.some((f) => f.status === 'accepted' && f.requester_id === ids.a && f.addressee_id === ids.c));
const bRows = await readRows(ids.b, 'friendships');
assert.equal(bRows.length, 0, 'B can see A and M\'s friend relationship');
assert.equal((await readRows(ids.b, `friend_presence?user_id=eq.${ids.a}`)).length, 0, 'B can see A last_seen without being a friend');

const touched = await request(ids.a, 'rpc/touch_friend_presence', 'POST', {});
assert.equal(touched.status, 200, `A could not update own presence: ${await touched.text()}`);
const before = (await readRows(ids.a, `friend_presence?user_id=eq.${ids.a}`))[0]?.last_seen;
assert.ok(before, 'A presence row missing');
const forbidden = await request(ids.b, `friend_presence?user_id=eq.${ids.a}`, 'PATCH', { last_seen: '2999-01-01T00:00:00Z' }, 'return=representation');
assert.ok(forbidden.status >= 400, `B updated A presence (HTTP ${forbidden.status})`);
const after = (await readRows(ids.a, `friend_presence?user_id=eq.${ids.a}`))[0]?.last_seen;
assert.equal(after, before, 'B changed A last_seen');

console.log('PASS: friend rows are private; another user cannot change last_seen');
