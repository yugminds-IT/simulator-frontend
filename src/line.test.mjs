// Run: node src/line.test.mjs — line-follower sensors (1 = over the tape) and the drift model the book's program must correct.
import assert from 'node:assert/strict';
import { lineSensors, lineStep } from './line.js';

assert.deepEqual(lineSensors(0), [0, 0]);    // tape between the sensors
assert.deepEqual(lineSensors(40), [1, 0]);   // car drifted right: left sensor on the tape
assert.deepEqual(lineSensors(-40), [0, 1]);
assert.deepEqual(lineSensors(90), [1, 1]);   // lost: both high (book p. 174)
// the book's program in a loop keeps the car on the tape through the curve
let d = 0;
const motors = ([l, r]) => (!l && !r ? [1, 1] : l && !r ? [0, 1] : !l && r ? [1, 0] : [0, 0]);
for (let t = 0; t < 300; t++) { const [a, b] = motors(lineSensors(d)); d = lineStep(d, a, b, 3 * Math.sin(t / 25)); assert.ok(Math.abs(d) < 70, `lost the line at tick ${t}`); }
console.log('line ok');
