// Lesson assembly: the kit builds itself step by step (like the Build tab), then runs.
// One step per module (fly in beside its port, cable grows into the port, plug seats), then the
// procedure steps: SW1 off → blocks → USB + upload → USB out, SW1 on → run. Steps match kit.steps().
import * as THREE from 'three';

const MM = 0.001;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const ease = (k) => k * k * (3 - 2 * k);
const PER_MODULE = 2.4;
const PROCEDURE = [['power-off', 1.4], ['blocks', 1.6], ['upload', 2.8], ['power-on', 1.6], ['observe', 0.4]];
export const JR_PROCEDURE = [['power-on', 1.6], ['observe', 0.4]]; // Jr. Explorer: no code, so wire → SW1 on → try it

/**
 * kit: stage.loadKit() result. act(key, on): side effects for the procedure steps (main.js owns power, USB, sim).
 * onStep(i): the step now playing changed (-1 when finished).
 */
export function createAssembly(kit, { act, onStep, highlight, procedure = PROCEDURE }) {
  const mods = kit.modules;
  const steps = mods.map((m, i) => ({ t0: i * PER_MODULE, t1: (i + 1) * PER_MODULE, mod: m }));
  let t = mods.length * PER_MODULE;
  for (const [key, d] of procedure) { steps.push({ t0: t, t1: t + d, key }); t += d; }
  const end = t;
  const st = { t: 0, playing: false, step: -2, fired: -1 };
  const lift = new THREE.Vector3();

  function pose(instant = false) {
    mods.forEach((m, i) => {
      const t0 = i * PER_MODULE, k = ease(seg(st.t, t0, t0 + 1.0)), c = ease(seg(st.t, t0 + 1.0, t0 + 2.0));
      m.root.visible = st.t >= t0;
      lift.set(m.side * (1 - k) * 90 * MM, ((1 - k) * 70 + Math.sin(Math.PI * k) * 18) * MM, 0); // swoops in from outside and above
      m.root.position.copy(m.home).add(lift);
      for (const tb of m.tubes || []) {
        tb.visible = c > 0;
        tb.geometry.setDrawRange(0, Math.floor((tb.geometry.index.count / 6) * c) * 6);
      }
      for (const pl of m.plugs || []) pl.visible = pl.userData.end === 'mod' ? k >= 1 : c >= 1;
    });
    const i = st.t >= end ? -1 : steps.findIndex((s) => st.t >= s.t0 && st.t < s.t1);
    if (i !== st.step) {
      st.step = i;
      highlight(i >= 0 && steps[i].mod ? steps[i].mod.root : null);
      onStep(i);
    }
    for (let j = st.fired + 1; j < steps.length && st.t >= steps[j].t0; j++) { if (steps[j].key) act(steps[j].key, instant); st.fired = j; }
  }

  let last = 0;
  function tick(now) {
    if (!st.playing) return;
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now;
    st.t = Math.min(end, st.t + dt);
    pose();
    if (st.t >= end) st.playing = false;
    else requestAnimationFrame(tick);
  }
  const play = () => { if (st.playing) return; st.playing = true; last = 0; requestAnimationFrame(tick); };

  return {
    steps, st,
    /** start step i (0-based) and play from there; earlier procedure steps are applied at once */
    seek(i) {
      st.t = steps[i]?.t0 ?? 0;
      st.fired = -1;
      act('reset');
      for (let j = 0; j < i; j++) { if (steps[j].key) act(steps[j].key, true); st.fired = j; }
      pose(); play();
    },
    /** jump to the finished, working kit */
    skip() { st.playing = false; st.t = end; pose(true); },
    stop() { st.playing = false; },
    done: () => st.t >= end,
  };
}
