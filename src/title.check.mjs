// node src/title.check.mjs: the title-screen demo cars do what the book's programs do, without crashing into anything
import assert from 'node:assert/strict';
import { ARENAS, carPoints, blocked, sonar } from './arena.js';
import { obstacleStep, lineStep } from './title.js';

globalThis.performance ??= { now: () => 0 };
const half = { cx: 0, cz: 0, hx: 0.13, hz: 0.09 }; // the assembled car's footprint, roughly
const dt = 1 / 60;

// obstacle run: 60 s of driving never ends up inside a block or a wall, turns right at least once, and keeps moving
const ob = { A: ARENAS.obstacle, half, v: 0, read: {} }, step = obstacleStep(ob, sonar, blocked, carPoints);
let turned = 0, moved = 0, cuts = 0, last = { ...ob.pose() };
for (let i = 0; i < 3600; i++) {
  if (ob.stuck) { cuts++; ob.reset(); last = { ...ob.pose() }; } // what the reel does: cut away, start over next time
  const { hud } = step(dt, i * dt * 1000, false, false), p = ob.pose();
  assert.ok(!blocked(carPoints(p, half), ob.A), `obstacle car inside something at ${(i * dt).toFixed(1)} s`);
  if (hud.act === 'Turning right') { turned++; assert.ok(ob.read.cm < 30 || hud.row === 'turn'); }
  moved += Math.hypot(p.x - last.x, p.z - last.z); last = { ...p };
}
assert.ok(turned > 0, 'the obstacle car turns right when something is close');
assert.ok(moved > 5, `the obstacle car keeps exploring (${moved.toFixed(1)} m in 60 s)`);
assert.ok(cuts <= 3, `the obstacle car rarely wedges (${cuts} in 60 s)`);

// line follower: a lap's worth of steps reads 1 on the left sensor in left bends, on the right in right bends, never both
const ln = { v: 0, read: {} }, lstep = lineStep(ln, ARENAS.line);
const seen = new Set();
for (let i = 0; i < 3600; i++) { const { hud } = lstep(dt, i * dt * 1000, false, false); seen.add(hud.act); assert.ok(!(ln.read.l && ln.read.r)); }
assert.ok(seen.has('Turning left') && seen.has('Turning right') && seen.has('Driving straight'), `line car steers both ways (${[...seen]})`);
console.log(`title demo ok: obstacle car drove ${moved.toFixed(1)} m, ${(turned * dt).toFixed(1)} s turning, ${cuts} early cuts; line car: ${[...seen].join(', ')}`);
