import { eraArtUrl, artImage } from './artwork';
const ERAS = ['고대', '동양', '중세', '근대', '현대'];
const COLORS = ['#f1e9dc', '#e3eee7', '#eee5f3', '#e9eef6', '#f5e5ec'];
export function journeyArt(era: string): string { return eraArtUrl(era); }
/** Equal-cell atlas; rounded boundaries avoid sampling neighbouring eras. */
export function drawEraTile(x: CanvasRenderingContext2D, era: string, column: number, dx: number, dy: number, width: number, height = width) {
  const row = Math.max(0, ERAS.indexOf(era));
  const image = artImage('battle-tiles');
  if (!image) { x.fillStyle = COLORS[row]; x.fillRect(dx, dy, width, height); return; }
  const sx = Math.round(column * image.naturalWidth / 5), sy = Math.round(row * image.naturalHeight / 5);
  const sw = Math.round((column + 1) * image.naturalWidth / 5) - sx;
  const sh = Math.round((row + 1) * image.naturalHeight / 5) - sy;
  x.drawImage(image, sx, sy, sw, sh, dx, dy, width, height);
}
export function drawPastelFloor(x: CanvasRenderingContext2D, era: string, cellX: number, cellY: number, grid: number) {
  x.imageSmoothingEnabled = false;
  for (let row = 0; row < grid; row++) for (let col = 0; col < grid; col++) {
    const inner = row > 0 && col > 0 && row < grid - 1 && col < grid - 1;
    const left = Math.round(col * cellX), top = Math.round(row * cellY);
    const width = Math.round((col + 1) * cellX) - left, height = Math.round((row + 1) * cellY) - top;
    drawEraTile(x, era, inner ? (row + col) % 2 : 2, left, top, width, height);
    if (inner) { x.strokeStyle = '#b5a7bd'; x.lineWidth = 1; x.strokeRect(left + .5, top + .5, width - 1, height - 1); }
  }
}
