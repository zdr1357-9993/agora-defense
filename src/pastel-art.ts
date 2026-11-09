import { eraArtUrl, artImage, type ArtName } from './artwork';
const ERAS = ['고대', '동양', '중세', '근대', '현대'];
const ARENAS: ArtName[] = ['arena-ancient-v2', 'arena-east-v2', 'arena-medieval-v2', 'arena-modern-v2', 'arena-contemporary-v2'];
export function journeyArt(era: string): string { return eraArtUrl(era); }
export const GREEK_BACKDROPS = [['greek-01', '올리브 아고라'], ['greek-02', '에게해 항구'], ['greek-03', '월계수 학당'], ['greek-04', '노을 신전'], ['greek-05', '낙서 공책 아고라']] as const;
export function arenaArtName(era: string, concept = 'era', storyId?: string): ArtName {
  if (storyId === 'P7') return 'arena-bodhi-v2';
  // Old saves may keep a Greek concept. It can only override the ancient map.
  if (era === '고대' && GREEK_BACKDROPS.some(([id]) => id === concept)) return concept as ArtName;
  return ARENAS[Math.max(0, ERAS.indexOf(era))];
}
export function arenaArt(era: string, concept = 'era', storyId?: string) { return artImage(arenaArtName(era,concept,storyId)); }
export function drawWaitingBench(x: CanvasRenderingContext2D, era: string, left: number, top: number, width: number, height: number) {
  const image = artImage('waiting-benches'); if (!image) return;
  const row = Math.max(0, ERAS.indexOf(era));
  const sy = Math.round(row * image.naturalHeight / 5), bottom = Math.round((row + 1) * image.naturalHeight / 5);
  x.drawImage(image, 0, sy, image.naturalWidth, bottom - sy, left, top, width, height);
}
/** Continuous courtyard: guides only appear when a philosopher is selected. */
export function drawPastelFloor(x: CanvasRenderingContext2D, era: string, cellX: number, cellY: number, grid: number, guides = false) {
  x.fillStyle = 'rgba(255,253,246,.34)';
  x.fillRect(cellX, cellY, (grid - 2) * cellX, (grid - 2) * cellY);
  if (!guides) return;
  x.strokeStyle = 'rgba(110,98,129,.055)'; x.lineWidth = 1;
  for (let n = 1; n < grid; n++) {
    x.beginPath(); x.moveTo(Math.round(n * cellX) + .5, cellY); x.lineTo(Math.round(n * cellX) + .5, (grid - 1) * cellY); x.stroke();
    x.beginPath(); x.moveTo(cellX, Math.round(n * cellY) + .5); x.lineTo((grid - 1) * cellX, Math.round(n * cellY) + .5); x.stroke();
  }
}
