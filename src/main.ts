import { Game, GRID, trackPos, type Tower } from './game';
import { PHIL, TIER_COLORS, TIER_STATS } from './data';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('field');
const ctx = canvas.getContext('2d')!;

let game = new Game();
let selected: Tower | null = null;
let speed = 1;
let cell = 0;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const size = canvas.clientWidth;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cell = size / GRID;
}
window.addEventListener('resize', resize);
resize();

// ---------- 입력: 탭으로 선택 / 이동 / 스왑 ----------
canvas.addEventListener('pointerdown', (ev) => {
  const r = canvas.getBoundingClientRect();
  const cx = Math.floor(((ev.clientX - r.left) / r.width) * GRID);
  const cy = Math.floor(((ev.clientY - r.top) / r.height) * GRID);
  const inner = cx >= 1 && cy >= 1 && cx < GRID - 1 && cy < GRID - 1;
  if (!inner) { selected = null; return; }
  const t = game.towerAt(cx, cy);
  if (selected && selected === t) selected = null;
  else if (selected) { game.moveTo(selected, cx, cy); selected = null; }
  else selected = t ?? null;
  updateUI();
});

$('summon').onclick = () => { game.summon(); updateUI(); };
$('sell').onclick = () => { if (selected) { game.sell(selected); selected = null; updateUI(); } };
$('start').onclick = () => {
  if (game.over) { game = new Game(); selected = null; } else game.startWave();
  updateUI();
};
$('speed').onclick = () => { speed = speed === 3 ? 1 : speed + 1; $('speed').textContent = `${speed}x`; };

// ---------- 하단 UI ----------
let lastSynthKey = '';
function updateUI() {
  $('gold').textContent = String(game.gold);
  $('lives').textContent = String(game.lives);
  $('wave').textContent = String(game.wave);
  $('cost').textContent = String(game.summonCost);
  $<HTMLButtonElement>('summon').disabled = game.gold < game.summonCost || !!game.over;
  $<HTMLButtonElement>('sell').disabled = !selected;
  const start = $<HTMLButtonElement>('start');
  start.textContent = game.over ? '다시 하기' : game.countdown > 0 ? `다음 웨이브 ${Math.ceil(game.countdown)}` : '웨이브 시작';
  start.disabled = !game.over && (game.running || game.countdown > 0);

  const info = $('info');
  if (game.over) info.innerHTML = game.over === 'win' ? '<b>🏛 아고라 수호 성공!</b> 10웨이브를 모두 논파했습니다.' : '<b>💀 멘탈 붕괴...</b> 도그마가 아고라를 점령했습니다.';
  else if (selected) {
    const p = PHIL.get(selected.philId)!;
    info.innerHTML = `<b>${'★'.repeat(p.tier)} ${p.name}</b> · ${p.school}<br>“${p.quote}”<br><small>${p.lore}</small><br><small>빈 칸을 누르면 이동, 다른 철학자를 누르면 자리 바꾸기</small>`;
  } else info.textContent = game.towers.length ? '철학자를 눌러 선택하세요. 재료가 모이면 아래에 연성 버튼이 뜹니다.' : '소환 버튼으로 1성 철학자를 불러오세요.';

  // 원터치 연성 버튼 (목록이 바뀔 때만 다시 그림)
  const recipes = game.over ? [] : game.availableRecipes();
  const key = recipes.map((r) => r.id).join();
  if (key !== lastSynthKey) {
    lastSynthKey = key;
    const box = $('synth');
    box.innerHTML = '';
    for (const r of recipes) {
      const b = document.createElement('button');
      const res = PHIL.get(r.result)!;
      b.textContent = `⚗ ${r.materials.map((m) => PHIL.get(m)!.name).join('+')} → ${res.name}`;
      b.onclick = () => { const t = game.synthesize(r); selected = t; updateUI(); };
      box.appendChild(b);
    }
  }
}

// ---------- 그리기 ----------
function draw() {
  const w = canvas.clientWidth;
  ctx.clearRect(0, 0, w, w);

  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
    const track = x === 0 || y === 0 || x === GRID - 1 || y === GRID - 1;
    ctx.fillStyle = track ? '#1c1917' : (x + y) % 2 ? '#182032' : '#1b2438';
    ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
  }

  if (selected) {
    const st = TIER_STATS[PHIL.get(selected.philId)!.tier]!;
    ctx.beginPath();
    ctx.arc((selected.cx + 0.5) * cell, (selected.cy + 0.5) * cell, st.range * cell, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(251,191,36,.08)'; ctx.fill();
    ctx.strokeStyle = 'rgba(251,191,36,.6)'; ctx.stroke();
  }

  for (const t of game.towers) {
    const p = PHIL.get(t.philId)!;
    const x = (t.cx + 0.5) * cell, y = (t.cy + 0.5) * cell;
    ctx.beginPath(); ctx.arc(x, y, cell * 0.38, 0, Math.PI * 2);
    ctx.fillStyle = TIER_COLORS[p.tier]; ctx.fill();
    ctx.lineWidth = t === selected ? 3 : 1.5;
    ctx.strokeStyle = t === selected ? '#fbbf24' : 'rgba(255,255,255,.3)'; ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${cell * 0.2}px sans-serif`;
    ctx.fillText(p.name.replace(/^(르네|임마누엘|바뤼흐) /, '').slice(0, 4), x, y);
    ctx.font = `${cell * 0.13}px sans-serif`; ctx.fillStyle = '#fbbf24';
    ctx.fillText('★'.repeat(p.tier), x, y + cell * 0.27);
  }

  for (const e of game.enemies) {
    const [ex, ey] = trackPos(e.dist);
    const x = ex * cell, y = ey * cell, r = cell * (e.boss ? 0.36 : 0.22);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = e.boss ? '#7f1d1d' : '#4c0519'; ctx.fill();
    ctx.font = `${r * 1.2}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(e.boss ? '⚖️' : '👺', x, y);
    ctx.fillStyle = '#000'; ctx.fillRect(x - r, y - r - 6, r * 2, 3);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(x - r, y - r - 6, r * 2 * Math.max(0, e.hp / e.maxHp), 3);
  }

  // 말풍선 탄환
  ctx.font = `700 ${Math.max(9, cell * 0.14)}px sans-serif`;
  for (const b of game.bullets) {
    const text = b.text.length > 9 ? b.text.slice(0, 8) + '…' : b.text;
    const tw = ctx.measureText(text).width + 8, x = b.x * cell, y = b.y * cell;
    ctx.fillStyle = 'rgba(254,243,199,.95)';
    ctx.beginPath(); ctx.roundRect(x - tw / 2, y - 8, tw, 16, 6); ctx.fill();
    ctx.fillStyle = '#1c1917'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }

  if (game.wave === 0 && !game.running && game.countdown < 0) {
    ctx.fillStyle = 'rgba(254,243,199,.8)'; ctx.font = `700 ${cell * 0.24}px serif`; ctx.textAlign = 'center';
    ctx.fillText('사유하라, 조합하라, 도그마를 논파하라!', w / 2, w / 2);
  }
}

// ---------- 루프 ----------
let last = performance.now();
let uiTimer = 0;
function loop(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000) * speed;
  last = now;
  game.update(dt);
  if ((uiTimer += dt) > 0.15) { uiTimer = 0; updateUI(); }
  draw();
  requestAnimationFrame(loop);
}
updateUI();
requestAnimationFrame(loop);
