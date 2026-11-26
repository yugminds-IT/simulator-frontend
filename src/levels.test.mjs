// Every ready book project must resolve to a full lesson record; Level 1 uses only its own lessons.
import assert from 'node:assert/strict';
import { LEVELS, levelLessons } from './levels.js';

for (const l of LEVELS) {
  const ls = levelLessons(l.n);
  assert.equal(ls.length, l.projects.filter((p) => p.lesson).length);
  for (const x of ls) assert.ok(x.id && x.heading && (x.blocks?.loop.length || x.blocks?.setup.length) && (x.kit.length || x.chassis), `level ${l.n}: ${x.cardTitle} is incomplete`);
}
assert.deepEqual(levelLessons(1).map((x) => x.id), ['l1-blink', 'l1-chase', 'l1-doorbell', 'l1-button-led']);
console.log('levels ok');
assert.deepEqual(levelLessons(2).map((x) => x.id), ['l2-night-light', 'l2-light-display', 'l2-hand-wave', 'l2-smart-traffic']);
assert.deepEqual(levelLessons(3).map((x) => x.id), ['l3-pattern', 'l3-manual', 'l3-distance-alarm', 'l3-obstacle', 'l3-line']);
console.log('levels 1–3 ok');
