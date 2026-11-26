// RC-Studio-style block programs: { setup: [...], loop: [...] } where each statement is a tuple
// [op, ...args]. One registry drives the editor (parts), the C++ generator (cpp) and the simulator (run).

export const NOTES = { C4: 262, D4: 294, E4: 330, F4: 349, G4: 392, A4: 440, B4: 494, C5: 523 };
export const GPIO = [2, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33, 34, 35, 36, 39];
const ms = (s) => Math.round(s * 1000);
const STOP = Symbol('stop');
// if-conditions: ['read', pin, 0|1] (digital pin equals) or ['analog', pin, '>'|'<', number] (analog reading above/below)
// ['var', name, '<'|'>'|'=', number] (a variable) and ['and', cond, cond] (Tech Explorers L3)
const condCpp = (c) => (c[0] === 'and' ? `${condCpp(c[1])} && ${condCpp(c[2])}` : c[0] === 'var' ? `${c[1]} ${c[2] === '=' ? '==' : c[2]} ${c[3]}`
  : c[0] === 'analog' ? `analogRead(${c[1]}) ${c[2]} ${c[3]}` : `digitalRead(${c[1]}) == ${c[2] ? 'HIGH' : 'LOW'}`);
const cmp = (v, op, n) => (op === '<' ? v < n : op === '>' ? v > n : v === n);
const condRun = (c, hw) => (c[0] === 'and' ? condRun(c[1], hw) && condRun(c[2], hw) : c[0] === 'var' ? cmp(hw.vars?.[c[1]] ?? 0, c[2], c[3])
  : c[0] === 'analog' ? cmp(hw.analog(c[1]), c[2], c[3]) : hw.read(c[1]) === c[2]);
const condPins = (c) => (c[0] === 'and' ? [...condPins(c[1]), ...condPins(c[2])] : c[0] === 'var' ? [] : [c[1]]);

// parts: text, or [kind, argIndex, options?]  kinds: pin | sel | num | text | cond
export const OPS = {
  mode: { cat: 'pin', parts: ['set pin', ['pin', 1], 'mode', ['sel', 2, ['output', 'input']]],
    cpp: (a) => `pinMode(${a[1]}, ${a[2].toUpperCase()});`, run: (a, hw) => hw.mode(a[1], a[2]) },
  write: { cat: 'pin', parts: ['set digital pin', ['pin', 1], 'out', ['sel', 2, [['high', 1], ['low', 0]]]],
    cpp: (a) => `digitalWrite(${a[1]}, ${a[2] ? 'HIGH' : 'LOW'});`, run: (a, hw) => hw.write(a[1], a[2]) },
  wait: { cat: 'ctrl', parts: ['wait', ['num', 1], 'seconds'], cpp: (a) => `delay(${ms(a[1])});`, run: (a, hw) => hw.sleep(ms(a[1])) },
  tone: { cat: 'sound', parts: ['play tone on pin', ['pin', 1], 'note', ['sel', 2, Object.keys(NOTES)], 'for', ['num', 3], 'seconds'],
    cpp: (a) => `tone(${a[1]}, ${NOTES[a[2]]}, ${ms(a[3])});\ndelay(${ms(a[3])});`,
    run: async (a, hw) => { hw.tone(a[1], NOTES[a[2]], ms(a[3])); await hw.sleep(ms(a[3])); } },
  print: { cat: 'serial', parts: ['serial print', ['text', 1]],
    cpp: (a) => `Serial.println("${String(a[1]).replace(/["\\]/g, '\\$&')}");`, run: (a, hw) => hw.serial(String(a[1])) },
  printRead: { cat: 'serial', parts: ['serial print', ['sel', 1, ['analog', 'digital']], 'read pin', ['pin', 2]],
    cpp: (a) => `Serial.println(${a[1] === 'analog' ? 'analogRead' : 'digitalRead'}(${a[2]}));`,
    run: (a, hw) => hw.serial(String(a[1] === 'analog' ? hw.analog(a[2]) : hw.read(a[2]))) },
  distance: { cat: 'serial', parts: ['serial print distance · trig', ['pin', 1], 'echo', ['pin', 2]],
    cpp: (a) => `Serial.println(readDistance(${a[1]}, ${a[2]}));`, run: (a, hw) => hw.serial(`${hw.distance(a[1], a[2]).toFixed(1)} cm`) },
  temp: { cat: 'serial', parts: ['serial print temperature on pin', ['pin', 1]],
    cpp: () => 'Serial.println(dht.readTemperature());', run: (a, hw) => hw.serial(`${hw.temperature(a[1]).toFixed(1)} C`) },
  servo: { cat: 'pin', parts: ['set servo pin', ['pin', 1], 'angle', ['num', 2]],
    cpp: (a) => `servo.write(${a[2]});`, run: (a, hw) => hw.servo(a[1], a[2]) },
  oled: { cat: 'serial', parts: ['OLED show', ['text', 1]],
    cpp: (a) => `oled.clearDisplay(); oled.setCursor(0, 0);\noled.println("${String(a[1]).replace(/["\\]/g, '\\$&')}"); oled.display();`,
    run: (a, hw) => hw.oled(String(a[1])) },
  // RC Studio OLED blocks (Tech Explorers L2): draw into a buffer, then "refresh oled display" shows it
  oledInit: { cat: 'serial', parts: ['init oled width', ['num', 1], 'height', ['num', 2], 'I2C address', ['sel', 3, ['0x3C', '0x3D']]],
    cpp: (a) => `oled.begin(SSD1306_SWITCHCAPVCC, ${a[3]});`, run: (a, hw) => hw.oledInit() },
  oledSize: { cat: 'serial', parts: ['set oled text size', ['sel', 1, ['6x8', '12x16']], 'color', ['sel', 2, ['white', 'black']], 'background color', ['sel', 3, ['black', 'white']]],
    cpp: (a) => `oled.setTextSize(${a[1] === '12x16' ? 2 : 1});\noled.setTextColor(SSD1306_${a[2].toUpperCase()}, SSD1306_${a[3].toUpperCase()});`, run: () => {} }, // ponytail: sim draws 6x8 only
  oledClear: { cat: 'serial', parts: ['clear oled'], cpp: () => 'oled.clearDisplay();', run: (a, hw) => hw.oledClear() },
  oledCursor: { cat: 'serial', parts: ['set oled cursor x:', ['num', 1], 'y:', ['num', 2]], cpp: (a) => `oled.setCursor(${a[1]}, ${a[2]});`, run: (a, hw) => hw.oledCursor(a[1], a[2]) },
  oledPrint: { cat: 'serial', parts: ['oled print', ['text', 1], ['sel', 2, ['warp', 'no warp']]],
    cpp: (a) => `oled.setTextWrap(${a[2] === 'warp'});\noled.print("${String(a[1]).replace(/["\\]/g, '\\$&')}");`, run: (a, hw) => hw.oledPrint(String(a[1])) },
  oledShow: { cat: 'serial', parts: ['refresh oled display'], cpp: () => 'oled.display();', run: (a, hw) => hw.oledShow() },
  // Tech Explorers L3: repeat, variables and custom blocks (prog.funcs = { name: [statements] }, called with ['call', name])
  repeat: { cat: 'ctrl', parts: ['repeat', ['num', 1]] },
  setDist: { cat: 'var', parts: ['set', ['var', 1], 'to ultrasonic sensor pin TRIG', ['pin', 2], 'ECHO', ['pin', 3], 'read distance cm'],
    cpp: (a) => `${a[1]} = readDistance(${a[2]}, ${a[3]});`, run: (a, hw) => { hw.vars[a[1]] = hw.distance(a[2], a[3]); } },
  setRead: { cat: 'var', parts: ['set', ['var', 1], 'to read digital pin', ['pin', 2]],
    cpp: (a) => `${a[1]} = digitalRead(${a[2]});`, run: (a, hw) => { hw.vars[a[1]] = hw.read(a[2]); } },
  oledPrintVar: { cat: 'serial', parts: ['oled print', ['var', 1], ['sel', 2, ['warp', 'no warp']]],
    cpp: (a) => `oled.print(${a[1]});`, run: (a, hw) => { const v = hw.vars[a[1]] ?? 0; hw.oledPrint(Number.isInteger(v) ? String(v) : v.toFixed(2)); } }, // print(float): 2 decimals
  call: { cat: 'fn', parts: [['var', 1]], cpp: (a) => `${a[1]}();` },
  if: { cat: 'ctrl', parts: ['if', ['cond', 1], 'then'] },
};

const walk = (list, fn) => list.forEach((st) => { fn(st); if (st[0] === 'if' || st[0] === 'repeat') { walk(st[2], fn); walk(st[3] || [], fn); } });
const all = (prog) => [...prog.setup, ...prog.loop, ...Object.values(prog.funcs || {}).flat()];
const find = (prog, op) => { let hit = null; walk(all(prog), (st) => { if (!hit && st[0] === op) hit = st; }); return hit; };

// C++ lines as [text, statement] so the running statement can be lit up in the code view
function lines(list) {
  const ind = ([t, st]) => ['  ' + t, st];
  return list.flatMap((st) => st[0] === 'repeat' ? [[`for (int i = 0; i < ${st[1]}; i++) {`, st], ...lines(st[2]).map(ind), ['}', st]]
    : st[0] === 'if'
    ? [[`if (${condCpp(st[1])}) {`, st], ...lines(st[2]).map(ind),
      ...(st[3]?.length ? [['} else {', st], ...lines(st[3]).map(ind)] : []), ['}', st]]
    : OPS[st[0]].cpp(st).split('\n').map((t) => [t, st]));
}

export const toCpp = (prog) => cppWithLines(prog).code;

/** C++ source plus lineOf: Map(statement → 0-based index of its first line). */
export function cppWithLines(prog) {
  const has = (op) => find(prog, op);
  const head = [], init = [];
  if (has('servo')) head.push('#include <ESP32Servo.h>', 'Servo servo;'), init.push(`servo.attach(${has('servo')[1]});`);
  if (has('temp')) head.push('#include <DHT.h>', `DHT dht(${has('temp')[1]}, DHT11);`), init.push('dht.begin();');
  const init0 = has('oledInit');
  if (init0) head.push('#include <Wire.h>', '#include <Adafruit_SSD1306.h>', `Adafruit_SSD1306 oled(${init0[1]}, ${init0[2]}, &Wire, -1);`), init.push('Wire.begin(21, 22);');
  else if (has('oled')) {
    head.push('#include <Wire.h>', '#include <Adafruit_SSD1306.h>', 'Adafruit_SSD1306 oled(128, 64, &Wire, -1);  // TODO: 128x64 or 128x32');
    init.push('Wire.begin(21, 22);', 'oled.begin(SSD1306_SWITCHCAPVCC, 0x3C);', 'oled.setTextColor(SSD1306_WHITE);');
  }
  const vars = new Map(); walk(all(prog), (st) => { if (st[0] === 'setDist') vars.set(st[1], 'float'); if (st[0] === 'setRead') vars.set(st[1], 'int'); });
  if (vars.size) head.push('', ...[...vars].map(([n, t]) => `${t} ${n} = 0;`));
  if (has('distance') || has('setDist')) head.push('', 'float readDistance(int trig, int echo) {', '  digitalWrite(trig, LOW); delayMicroseconds(2);',
    '  digitalWrite(trig, HIGH); delayMicroseconds(10);', '  digitalWrite(trig, LOW);', '  return pulseIn(echo, HIGH, 30000) * 0.0343 / 2;  // cm', '}');
  if (['print', 'printRead', 'distance', 'temp'].some(has)) init.unshift('Serial.begin(115200);');
  const fns = Object.entries(prog.funcs || {}).flatMap(([n, body]) => [[`void ${n}() {`], ...lines(body).map(([t, st]) => ['  ' + t, st]), ['}'], ['']]);
  const out = [...head, ...(head.length ? [''] : []).map((t) => [t]), ...fns, ['void setup() {'], ...[...init.map((t) => [t]), ...lines(prog.setup)].map(([t, st]) => ['  ' + t, st]), ['}'], [''],
    ['void loop() {'], ...lines(prog.loop).map(([t, st]) => ['  ' + t, st]), ['}']].map((x) => (Array.isArray(x) ? x : [x]));
  const lineOf = new Map();
  out.forEach(([, st], i) => { if (st && !lineOf.has(st)) lineOf.set(st, i); });
  return { code: out.map(([t]) => t).join('\n') + '\n', lineOf };
}

/** GPIO numbers a program touches (pin fields and if-conditions), sorted. */
export function usedPins(prog) {
  const s = new Set();
  walk(all(prog), (st) => {
    if (st[0] === 'if') condPins(st[1]).forEach((g) => s.add(g));
    else OPS[st[0]].parts.forEach((p) => { if (p[0] === 'pin') s.add(st[p[1]]); });
  });
  return [...s].sort((a, b) => a - b);
}

const hasWait = (list) => { let w = false; walk(list, (st) => { if (st[0] === 'wait' || st[0] === 'tone') w = true; }); return w; };

/** Run a program against `hw` until hw.stopped(). hw.step(st) (optional) is called before each statement. */
export async function run(prog, hw) {
  const exec = async (list) => {
    for (const st of list) {
      if (hw.stopped()) throw STOP;
      hw.step?.(st);
      if (st[0] === 'if') await exec(condRun(st[1], hw) ? st[2] : st[3] || []);
      else if (st[0] === 'repeat') for (let i = 0; i < st[1]; i++) await exec(st[2]);
      else if (st[0] === 'call') await exec(prog.funcs?.[st[1]] || []);
      else await OPS[st[0]].run(st, hw);
    }
  };
  hw.vars = {};
  try {
    await exec(prog.setup);
    for (;;) {
      await exec(prog.loop);
      await hw.sleep(hasWait(prog.loop) ? 0 : 20); // ponytail: a busy loop is throttled to 50 Hz so the page stays responsive
    }
  } catch (e) {
    if (e !== STOP) throw e;
  }
}

// --- editor ----------------------------------------------------------------------------------
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const pinSelect = (v) => `<select data-k="pin">${GPIO.map((g) => `<option value="${g}"${g === v ? ' selected' : ''}>IO${g}</option>`).join('')}</select>`;

function field(st, [kind, i, opts]) {
  const v = st[i];
  if (kind === 'pin') return pinSelect(v).replace('<select', `<select data-i="${i}"`);
  if (kind === 'sel') return `<select data-i="${i}">${opts.map((o) => { const [label, val] = Array.isArray(o) ? o : [o, o]; return `<option value="${val}"${val === v ? ' selected' : ''}>${label}</option>`; }).join('')}</select>`;
  if (kind === 'num') return `<input data-i="${i}" type="number" min="0" step="any" value="${v}">`;
  if (kind === 'text') return `<input data-i="${i}" type="text" value="${esc(v)}">`;
  if (kind === 'var') return `<b class="var">${esc(v)}</b>`;
  return condHtml(v, '');
}
/** a condition; data-c is its path inside the if's condition (e.g. "1.3"), so nested "and" fields stay editable */
function condHtml(v, p) {
  const k = (n) => `data-c="${p}${p ? '.' : ''}${n}"`, ops = (list, n) => `<select ${k(n)}>${list.map((o) => `<option${o === v[n] ? ' selected' : ''}>${o}</option>`).join('')}</select>`;
  if (v[0] === 'and') return `<span class="cond">${condHtml(v[1], `${p}${p ? '.' : ''}1`)} <span>and</span> ${condHtml(v[2], `${p}${p ? '.' : ''}2`)}</span>`;
  if (v[0] === 'var') return `<span class="cond"><b class="var">${esc(v[1])}</b> ${ops(['<', '>', '='], 2)} <input ${k(3)} type="number" step="any" value="${v[3]}"></span>`;
  if (v[0] === 'analog') return `<span class="cond">read analog pin ${pinSelect(v[1]).replace('<select', `<select ${k(1)}`)} ${ops(['>', '<'], 2)} <input ${k(3)} type="number" min="0" max="4095" value="${v[3]}"></span>`;
  return `<span class="cond">read digital pin ${pinSelect(v[1]).replace('<select', `<select ${k(1)}`)} = <select ${k(2)}><option value="1"${v[2] ? ' selected' : ''}>1</option><option value="0"${v[2] ? '' : ' selected'}>0</option></select></span>`;
}

/** Render an editable block program into `el`. Returns Map(statement → element) for highlighting. */
export function renderBlocks(el, prog, onChange) {
  const map = new Map();
  const stack = (list) => list.map((st) => {
    const head = OPS[st[0]].parts.map((p) => (typeof p === 'string' ? `<span>${p}</span>` : field(st, p))).join('');
    if (st[0] === 'if' || st[0] === 'repeat') return `<div class="bk c cat-ctrl" data-id="${id(st)}"><div class="bk-row">${head}</div><div class="stack">${stack(st[2])}</div>` +
      (st[3] ? `<div class="bk-row"><span>else</span></div><div class="stack">${stack(st[3])}</div>` : '') + '<div class="bk-foot"></div></div>';
    return `<div class="bk cat-${OPS[st[0]].cat}" data-id="${id(st)}"><div class="bk-row">${head}</div></div>`;
  }).join('');
  const ids = [];
  const id = (st) => ids.push(st) - 1;
  el.innerHTML = `<div class="bk hat"><div class="bk-row"><span>when Arduino begin</span></div></div><div class="stack setup">${stack(prog.setup)}</div>` +
    `<div class="bk c cat-ctrl forever"><div class="bk-row"><span>forever</span></div><div class="stack">${stack(prog.loop)}</div><div class="bk-foot">↻</div></div>` +
    Object.entries(prog.funcs || {}).map(([n, body]) => `<div class="bk c cat-fn define"><div class="bk-row"><span>define</span><b class="fname">${esc(n)}</b></div><div class="stack">${stack(body)}</div><div class="bk-foot"></div></div>`).join('');
  el.querySelectorAll('[data-id]').forEach((b) => map.set(ids[b.dataset.id], b));
  el.oninput = (e) => {
    const t = e.target, st = ids[t.closest('[data-id]')?.dataset.id];
    if (!st) return;
    const num = (x) => (x === '' || isNaN(+x) ? x : +x);
    if (t.dataset.c) { const path = t.dataset.c.split('.').map(Number); let o = st[1]; path.slice(0, -1).forEach((k) => { o = o[k]; }); o[path.at(-1)] = ['<', '>', '='].includes(t.value) ? t.value : +t.value; }
    else st[+t.dataset.i] = t.type === 'text' ? t.value : num(t.value);
    onChange();
  };
  return map;
}
