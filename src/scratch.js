// Scratch Coding module: no kit needed. Lesson 1 "Meet Scratch": what Scratch is, the editor, block shapes, the 9 block
// categories, a drag-and-snap playground with a robot sprite, and a quiz. Renders into #home like the book pages.
import { head } from './levels.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const LESSON_ID = 'scratch-intro';

// Scratch 3 category colours: c = block, e = edge. Blocks for show: [category, shape, text, inner blocks (C shapes)]
// shape: hat | s (stack) | c | cc (forever: a C with a flat bottom) | cap | bool | rep (reporter)
// text marks: (10) a round input, [all] a dropdown, <> an empty hexagon hole, ⚑ the green flag
export const CATS = [
  { id: 'motion', name: 'Motion', c: '#4c97ff', e: '#3373cc', what: 'Move your sprite, turn it and send it to a spot on the stage.',
    blocks: [['motion', 's', 'move (10) steps'], ['motion', 's', 'turn ↻ (15) degrees'], ['motion', 's', 'go to x: (0) y: (0)'], ['motion', 's', 'glide (1) secs to [random position]'], ['motion', 's', 'if on edge, bounce'], ['motion', 'rep', 'x position']] },
  { id: 'looks', name: 'Looks', c: '#9966ff', e: '#774dcb', what: 'Change how a sprite looks: speech bubbles, costumes, size and colour.',
    blocks: [['looks', 's', 'say (Hello!) for (2) seconds'], ['looks', 's', 'think (Hmm…)'], ['looks', 's', 'switch costume to [costume2]'], ['looks', 's', 'change size by (10)'], ['looks', 's', 'change [color] effect by (25)'], ['looks', 's', 'hide']] },
  { id: 'sound', name: 'Sound', c: '#cf63cf', e: '#bd42bd', what: 'Play sounds and music, and make them louder or quieter.',
    blocks: [['sound', 's', 'play sound [pop] until done'], ['sound', 's', 'start sound [pop]'], ['sound', 's', 'stop all sounds'], ['sound', 's', 'change volume by (-10)']] },
  { id: 'events', name: 'Events', c: '#ffbf00', e: '#cc9900', what: 'Start scripts when something happens: the green flag, a key press, a click or a message.',
    blocks: [['events', 'hat', 'when ⚑ clicked'], ['events', 'hat', 'when [space] key pressed'], ['events', 'hat', 'when this sprite clicked'], ['events', 's', 'broadcast [message1]']] },
  { id: 'control', name: 'Control', c: '#ffab19', e: '#cf8b17', what: 'Wait, repeat and decide. These blocks control when, and how often, other blocks run.',
    blocks: [['control', 's', 'wait (1) seconds'], ['control', 'c', 'repeat (10)'], ['control', 'cc', 'forever'], ['control', 'c', 'if <> then'], ['control', 'cap', 'stop [all]']] },
  { id: 'sensing', name: 'Sensing', c: '#5cb1d6', e: '#2e8eb8', what: 'Ask about the world: is the sprite touching something, is a key pressed, how much time has passed?',
    blocks: [['sensing', 'bool', 'touching [mouse-pointer] ?'], ['sensing', 'bool', 'key [space] pressed?'], ['sensing', 's', "ask (What's your name?) and wait"], ['sensing', 'rep', 'answer'], ['sensing', 'rep', 'timer']] },
  { id: 'operators', name: 'Operators', c: '#59c059', e: '#389438', what: 'Do maths, compare numbers, pick random numbers and join words together.',
    blocks: [['operators', 'rep', '( ) + ( )'], ['operators', 'rep', 'pick random (1) to (10)'], ['operators', 'bool', '( ) > (50)'], ['operators', 'bool', '<> and <>'], ['operators', 'rep', 'join (apple) (banana)']] },
  { id: 'variables', name: 'Variables', c: '#ff8c1a', e: '#db6e00', what: 'Remember things, like a score or a name, in a named box you can change.',
    blocks: [['variables', 's', 'set [score] to (0)'], ['variables', 's', 'change [score] by (1)'], ['variables', 's', 'show variable [score]'], ['variables', 'rep', 'score']] },
  { id: 'myblocks', name: 'My Blocks', c: '#ff6680', e: '#ff4d6a', what: 'Make your own block from a group of blocks, then use it again and again.',
    blocks: [['myblocks', 'hat', 'define jump'], ['myblocks', 's', 'jump']] },
];
const K = Object.fromEntries(CATS.map((k) => [k.id, k]));
export const kv = (cat) => `--c:${K[cat].c};--e:${K[cat].e}`;

export const FLAG = '<svg class="flag" viewBox="0 0 24 24" role="img" aria-label="green flag"><path d="M6 21V4" stroke="#45993d" stroke-width="2.2" stroke-linecap="round"/><path d="M6 4.5c3.5-2 6.5 2 11 0v9c-4.5 2-7.5-2-11 0z" fill="#4cbf56" stroke="#45993d" stroke-width="1.6" stroke-linejoin="round"/></svg>';
export const STOP_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z" fill="#ec5959" stroke="#b84848" stroke-width="1.5" stroke-linejoin="round"/></svg>';
// an original robot sprite (facing right, like every Scratch costume at direction 90)
const ROBOT = `<svg viewBox="0 0 64 64" aria-hidden="true"><g stroke="#0a1f4d" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
  <path d="M30 11V5"/><circle cx="30" cy="4.5" r="3.2" fill="#fbbf24"/><rect x="10" y="11" width="40" height="26" rx="8" fill="#2563eb"/>
  <path d="M44 45h11"/><rect x="16" y="38" width="28" height="16" rx="4" fill="#fbbf24"/><circle cx="22" cy="58" r="4" fill="#0a1f4d"/><circle cx="38" cy="58" r="4" fill="#0a1f4d"/></g>
  <rect x="24" y="16" width="22" height="15" rx="5" fill="#e3ecfd"/><circle cx="31" cy="23.5" r="2.6" fill="#0a1f4d"/><circle cx="40" cy="23.5" r="2.6" fill="#0a1f4d"/><circle cx="15" cy="24" r="2.4" fill="#fbbf24"/></svg>`;

const turn = (d, side) => `<svg class="turn" viewBox="0 0 24 24" role="img" aria-label="${side}"><path d="${d}" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const icons = (t) => t.replace(/⚑/g, FLAG).replace(/↻/g, turn('M19 12a7 7 0 1 1-2-4.9M19 3v5h-5', 'right')).replace(/↺/g, turn('M5 12a7 7 0 1 0 2-4.9M5 3v5h5', 'left'));
const txt = (t) => icons(t.replace(/\(([^()]*)\)/g, '<i class="in">$1</i>').replace(/\[([^\]]*)\]/g, '<i class="dd">$1 ▾</i>').replace(/<>/g, '<i class="slot"></i>'));
/** one Scratch-style block (or a C block with blocks inside) as HTML */
export const sb = ([cat, shape, text, inner = []]) => (shape === 'c' || shape === 'cc'
  ? `<div class="sb c${shape === 'cc' ? ' cap' : ''}" style="${kv(cat)}"><div class="sb-top">${txt(text)}</div><div class="sb-in">${inner.map(sb).join('')}</div><div class="sb-bot"></div></div>`
  : `<div class="sb ${shape}" style="${kv(cat)}">${txt(text)}</div>`);

/** the card art: a small script beside the robot */
export const scratchArt = () => `<div class="sc-art">${sb(['events', 'hat', 'when ⚑ clicked'])}${sb(['control', 'c', 'repeat (10)', [['motion', 's', 'move (10) steps'], ['motion', 's', 'turn ↻ (15) degrees']]])}${sb(['looks', 's', 'say (Hello!) for (2) seconds'])}</div>
  <span class="sc-bot">${ROBOT}<span class="sc-bubble">Hello!</span></span>`;

const SHAPES = [
  ['Hat', 'Starts a script. The round top means nothing can snap above it.', ['events', 'hat', 'when ⚑ clicked']],
  ['Stack', 'Does one thing. A notch on top and a bump below let it snap into a stack.', ['motion', 's', 'move (10) steps']],
  ['C block', 'Wraps around other blocks to repeat them, or to run them only sometimes.', ['control', 'c', 'repeat (10)', [['motion', 's', 'move (10) steps']]]],
  ['Boolean', 'Pointy ends. Answers yes or no (true or false). Fits in hexagon holes.', ['sensing', 'bool', 'touching [edge] ?']],
  ['Reporter', 'Round ends. Holds a value, like a number or a word. Fits in round holes.', ['motion', 'rep', 'x position']],
  ['Cap', 'Ends a script. The flat bottom means nothing can snap below it.', ['control', 'cap', 'stop [all]']],
];
const AREAS = [ // the editor tour, numbered like the mock
  ['Block categories', 'Nine colours. Click one to jump to its blocks.'],
  ['Block palette', 'Every block in that category. Drag one into the code area.'],
  ['Code area', 'Snap blocks together here. A stack of blocks is called a script.'],
  ['Stage', 'Your sprites act here. The green flag starts your scripts; the red stop sign stops them.'],
  ['Sprite list', 'Every sprite in your project. Click one to see and change its scripts.'],
  ['Tabs', 'Code for blocks, Costumes for how a sprite looks, Sounds for what it can play.'],
];
const QUIZ = [
  { q: 'Which block starts a script when you click the green flag?', opts: [['events', 'hat', 'when ⚑ clicked'], ['motion', 's', 'move (10) steps'], ['control', 'cap', 'stop [all]']], a: 0, why: 'Hat blocks have a round top: they start scripts.' },
  { q: 'Which category is “say Hello! for 2 seconds” in?', opts: ['Motion', 'Looks', 'Sound'], a: 1, why: 'Looks blocks change how a sprite looks, speech bubbles too.' },
  { q: 'A block with pointy ends, like “touching edge?”, gives you…', opts: ['a number or a word', 'a yes or no answer', 'a new sprite'], a: 1, why: 'Boolean blocks answer true or false.' },
  { q: 'Which block makes the blocks inside it run 10 times?', opts: [['control', 'c', 'repeat (10)'], ['events', 'hat', 'when this sprite clicked'], ['operators', 'rep', 'pick random (1) to (10)']], a: 0, why: 'Repeat is a C block from Control: it wraps around other blocks.' },
];
const STEPS = ['What is Scratch?', 'The Scratch screen', 'Block shapes', 'Block categories', 'Try it', 'Quiz'];

// --- playground: blocks, interpreter ---------------------------------------------------------------
// parts: text, or the index of an input in args. c: a C block (has a body)
const OPS = {
  move: { cat: 'motion', parts: ['move', 0, 'steps'], args: [10] },
  turnR: { cat: 'motion', parts: ['turn ↻', 0, 'degrees'], args: [15] },
  turnL: { cat: 'motion', parts: ['turn ↺', 0, 'degrees'], args: [15] },
  goto: { cat: 'motion', parts: ['go to x:', 0, 'y:', 1], args: [0, 0] },
  point: { cat: 'motion', parts: ['point in direction', 0], args: [90] },
  bounce: { cat: 'motion', parts: ['if on edge, bounce'], args: [] },
  say: { cat: 'looks', parts: ['say', 0, 'for', 1, 'seconds'], args: ['Hello!', 2] },
  size: { cat: 'looks', parts: ['change size by', 0], args: [10] },
  color: { cat: 'looks', parts: ['change color effect by', 0], args: [25] },
  pop: { cat: 'sound', parts: ['play sound pop'], args: [] },
  wait: { cat: 'control', parts: ['wait', 0, 'seconds'], args: [1] },
  repeat: { cat: 'control', parts: ['repeat', 0], args: [10], c: true },
};
// --- 3D lessons: the robotics workspace (3D stage, tabs, block editor, strip) with the cat sprite ---------
// Record: { id, scratch, cardTitle, thumb, heading, lede, features, steps, observation, ref: [[block, what]] (Blocks tab),
//           specs (Sprite tab), palette: block ops, blocks: the starting script }
export const B = (op, ...args) => ({ op, args }), REPEAT = (n, body) => ({ op: 'repeat', args: [n], body });
export const SCRATCH_LESSONS = [
  { id: 'sc-hello-spin', scratch: true, cardTitle: 'Say hello and spin', thumb: 'cat', blurb: 'the cat says hello and spins all the way round',
    heading: 'Say hello and spin', lede: 'Your first 3D Scratch script. Press Run: the cat says Hello!, spins all the way round, then says Whee! Change the numbers, drag in more blocks and run it again.',
    features: ['"when green flag clicked" starts the script when you press Run', '"say Hello! for 2 seconds" shows a speech bubble, then waits', '"repeat 24" runs the turn block 24 times: 24 × 15° = 360°, one full spin', '"turn ↻ 15 degrees" turns the cat clockwise, seen from above'],
    steps: ['Press Run and watch the cat: hello, a full spin, then Whee!', 'Click "Hello!" in the say block and type your own name, then run it again', 'Change repeat 24 to 48. How many times does the cat spin now?', 'Drag "turn ↺" from the palette into the repeat, and drag "turn ↻" out. Which way does it spin?', 'Try turn 90 with repeat 4: the cat turns in four big jumps', 'End with "point in direction 90" so the cat always faces right again'],
    observation: 'The cat shows "Hello!" for 2 seconds, then turns 15° twenty-four times, one full turn, and ends facing the way it started before it says "Whee!".',
    ref: [[['events', 'hat', 'when ⚑ clicked'], 'Starts the script when you press Run'], [['looks', 's', 'say (Hello!) for (2) seconds'], 'A speech bubble for that long, then the next block'],
      [['control', 'c', 'repeat (24)'], 'Runs the blocks inside it 24 times'], [['motion', 's', 'turn ↻ (15) degrees'], 'Turns clockwise (↺ turns the other way)'],
      [['motion', 's', 'point in direction (90)'], '90 = right, 0 = up, -90 = left, 180 = down'], [['control', 's', 'wait (1) seconds'], 'Pauses the script']],
    specs: [['Sprite', 'Cat'], ['Starts at', 'x 0, y 0: the middle of the stage'], ['Direction', '90: facing right'], ['Stage', '480 × 360 steps, x −240 to 240, y −180 to 180'], ['One full turn', '360°']],
    palette: ['say', 'turnR', 'turnL', 'point', 'wait', 'repeat'],
    blocks: [B('say', 'Hello!', 2), REPEAT(24, [B('turnR', 15)]), B('say', 'Whee!', 1)] },
];
export const CH1_ID = 'scratch-ch1';
/** every Scratch lesson in order: [{ id, href, title }] (module page, home card, next-lesson links, XP) */
export const scratchList = () => [{ id: CH1_ID, href: '#/scratch/ch1', title: 'Introduction to Block-Based Coding' }, { id: LESSON_ID, href: '#/scratch/intro', title: 'Meet Scratch' },
  ...SCRATCH_LESSONS.map((l) => ({ id: l.id, href: `#/scratch/lesson/${l.id}`, title: l.cardTitle }))];
export const scratchIds = scratchList().map((x) => x.id);

const GOALS = [
  ['Run a script with a move block', (b) => b.op === 'move'],
  ['Put blocks inside a repeat (try move and turn)', (b) => b.op === 'repeat' && b.body.length > 0],
  ['Make the robot say something', (b) => b.op === 'say'],
];

const W = 240, H = 180, STOP = Symbol('stop'); // stage: 480 × 360, (0, 0) in the middle, like Scratch
const rad = (d) => (d * Math.PI) / 180, r6 = (v) => Math.round(v * 1e6) / 1e6 + 0; // + 0 turns -0 into 0
const clamp = (v, m) => Math.max(-m, Math.min(m, v));
const wrap = (d) => { const w = (((d + 180) % 360) + 360) % 360 - 180; return w === -180 ? 180 : w; }; // Scratch directions: (-180, 180]
export const newSprite = () => ({ x: 0, y: 0, dir: 90, size: 100, color: 0, say: '' });

function bounce(s) {
  const r = s.size * 0.3; // the robot is 60 of 480 stage units wide at 100 %
  let dx = Math.sin(rad(s.dir)), dy = Math.cos(rad(s.dir)), hit = false;
  if (s.x > W - r) { s.x = W - r; dx = -Math.abs(dx); hit = true; } else if (s.x < r - W) { s.x = r - W; dx = Math.abs(dx); hit = true; }
  if (s.y > H - r) { s.y = H - r; dy = -Math.abs(dy); hit = true; } else if (s.y < r - H) { s.y = r - H; dy = Math.abs(dy); hit = true; }
  if (hit) s.dir = wrap(r6((Math.atan2(dx, dy) * 180) / Math.PI));
}

/** Run blocks [{ op, args, body? }] on sprite s. ctx: { sleep(ms), frame(), stopped(), step?(block), sound?() }. Each repeat lap waits a frame, like Scratch. */
export async function runScript(script, s, ctx) {
  const exec = async (list) => {
    for (const b of list) {
      if (ctx.stopped()) throw STOP;
      ctx.step?.(b);
      const n = (i) => Number(b.args[i]) || 0;
      switch (b.op) {
        case 'move': s.x = clamp(r6(s.x + n(0) * Math.sin(rad(s.dir))), W); s.y = clamp(r6(s.y + n(0) * Math.cos(rad(s.dir))), H); break;
        case 'turnR': s.dir = wrap(s.dir + n(0)); break;
        case 'turnL': s.dir = wrap(s.dir - n(0)); break;
        case 'goto': s.x = clamp(n(0), W); s.y = clamp(n(1), H); break;
        case 'point': s.dir = wrap(n(0)); break;
        case 'bounce': bounce(s); break;
        case 'say': s.say = String(b.args[0]); await ctx.sleep(n(1) * 1000); s.say = ''; break;
        case 'size': s.size = Math.min(500, Math.max(5, s.size + n(0))); break;
        case 'color': s.color += n(0); break;
        case 'pop': ctx.sound?.(); break;
        case 'wait': await ctx.sleep(n(0) * 1000); break;
        case 'repeat': for (let i = 0; i < Math.round(n(0)); i++) { await exec(b.body); await ctx.frame(); } break;
      }
    }
  };
  try { await exec(script); } catch (e) { if (e !== STOP) throw e; }
}

let audio = null;
function pop() { // a short falling blip
  try {
    audio ||= new AudioContext();
    const t = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
    o.frequency.setValueAtTime(700, t); o.frequency.exponentialRampToValueAtTime(180, t + 0.12);
    g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g).connect(audio.destination); o.start(t); o.stop(t + 0.16);
  } catch { /* no audio: stay quiet */ }
}

const label = (op) => OPS[op].parts.map((x) => (typeof x === 'string' ? x : '…')).join(' ');
/** a block's row: inputs from b (in the script) or the defaults as plain ovals (in the palette) */
const row = (op, b) => OPS[op].parts.map((x) => (typeof x === 'string' ? `<span>${icons(x)}</span>`
  : b ? `<input data-i="${x}" value="${esc(b.args[x])}" size="${Math.max(2, String(b.args[x]).length)}" aria-label="${label(op)}">` : `<i class="in">${esc(OPS[op].args[x])}</i>`)).join('');

/** Drag-and-snap block editor. Puts a palette and a code area ("when ⚑ clicked" + the script) at the start of root.
 *  main: the script, edited in place. ops: the palette's blocks. onChange(): after every edit. Returns { elOf(block) }. */
export function mountEditor(root, main, { ops = Object.keys(OPS), onChange = () => {} } = {}) {
  root.insertAdjacentHTML('afterbegin', `<div class="sc-pal" aria-label="Block palette"></div><div class="sc-code" tabindex="-1" aria-label="Your script">${sb(['events', 'hat', 'when ⚑ clicked'])}<div class="sc-script stk" data-l="0"></div><p class="sc-tip">Drag blocks here</p></div>`);
  const pal = root.querySelector('.sc-pal'), code = root.querySelector('.sc-code'), script = code.querySelector('.sc-script'), tip = code.querySelector('.sc-tip');
  let refs = [], lists = [], drag = null;

  pal.innerHTML = CATS.filter((k) => ops.some((op) => OPS[op].cat === k.id)).map((k) => `<h3><i style="${kv(k.id)}"></i>${k.name}</h3>` +
    ops.filter((op) => OPS[op].cat === k.id).map((op) => { const o = OPS[op], at = `style="${kv(o.cat)}" data-op="${op}" tabindex="0" role="button" aria-label="Add ${label(op)}"`;
      return o.c ? `<div class="sb c" ${at}><div class="sb-top">${row(op)}</div><div class="sb-in"></div><div class="sb-bot"></div></div>` : `<div class="sb s" ${at}>${row(op)}</div>`; }).join('')).join('');

  const render = () => {
    refs = []; lists = [main];
    const stack = (list) => list.map((b) => {
      const o = OPS[b.op], at = `style="${kv(o.cat)}" data-r="${refs.push({ b, list }) - 1}" tabindex="0" role="group" aria-label="${label(b.op)} (Delete removes it)"`;
      return o.c ? `<div class="sb c" ${at}><div class="sb-top">${row(b.op, b)}</div><div class="sb-in stk" data-l="${lists.push(b.body) - 1}">${stack(b.body)}</div><div class="sb-bot"></div></div>`
        : `<div class="sb s" ${at}>${row(b.op, b)}</div>`;
    }).join('');
    script.innerHTML = stack(main);
    tip.hidden = main.length > 0;
  };
  const edited = () => { render(); onChange(); };
  const newBlock = (op) => ({ op, args: [...OPS[op].args], ...(OPS[op].c && { body: [] }) });
  const remove = (r) => r.list.splice(r.list.indexOf(r.b), 1);

  // drag and snap: a ghost follows the pointer; a grey gap shows where the block will snap. Off the code area = delete.
  // ponytail: dragging moves one block (with its inside), not every block below it like Scratch; add if kids miss it.
  const aim = (gx, gy, px, py) => {
    drag.gap.remove();
    let best = null, bd = 56;
    for (const st of code.querySelectorAll('.stk')) {
      if (drag.el.contains(st)) continue; // never into itself
      const kids = [...st.children].filter((k) => k.matches('.sb') && k !== drag.el), sr = st.getBoundingClientRect();
      for (let i = 0; i <= kids.length; i++) {
        const y = i < kids.length ? kids[i].getBoundingClientRect().top : kids.length ? kids.at(-1).getBoundingClientRect().bottom : sr.top;
        const d = Math.hypot(gx - sr.left, gy - y);
        if (d < bd) { bd = d; best = { st, i, kids }; }
      }
    }
    const cr = code.getBoundingClientRect();
    if (!best && px > cr.left && px < cr.right && py > cr.top && py < cr.bottom) { // anywhere on the code area: the end of the script
      const kids = [...script.children].filter((k) => k !== drag.el);
      best = { st: script, i: kids.length, kids };
    }
    drag.to = best;
    if (best) best.st.insertBefore(drag.gap, best.kids[best.i] || null);
  };
  const endDrag = () => { drag.ghost?.remove(); drag.gap?.remove(); drag.el.classList.remove('sc-hide'); drag = null; };
  root.addEventListener('pointerdown', (e) => {
    const el = e.button === 0 && !e.target.closest('input') && e.target.closest('.sc-pal [data-op], .sc-code [data-r]');
    if (!el) return;
    const r = el.getBoundingClientRect();
    drag = { el, id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, h: r.height };
    root.setPointerCapture(e.pointerId);
  });
  root.addEventListener('pointermove', (e) => {
    if (drag?.id !== e.pointerId) return;
    if (!drag.ghost) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 5) return;
      drag.ghost = drag.el.cloneNode(true); drag.ghost.classList.add('sc-ghost'); drag.ghost.removeAttribute('tabindex'); root.append(drag.ghost);
      drag.gap = document.createElement('div'); drag.gap.className = 'sc-gap'; drag.gap.style.cssText = `width:${drag.w}px;height:${drag.h}px`;
      if (drag.el.dataset.r) drag.el.classList.add('sc-hide');
    }
    const gx = e.clientX - drag.dx, gy = e.clientY - drag.dy;
    drag.ghost.style.translate = `${gx}px ${gy}px`;
    aim(gx, gy, e.clientX, e.clientY);
  });
  root.addEventListener('pointerup', (e) => {
    if (drag?.id !== e.pointerId) return;
    const { el, ghost, to } = drag, from = el.dataset.r ? refs[el.dataset.r] : null;
    endDrag();
    if (!ghost) { if (!from) { main.push(newBlock(el.dataset.op)); edited(); } return; } // a tap on the palette adds to the end
    const b = from ? from.b : newBlock(el.dataset.op);
    if (from) remove(from);
    if (to) lists[to.st.dataset.l].splice(to.i, 0, b);
    edited();
  });
  root.addEventListener('pointercancel', () => drag && endDrag());
  root.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t.matches('.sc-pal [data-op]') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); main.push(newBlock(t.dataset.op)); edited(); }
    if (t.matches('.sc-code [data-r]') && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); remove(refs[t.dataset.r]); edited(); code.focus(); }
  });
  script.addEventListener('input', (e) => {
    const t = e.target, r = refs[t.closest('[data-r]').dataset.r];
    r.b.args[+t.dataset.i] = t.value; t.size = Math.max(2, t.value.length);
    onChange();
  });
  render();
  return { elOf: (b) => script.querySelector(`[data-r="${refs.findIndex((r) => r.b === b)}"]`) };
}

/** a run that Stop (or a new run) can cut short: sleeps wake early once stop() is called */
export function runner() {
  const me = { stop: false };
  me.wait = (ms) => new Promise((ok) => { const end = performance.now() + ms; const t = () => (me.stop || performance.now() >= end ? ok() : setTimeout(t, Math.min(50, end - performance.now()))); t(); });
  return me;
}

/** A 2D Scratch stage: el holds .sc-sprite and .sc-say; pos (optional) shows x, y and direction.
 *  → { s (the sprite), draw(), go(script, step?) runs a script (a new run stops the last one), stop(), reset() } */
export function stageView(el, pos) {
  const s = newSprite(), sp = el.querySelector('.sc-sprite'), bub = el.querySelector('.sc-say');
  let run = null;
  const draw = () => {
    sp.style.left = bub.style.left = `${((s.x + W) / (2 * W)) * 100}%`;
    sp.style.top = bub.style.top = `${((H - s.y) / (2 * H)) * 100}%`;
    sp.style.transform = `translate(-50%, -50%) rotate(${s.dir - 90}deg) scale(${s.size / 100})`;
    sp.style.filter = s.color ? `hue-rotate(${s.color * 1.8}deg)` : ''; // Scratch: colour effect 200 = once round the colour wheel
    bub.hidden = !s.say; bub.textContent = s.say;
    if (pos) pos.innerHTML = `x: <b>${Math.round(s.x)}</b> y: <b>${Math.round(s.y)}</b> direction: <b>${Math.round(s.dir)}</b>`;
  };
  const stop = () => { if (run) run.stop = true; };
  const go = async (script, step) => {
    stop();
    const me = run = runner();
    const loop = () => { draw(); if (run === me) requestAnimationFrame(loop); };
    loop();
    await runScript(script, s, { stopped: () => me.stop, sleep: me.wait, frame: () => me.wait(1000 / 30), sound: pop, step });
    if (run === me) run = null;
    draw();
  };
  addEventListener('hashchange', stop, { once: true }); // leaving the page stops the sprite
  draw();
  return { s, draw, go, stop, reset: () => { stop(); Object.assign(s, newSprite()); draw(); } };
}

function playground(root, onRun) {
  const main = [], { elOf } = mountEditor(root, main), view = stageView(root.querySelector('.sc-stage'), root.querySelector('.sc-pos'));
  const has = (list, f) => list.some((b) => f(b) || (b.body && has(b.body, f)));
  let lit = null;
  root.querySelector('.sc-go').onclick = async () => {
    onRun(GOALS.map(([, f]) => has(main, f)));
    await view.go(main, (b) => { lit?.classList.remove('run'); lit = elOf(b); lit?.classList.add('run'); });
    lit?.classList.remove('run');
  };
  root.querySelector('.sc-stop').onclick = view.stop;
  root.querySelector('.sc-home').onclick = view.reset;
  if (import.meta.env?.DEV) window.__scratch = { main, s: view.s }; // dev-only: browser checks
}

// --- pages ---------------------------------------------------------------------------------------------
/** #/scratch: the module page. p: { done: Set } → img placeholders that want a 3D thumbnail: [{ el, model }] */
export function renderScratchHome(el, p) {
  const art = { [CH1_ID]: [['events', 'hat', 'when ⚑ clicked'], ['motion', 's', 'move (10) steps']], [LESSON_ID]: [['events', 'hat', 'when ⚑ clicked'], ['looks', 's', 'say (Hi!)']] };
  const sub = { [CH1_ID]: 'What coding is, blocks vs text, RoboCoders Studio, the block palette and saving projects',
    [LESSON_ID]: 'The Scratch screen, the 6 block shapes, the 9 block colours and your first script' };
  const list = scratchList().map((x) => { const l = SCRATCH_LESSONS.find((y) => y.id === x.id);
    return { ...x, sub: l ? `In 3D: ${l.blurb}` : sub[x.id], art: l ? `<span class="proj-shot" data-thumb="${l.thumb}"></span>` : `<span class="sc-thumb">${art[x.id].map(sb).join('')}</span>` }; });
  const got = list.filter((x) => p.done.has(x.id)).length, next = list.find((x) => !p.done.has(x.id));
  el.innerHTML = `<div class="hwash sc-page">${head('<a class="pill ghost" href="#/">All kits</a>')}
    <section class="bhero hwrap sc-hero"><div class="kc-art sc-art-wrap">${scratchArt()}</div>
      <div><h1>Scratch Coding</h1><p class="lede">Learn to code with colourful blocks that snap together. No kit needed: everything runs right here in your browser.</p>
        <dl class="meters"><div><dt>Lessons done</dt><dd>${got} of ${list.length}</dd><span class="m"><i style="width:${(got / list.length) * 100}%"></i></span></div></dl>
        <div class="acts"><a class="pill amber big" href="${(next || list[0]).href}">${next ? (got ? 'Continue' : 'Start') : 'Review'}: ${esc((next || list[0]).title)}</a></div></div></section>
    <section class="hwrap bsec" aria-labelledby="sc-ls"><h2 id="sc-ls">Lessons</h2>
      <ol class="projs">${list.map((x, i) => `<li class="proj"><a class="proj-in" href="${x.href}">${x.art}
        <span class="proj-txt"><i class="proj-n">Lesson ${i + 1}</i><b>${esc(x.title)}</b><small>${esc(x.sub)}</small></span>
        <span class="proj-st">${p.done.has(x.id) ? 'Done' : 'Start'}</span></a></li>`).join('')}</ol>
      <p class="sc-more">More lessons are on the way.</p></section></div>`;
  return [...el.querySelectorAll('[data-thumb]')].map((d) => ({ el: d, model: d.dataset.thumb }));
}

/** A step-by-step lesson page: title, step pills with a progress bar, one step at a time with Back/Next, and a last quiz step
 *  whose "Finish lesson" calls p.finish(cfg.id). cfg: { id, title, names, steps (html per step), quiz: [{ q, opts, a, why }], done }.
 *  The open step is remembered per lesson. Returns { $, $$ } scoped to the page, for the lesson's own activities. */
export function stepLesson(el, p, cfg) {
  const names = [...cfg.names, 'Quiz'], list = scratchList(), at = list.findIndex((x) => x.id === cfg.id), next = list[at + 1];
  const quiz = `<h2>Quick quiz</h2><p class="sc-lede">${cfg.quiz.length} questions. Get them all right to finish the lesson and earn 100 XP.</p>
    ${cfg.quiz.map((x, qi) => `<fieldset class="sc-q" data-q="${qi}"><legend>${qi + 1}. ${esc(x.q)}</legend><div class="sc-opts">${x.opts.map((o, oi) => `<button type="button" data-o="${oi}">${typeof o === 'string' ? esc(o) : sb(o)}</button>`).join('')}</div><p class="sc-fb" aria-live="polite"></p></fieldset>`).join('')}
    <div class="sc-finish"><button type="button" class="pill amber big" disabled>Finish lesson</button></div>
    <div class="sc-done" hidden><b>Lesson complete!</b><p>You earned 100 XP. ${esc(cfg.done)}</p>
      <div class="acts"><a class="pill amber" href="${next ? next.href : '#/'}">${next ? `Next: ${esc(next.title)}` : 'Back to home'}</a><a class="pill ghost" href="#/scratch">Scratch lessons</a></div></div>`;
  el.innerHTML = `<div class="hwash sc-page">${head('<a class="pill ghost" href="#/scratch">Scratch lessons</a>')}
    <section class="hwrap sc-lesson" aria-labelledby="sc-h"><p class="sc-kick">Scratch Coding · Lesson ${at + 1}</p><h1 id="sc-h">${esc(cfg.title)}</h1>
      <nav class="sc-steps" aria-label="Lesson steps"><ol>${names.map((t, i) => `<li><button type="button" data-go="${i}"><b>${i + 1}</b><span>${esc(t)}</span></button></li>`).join('')}</ol><span class="sc-prog"><i></i></span></nav>
      ${[...cfg.steps, quiz].map((h, i) => `<article class="sc-step" aria-label="${esc(names[i])}">${h}</article>`).join('')}
      <footer class="sc-nav"><button type="button" class="pill ghost" data-d="-1">Back</button><span class="sc-count"></span><button type="button" class="pill amber" data-d="1">Next</button></footer></section></div>`;
  const $ = (s) => el.querySelector(s), $$ = (s) => [...el.querySelectorAll(s)], key = `step:${cfg.id}`;

  let cur = 0;
  const show = (i, scroll = true) => {
    cur = Math.max(0, Math.min(names.length - 1, i)); p.store.set(key, cur);
    $$('.sc-step').forEach((s, k) => { s.hidden = k !== cur; });
    $$('[data-go]').forEach((b, k) => { b.classList.toggle('seen', k < cur); k === cur ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current'); });
    $('.sc-prog i').style.width = `${(cur / (names.length - 1)) * 100}%`;
    $('[data-d="-1"]').disabled = cur === 0;
    $('[data-d="1"]').hidden = cur === names.length - 1;
    $('[data-d="1"]').textContent = cur === names.length - 2 ? 'Next: the quiz' : 'Next';
    $('.sc-count').textContent = `Step ${cur + 1} of ${names.length}`;
    if (scroll) $('.sc-steps').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  $('.sc-lesson').addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]'), d = e.target.closest('[data-d]');
    if (go) show(+go.dataset.go); else if (d) show(cur + +d.dataset.d);
  });

  const fin = $('.sc-finish button');
  $$('.sc-q').forEach((f) => f.addEventListener('click', (e) => {
    const b = e.target.closest('[data-o]'), x = cfg.quiz[f.dataset.q];
    if (!b || f.classList.contains('done')) return;
    const right = +b.dataset.o === x.a;
    b.classList.add(right ? 'right' : 'wrong'); b.disabled = true;
    f.querySelector('.sc-fb').textContent = right ? `Yes! ${x.why}` : 'Not quite. Try another one.';
    if (right) { f.classList.add('done'); f.querySelectorAll('button').forEach((o) => { o.disabled = true; }); }
    fin.disabled = $$('.sc-q.done').length < cfg.quiz.length;
  }));
  fin.addEventListener('click', () => { p.finish(cfg.id); $('.sc-finish').hidden = true; $('.sc-done').hidden = false; $('.sc-done').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });

  show(p.store.get(key, 0), false);
  return { $, $$ };
}

/** #/scratch/intro: Meet Scratch. p: { done: Set, store, finish(id) } */
export function renderScratchLesson(el, p) {
  const steps = [
    `<div class="sc-two"><div><h2 id="sc-t0">What is Scratch?</h2>
      <p class="sc-lede">Scratch is a free coding language where you build programs by snapping blocks together, like puzzle pieces. There is nothing to type, so there are no spelling mistakes.</p>
      <ul class="sc-facts"><li><b>Made for young coders</b>The Lifelong Kindergarten group at the MIT Media Lab made Scratch. It is free for everyone.</li>
        <li><b>Sprites on a stage</b>The characters in a project are called sprites. They move, talk and play sounds on the stage.</li>
        <li><b>Scripts of blocks</b>A stack of blocks is a script. Click the green flag and your scripts run from top to bottom.</li></ul>
      <p class="sc-note">Use Scratch online at <a href="https://scratch.mit.edu" target="_blank" rel="noopener">scratch.mit.edu</a> or in the Scratch app. The blocks you use with the Robo Coders kit work the same way.</p></div>
      <figure class="sc-fig"><div class="sc-hello"><div>${sb(['events', 'hat', 'when ⚑ clicked'])}${sb(['motion', 's', 'move (10) steps'])}${sb(['looks', 's', 'say (Hello!)'])}</div>
        <div class="sc-mini-stage">${ROBOT}<span class="sc-bubble">Hello!</span></div></div>
        <figcaption>A script (left) tells a sprite what to do on the stage (right).</figcaption></figure></div>`,
    `<h2 id="sc-t1">The Scratch screen</h2><p class="sc-lede">Scratch has five main areas. Click a number to find each one.</p>
      <div class="sc-edwrap"><div class="sc-ed">
        <div class="ed-bar"><b>Scratch</b><span>File</span><span>Edit</span><span>Tutorials</span></div>
        <div class="ed-tabs" data-a="6"><span class="on">Code</span><span>Costumes</span><span>Sounds</span><b class="ed-n">6</b></div>
        <div class="ed-cats" data-a="1">${CATS.map((k) => `<i style="${kv(k.id)}"></i>`).join('')}<b class="ed-n">1</b></div>
        <div class="ed-pal" data-a="2">${sb(['motion', 's', 'move (10) steps'])}${sb(['motion', 's', 'turn ↻ (15) degrees'])}${sb(['motion', 's', 'go to x: (0) y: (0)'])}<b class="ed-n">2</b></div>
        <div class="ed-code" data-a="3">${sb(['events', 'hat', 'when ⚑ clicked'])}${sb(['control', 'c', 'repeat (10)', [['motion', 's', 'move (10) steps'], ['motion', 's', 'turn ↻ (15) degrees']]])}<b class="ed-n">3</b></div>
        <div class="ed-ctrl" data-a="4">${FLAG}${STOP_ICON}</div>
        <div class="ed-stage" data-a="4">${ROBOT}<b class="ed-n">4</b></div>
        <div class="ed-sprites" data-a="5"><span class="on">${ROBOT}</span><span class="add">+</span><b class="ed-n">5</b></div></div>
        <ol class="sc-legend">${AREAS.map(([n, w], i) => `<li><button type="button" data-a="${i + 1}"><b>${i + 1}</b><span><strong>${n}</strong>${w}</span></button></li>`).join('')}</ol></div>`,
    `<h2 id="sc-t2">Block shapes</h2><p class="sc-lede">A block's shape tells you where it fits, just like a puzzle piece.</p>
      <ul class="sc-shapes">${SHAPES.map(([n, w, b]) => `<li><div class="sc-shape">${sb(b)}</div><b>${n}</b><p>${w}</p></li>`).join('')}</ul>`,
    `<h2 id="sc-t3">Block categories</h2><p class="sc-lede">Blocks are sorted into 9 categories. Each has its own colour, so you can tell what a block does at a glance.</p>
      <div class="sc-cats" role="tablist" aria-label="Block categories">${CATS.map((k, i) => `<button type="button" role="tab" data-cat="${i}" style="${kv(k.id)}" aria-selected="false"><i></i>${k.name}</button>`).join('')}</div>
      <div class="sc-cat" role="tabpanel"></div>
      <p class="sc-note">Want more? The Add Extension button, bottom left in Scratch, adds extra categories, like Pen for drawing and Music for instruments.</p>`,
    `<h2 id="sc-t4">Try it: make the robot move</h2><p class="sc-lede">Drag blocks from the palette and snap them under <b>when green flag clicked</b>, then press the green flag. Tap a block to add it to the end. Drag a block off the script to remove it.</p>
      <ul class="sc-goals">${GOALS.map(([t]) => `<li>${t}</li>`).join('')}</ul>
      <div class="sc-play">
        <div class="sc-stagebox"><div class="sc-sbar"><button type="button" class="sc-go" title="Green flag: run the script">${FLAG}</button><button type="button" class="sc-stop" title="Stop" aria-label="Stop">${STOP_ICON}</button>
          <button type="button" class="sc-home" title="Put the robot back in the middle" aria-label="Put the robot back in the middle"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5"/></svg></button></div>
          <div class="sc-stage"><div class="sc-sprite">${ROBOT}</div><div class="sc-say" hidden></div></div><p class="sc-pos"></p></div></div>
      <p class="sc-yay" hidden>All three done. Great coding! Next up: the quiz.</p>`
  ];
  const { $, $$ } = stepLesson(el, p, { id: LESSON_ID, title: 'Meet Scratch', names: STEPS.slice(0, -1), steps, quiz: QUIZ,
    done: 'You know the Scratch screen, the block shapes and all 9 block colours.' });

  // the editor tour: a legend number and its area light up together
  const tour = $('.sc-edwrap'), hi = (a) => tour.querySelectorAll('[data-a]').forEach((x) => x.classList.toggle('hi', x.dataset.a === a));
  ['click', 'mouseover', 'focusin'].forEach((ev) => tour.addEventListener(ev, (e) => { const a = e.target.closest('[data-a]'); if (a) hi(a.dataset.a); }));
  hi('1');

  const pick = (i) => {
    const k = CATS[i];
    $$('[data-cat]').forEach((b) => b.setAttribute('aria-selected', String(+b.dataset.cat === i)));
    $('.sc-cat').innerHTML = `<div><h3><i style="${kv(k.id)}"></i>${k.name}</h3><p>${k.what}</p></div><div class="sc-blocks">${k.blocks.map(sb).join('')}</div>`;
  };
  $('.sc-cats').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) pick(+b.dataset.cat); });
  pick(0);

  const goals = $$('.sc-goals li');
  playground($('.sc-play'), (got) => {
    got.forEach((g, i) => { if (g) goals[i].classList.add('got'); });
    $('.sc-yay').hidden = !goals.every((g) => g.classList.contains('got'));
  });
}
