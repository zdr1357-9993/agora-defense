import profiles from './signature-profiles.json';
import { artImage } from './artwork';
export type SignatureProfile = typeof profiles[keyof typeof profiles];
export const signatureProfile = (id: string): SignatureProfile => profiles[id as keyof typeof profiles];
export interface SignatureCast { uid: number; id: string; age: number; duration: number; tx: number; ty: number; skill: boolean }
export function signaturePose(id: string, phase: number) {
  const p = signatureProfile(id), pulse = Math.sin(Math.min(1, phase) * Math.PI);
  if (!p) return { angle: 0, lift: 0 };
  const power = p.gesture === 'slam' ? 1.7 : p.gesture === 'orbit' ? .25 : 1;
  return { angle: Math.sin(phase * Math.PI * 2) * .13 * power, lift: pulse * (p.gesture === 'slam' ? .09 : .035) };
}
/** Fixed frame coordinates preserve each prop's pivot and motion trail. */
export function drawSignatureEffect(ctx: CanvasRenderingContext2D, id: string, phase: number, x: number, y: number, tx: number, ty: number, unit: number, skill = true) {
  const p = signatureProfile(id); if (!p || phase < 0 || phase >= 1) return;
  const image = artImage(p.row < 8 ? 'signature-fx-a' : 'signature-fx-b'); if (!image) return;
  const frame = Math.min(3, Math.floor(phase * 4)), row = p.row % 8;
  const sx = Math.round(frame * image.naturalWidth / 4), sy = Math.round(row * image.naturalHeight / 8);
  const sw = Math.round((frame + 1) * image.naturalWidth / 4) - sx, sh = Math.round((row + 1) * image.naturalHeight / 8) - sy;
  const pulse = Math.sin(phase * Math.PI), power = skill ? 1 : .48;
  let px = x, py = y - unit * .45, rotation = 0;
  if (p.gesture === 'throw') {
    const t = Math.min(1, phase * 1.35); px += (tx - x) * t; py += (ty - y) * t - Math.sin(t * Math.PI) * unit * .45;
    rotation = (p.variant - 3) * phase * .12;
  } else if (p.gesture === 'orbit' || p.gesture === 'reflect') {
    const a = phase * Math.PI * 2 + p.variant * .35; px += Math.cos(a) * unit * .35; py += Math.sin(a) * unit * .2;
  } else if (p.gesture === 'slam') { px += unit * .33; py += (-.4 + phase * .7) * unit; rotation = -.6 + phase * .8; }
  else if (p.gesture === 'swing' || p.gesture === 'slash') { px += unit * .28; rotation = -.8 + phase * 1.7; }
  else { px += (p.variant % 2 ? -1 : 1) * pulse * unit * .2; py -= pulse * unit * .1; }
  const size = unit * (p.motif === 'books' ? .95 : .78) * power;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = Math.min(1, phase * 10, (1 - phase) * 6) * (skill ? .95 : .6);
  ctx.translate(px, py); ctx.rotate(rotation);
  ctx.drawImage(image, sx, sy, sw, sh, -size / 2, -size / 2, size, size);
  ctx.restore();
}
