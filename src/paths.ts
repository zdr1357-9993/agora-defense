// 스테이지별 길 모양 (9x9 격자 좌표의 꺾은선)
// - loop: 순환로 (한 바퀴마다 멘탈 감소) / 그 외: 입구→출구 (출구 도착 시 멘탈 감소)
// - 웨이브에 따라 길이 바뀌는 "변화 장치"도 여기서 정의

export const N = 9;
export type Pt = [number, number];
export interface Layout { paths: Pt[][]; loop?: boolean; speedMult?: number }
export interface StagePaths { layoutFor(wave: number): Layout; notice?: (wave: number) => string | null; caption: string }

const ATHENS: Layout = { loop: true, paths: [[[0, 0], [8, 0], [8, 8], [0, 8], [0, 0]]] };

// 신앙의 성채: 바깥에서 제단(중심)으로 감기는 나선. 10웨이브부터 바깥 성벽 붕괴 → 길이 짧아짐
const FORTRESS_FULL: Layout = { paths: [[[0, 0], [8, 0], [8, 8], [0, 8], [0, 2], [6, 2], [6, 6], [2, 6], [2, 4], [4, 4]]] };
const FORTRESS_BROKEN: Layout = { paths: [[[0, 2], [6, 2], [6, 6], [2, 6], [2, 4], [4, 4]]] };

// 백가의 숲: 태극 S자. 음/양 두 갈래 중 적이 무작위로 한 길을 고름
const FOREST: Layout = {
  paths: [
    [[4, 0], [4, 1], [1, 1], [1, 4], [7, 4], [7, 7], [4, 7], [4, 8]],
    [[4, 0], [4, 1], [7, 1], [7, 4], [1, 4], [1, 7], [4, 7], [4, 8]],
  ],
};

// 계몽의 도시: 지그재그 컨베이어. 10웨이브부터 산업혁명(적 속도 ×1.3)
const CITY: Layout = { paths: [[[0, 0], [8, 0], [8, 2], [0, 2], [0, 4], [8, 4], [8, 6], [0, 6], [0, 8], [8, 8]]] };
const CITY_FAST: Layout = { ...CITY, speedMult: 1.3 };

// 언어의 미궁: 5웨이브마다 벽이 바뀌는 미로 (언어게임 — 쓰임이 바뀌면 길도 바뀐다)
const MAZES: Layout[] = [
  { paths: [[[0, 0], [0, 3], [3, 3], [3, 0], [6, 0], [6, 5], [2, 5], [2, 8], [8, 8]]] },
  { paths: [[[8, 0], [4, 0], [4, 2], [1, 2], [1, 6], [5, 6], [5, 4], [7, 4], [7, 8], [0, 8]]] },
  { paths: [[[0, 4], [2, 4], [2, 1], [6, 1], [6, 3], [4, 3], [4, 6], [8, 6], [8, 2]]] },
];

export const STAGE_PATHS: Record<string, StagePaths> = {
  S1: { caption: '광장을 도는 순환로', layoutFor: () => ATHENS },
  S2: {
    caption: '제단으로 감기는 나선 · 10웨이브부터 바깥 성벽 붕괴',
    layoutFor: (w) => (w >= 10 ? FORTRESS_BROKEN : FORTRESS_FULL),
    notice: (w) => (w === 10 ? '🧱 바깥 성벽이 무너졌다! 길이 짧아진다' : null),
  },
  S3: { caption: '음양으로 갈라지는 태극의 두 길', layoutFor: () => FOREST },
  S4: {
    caption: '도시를 오가는 지그재그 · 10웨이브부터 산업혁명',
    layoutFor: (w) => (w >= 10 ? CITY_FAST : CITY),
    notice: (w) => (w === 10 ? '🏭 산업혁명! 적의 속도가 빨라진다' : null),
  },
  S5: {
    caption: '10웨이브부터 5웨이브마다 벽이 바뀌는 미궁',
    layoutFor: (w) => (w < 10 ? MAZES[0] : MAZES[(1 + Math.floor((w - 10) / 5)) % MAZES.length]),
    notice: (w) => (w >= 10 && (w - 10) % 5 === 0 ? '🌀 언어게임이 바뀌었다! 미궁의 벽이 움직인다' : null),
  },
};

// ---------- 기하 계산 ----------
export function pathLength(path: Pt[]) {
  let L = 0;
  for (let i = 1; i < path.length; i++) L += Math.abs(path[i][0] - path[i - 1][0]) + Math.abs(path[i][1] - path[i - 1][1]);
  return L;
}

/** 꺾은선 위 거리 d의 좌표 (칸 중심 기준, +0.5) */
export function pointAt(path: Pt[], d: number): [number, number] {
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1], [bx, by] = path[i];
    const seg = Math.abs(bx - ax) + Math.abs(by - ay);
    if (d <= seg) {
      const t = seg ? d / seg : 0;
      return [ax + (bx - ax) * t + 0.5, ay + (by - ay) * t + 0.5];
    }
    d -= seg;
  }
  const [x, y] = path[path.length - 1];
  return [x + 0.5, y + 0.5];
}

/** 길이 지나가는 칸 집합 ("x,y") */
export function pathCells(layout: Layout) {
  const set = new Set<string>();
  for (const path of layout.paths)
    for (let i = 1; i < path.length; i++) {
      const [ax, ay] = path[i - 1], [bx, by] = path[i];
      const sx = Math.sign(bx - ax), sy = Math.sign(by - ay);
      for (let x = ax, y = ay; ; x += sx, y += sy) {
        set.add(`${x},${y}`);
        if (x === bx && y === by) break;
      }
    }
  return set;
}
