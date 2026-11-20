// A1. 표시 확률 = 실제 확률 (로직 수준)
// 시드를 고정해 카드 뽑기 N판을 돌리고, 등급별 관측 비율이 표시 확률(CARD_RATES)의 ±3 표준오차 안인지 본다.
// 같은 시드로 두 번 돌려 결과가 완전히 같은지도 본다.
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const N = Number(process.env.GACHA_N || 100000);
const SEED = Number(process.env.GACHA_SEED || 20261120);
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { CARD_RATES, drawCard } = await server.ssrLoadModule('/src/meta.ts');
  const { PHIL, gradeRank } = await server.ssrLoadModule('/src/data.ts');
  const total = CARD_RATES.reduce((a, c) => a + c.rate, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `표시 확률 합계가 100%가 아님: ${total}`);

  const run = (seed) => {
    const orig = Math.random; Math.random = mulberry32(seed);
    try { const seq = []; for (let i = 0; i < N; i++) seq.push(drawCard(1, true)); return seq; }
    finally { Math.random = orig; }
  };
  const a = run(SEED), b = run(SEED);
  assert.deepEqual(a, b, '같은 시드인데 결과가 다름 (재현성 실패)');

  const count = new Map();
  for (const id of a) { const k = gradeRank(PHIL.get(id)); count.set(k, (count.get(k) || 0) + 1); }
  const bad = [];
  const rows = CARD_RATES.map((c) => {
    const k = gradeRank(c), p = c.rate, obs = (count.get(k) || 0) / N, se = Math.sqrt(p * (1 - p) / N);
    const ok = Math.abs(obs - p) <= 3 * se;
    if (!ok) bad.push(`${k}: 기대 ${(p * 100).toFixed(2)}% 관측 ${(obs * 100).toFixed(2)}% (허용 ±${(3 * se * 100).toFixed(3)}%p)`);
    return `${String(k).padEnd(4)} 기대 ${(p * 100).toFixed(2).padStart(5)}%  관측 ${(obs * 100).toFixed(3).padStart(6)}%  ${ok ? 'ok' : 'OUT'}`;
  });
  console.log(rows.join('\n'));
  assert.equal(bad.length, 0, `±3 표준오차 밖: ${bad.join(' / ')}`);
  console.log(`PASS: 카드 뽑기 ${N.toLocaleString()}판, ${CARD_RATES.length}개 등급 모두 ±3 표준오차 이내, 같은 시드 재현 100%`);
} finally { await server.close(); }
