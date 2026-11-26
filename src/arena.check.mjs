// node src/arena.check.mjs: each project's course holds together with the car's geometry
import assert from 'node:assert/strict';
import { ARENAS, carPoints, blocked, sonar, onTape, sensorsAt, inStop, gateAt } from './arena.js';

const car = { cx: 0, cz: 0, hx: 0.13, hz: 0.09 }, start = { x: 0, z: 0, th: 0 };
for (const [k, A] of Object.entries(ARENAS)) assert.ok(!blocked(carPoints(start, car), A), `${k}: the car starts in a free spot`);
const O = ARENAS.obstacle;
assert.ok(blocked(carPoints({ x: 1.2, z: 0, th: 0 }, car), O), 'past the right wall is blocked');
assert.ok(blocked(carPoints({ x: 0, z: -0.5, th: 0 }, car), O), 'inside the middle block is blocked');
const d = sonar(car.hx, 0, 0, O);
assert.ok(Math.abs(d - 57) < 0.5, `sonar sees the block ahead (${d.toFixed(1)} cm)`);
assert.ok(Math.abs(sonar(0, 0, Math.PI / 2, O) - 40) < 0.5, 'turned left, it sees the yellow block at 40 cm');
// line: the tape passes under the start and through the dent; both sensors either side of it at the start
const T = ARENAS.line.track;
assert.ok(onTape(0, 0, T) && onTape(0, -0.7, T) && onTape(...T.pts[60], T) && !onTape(0, 0.03, T) && !onTape(0, -0.4, T));
const s = sensorsAt(start, car);
assert.deepEqual([onTape(...s.irL, T), onTape(...s.irR, T)], [false, false], 'both IR sensors either side of the tape at the start');
assert.ok(onTape(...sensorsAt({ x: 0, z: 0.028, th: 0 }, car).irL, T), 'drift right → the left sensor lands on the tape');
assert.equal(ARENAS.line.boxes.length, 0, 'nothing on the track');
const straight = T.pts.filter(([x, z]) => Math.abs(x) < 0.5 && z > -0.2);
assert.ok(straight.every(([, z]) => Math.abs(z) < 0.006), 'the start straight is straight (no wiggle for a sensor to catch)');
// the dent turns the other way: the track's heading turns both left and right going round
const turns = T.pts.map((p, i) => { const a = T.pts[(i + T.pts.length - 1) % T.pts.length], b = T.pts[(i + 1) % T.pts.length]; return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]); });
assert.ok(turns.some((t) => t > 1e-6) && turns.some((t) => t < -1e-6), 'the track bends both ways');
// pattern: the whole 30 cm square fits, even with the car turned on a corner
const P = ARENAS.pattern;
for (const [x, z] of [[0, 0], [0.3, 0], [0.3, 0.3], [0, 0.3]]) for (const th of [0, 0.8, 1.6, 2.4, 3.2]) assert.ok(!blocked(carPoints({ x, z, th }, car), P), `square corner ${x},${z} is clear`);
// manual (bus route): with the barrier up the road is clear all the way to the depot; each stop fits the car with room to spare;
// the lowered barrier stops a car that would cross it
const M = ARENAS.manual, [s1, , depot] = M.stops;
M.gate.isDown = false;
for (let x = 0; x < depot[1] - car.hx; x += 0.02) assert.ok(!blocked(carPoints({ x, z: 0, th: 0 }, car), M), `the road is clear at x ${x.toFixed(2)}`);
for (const S of M.stops) assert.ok(S[1] - S[0] - 2 * car.hx >= 0.08, `${S[2]} leaves at least 8 cm to stop in`);
const mid = (S) => ({ x: (S[0] + S[1]) / 2, z: 0, th: 0 });
assert.ok(inStop(carPoints(mid(s1), car), s1, M) && !inStop(carPoints({ x: s1[1], z: 0, th: 0 }, car), s1, M), 'inside a stop means all of the car');
M.gate.isDown = true;
assert.ok(blocked(carPoints({ x: M.gate.x, z: 0, th: 0 }, car), M) && !blocked(carPoints({ x: M.gate.x - car.hx - 0.01, z: 0, th: 0 }, car), M), 'the lowered barrier blocks the road, just before it is fine');
M.gate.isDown = false;
assert.deepEqual([gateAt(M.gate, 1), gateAt(M.gate, 3.7), gateAt(M.gate, 5), gateAt(M.gate, 8)], [[false, false], [true, false], [true, true], [false, false]], 'the barrier cycle');
// the line follower's book program (50 Hz) really follows the tape: laps, and never far from it
{ let p = { x: 0, z: 0, th: 0 }, laps = 0, away = false, worst = 0;
  for (let t = 0; t < 60; t += 0.02) {
    const s = sensorsAt(p, car), L = onTape(...s.irL, T), R = onTape(...s.irR, T), [a, b] = !L && !R ? [1, 1] : L && !R ? [0, 1] : !L && R ? [1, 0] : [0, 0];
    const v = (a + b) / 2 * 0.3, w = (b - a) * 1.4; p = { th: p.th + w * 0.02, x: p.x + Math.cos(p.th) * v * 0.02, z: p.z - Math.sin(p.th) * v * 0.02 }; // stage.drive's model
    const c = sensorsAt(p, car).centre, d = Math.hypot(...c);
    worst = Math.max(worst, Math.min(...T.pts.map(([x, z]) => Math.hypot(x - c[0], z - c[1]))));
    if (d > 0.5) away = true; if (away && d < 0.1) { laps++; away = false; }
  }
  assert.ok(laps >= 2 && worst < 0.06, `line follower: ${laps} laps in 60 s, at most ${(worst * 100).toFixed(1)} cm off the tape`);
  console.log(`line follower: ${laps} laps in 60 s, at most ${(worst * 100).toFixed(1)} cm off the tape`);
}
console.log('arena ok · 4 courses · sonar ahead at start', d.toFixed(1), 'cm');
