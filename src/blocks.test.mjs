// Run: node src/blocks.test.mjs — checks C++ generation and the interpreter on a virtual clock.
import assert from 'node:assert/strict';
import { toCpp, run, cppWithLines } from './blocks.js';

// fake hardware: virtual time, stops after `limit` ms
function fakeHw(limit, inputs = {}) {
  let t = 0;
  const writes = [], printed = [];
  return {
    writes, printed,
    mode() {}, write: (p, v) => writes.push([t, p, v]),
    read: (p) => (typeof inputs[p] === 'function' ? inputs[p](t) : inputs[p] ?? 0),
    analog: () => 1234, sleep: async (ms) => { t += ms; }, stopped: () => t >= limit,
    serial: (s) => printed.push(s), tone() {}, servo() {}, distance: () => 30, temperature: () => 26, oled() {},
  };
}

const blink = { setup: [['mode', 13, 'output']], loop: [['write', 13, 1], ['wait', 1], ['write', 13, 0], ['wait', 1]] };
const button = {
  setup: [['mode', 23, 'output'], ['mode', 34, 'input']],
  loop: [['if', ['read', 34, 1], [['write', 23, 1]], [['write', 23, 0]]], ['wait', 1]],
};

// C++ generation
const cpp = toCpp(blink);
assert.match(cpp, /void setup\(\) \{\n {2}pinMode\(13, OUTPUT\);\n\}/);
assert.match(cpp, /digitalWrite\(13, HIGH\);\n {2}delay\(1000\);\n {2}digitalWrite\(13, LOW\);/);
assert.match(toCpp(button), /if \(digitalRead\(34\) == HIGH\) \{\n {4}digitalWrite\(23, HIGH\);\n {2}\} else \{/);
const melody = toCpp({ setup: [], loop: [['tone', 13, 'C4', 0.5], ['print', 'hi "there"']] });
assert.match(melody, /tone\(13, 262, 500\);\n {2}delay\(500\);/);
assert.match(melody, /Serial\.begin\(115200\);/);
assert.match(melody, /Serial\.println\("hi \\"there\\""\);/);
assert.match(toCpp({ setup: [], loop: [['servo', 33, 90]] }), /#include <ESP32Servo\.h>[\s\S]*servo\.attach\(33\);[\s\S]*servo\.write\(90\);/);

// interpreter: blink on a virtual clock
let hw = fakeHw(2500);
await run(blink, hw);
assert.deepEqual(hw.writes, [[0, 13, 1], [1000, 13, 0], [2000, 13, 1]]);

// if/else follows the input
hw = fakeHw(3500, { 34: (t) => (t >= 1500 ? 1 : 0) });
await run(button, hw);
assert.deepEqual(hw.writes, [[0, 23, 0], [1000, 23, 0], [2000, 23, 1], [3000, 23, 1]]);

// a loop with no wait still yields (20 ms) and stops
hw = fakeHw(100);
await run({ setup: [], loop: [['write', 2, 1]] }, hw);
assert.equal(hw.writes.length, 5);

// printRead uses analog input
hw = fakeHw(1);
await run({ setup: [], loop: [['printRead', 'analog', 35], ['wait', 1]] }, hw);
assert.deepEqual(hw.printed, ['1234']);

// TB6612 H-bridge truth table
const { bridge } = await import('./tb6612.js');
assert.equal(bridge(1, 0), 1); assert.equal(bridge(0, 1), -1); assert.equal(bridge(0, 0), 0);
assert.equal(bridge(1, 1), 'brake'); assert.equal(bridge(1, 0, 0), 0);

// the code view lights up the running statement: lineOf points at its C++ line
{
  const blink = { setup: [['mode', 2, 'output']], loop: [['write', 2, 1], ['wait', 1], ['write', 2, 0], ['wait', 1]] };
  const { code, lineOf } = cppWithLines(blink), L = code.split('\n');
  assert.equal(code, toCpp(blink));
  assert.equal(L[lineOf.get(blink.setup[0])].trim(), 'pinMode(2, OUTPUT);');
  assert.equal(L[lineOf.get(blink.loop[1])].trim(), 'delay(1000);');
  assert.equal(L[lineOf.get(blink.loop[2])].trim(), 'digitalWrite(2, LOW);');
}


// analog if: C++ text and how it runs
{
  const prog = { setup: [], loop: [['if', ['analog', 35, '>', 2000], [['write', 13, 1]], [['write', 13, 0]]]] };
  assert.match(toCpp(prog), /if \(analogRead\(35\) > 2000\) \{\n    digitalWrite\(13, HIGH\);\n  \} else \{/);
  for (const [v, led] of [[2500, 1], [900, 0]]) {
    let out = null, n = 0;
    await run(prog, { stopped: () => n++ > 2, analog: () => v, write: (p, x) => { out = x; }, sleep: async () => {}, read: () => 0 });
    assert.equal(out, led, `analog ${v} → LED ${led}`);
  }
}
console.log('blocks: all checks passed');
{ // OLED blocks (Tech Explorers L2): buffer by cursor row, shown only on refresh; C++ uses the init size
  const { toCpp: cpp, run: go } = await import('./blocks.js');
  const shown = [], prog = { setup: [['oledInit', 128, 64, '0x3C'], ['oledClear'], ['oledCursor', 0, 0], ['oledPrint', 'Phase:', 'warp'], ['oledCursor', 0, 16], ['oledPrint', 'RED', 'warp'], ['oledShow']], loop: [['wait', 0.01]] };
  const scr = { rows: [], x: 0, y: 0 };
  const hw = { stopped: () => shown.length > 0, sleep: async () => {}, oledInit() {}, oledClear() { scr.rows = []; }, oledCursor(x, y) { scr.x = x; scr.y = y; },
    oledPrint(t) { scr.rows[Math.floor(scr.y / 8)] = t; }, oledShow() { shown.push(scr.rows.map((r) => r || '').join('\n')); } };
  await go(prog, hw).catch(() => {});
  assert.equal(shown[0], 'Phase:\n\nRED');
  assert.match(cpp(prog), /Adafruit_SSD1306 oled\(128, 64, &Wire, -1\);[\s\S]*oled\.begin\(SSD1306_SWITCHCAPVCC, 0x3C\);[\s\S]*oled\.print\("RED"\);[\s\S]*oled\.display\(\);/);
}
{ // Tech Explorers L3: repeat, variables, "and" conditions and custom blocks
  const { toCpp: cpp, run: go } = await import('./blocks.js');
  const writes = [], vals = { 36: 1, 35: 0 };
  const prog = { funcs: { left: [['write', 26, 1]], straight: [['write', 27, 1]] },
    setup: [['repeat', 3, [['write', 2, 1]]], ['setRead', 'l', 36], ['setRead', 'r', 35], ['setDist', 'd', 19, 18],
      ['if', ['and', ['var', 'l', '=', 1], ['var', 'r', '=', 0]], [['call', 'left']], [['call', 'straight']]],
      ['if', ['var', 'd', '<', 20], [['write', 13, 1]]]], loop: [['wait', 0.01]] };
  let n = 0;
  const hw = { stopped: () => ++n > 40, sleep: async () => {}, write: (g, v) => writes.push(`${g}=${v}`), read: (g) => vals[g], distance: () => 12.5 };
  await go(prog, hw).catch(() => {});
  assert.deepEqual(writes, ['2=1', '2=1', '2=1', '26=1', '13=1']);
  const c = cpp(prog);
  assert.match(c, /int l = 0;[\s\S]*float d = 0;[\s\S]*float readDistance[\s\S]*void left\(\) \{\n  digitalWrite\(26, HIGH\);\n\}/);
  assert.match(c, /for \(int i = 0; i < 3; i\+\+\) \{/);
  assert.match(c, /if \(l == 1 && r == 0\) \{\n    left\(\);/);
}
