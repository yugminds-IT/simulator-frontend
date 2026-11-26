// Scratch playground interpreter: Scratch motion maths, repeat, bounce, say and stop.
import assert from 'node:assert/strict';
import { runScript, newSprite } from './scratch.js';

const B = (op, ...args) => ({ op, args }), R = (n, body) => ({ op: 'repeat', args: [n], body });
const ctx = (stopAt = Infinity) => { const c = { steps: 0, slept: [], sleep: async (ms) => { c.slept.push(ms); }, frame: async () => {}, stopped: () => c.steps >= stopAt, step: () => { c.steps++; } }; return c; };
const go = async (script, s = newSprite(), c = ctx()) => { await runScript(script, s, c); return s; };

let s = await go([B('move', 10)]);
assert.deepEqual([s.x, s.y], [10, 0], 'direction 90 points right');

s = await go([R(4, [B('move', 100), B('turnR', 90)])]);
assert.deepEqual([s.x, s.y, s.dir], [0, 0, 90], 'a square ends where it started');

s = await go([B('turnL', 270)]);
assert.equal(s.dir, 180, 'directions wrap into (-180, 180]');

s = await go([R(3, [R(4, [B('move', '1')])])]);
assert.equal(s.x, 12, 'nested repeats multiply; inputs may be strings');

s = await go([B('goto', 999, -999)]);
assert.deepEqual([s.x, s.y], [240, -180], 'the sprite stays on the stage');

s = newSprite(); s.x = 235;
await go([B('bounce')], s);
assert.deepEqual([s.dir, s.x], [-90, 210], 'bounce turns away from the edge and steps back inside');

const c = ctx();
s = await go([B('say', 'Hi', 2)], newSprite(), c);
assert.deepEqual([s.say, c.slept], ['', [2000]], 'say shows for N seconds, then clears');

s = await go([R(10, [B('move', 10)])], newSprite(), ctx(3));
assert.equal(s.x, 20, 'stop ends the run between blocks');

s = await go([B('point', -90), R(24, [B('turnR', 15)])]);
assert.equal(s.dir, -90, 'point sets the direction; 24 × 15° is one full turn');

const { SCRATCH_LESSONS } = await import('./scratch.js');
for (const l of SCRATCH_LESSONS) {
  s = await go(structuredClone(l.blocks));
  assert.ok(l.heading && l.steps.length && l.palette.length && l.blocks.length, `${l.id} is incomplete`);
}
assert.deepEqual([s.dir, s.say], [90, ''], 'say hello and spin: ends facing right, bubble gone');

// Chapter 1: the text-code parser behind "blocks vs text", and the chapter's data
const { parseLine, RECIPE, AREAS, ABOUT, MATCH, SAVE_STEPS, OPEN_STEPS } = await import('./scratch-ch1.js');
assert.deepEqual(parseLine(' move(10) ').block, B('move', 10), 'move(10) is a move block');
assert.deepEqual(parseLine('turn(-90)').block, B('turnR', -90), 'turn(n) turns right, negative turns left');
assert.deepEqual(parseLine('say("Hi there")').block, B('say', 'Hi there', 2), 'say("…") says it for 2 seconds');
assert.match(parseLine('mvoe(10)').err, /^NameError: name 'mvoe'/, 'a typo is a NameError');
assert.match(parseLine('mvoe(10)').hint, /Did you mean move\?/, '…with a friendly hint');
assert.match(parseLine('Move(10)').err, /NameError/, 'names are case sensitive');
assert.match(parseLine('move(10').err, /SyntaxError/, 'a missing bracket is a SyntaxError');
assert.match(parseLine('move(ten)').err, /not a number/, 'move needs a number');
assert.match(parseLine('move()').err, /needs a number/, 'empty brackets');
assert.match(parseLine('say(Hello)').err, /quotes/, 'text needs quotes');
assert.equal(RECIPE.length, 5);
assert.deepEqual(AREAS.map(([a]) => a), ['tabs', 'code', 'stage', 'palette', 'sprites', 'ext', 'backdrops'], 'the book\'s seven parts, in its order');
for (const [, cat] of MATCH) assert.ok(ABOUT[cat], `${cat} has the book's description`);
assert.equal(SAVE_STEPS.length, 5); assert.equal(OPEN_STEPS.length, 5);

s = await go([B('size', -500), B('color', 25)]);
assert.deepEqual([s.size, s.color], [5, 25], 'size never goes below 5 %');
console.log('scratch ok');
