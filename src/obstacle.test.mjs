// Run: node src/obstacle.test.mjs — how well each obstacle echoes.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { reading, OBSTACLES, createObstacleRig } from './obstacle.js';
let r = 0; const seq = (...v) => () => v[r++ % v.length];
r = 0; assert.equal(reading('wall', 50, seq(0.5, 0.5)), 50);                 // no noise at the middle
r = 0; assert.ok(Math.abs(reading('box', 50, seq(0.5, 1)) - 50) <= 0.3);    // box: within ±0.3 cm
r = 0; assert.equal(reading('ball', 50, seq(0.1)), 0);                       // ball: sometimes no echo (pulseIn timeout)
r = 0; assert.ok(Math.abs(reading('ball', 50, seq(0.9, 0)) - 47) < 1e-9);    // ...and shaky (±3 cm) otherwise
assert.equal(reading('car', 1, seq(0.5, 0)), 2);                             // never below the 2 cm minimum
assert.deepEqual(Object.keys(OBSTACLES), ['car', 'box', 'ball', 'wall']);

// the rig: sensor at the origin facing -X; the obstacle's near face sits at the distance (1 mm per cm), and dragging follows the mouse
const group = new THREE.Group(), root = new THREE.Object3D(), tx = new THREE.Object3D(); tx.position.y = 0.02; root.add(tx); group.add(root);
let frame = null, now = 0; globalThis.requestAnimationFrame = (f) => { frame = f; return 1; }; globalThis.performance = { now: () => now }; globalThis.cancelAnimationFrame ||= () => {};
const rig = createObstacleRig(group, root, tx);
for (const k of Object.keys(OBSTACLES)) {
  rig.set(k); rig.dist(50);
  group.updateMatrixWorld(true);
  const face = new THREE.Box3().setFromObject(rig.st.model, true).max.x; // facing -X, so the near face is the largest x
  assert.ok(Math.abs(face + 0.05) < 1e-5, `${k}: near face at 50 cm, got ${(-face * 1000).toFixed(2)} mm`);
}
const down = (x) => new THREE.Ray(new THREE.Vector3(x, 1, 0), new THREE.Vector3(0, -1, 0));
const at = rig.grab(down(-0.06));
assert.equal(Math.round(at(down(-0.08))), 70);   // 20 mm further out → 20 cm further
assert.equal(at(down(1)), 2);                    // clamped to 2..200 cm
assert.equal(at(down(-1)), 200);

// the burst: wavefronts leave T (teal) and grow, reach the face at 50 cm, and come back as an echo (orange) that R hears
rig.set('wall'); rig.dist(50); now = 0; rig.ping(true);
const fronts = rig.st.pings[0].fronts, step = (ms) => { now = ms; const f = frame; frame = null; f?.(); };
step(200); assert.ok(fronts[0].visible && fronts[0].material.color.getHex() === 0x2fb3a0 && Math.abs(fronts[0].scale.x - 0.022) < 1e-6, 'outbound front, 22 mm out after 200 ms');
assert.ok(fronts[0].scale.x > fronts[7].scale.x, 'the 8 pulses follow one another');
step(700); assert.equal(fronts[0].material.color.getHex(), 0xf2a33a, 'echo on its way back');
for (let t = 700; t < 3000 && rig.st.pings.length; t += 16) step(t);
assert.equal(rig.st.pings.length, 0, 'the burst is gone once R has heard it');
console.log('obstacle: all checks passed');
