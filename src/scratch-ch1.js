// Scratch Coding · Lesson 1, from chapter 1 of the Robo Coders book, "Introduction to Block-Based Coding": what coding is,
// blocks vs text, RoboCoders Studio (home screen and interface), the block palette, naming, saving and opening projects.
// The Studio sections run in a simulated RoboCoders Studio window (studio() + wireStudio()). Files are pretend: nothing touches the disk.
import { CATS, CH1_ID, kv, sb, FLAG, STOP_ICON, B, REPEAT, stepLesson, stageView } from './scratch.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** One line of Python-style text code → { block } or { err, hint }. Knows move(n), turn(n) and say("text"). */
export function parseLine(t) {
  const m = String(t).trim().match(/^([A-Za-z_]\w*)\s*\((.*)\)$/);
  if (!m) return { err: 'SyntaxError: invalid syntax', hint: 'Write the name, then brackets: move(10)' };
  const [, name, raw] = m, arg = raw.trim();
  if (!['move', 'turn', 'say'].includes(name)) {
    const guess = { m: 'move', t: 'turn', s: 'say' }[name[0].toLowerCase()] || 'move';
    return { err: `NameError: name '${name}' is not defined`, hint: `Spelling matters in text code. Did you mean ${guess}?` };
  }
  if (name === 'say') {
    const q = arg.match(/^(["'])(.*)\1$/);
    return q ? { block: B('say', q[2], 2) } : { err: 'SyntaxError: text needs quotes', hint: 'Put your words in quotes: say("Hello!")' };
  }
  if (!arg) return { err: `TypeError: ${name}() needs a number`, hint: `Put a number in the brackets: ${name}(10)` };
  if (!/^-?\d+(\.\d+)?$/.test(arg)) return { err: `SyntaxError: '${arg}' is not a number`, hint: `Put a number in the brackets: ${name}(10)` };
  return { block: B(name === 'move' ? 'move' : 'turnR', +arg) };
}

export const OUTCOMES = ['What is coding?', 'Difference between block-based and text-based coding', 'Introduction to RoboCoders Studio and its interface', 'Exploring the block palette', 'Saving, opening and naming projects'];
export const RECIPE = ['Mix the butter and sugar', 'Add the flour and mix again', 'Roll the dough into small balls', 'Bake for 10 minutes', 'Let them cool, then eat!'];
const DEAL = [3, 0, 4, 2, 1]; // the order the recipe cards are dealt in
const MAKES = [['Websites', 'M3 5h18v14H3zM3 9h18'], ['Apps', 'M7 2h10v20H7zM11 18h2'], ['Games', 'M6 9h12a4 4 0 0 1 0 8H6a4 4 0 0 1 0-8zM8 11v4M6 13h4M15 12h.01M17 14h.01'], ['Robots', 'M7 8h10v9H7zM12 4v4M9 12h.01M15 12h.01M5 11v4M19 11v4']];
export const AREAS = [ // the book's tour of the Studio, in its order: [area, name, what it is]
  ['tabs', 'Tabs', 'Switch between Code, Costumes and Sounds to build different parts of your project.'],
  ['code', 'Code Area', 'Your workspace! Drag blocks here and snap them together to tell your sprites what to do.'],
  ['stage', 'Stage', 'Like a theatre where your creations come alive: your characters move and perform here.'],
  ['palette', 'Block Palette', 'Your toy box of coding blocks. Find blocks for movement, sounds, looks and more.'],
  ['sprites', 'Sprites List', 'These are your characters. They can be animals, people, cars or anything you imagine.'],
  ['ext', 'Add Extension', 'Special blocks for cool extras like music, video sensing and text-to-speech.'],
  ['backdrops', 'Backdrops', 'The backgrounds of your project. Change them to make places like space, a jungle or a classroom!'],
];
const AREA_NAME = { ...Object.fromEntries(AREAS.map(([a, n]) => [a, n])), name: 'project name box' };
// the book's colour, job and examples per category. Control's example is "if … then": "if on edge, bounce" is a Motion block in the Studio.
export const ABOUT = { motion: ['blue', 'Make sprites move and turn', 'Move 10 steps, turn right'], looks: ['purple', 'Change how sprites look', 'Change colour, say "Hello!"'],
  sound: ['pink', 'Add music and sound effects', 'Play a sound, make it louder'], events: ['yellow', 'Start actions when something happens', 'When you click the green flag, when you press a key'],
  control: ['orange', 'Control your program with loops and choices', 'Repeat 10 times, if … then'], sensing: ['light blue', 'Detect touches and movements', 'Is it touching something? Ask a question and wait'],
  operators: ['green', 'Do maths and comparisons', 'Add numbers, check if something is bigger'], variables: ['dark orange', 'Remember scores and numbers', 'Add 1 to the score, show the score'],
  myblocks: ['red', 'Make your own blocks', 'Make a "jump" block once, use it again and again'] };
// palette blocks that run when you click them, as in the Studio (keyed by their text in CATS)
const RUNS = { 'move (10) steps': B('move', 10), 'turn ↻ (15) degrees': B('turnR', 15), 'go to x: (0) y: (0)': B('goto', 0, 0), 'if on edge, bounce': B('bounce'),
  'say (Hello!) for (2) seconds': B('say', 'Hello!', 2), 'change size by (10)': B('size', 10), 'change [color] effect by (25)': B('color', 25),
  'play sound [pop] until done': B('pop'), 'start sound [pop]': B('pop'), 'wait (1) seconds': B('wait', 1) };
export const MATCH = [[['motion', 's', 'move (10) steps'], 'motion'], [['looks', 's', 'say (Hello!) for (2) seconds'], 'looks'], [['sound', 's', 'start sound [drum]'], 'sound'],
  [['events', 'hat', 'when ⚑ clicked'], 'events'], [['control', 'c', 'repeat (10)'], 'control'], [['sensing', 'bool', 'touching [edge] ?'], 'sensing'],
  [['operators', 'rep', '( ) + ( )'], 'operators'], [['variables', 's', 'change [score] by (1)'], 'variables']];
const MENU = [['new', 'New', 'New starts a fresh, empty project.'], ['newblocks', 'New Blocks', 'New Blocks starts a new block-coding project.'], ['open', 'Open'], ['save', 'Save'], ['saveas', 'Save As'],
  ['ml', 'Open ML Env', 'Open ML Env opens the AI & ML lab, where you teach computers to recognise things.'], ['robo', 'Open Robotics Env', 'Open Robotics Env opens the Robotics lab, to program real robots.']];
const MENU_INFO = { ...Object.fromEntries(MENU.map(([k, , t]) => [k, t])), edit: 'Edit has Undo, Redo and more.' };
export const SAVE_STEPS = ['Go to the File menu', 'Click Save or Save As', 'Type the name for your project', 'Select where to save it', 'Click Save'];
export const OPEN_STEPS = ['Go to the File menu', 'Click Open', 'Choose the folder where it is saved', 'Select the project file', 'Click Open'];

const HAT = ['events', 'hat', 'when ⚑ clicked'];
const project = (name, script, view) => ({ name, script, view: [HAT, ...view] });
const START = () => project('Untitled', [REPEAT(10, [B('move', 10)])], [['control', 'c', 'repeat (10)', [['motion', 's', 'move (10) steps']]]]);
const FILES = () => ({ Desktop: [], Documents: [{ name: 'my first game.sb3', date: '02-May-26 4:10 PM', p: project('my first game', [REPEAT(4, [B('move', 60), B('turnR', 90)])], [['control', 'c', 'repeat (4)', [['motion', 's', 'move (60) steps'], ['motion', 's', 'turn ↻ (90) degrees']]]]) }],
  'Scratch Projects': [{ name: 'geometry dash.sb3', date: '13-May-26 12:31 PM', p: project('geometry dash', [B('say', 'Geometry Dash!', 2), REPEAT(36, [B('turnR', 10)])], [['looks', 's', 'say (Geometry Dash!) for (2) seconds'], ['control', 'c', 'repeat (36)', [['motion', 's', 'turn ↻ (10) degrees']]]]) }] });

const CAT = '<span class="st-cat" data-thumb="cat"></span>'; // the 3D cat's picture, filled in by the page
const icon = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;

/** a RoboCoders Studio window: top bar with File menu and project name, the home screen ("What would you like to do?") and the block editor */
function studio(view = 'editor') {
  const pick = (k, age, ic, t, d) => `<button type="button" class="st-pick" data-pick="${k}"><i class="st-age">Ages ${age}</i>${icon(ic)}<b>${t}</b><small>${d}</small></button>`;
  return `<div class="st-win" data-view="${view}">
  <header class="st-bar"><b class="st-logo">ROBOCODERS</b>
    <div class="st-menu"><button type="button" class="st-mb st-file" aria-haspopup="menu" aria-expanded="false">File</button>
      <div class="st-drop" role="menu" hidden>${MENU.map(([k, t]) => `<button type="button" role="menuitem" data-menu="${k}">${t}</button>`).join('')}</div></div>
    <button type="button" class="st-mb" data-menu="edit">Edit</button>
    <label class="st-name" data-area="name"><span>Project</span><input value="Untitled" maxlength="40" aria-label="Project name" spellcheck="false"></label>
    <span class="st-tut">Tutorials</span></header>
  <div class="st-home"><h3>What would you like to do?</h3>
    <div class="st-picks"><p>Block Coding</p><p>Robotics</p>
      ${pick('blocks', '7+', 'M4 4h7v7H4zM13 13h7v7h-7zM13 4h7v7h-7z', 'Blocks', 'Code with playful puzzle-shaped blocks')}
      ${pick('robotics', '10+', 'M7 8h10v9H7zM12 4v4M9 12h.01M15 12h.01M5 11v4M19 11v4', 'Robotics', 'Program and control real robots and microcontrollers: Arduino, Raspberry Pi, ESP32 and more')}
      <p class="st-wide">Artificial Intelligence and Machine Learning</p>
      ${pick('ai', '10+', 'M12 3a4 4 0 0 1 4 4 4 4 0 0 1 0 8 4 4 0 0 1-8 0 4 4 0 0 1 0-8 4 4 0 0 1 4-4zM12 7v10M8 11h8', 'AI & ML', 'Train custom AI models to recognise images, text and sounds, then use them in your projects')}</div></div>
  <div class="st-ed">
    <div class="st-tabs" data-area="tabs"><span class="on">Code</span><span>Costumes</span><span>Sounds</span></div>
    <div class="st-cats" data-area="palette">${CATS.map((k) => `<button type="button" data-cat="${k.id}" style="${kv(k.id)}"><i></i>${k.name}</button>`).join('')}</div>
    <div class="st-pal" data-area="palette"></div>
    <button type="button" class="st-ext" data-area="ext" aria-label="Add Extension">${icon('M4 6h10v12H4zM17 4v6M14 7h6')}</button>
    <div class="st-code" data-area="code"></div>
    <div class="st-ctrl" data-area="stage"><button type="button" class="st-go" title="Green flag: run the script">${FLAG}</button><button type="button" class="st-stop" title="Stop" aria-label="Stop">${STOP_ICON}</button></div>
    <div class="st-stage sc-stage" data-area="stage"><div class="sc-sprite">${CAT}</div><div class="sc-say" hidden></div></div>
    <div class="st-sprites" data-area="sprites"><p>Sprite <b>Cat</b> <span class="st-pos"></span></p><span class="st-tile">${CAT}<small>Cat</small></span></div>
    <div class="st-back" data-area="backdrops"><b>Stage</b><span class="st-bd"></span><small>Backdrops: 1</small></div>
  </div>
  <div class="st-toast" role="status" hidden></div></div>`;
}

/** what every Studio window does: categories, click-to-run blocks, green flag, the File menu, the shared project name.
 *  state: { project, wins } shared by the lesson's windows. opts.onMenu(key) → true when the step handles it; opts.onCat(id). */
function wireStudio(root, state, opts = {}) {
  const $ = (s) => root.querySelector(s), stage = stageView($('.st-stage'), $('.st-pos')), drop = $('.st-drop'), file = $('.st-file');
  const toast = (t) => { const el = $('.st-toast'); el.textContent = t; el.hidden = false; clearTimeout(el.timer); el.timer = setTimeout(() => { el.hidden = true; }, 3000); };
  const showCode = () => { $('.st-code').innerHTML = state.project.view.map(sb).join(''); $('.st-name input').value = state.project.name; };
  const menu = (open) => { drop.hidden = !open; file.setAttribute('aria-expanded', String(open)); };
  const pick = (id) => {
    const k = CATS.find((c) => c.id === id);
    root.querySelectorAll('.st-cats [data-cat]').forEach((b) => b.classList.toggle('on', b.dataset.cat === id));
    $('.st-pal').innerHTML = `<h4>${k.name}</h4>${k.blocks.map((b) => (RUNS[b[2]] ? `<button type="button" class="st-run" data-run="${esc(b[2])}" title="Click to run it">${sb(b)}</button>` : sb(b))).join('')}`;
    opts.onCat?.(id);
  };
  root.addEventListener('click', (e) => {
    const t = e.target, cat = t.closest('.st-cats [data-cat]'), run = t.closest('[data-run]'), item = t.closest('[data-menu]');
    if (cat) pick(cat.dataset.cat);
    if (run) stage.go([RUNS[run.dataset.run]]);
    if (t.closest('.st-go')) stage.go(state.project.script);
    if (t.closest('.st-stop')) stage.stop();
    if (t.closest('.st-file')) { menu(drop.hidden); if (!drop.hidden) opts.onMenu?.('file'); return; }
    if (item) { menu(false); if (!opts.onMenu?.(item.dataset.menu)) toast(MENU_INFO[item.dataset.menu]); return; }
    if (!t.closest('.st-menu')) menu(false);
  });
  $('.st-name input').addEventListener('input', (e) => { state.project.name = e.target.value; state.wins.forEach((w) => { if (w.root !== root) w.root.querySelector('.st-name input').value = e.target.value; }); });
  pick('motion'); showCode();
  const w = { root, $, stage, toast, showCode, pick };
  state.wins.push(w);
  return w;
}

/** #/scratch/ch1. p: { done: Set, store, finish(id) } → img placeholders that want a 3D thumbnail (the cat): [{ el, model }] */
export function renderChapter1(el, p) {
  const goals = (list) => `<ul class="sc-goals">${list.map((t) => `<li>${t}</li>`).join('')}</ul>`;
  const steps = [
    `<div class="ch-outcomes"><b>In this chapter you will learn</b><ul>${OUTCOMES.map((o) => `<li>${o}</li>`).join('')}</ul></div>
      <h2>What is coding?</h2><p class="sc-lede">Coding is like giving instructions to a computer, just like following a recipe when you bake cookies. It's how we create websites, apps, games and even robots.</p>
      <ul class="ch-makes">${MAKES.map(([t, d]) => `<li>${icon(d)}${t}</li>`).join('')}</ul>
      <p class="sc-note">When you learn to code, you get better at solving puzzles and thinking creatively. There are many coding languages, and each one has its own special way of talking to computers.</p>
      <div class="ch-act"><h3>Try it: write the cookie program</h3><p>A recipe only works if the steps are in the right order. Tap the steps in order.</p>
        <div class="ch-recipe"><div class="ch-deck">${DEAL.map((i) => `<button type="button" data-card="${i}">${RECIPE[i]}</button>`).join('')}</div>
          <ol class="ch-prog">${RECIPE.map(() => '<li></li>').join('')}</ol></div>
        <p class="ch-fb" aria-live="polite"></p><button type="button" class="pill ghost ch-again" hidden>Mix them up again</button></div>`,
    `<h2>Blocks vs text</h2><p class="sc-lede">There are two main types of coding. Here is the same program both ways.</p>
      <div class="ch-fig"><div>${[HAT, ['control', 'c', 'repeat (10)', [['motion', 's', 'move (10) steps']]]].map(sb).join('')}</div><b>vs.</b><pre><span class="k">for</span> i <span class="k">in</span> range(<span class="n">10</span>):
    move(<span class="n">10</span>)</pre></div>
      <table class="ch-vs"><tr><th></th><th>Block-based coding</th><th>Text-based coding</th></tr>
        <tr><th>How</th><td>Drag and drop colourful blocks that snap together like LEGO</td><td>Type the instructions in a language like Python or JavaScript</td></tr>
        <tr><th>Mistakes</th><td>Blocks only fit where they work: nothing to misspell</td><td>You must spell everything correctly and follow special rules</td></tr>
        <tr><th>Best for</th><td>Beginners: easy, quick and fun</td><td>Professional coders building large apps and advanced programs</td></tr></table>
      <div class="ch-act"><h3>Try it: make the cat move both ways</h3>
        <div class="ch-try"><div class="ch-side"><h4>Blocks</h4><p>Click the block to run it.</p><button type="button" class="st-run ch-blk">${sb(['motion', 's', 'move (10) steps'])}</button></div>
          <div class="ch-side"><h4>Text (Python)</h4><p>There's a typo! Run it, fix it, run it again.</p>
            <div class="ch-code"><span>1</span><input class="ch-in" value="mvoe(10)" spellcheck="false" autocapitalize="off" aria-label="Python code"><button type="button" class="pill amber ch-run">Run</button></div>
            <pre class="ch-out" aria-live="polite"></pre></div>
          <div class="ch-mini"><div class="sc-stage"><div class="sc-sprite">${CAT}</div><div class="sc-say" hidden></div></div><p class="sc-pos"></p></div></div>
        ${goals(['Run the block', 'Fix the typo and run the text code'])}</div>
      <p class="sc-note">Let's start with block-based coding. Later, you can learn text-based coding.</p>`,
    `<h2>RoboCoders Studio</h2><p class="sc-lede">RoboCoders Studio is your all-in-one learning lab. Everything is in one place: no switching between websites, no confusion. Just learn, create and have fun!</p>
      <ul class="ch-three"><li><b>Code</b>Build games with blocks</li><li><b>Build AI</b>Teach computers to recognise things</li><li><b>Robotics</b>Program real robots</li></ul>
      <div class="ch-act"><h3>Try it: open the block editor</h3>
        <ol class="ch-check" data-check="home"><li class="got">Open RoboCoders Studio on your computer</li><li>On the home screen, click "Blocks"</li><li>The block coding editor opens</li><li>Give your project a name in the top bar</li></ol>
        ${studio('home')}</div>`,
    `<h2>The Studio interface</h2><p class="sc-lede">Let's find our way around. Each part of the Studio has its own job.</p>
      <div class="ch-act"><h3 class="ch-ask" aria-live="polite"></h3><p class="ch-hint" aria-live="polite">Click that part of the Studio below.</p>
        ${studio()}<ol class="ch-found">${AREAS.map(([a, n, d]) => `<li data-a="${a}"><b>${n}</b><span>${d}</span></li>`).join('')}</ol></div>`,
    `<h2>Exploring the block palette</h2><p class="sc-lede">The palette holds every block you can use to control your sprites. The blocks are colour-coded by what they do.</p>
      <div class="ch-act"><h3>Explore: click a colour, then click a block to run it</h3>${studio()}<div class="ch-about" aria-live="polite"></div></div>
      <div class="ch-act ch-match"><h3>Colour match: which category is this block from?</h3><p>Think about what the block does. Its colour appears when you get it right.</p>
        <div class="ch-mq"></div><div class="ch-mopts"></div><p class="ch-fb" aria-live="polite"></p></div>
      <p class="sc-note">Don't worry: you'll learn about each block in detail later.</p>`,
    `<h2>Naming, saving and opening projects</h2><p class="sc-lede">Save your work so it is never lost, then open it again any time. Follow the checklists.</p>
      <div class="ch-missions"><section data-m="save"><h3>Save your project</h3><ol class="ch-check">${SAVE_STEPS.map((s) => `<li>${s}</li>`).join('')}</ol></section>
        <section data-m="open"><h3>Open a project</h3><ol class="ch-check">${OPEN_STEPS.map((s) => `<li>${s}</li>`).join('')}</ol></section></div>
      <div class="ch-act">${studio()}</div>`,
  ];
  const quiz = [
    { q: 'Coding is like…', opts: ['giving a computer a recipe to follow', 'drawing a picture', 'reading a storybook'], a: 0, why: 'Code is a list of instructions, in the right order.' },
    { q: 'Which kind of coding uses blocks that snap together like LEGO?', opts: ['Text-based coding', 'Block-based coding'], a: 1, why: 'In text-based coding you type the instructions instead.' },
    { q: 'In RoboCoders Studio, where do your characters move and perform?', opts: ['The Tabs', 'The Block Palette', 'The Stage'], a: 2, why: 'The Stage is like a theatre where your creations come alive.' },
    { q: 'What colour are Events blocks, like “when green flag clicked”?', opts: ['Blue', 'Yellow', 'Green'], a: 1, why: 'Events blocks are yellow. They start your scripts.' },
    { q: 'You want to keep your project with a new name. What do you click?', opts: ['File, then Save As', 'Edit', 'The green flag'], a: 0, why: 'Save As asks for a name and a place to save it.' },
  ];
  const { $, $$ } = stepLesson(el, p, { id: CH1_ID, title: 'Introduction to Block-Based Coding', names: ['What is coding?', 'Blocks vs text', 'RoboCoders Studio', 'The interface', 'Block palette', 'Save and open'],
    steps, quiz, done: 'You know what coding is, how blocks and text differ, your way around RoboCoders Studio, and how to save and open projects.' });
  const [, s2, s3, s4, s5, s6] = $$('.sc-step');
  const state = { project: START(), wins: [] };
  const tick = (li) => li?.classList.add('got');

  // 1 · the cookie program: tap the cards in recipe order
  { const deck = $('.ch-deck'), prog = $$('.ch-prog li'), fb = $('.ch-fb'), again = $('.ch-again');
    let n = 0;
    deck.addEventListener('click', (e) => {
      const c = e.target.closest('[data-card]');
      if (!c) return;
      if (+c.dataset.card !== n) { c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); fb.textContent = n ? `Not yet! What comes after "${RECIPE[n - 1]}"?` : 'Not yet! What do you do first?'; return; }
      prog[n].textContent = RECIPE[n]; c.disabled = true; n++;
      fb.textContent = n < RECIPE.length ? 'Yes!' : 'You wrote a program! A computer follows code the same way: one instruction after another, in order.';
      again.hidden = n < RECIPE.length;
    });
    again.addEventListener('click', () => { n = 0; prog.forEach((li) => { li.textContent = ''; }); deck.querySelectorAll('button').forEach((b) => { b.disabled = false; }); fb.textContent = ''; again.hidden = true; }); }

  // 2 · the same move, as a block and as text code
  { const view = stageView(s2.querySelector('.sc-stage'), s2.querySelector('.sc-pos')), [g1, g2] = s2.querySelectorAll('.sc-goals li'), out = s2.querySelector('.ch-out'), inp = s2.querySelector('.ch-in');
    s2.querySelector('.ch-blk').addEventListener('click', () => { view.go([B('move', 10)]); tick(g1); });
    const runText = () => {
      const r = parseLine(inp.value);
      out.className = `ch-out ${r.err ? 'err' : 'ok'}`;
      out.textContent = r.err ? `>>> ${inp.value}\n${r.err}\n💡 ${r.hint}` : `>>> ${inp.value}\n✓ It worked!`;
      if (r.block) { view.go([r.block]); tick(g2); }
    };
    s2.querySelector('.ch-run').addEventListener('click', runText);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') runText(); }); }

  // 3 · the home screen: click Blocks, then name the project
  { const w = wireStudio(s3.querySelector('.st-win'), state), check = s3.querySelectorAll('.ch-check li');
    w.root.addEventListener('click', (e) => {
      const k = e.target.closest('[data-pick]')?.dataset.pick;
      if (!k) return;
      if (k !== 'blocks') return w.toast(`${k === 'ai' ? 'AI & ML' : 'Robotics'} opens a different lab. For block coding, click Blocks.`);
      w.root.dataset.view = 'editor'; tick(check[1]); tick(check[2]);
      const name = w.$('.st-name'); name.classList.add('st-nudge'); name.querySelector('input').select();
      w.toast('The block editor is open. Now type a name for your project in the top bar.');
    });
    w.$('.st-name input').addEventListener('input', (e) => { const v = e.target.value.trim(); if (v && v !== 'Untitled' && w.root.dataset.view === 'editor') { tick(check[3]); w.$('.st-name').classList.remove('st-nudge'); } }); }

  // 4 · "find it": the book's seven parts of the Studio, one at a time
  { const w = wireStudio(s4.querySelector('.st-win'), state), ask = s4.querySelector('.ch-ask'), hint = s4.querySelector('.ch-hint');
    let k = 0;
    const next = () => { ask.textContent = k < AREAS.length ? `Find the ${AREAS[k][1]} (${k + 1} of ${AREAS.length})` : 'You found all 7 parts of the Studio!'; };
    w.root.querySelectorAll('[data-area]').forEach((a) => { a.tabIndex = 0; });
    w.root.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-area]')) { e.preventDefault(); e.target.click(); } });
    w.root.addEventListener('click', (e) => {
      const a = e.target.closest('[data-area]');
      if (!a || k >= AREAS.length) return;
      if (a.dataset.area !== AREAS[k][0]) { hint.textContent = `That's the ${AREA_NAME[a.dataset.area]}. Look for the ${AREAS[k][1]}.`; return; }
      w.root.querySelectorAll(`[data-area="${a.dataset.area}"]`).forEach((x) => { x.classList.remove('st-hit'); void x.offsetWidth; x.classList.add('st-hit'); });
      tick(s4.querySelector(`.ch-found [data-a="${AREAS[k][0]}"]`));
      hint.textContent = `Yes! ${AREAS[k][1]}: ${AREAS[k][2]}`;
      k++; next();
    });
    next(); }

  // 5 · palette explorer + colour match
  { const about = s5.querySelector('.ch-about');
    wireStudio(s5.querySelector('.st-win'), state, { onCat: (id) => {
      const k = CATS.find((c) => c.id === id), [colour, job, ex] = ABOUT[id];
      about.innerHTML = `<h4><i style="${kv(id)}"></i>${k.name} blocks <small>${colour}</small></h4><p>${job}. <b>Example:</b> ${ex}.</p>`;
    } });
    const q = s5.querySelector('.ch-mq'), opts = s5.querySelector('.ch-mopts'), fb = s5.querySelector('.ch-match .ch-fb'), ids = MATCH.map(([, c]) => c);
    let r = 0, score = 0, miss = false;
    const round = () => {
      if (r >= MATCH.length) { q.innerHTML = ''; opts.innerHTML = '<button type="button" class="pill ghost" data-again>Play again</button>'; fb.textContent = `${score} of ${MATCH.length} first time! You know your block colours.`; return; }
      const [block, ans] = MATCH[r], choice = [ans, ids[(r + 3) % ids.length], ids[(r + 5) % ids.length]], turn = r % 3;
      q.innerHTML = `<span class="ch-n">${r + 1} / ${MATCH.length}</span><div class="sc-grey">${sb(block)}</div>`;
      opts.innerHTML = [...choice.slice(turn), ...choice.slice(0, turn)].map((id) => `<button type="button" data-m="${id}" style="${kv(id)}"><i></i>${CATS.find((c) => c.id === id).name}</button>`).join('');
      fb.textContent = ''; miss = false;
    };
    opts.addEventListener('click', (e) => {
      if (e.target.closest('[data-again]')) { r = score = 0; return round(); }
      const b = e.target.closest('[data-m]');
      if (!b || b.disabled) return;
      const ans = MATCH[r][1];
      if (b.dataset.m !== ans) { b.disabled = true; b.classList.add('wrong'); miss = true; fb.textContent = 'Not quite. Think about what the block does.'; return; }
      if (!miss) score++;
      q.querySelector('.sc-grey').classList.remove('sc-grey'); b.classList.add('right'); opts.querySelectorAll('button').forEach((x) => { x.disabled = true; });
      fb.textContent = `Yes! ${CATS.find((c) => c.id === ans).name} blocks are ${ABOUT[ans][0]}.`;
      r++; setTimeout(round, 1300);
    });
    round(); }

  // 6 · Save As, then Open, in pretend file dialogs
  { const fs = FILES(), [save, open] = s6.querySelectorAll('.ch-missions section'), sv = save.querySelectorAll('li'), op = open.querySelectorAll('li');
    let saved = null; // { folder, name } once the project has been saved
    const phase = () => { const s = [...sv].every((li) => li.classList.contains('got')); save.classList.toggle('now', !s); open.classList.toggle('now', s); return s ? op : sv; };
    const dialog = (mode) => {
      let folder = saved?.folder || 'Desktop', sel = null, fname = mode === 'save' ? state.project.name : '';
      const box = document.createElement('div');
      box.className = 'st-shade';
      const draw = () => {
        box.innerHTML = `<div class="st-dlg" role="dialog" aria-modal="true" aria-label="${mode === 'save' ? 'Save As' : 'Open'}">
          <header><b>${mode === 'save' ? 'Save As' : 'Open'}</b><button type="button" class="st-x" aria-label="Cancel">×</button></header>
          <p class="st-path">user › ${folder}</p>
          <div class="st-dbody"><nav class="st-places" aria-label="Folders">${Object.keys(fs).map((f) => `<button type="button" data-folder="${f}" class="${f === folder ? 'on' : ''}">${icon('M3 6h6l2 2h10v11H3z')}${f}</button>`).join('')}</nav>
            <div class="st-files"><div class="st-fh"><span>Name</span><span>Date modified</span><span>Type</span></div>
              ${fs[folder].map((f) => `<button type="button" data-file="${esc(f.name)}" class="${f.name === sel ? 'on' : ''}"><span>${esc(f.name)}</span><span>${f.date}</span><span>SB3 File</span></button>`).join('') || '<p class="st-empty">This folder is empty.</p>'}</div></div>
          <footer><label>File name <input class="st-fname" value="${esc(fname)}" spellcheck="false"></label><span class="st-type">Scratch 3 Project (*.sb3)</span>
            <p class="st-err" aria-live="polite"></p><button type="button" class="pill amber st-ok">${mode === 'save' ? 'Save' : 'Open'}</button><button type="button" class="pill ghost st-x">Cancel</button></footer></div>`;
        box.querySelector(mode === 'save' ? '.st-fname' : '.st-places .on').focus();
      };
      const close = () => box.remove();
      box.addEventListener('input', (e) => { fname = e.target.value; if (mode === 'save' && fname.trim() && fname.trim() !== 'Untitled') tick(sv[2]); });
      box.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
      box.addEventListener('click', (e) => {
        const t = e.target, f = t.closest('[data-folder]'), file = t.closest('[data-file]');
        if (t.closest('.st-x') || t === box) return close();
        if (f) { folder = f.dataset.folder; sel = null; tick(mode === 'save' ? sv[3] : op[2]); return draw(); }
        if (file) { sel = file.dataset.file; fname = mode === 'save' ? sel.replace(/\.sb3$/, '') : sel; if (mode === 'open') tick(op[3]); return draw(); }
        if (!t.closest('.st-ok')) return;
        const err = box.querySelector('.st-err');
        if (mode === 'save') {
          const name = fname.trim().replace(/\.sb3$/i, '');
          if (!name) { err.textContent = 'Type a name for your project first.'; return; }
          if (!sv[3].classList.contains('got')) { err.textContent = 'Now choose where to save it: click a folder on the left.'; return; } // the book's step, the first time
          const list = fs[folder], at = list.findIndex((x) => x.name === `${name}.sb3`), entry = { name: `${name}.sb3`, date: 'Today', p: structuredClone({ ...state.project, name }) };
          at < 0 ? list.push(entry) : (list[at] = entry);
          state.project.name = name; state.wins.forEach((x) => x.showCode());
          saved = { folder, name }; tick(sv[2]); tick(sv[4]); close();
          w.toast(`Saved "${name}.sb3" in ${folder}. Now try opening a project.`);
        } else {
          const entry = fs[folder].find((x) => x.name === sel);
          if (!entry) { err.textContent = 'Select a project file first.'; return; }
          state.project = structuredClone(entry.p); state.wins.forEach((x) => x.showCode());
          tick(op[4]); close();
          w.toast(`Opened "${entry.name}". Press the green flag to run it!`);
        }
        phase();
      });
      w.root.append(box); draw();
    };
    const w = wireStudio(s6.querySelector('.st-win'), state, { onMenu: (k) => {
      if (k === 'file') { tick(phase()[0]); return true; }
      if (k === 'save' && saved) { const entry = fs[saved.folder].find((x) => x.name === `${saved.name}.sb3`); if (entry) entry.p = structuredClone(state.project); w.toast(`Saved "${saved.name}.sb3" again.`); return true; }
      if (k === 'save' || k === 'saveas') { tick(sv[1]); dialog('save'); return true; }
      if (k === 'open') { tick(op[1]); dialog('open'); return true; }
      return false;
    } });
    phase(); }

  if (import.meta.env?.DEV) window.__ch1 = state; // dev-only: browser checks
  return [...el.querySelectorAll('[data-thumb]')].map((d) => ({ el: d, model: d.dataset.thumb }));
}
