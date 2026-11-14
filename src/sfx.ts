// 파일 없이 코드로 합성하는 귀여운 효과음 (WebAudio)
let ac: AudioContext | null = null;
let muted = (() => { try { return localStorage.getItem('agora_mute') === '1'; } catch { return false; } })();
let lastHit = 0;

function ctx() {
  if (!ac) { try { ac = new AudioContext(); } catch { return null; } }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
// 첫 터치에서 오디오 잠금 해제 (모바일 정책)
if (typeof window !== 'undefined') window.addEventListener('pointerdown', () => ctx(), { once: true });

export const isMuted = () => muted;
export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('agora_mute', muted ? '1' : '0'); } catch { /* 무시 */ }
  return muted;
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.15, slide = 0, delay = 0) {
  if (muted) return;
  const a = ctx(); if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.1, delay = 0) {
  if (muted) return;
  const a = ctx(); if (!a) return;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = a.createBufferSource(), g = a.createGain();
  s.buffer = buf; g.gain.value = vol;
  s.connect(g).connect(a.destination);
  s.start(a.currentTime + delay);
}

const C = [523, 587, 659, 784, 880, 1047, 1175, 1319];

export const sfx = {
  tap: () => tone(700 + Math.random() * 200, 0.08, 'triangle', 0.12, 1.5),
  summon: () => { tone(440, 0.1, 'square', 0.06, 1.8); tone(880, 0.12, 'triangle', 0.08, 1.2, 0.05); },
  merge: () => [0, 2, 4].forEach((n, i) => tone(C[n], 0.14, 'triangle', 0.12, 1, i * 0.06)),
  synth: (tier: number) => { [0, 2, 4, 7].forEach((n, i) => tone(C[n % 8] * (tier >= 5 ? 2 : 1), 0.25, 'sine', 0.13, 1, i * 0.07)); if (tier >= 5) noise(0.4, 0.05, 0.2); },
  hit: () => { const now = performance.now(); if (now - lastHit < 45) return; lastHit = now; tone(1200 + Math.random() * 300, 0.04, 'square', 0.025, 0.6); },
  kill: () => tone(660, 0.09, 'triangle', 0.07, 1.6),
  coin: () => { tone(1319, 0.06, 'square', 0.04); tone(1760, 0.08, 'square', 0.04, 1, 0.05); },
  bossBreak: () => { noise(0.22, 0.16); tone(95, 0.34, 'sawtooth', 0.18, 0.38); tone(440, 0.16, 'triangle', 0.1, 2.2, 0.035); },
  boss: () => { tone(110, 0.6, 'sawtooth', 0.12, 0.8); tone(165, 0.6, 'sawtooth', 0.08, 0.8, 0.15); },
  bossSkill: () => { noise(0.3, 0.08); tone(300, 0.3, 'sawtooth', 0.06, 0.4); },
  win: () => [0, 2, 4, 7, 4, 7].forEach((n, i) => tone(C[n] * (i > 3 ? 2 : 1), 0.18, 'triangle', 0.13, 1, i * 0.11)),
  lose: () => [4, 3, 2, 0].forEach((n, i) => tone(C[n] / 2, 0.3, 'sine', 0.12, 0.9, i * 0.18)),
  drumroll: (sec: number) => { for (let t = 0; t < sec; t += 0.06) noise(0.05, 0.04 + (t / sec) * 0.06, t); },
  reveal: (tier: number) => {
    if (tier >= 6) { [0, 2, 4, 7].forEach((n, i) => tone(C[n] * 2, 0.5, 'sine', 0.12, 1, i * 0.09)); noise(0.6, 0.06, 0.1); }
    else if (tier >= 5) [0, 4, 7].forEach((n, i) => tone(C[n] * 2, 0.35, 'triangle', 0.12, 1, i * 0.08));
    else tone(C[Math.min(7, tier + 1)], 0.12, 'triangle', 0.1, 1.2);
  },
  click: () => tone(520, 0.05, 'triangle', 0.06),
};
