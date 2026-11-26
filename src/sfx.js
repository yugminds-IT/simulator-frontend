// Launcher sounds, synthesised with Web Audio (no files). Muting is remembered per browser.
let ctx = null;
const KEY = 'rckit:sfxMuted';
export const muted = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
export const setMuted = (m) => { try { localStorage.setItem(KEY, m ? '1' : '0'); } catch { /* private mode: not remembered */ } };

/** notes: [[freq Hz, start s, length s], …] */
function play(notes, { type = 'sine', vol = 0.06 } = {}) {
  if (muted()) return;
  try {
    ctx ||= new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime;
    for (const [f, at, len] of notes) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0, t0 + at);
      g.gain.linearRampToValueAtTime(vol, t0 + at + 0.006);           // fast attack, no click
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);     // short decay
      o.connect(g).connect(ctx.destination);
      o.start(t0 + at); o.stop(t0 + at + len + 0.02);
    }
  } catch { /* no audio: stay silent */ }
}

export const sfx = {
  move: () => play([[1320, 0, 0.05]], { type: 'triangle', vol: 0.05 }),                              // tick between tiles
  play: () => play([[660, 0, 0.09], [990, 0.07, 0.11], [1320, 0.14, 0.22]], { type: 'triangle', vol: 0.07 }), // rising start chime
  locked: () => play([[180, 0, 0.12], [150, 0.09, 0.16]], { type: 'square', vol: 0.03 }),          // low "can't"
  back: () => play([[990, 0, 0.07], [660, 0.06, 0.12]], { type: 'triangle', vol: 0.05 }),
  // sign-in screens: chiptune square waves, kept quiet
  start: () => play([[523, 0, 0.09], [659, 0.08, 0.09], [784, 0.16, 0.09], [1047, 0.24, 0.32]], { type: 'square', vol: 0.03 }), // power-on jingle
  key: () => play([[2400 + Math.random() * 400, 0, 0.025]], { type: 'triangle', vol: 0.018 }),  // soft keystroke, pitch varies a little
  ok: () => play([[523, 0, 0.1], [784, 0.09, 0.1], [1047, 0.18, 0.1], [1568, 0.27, 0.45]], { type: 'square', vol: 0.035 }), // signed in
  rev: () => play([[98, 0, 0.09], [131, 0.06, 0.09], [175, 0.12, 0.09], [247, 0.18, 0.22]], { type: 'sawtooth', vol: 0.022 }), // motors spin up
  ping: () => play([[1760, 0, 0.06]], { type: 'sine', vol: 0.03 }),                                 // searching for signal
  levelup: () => play([[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.1], [1047, 0.3, 0.12], [784, 0.44, 0.08], [1047, 0.52, 0.1], [1319, 0.62, 0.1], [1568, 0.74, 0.6]], { type: 'square', vol: 0.035 }), // player level up
};
