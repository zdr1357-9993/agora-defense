/** Small, code-native pixel scenery. No external images or asset downloads. */
const scenes = new Map<string, string>();
const COLORS: Record<string, [string, string, string]> = {
  고대: ['#f2effb', '#ddd5ed', '#a9c8bb'],
  동양: ['#edf5ef', '#d5e6dd', '#a3c5b4'],
  중세: ['#f2eef8', '#dfd6eb', '#bcb1d2'],
  근대: ['#edf2fa', '#d4deef', '#aabbd4'],
  현대: ['#f6edf5', '#ead8e8', '#c5afd0'],
};

export function journeyArt(era: string): string {
  const hit = scenes.get(era);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = 160; canvas.height = 240;
  const x = canvas.getContext('2d')!;
  const [sky, stone, leaf] = COLORS[era] ?? COLORS.고대;
  const rect = (a: number, b: number, w: number, h: number, color: string) => {
    x.fillStyle = color; x.fillRect(a, b, w, h);
  };
  rect(0, 0, 160, 240, sky);
  // A tiny temple and an olive tree leave the route in the middle quiet.
  const ink = '#9b98b5', light = '#fffdf6';
  for (let i = 0; i < 5; i++) rect(11 + i * 3, 31 - i * 2, 38 - i * 6, 2, stone);
  rect(10, 32, 42, 3, ink); rect(12, 35, 38, 3, light);
  for (let i = 0; i < 4; i++) { rect(15 + i * 9, 38, 5, 20, stone); rect(15 + i * 9, 38, 2, 20, light); }
  rect(10, 58, 42, 3, ink); rect(7, 61, 48, 3, stone);
  rect(130, 141, 4, 21, '#b9a6a5'); rect(124, 146, 6, 3, '#b9a6a5');
  rect(117, 124, 29, 17, leaf); rect(112, 130, 40, 9, leaf);
  rect(122, 120, 17, 6, leaf); rect(119, 126, 8, 4, '#c9dfca'); rect(136, 131, 8, 4, '#c9dfca');
  for (const [a, b] of [[18, 105], [138, 75], [28, 187], [115, 210]]) {
    rect(a, b, 2, 3, leaf); rect(a + 3, b + 1, 2, 2, leaf);
  }
  rect(0, 226, 37, 14, '#d8e8f4'); rect(0, 233, 55, 7, '#d8e8f4');
  rect(5, 230, 8, 1, '#fffdfd'); rect(25, 236, 10, 1, '#fffdfd');
  const url = canvas.toDataURL(); scenes.set(era, url); return url;
}

/** Quiet, alternating cells. Uses the actual game grid and cell dimensions. */
export function drawPastelFloor(x: CanvasRenderingContext2D, era: string, cellX: number, cellY: number, grid: number) {
  const [sky, stone] = COLORS[era] ?? COLORS.고대;
  x.fillStyle = sky; x.fillRect(0, 0, cellX * grid, cellY * grid);
  for (let row = 1; row < grid - 1; row++) for (let col = 1; col < grid - 1; col++) {
    x.fillStyle = (row + col) % 2 ? '#f9f7fc' : '#f1f5f6';
    x.fillRect(col * cellX + 1, row * cellY + 1, cellX - 2, cellY - 2);
    x.strokeStyle = stone; x.lineWidth = 1;
    x.strokeRect(col * cellX + .5, row * cellY + .5, cellX - 1, cellY - 1);
  }
}
