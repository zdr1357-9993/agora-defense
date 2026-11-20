// 철랜디 A7(권한)·A8(동시 저장·DB 장애) 시험. 의존성 없음(Node 22).
// 사용: node runner.mjs a7 | a8 | all
// 환경: API_URL(PostgREST), JWT_SECRET, METRICS_PORT(기본 9100), KILL_POD(기본 agora-db-0, 'manual' 이면 직접 죽이기)
//       P95_MS(기본 1000), LOSS_S(기본 30), RESULT_FILE(선택: 결과 JSON 경로)
import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';

const API = process.env.API_URL || 'http://127.0.0.1:3300';
const SECRET = process.env.JWT_SECRET;
const P95_MS = Number(process.env.P95_MS || 1000);
const LOSS_S = Number(process.env.LOSS_S || 30);
const KILL_POD = process.env.KILL_POD || 'agora-db-0';
if (!SECRET) { console.log('BLOCKED: JWT_SECRET 없음'); process.exit(2); }

const U = { A: '00000000-0000-0000-0000-00000000000a', B: '00000000-0000-0000-0000-00000000000b', M: '00000000-0000-0000-0000-00000000000c' };
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
function jwt(sub, secret = SECRET, role = 'authenticated') {
  const h = b64({ alg: 'HS256', typ: 'JWT' }), p = b64({ sub, role, exp: Math.floor(Date.now() / 1000) + 3600 });
  return `${h}.${p}.${crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url')}`;
}

// ---- 지표(Prometheus 텍스트 형식) ----
const BUCKETS = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];
const M = { hist: new Map(), counters: new Map(), gauges: new Map() };
const live = { active: false, pending: false, ackedAt: Date.now() };
function observe(phase, sec) {
  let h = M.hist.get(phase); if (!h) M.hist.set(phase, h = { b: BUCKETS.map(() => 0), sum: 0, n: 0 });
  BUCKETS.forEach((le, i) => { if (sec <= le) h.b[i]++; }); h.sum += sec; h.n++;
}
const inc = (k) => M.counters.set(k, (M.counters.get(k) || 0) + 1);
const gauge = (k, v) => M.gauges.set(k, v);
function metricsText() {
  let s = '# TYPE agora_save_seconds histogram\n';
  for (const [ph, h] of M.hist) {
    BUCKETS.forEach((le, i) => { s += `agora_save_seconds_bucket{phase="${ph}",le="${le}"} ${h.b[i]}\n`; });
    s += `agora_save_seconds_bucket{phase="${ph}",le="+Inf"} ${h.n}\nagora_save_seconds_sum{phase="${ph}"} ${h.sum}\nagora_save_seconds_count{phase="${ph}"} ${h.n}\n`;
  }
  s += '# TYPE agora_save_total counter\n';
  for (const [k, v] of M.counters) { const [ph, r] = k.split('|'); s += `agora_save_total{phase="${ph}",result="${r}"} ${v}\n`; }
  // 저장 안 된 진행의 나이는 긁어 가는 그 순간에 계산한다(대기열 루프가 응답을 기다리는 동안에도 정확하게)
  if (live.pending) M.gauges.set('pending_unsaved_ms', Date.now() - live.ackedAt);
  else if (live.active) M.gauges.set('pending_unsaved_ms', 0);
  s += '# TYPE agora_gauge gauge\n';
  for (const [k, v] of M.gauges) s += `agora_gauge{name="${k}"} ${v}\n`;
  return s;
}
const mport = Number(process.env.METRICS_PORT || 9100);
const msrv = http.createServer((q, r) => { r.setHeader('content-type', 'text/plain; version=0.0.4'); r.end(metricsText()); });
msrv.listen(mport, () => console.log(`지표: :${mport}/metrics`));

// ---- API ----
async function api(method, path, { token, body, timeout = 3000 } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const t0 = performance.now();
  try {
    const r = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeout) });
    const txt = await r.text(); let json = null; try { json = JSON.parse(txt); } catch {}
    return { status: r.status, json, ms: performance.now() - t0 };
  } catch (e) { return { status: 0, json: null, ms: performance.now() - t0, err: String(e.name || e) }; }
}
const save = (who, data, base, opt = {}) => api('POST', '/rpc/save_progress', { token: jwt(U[who]), body: { p_login_id: 'qa-' + who.toLowerCase(), p_data: data, p_base_revision: base }, ...opt });
async function readRow(who, uid = U[who]) {
  const r = await api('GET', `/progress?user_id=eq.${uid}&select=revision,data`, { token: jwt(U[who]) });
  return Array.isArray(r.json) ? r.json[0] : undefined;
}
async function waitApi(maxS = 120) {
  for (let i = 0; i < maxS; i++) { const r = await api('GET', '/progress?limit=0'); if (r.status === 200) return true; await sleep(1000); }
  return false;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function rec(id, title, status, detail) { results.push({ id, title, status, detail }); console.log(`${status === 'passed' ? 'PASS' : status === 'failed' ? 'FAIL' : 'BLOCKED'}  ${id} ${title} — ${detail}`); }
const check = (id, title, ok, detail) => rec(id, title, ok ? 'passed' : 'failed', detail);

// ---- A7: 실제 인증 경로로 권한 시험 ----
async function a7() {
  console.log('\n== A7 권한 (PostgREST + RLS + JWT) ==');
  const a0 = await readRow('A'); const base = a0 ? a0.revision : null;
  const s = await save('A', { gonoe: 1000, gems: 10, tickets: 1, mark: 'A' }, base);
  if (s.status !== 200) return rec('A7-0', 'A 계정 저장 가능', 'blocked', `status ${s.status} ${s.err || JSON.stringify(s.json)}`);
  check('A7-0', 'A 계정은 RPC로 저장할 수 있다', s.json?.status === 'ok', JSON.stringify(s.json));

  const rb = await api('GET', `/progress?user_id=eq.${U.A}`, { token: jwt(U.B) });
  check('A7-1', 'B는 A의 진행을 읽을 수 없다', rb.status === 200 && Array.isArray(rb.json) && rb.json.length === 0, `status ${rb.status}, 행 ${rb.json?.length}`);

  const pb = await api('PATCH', `/progress?user_id=eq.${U.A}`, { token: jwt(U.B), body: { data: { gonoe: 999999999 } } });
  const after = await readRow('A');
  check('A7-2', 'B는 A의 진행을 덮어쓸 수 없다', pb.status >= 400 && after?.data?.mark === 'A', `PATCH ${pb.status}, A의 mark=${after?.data?.mark}`);

  const pa = await api('PATCH', `/progress?user_id=eq.${U.A}`, { token: jwt(U.A), body: { data: { gonoe: 5 } } });
  check('A7-3', '본인도 직접 쓰기는 막히고 RPC로만 저장한다', pa.status >= 400, `PATCH ${pa.status}`);

  const an = await api('GET', '/progress');
  const as = await api('POST', '/rpc/save_progress', { body: { p_login_id: 'x', p_data: {}, p_base_revision: null } });
  check('A7-4', '비로그인은 아무 진행도 읽거나 저장할 수 없다', an.status === 200 && an.json?.length === 0 && as.status >= 400, `읽기 ${an.status}/${an.json?.length}행, 저장 ${as.status}`);

  const fk = await api('GET', '/progress', { token: jwt(U.A, 'wrong-secret-wrong-secret-wrong-secret') });
  check('A7-5', '위조 토큰(다른 비밀키)은 거절된다', fk.status === 401, `status ${fk.status}`);

  const ro = await api('POST', '/player_roles', { token: jwt(U.B), body: { user_id: U.B, role: 'master' } });
  check('A7-6', '스스로 master 역할을 줄 수 없다', ro.status >= 400, `status ${ro.status}`);

  const ins = await api('POST', '/progress', { token: jwt(U.B), body: { user_id: U.A, login_id: 'qa-a', data: { gonoe: 1 } } });
  const insSelf = await api('POST', '/progress', { token: jwt(U.B), body: { user_id: U.B, login_id: 'qa-b', data: { gonoe: 999999999 } } });
  check('A7-9', '직접 INSERT로 남의 줄·내 줄을 새로 만들 수 없다', ins.status >= 400 && insSelf.status >= 400, `남의 줄 ${ins.status}, 내 줄 ${insSelf.status}`);

  const delOther = await api('DELETE', `/progress?user_id=eq.${U.A}`, { token: jwt(U.B) });
  const delSelf = await api('DELETE', `/progress?user_id=eq.${U.A}`, { token: jwt(U.A) });
  const still = await readRow('A');
  check('A7-10', 'DELETE로 남의 줄도 내 줄도 지울 수 없다', delOther.status >= 400 && delSelf.status >= 400 && !!still, `남의 줄 ${delOther.status}, 내 줄 ${delSelf.status}, A의 줄 남아 있음=${!!still}`);

  const cur = await readRow('A');
  const cl = await save('A', { ...cur.data, gonoe: cur.data.gonoe + 50_000_000 }, cur.revision);
  const got = (await readRow('A'))?.data?.gonoe;
  check('A7-7', '일반 계정의 비정상 재화 증가는 서버가 자른다', cl.json?.status === 'ok' && got < cur.data.gonoe + 50_000_000, `요청 +5천만 → 저장 ${got} (clamped=${JSON.stringify(cl.json?.clamped)})`);

  const m0 = await readRow('M');
  const ms = await save('M', { gonoe: 50_000_000 }, m0 ? m0.revision : null);
  check('A7-8', 'master 계정은 재화 한도 검사를 받지 않는다', ms.json?.status === 'ok' && !ms.json?.clamped, JSON.stringify(ms.json));
}

// ---- A8: 응답 시간, 동시 저장, DB 장애 ----
async function a8() {
  console.log('\n== A8-1 저장 응답 시간 ==');
  let row = await readRow('B'); let rev = row ? row.revision : null; const lat = [];
  for (let i = 0; i < 300; i++) {
    const r = await save('B', { gonoe: 100 + i, gems: 1, tickets: 0, i }, rev);
    observe('latency', r.ms / 1000); inc(`latency|${r.json?.status || 'error'}`);
    if (r.json?.status === 'ok') { rev = r.json.revision; lat.push(r.ms); }
  }
  lat.sort((a, b) => a - b);
  const p = (q) => lat[Math.min(lat.length - 1, Math.floor(q * lat.length))];
  const p95 = p(0.95); gauge('latency_p95_ms', p95);
  check('A8-1', `저장 p95 ${P95_MS}ms 이하`, lat.length === 300 && p95 <= P95_MS, `성공 ${lat.length}/300, p50 ${p(0.5).toFixed(1)}ms, p95 ${p95.toFixed(1)}ms, 최대 ${lat.at(-1).toFixed(1)}ms`);

  console.log('\n== A8-2 같은 계정 동시 저장 100라운드 ==');
  let bad = 0; const notes = [];
  for (let k = 0; k < 100; k++) {
    const cur = await readRow('B');
    const [x, y] = await Promise.all([save('B', { gonoe: 10, gems: 1, tickets: 0, who: 'x', k }, cur.revision), save('B', { gonoe: 10, gems: 1, tickets: 0, who: 'y', k }, cur.revision)]);
    for (const r of [x, y]) { observe('concurrent', r.ms / 1000); inc(`concurrent|${r.json?.status || 'error'}`); }
    const st = [x.json?.status, y.json?.status].sort().join(',');
    const after = await readRow('B'); const winner = x.json?.status === 'ok' ? 'x' : 'y';
    const ok = st === 'conflict,ok' && after.revision === cur.revision + 1 && after.data.who === winner && after.data.k === k;
    if (!ok) { bad++; if (notes.length < 3) notes.push(`라운드 ${k}: ${st}, rev ${cur.revision}→${after.revision}, who=${after.data.who}`); }
  }
  check('A8-2', '동시 저장 시 하나만 이기고 하나는 충돌로 돌아온다(덮어쓰기 없음)', bad === 0, bad ? `${bad}/100 라운드 이상 · ${notes.join(' / ')}` : '100/100 라운드: ok 1 + conflict 1, revision +1, 이긴 쪽 데이터 저장');

  console.log('\n== A8-3 DB 파드 삭제 중 저장(재시도 대기열) ==');
  await chaos();
}

async function killPod() {
  if (KILL_POD === 'manual') { console.log('>>> 지금 다른 터미널에서: kubectl -n agora-test delete pod agora-db-0'); return true; }
  const tok = '/var/run/secrets/kubernetes.io/serviceaccount/token';
  if (!fs.existsSync(tok)) { console.log('클러스터 밖이라 파드를 직접 못 죽임 → KILL_POD=manual 로 실행하세요'); return false; }
  const ns = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/namespace', 'utf8').trim();
  return new Promise((res) => {
    const req = https.request({ host: 'kubernetes.default.svc', port: 443, method: 'DELETE', path: `/api/v1/namespaces/${ns}/pods/${KILL_POD}`,
      headers: { authorization: `Bearer ${fs.readFileSync(tok, 'utf8').trim()}` }, ca: fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt') },
      (r) => { r.resume(); console.log(`파드 삭제 요청 → ${r.statusCode}`); res(r.statusCode < 300); });
    req.on('error', (e) => { console.log('파드 삭제 실패', e.message); res(false); }); req.end();
  });
}

async function chaos() {
  // 게임 클라이언트를 흉내: 250ms마다 진행이 하나 늘고, 대기열은 최신 상태만 들고 있다가 저장한다.
  let rev = (await readRow('A'))?.revision ?? null;
  const base = (await readRow('A'))?.data || {};
  let n = 0, latest = null, acked = 0, ackedAt = Date.now(), inflight = false, backoff = 300;
  let firstFail = null, recovered = null, killed = false, maxLossMs = 0, flushedAt = null, conflicts = 0;
  const t0 = Date.now(); let producing = true;
  const prod = setInterval(() => { if (producing) { n++; latest = { ...base, gonoe: base.gonoe ?? 0, qa_counter: n, made: Date.now() }; } }, 250);
  const deadline = t0 + 150_000;
  while (Date.now() < deadline) {
    const now = Date.now();
    if (!killed && now - t0 > 5000) { killed = true; const ok = await killPod(); if (!ok) { clearInterval(prod); return rec('A8-3', 'DB 장애 중 진행 손실 없음', 'blocked', '파드를 죽이지 못함'); } }
    // 손실 위험: 아직 저장 안 된 가장 오래된 진행이 얼마나 묵었나
    if (latest && latest.qa_counter > acked) maxLossMs = Math.max(maxLossMs, now - ackedAt - 250);
    live.active = true; live.pending = !!(latest && latest.qa_counter > acked); live.ackedAt = ackedAt;
    if (!producing && latest && acked === latest.qa_counter) { flushedAt = now; break; }
    if (recovered && now - recovered > 15_000) producing = false;  // 복구 후 15초 더 돌리고 멈춰서 마지막까지 저장되는지 본다
    if (!inflight && latest && latest.qa_counter > acked) {
      inflight = true; const snap = latest;
      const r = await save('A', snap, rev, { timeout: 2000 });
      observe('chaos', r.ms / 1000);
      const st = r.json?.status || 'error'; inc(`chaos|${st}`);
      if (st === 'ok') {
        rev = r.json.revision; acked = snap.qa_counter; ackedAt = Date.now(); backoff = 300;
        if (firstFail && !recovered) { recovered = Date.now(); console.log(`복구: 장애 ${(recovered - firstFail) / 1000}s 만에 첫 저장 성공`); }
      } else if (st === 'conflict') {
        conflicts++; rev = r.json.revision;   // 응답을 못 받았지만 실제로는 저장된 경우 → 서버 번호로 맞추고 다시
      } else {
        if (!firstFail) { firstFail = Date.now(); console.log(`첫 저장 실패: t=${((firstFail - t0) / 1000).toFixed(1)}s (${r.err || r.status})`); }
        await sleep(backoff); backoff = Math.min(backoff * 2, 2000);
      }
      inflight = false;
    } else await sleep(50);
  }
  clearInterval(prod); live.pending = false;
  const server = await readRow('A');
  const outage = firstFail && recovered ? (recovered - firstFail) / 1000 : null;
  gauge('outage_seconds', outage ?? -1); gauge('max_unsaved_seconds', maxLossMs / 1000);
  const detail = `장애 ${outage ?? '감지 안 됨'}s, 저장 안 된 진행의 최대 나이 ${(maxLossMs / 1000).toFixed(1)}s, 충돌 후 재정렬 ${conflicts}회, 마지막 진행 ${latest?.qa_counter} / 서버 ${server?.data?.qa_counter}`;
  if (!firstFail) return rec('A8-3', `DB 장애 중 진행 손실 ${LOSS_S}초 이하`, 'blocked', '장애가 관측되지 않음(파드가 안 죽었거나 너무 빨리 살아남) · ' + detail);
  if (!flushedAt) return rec('A8-3', `DB 장애 중 진행 손실 ${LOSS_S}초 이하`, 'failed', '시간 안에 대기열을 비우지 못함 · ' + detail);
  check('A8-3', `DB 장애 중 진행 손실 ${LOSS_S}초 이하, 마지막 진행까지 저장`, maxLossMs / 1000 <= LOSS_S && server?.data?.qa_counter === latest.qa_counter, detail);
}

const mode = process.argv[2] || 'all';
if (!(await waitApi())) { rec('ENV', 'API 접속', 'blocked', `${API} 에 닿지 않음`); }
else { if (mode === 'a7' || mode === 'all') await a7(); if (mode === 'a8' || mode === 'all') await a8(); }
const sum = { passed: 0, failed: 0, blocked: 0 }; results.forEach((r) => sum[r.status]++);
console.log(`\n결과: 통과 ${sum.passed} · 실패 ${sum.failed} · 막힘 ${sum.blocked}`);
console.log('RESULT_JSON ' + JSON.stringify(results));
if (process.env.RESULT_FILE) fs.writeFileSync(process.env.RESULT_FILE, JSON.stringify(results, null, 2));
const hold = Number(process.env.HOLD_S || 0);  // Prometheus 가 마지막 값을 긁어 갈 시간
if (hold) { console.log(`지표 유지 ${hold}s`); await sleep(hold * 1000); }
msrv.close(); process.exit(sum.failed ? 1 : 0);
