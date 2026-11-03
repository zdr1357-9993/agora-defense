// 7x7 격자: 바깥 테두리 한 바퀴가 도그마의 순환로, 안쪽 5x5(25칸)가 철학자 자리.
// 스테이지마다 도는 방향·속도·갈래가 조금씩 다르다.
// - loop: 순환로 (한 바퀴마다 멘탈 감소)

export const N = 7;
export type Pt = [number, number];
export interface Layout { paths: Pt[][]; loop?: boolean; speedMult?: number }
export interface StagePaths { layoutFor(wave: number): Layout; notice?: (wave: number) => string | null; caption: string }

const CW: Pt[] = [[0, 0], [6, 0], [6, 6], [0, 6], [0, 0]];   // 시계 방향
const CCW: Pt[] = [[0, 0], [0, 6], [6, 6], [6, 0], [0, 0]];  // 반시계 방향
const RING: Layout = { loop: true, paths: [CW] };
const RING_FAST: Layout = { loop: true, paths: [CW], speedMult: 1.25 };
const RING_REV: Layout = { loop: true, paths: [CCW] };
const RING_BOTH: Layout = { loop: true, paths: [CW, CCW] };

export const STAGE_PATHS: Record<string, StagePaths> = {
  S1: { caption: '광장을 도는 순환로', layoutFor: () => RING },
  S2: {
    caption: '성벽을 도는 순환로 · 25웨이브부터 순례 행렬이 빨라진다',
    layoutFor: (w) => (w >= 25 ? RING_FAST : RING),
    notice: (w) => (w === 25 ? '⛪ 순례 행렬이 빨라졌다!' : null),
  },
  S3: { caption: '음과 양, 두 방향으로 도는 태극 순환로', layoutFor: () => RING_BOTH },
  S4: {
    caption: '도시 순환로 · 20웨이브부터 산업혁명(속도 ×1.25)',
    layoutFor: (w) => (w >= 20 ? RING_FAST : RING),
    notice: (w) => (w === 20 ? '🏭 산업혁명! 적의 속도가 빨라진다' : null),
  },
  S5: {
    caption: '10웨이브마다 도는 방향이 뒤집히는 언어의 미궁',
    layoutFor: (w) => (Math.floor(w / 10) % 2 ? RING_REV : RING),
    notice: (w) => (w >= 10 && w % 10 === 0 ? '🌀 언어게임이 바뀌었다! 도는 방향이 뒤집힌다' : null),
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
