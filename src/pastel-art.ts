import { eraArtUrl } from './artwork';
/** Small, code-native pixel scenery. No external images or asset downloads. */
const COLORS: Record<string, [string, string, string]> = {
  고대: ['#f2effb', '#ddd5ed', '#a9c8bb'],
  동양: ['#edf5ef', '#d5e6dd', '#a3c5b4'],
  중세: ['#f2eef8', '#dfd6eb', '#bcb1d2'],
  근대: ['#edf2fa', '#d4deef', '#aabbd4'],
  현대: ['#f6edf5', '#ead8e8', '#c5afd0'],
};

export function journeyArt(era: string): string {
  return eraArtUrl(era);
}

/** Quiet, alternating cells. Uses the actual game grid and cell dimensions. */
export function drawPastelFloor(x: CanvasRenderingContext2D, era: string, cellX: number, cellY: number, grid: number) {
  const [sky, stone] = COLORS[era] ?? COLORS.고대;
  x.fillStyle = sky; x.fillRect(0, 0, cellX * grid, cellY * grid);
  for (let row = 1; row < grid - 1; row++) for (let col = 1; col < grid - 1; col++) {
    x.fillStyle = (row + col) % 2 ? '#e3f3ed' : '#edf8f3';
    x.fillRect(col * cellX + 1, row * cellY + 1, cellX - 2, cellY - 2);
    x.strokeStyle = '#b8accd'; x.lineWidth = 1.5;
    x.strokeRect(col * cellX + .5, row * cellY + .5, cellX - 1, cellY - 1);
  }
}
