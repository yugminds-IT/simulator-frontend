// Home: pick a kit. Kits are drawn as modules plugged into a board; progress (lessons, build checks) becomes XP, a level and badges.
import { scratchArt, scratchIds, scratchList } from './scratch.js';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const XP_LESSON = 100, XP_CHECK = 25, XP_LEVEL = 400;
/** progress → { xp, level, into (XP inside this level), next (XP to the next level) } */
export function levelOf(lessonsDone, checksDone) {
  const xp = lessonsDone * XP_LESSON + checksDone * XP_CHECK;
  return { xp, level: 1 + Math.floor(xp / XP_LEVEL), into: xp % XP_LEVEL, next: XP_LEVEL - (xp % XP_LEVEL) };
}

/** [name, how to unlock, unlocked?, svg path] */
export const badgesOf = (finished, total, checks) => [
  ['First light', 'Finish your first lesson', finished >= 1, 'M12 3v3M5 6l2 2M19 6l-2 2M8 14a4 4 0 1 1 8 0c0 2-2 3-2 5h-4c0-2-2-3-2-5z'],
  ['Wired up', 'Finish 5 lessons', finished >= 5, 'M4 12h4l2-5 4 10 2-5h4'],
  ['Builder', 'Tick 10 build checks', checks >= 10, 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z'],
  ['Code master', 'Finish every lesson', finished === total, 'M8 8l-4 4 4 4M16 8l4 4-4 4M13 5l-2 14'],
];

export const KITS = [
  { id: 'robo-coders', name: 'Robo Coders kit', blurb: 'An ESP32 robot car with 17 plug-in modules: LEDs, sensors, a screen and four motors.', ready: true, thumb: 'base' },
  { id: 'jr', name: 'Jr. Explorer kit', blurb: 'No code needed. Plug in a button and a light, press, and watch it work. Two inputs steer a motor.', ready: true, thumb: 'jr_board', jr: true },
];

/**
 * el: the #home element. p: { lessons, done (Set of lesson ids), checks (number of build checks ticked), buildSteps, parts, last (lesson) }
 * Returns the img placeholders that want a 3D thumbnail: [{ el, model }].
 */
export function renderHome(el, p) {
  const total = p.lessons.length, finished = p.lessons.filter((l) => p.done.has(l.id)).length;
  const lv = levelOf(finished + (p.scratchDone || 0), p.checks);
  const badges = badgesOf(finished, total, p.checks);
  const pct = (n, of) => `${Math.min(100, (n / Math.max(1, of)) * 100)}%`;
  const kit = (k) => {
    if (!k.ready) return `<article class="kc locked" aria-label="${esc(k.name)}, coming soon">
      <div class="kc-art"><svg class="kc-lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></div>
      <div class="kc-body"><span class="ktag">Coming soon</span><h3>${esc(k.name)}</h3><p>${esc(k.blurb)}</p></div></article>`;
    if (k.jr) return `<article class="kc" aria-label="${esc(k.name)}">
      <div class="kc-art"><svg class="kc-trace" viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden="true"><path d="M0 60 H50 V100"/><path d="M300 150 H250 V110"/></svg>
        <div class="kc-shot" data-thumb="${k.thumb}"></div><span class="kc-live"><i></i>New</span></div>
      <div class="kc-body">
        <div class="ktags"><span class="ktag">No coding</span><span class="ktag">4 inputs, 4 outputs</span><span class="ktag">2 motors</span></div>
        <h3>${esc(k.name)}</h3><p>${esc(k.blurb)}</p>
        <div class="acts"><a class="pill amber" href="#/jr/lesson/${esc(p.jrLast || 'jr-meet')}">Start the projects</a><a class="pill ghost" href="#/jr/part/jr_board">Explore parts</a></div></div></article>`;
    return `<article class="kc" aria-label="${esc(k.name)}">
      <div class="kc-art"><svg class="kc-trace" viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden="true"><path d="M0 150 H60 V110"/><path d="M300 60 H240 V95"/></svg>
        <div class="kc-shot" data-thumb="${k.thumb}"></div><span class="kc-live"><i></i>Ready to play</span></div>
      <div class="kc-body">
        <div class="ktags"><span class="ktag">3 books</span><span class="ktag">${p.parts} parts</span><span class="ktag">Blocks and C++</span></div>
        <h3>${esc(k.name)}</h3><p>${esc(k.blurb)}</p>
        <dl class="meters">
          <div><dt>Projects done</dt><dd>${finished} of ${total}</dd><span class="m"><i style="width:${pct(finished, total)}"></i></span></div>
          <div><dt>Build checks</dt><dd>${p.checks} of ${p.buildChecks}</dd><span class="m"><i style="width:${pct(p.checks, p.buildChecks)}"></i></span></div>
        </dl>
        <div class="acts">
          <a class="pill amber" href="#/levels">Choose your book</a>
        </div></div></article>`;
  };
  el.innerHTML = `
    <div class="hwash">
      <header class="hhead hwrap">
        <a class="hmark" href="#/" aria-label="Robo Coders home"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 20a22 22 0 0 1 32 0M14 26a13 13 0 0 1 20 0M20 32a5 5 0 0 1 8 0"/><circle cx="24" cy="38" r="3"/></svg><span>Robo Coders</span></a>
        <div class="hud" aria-label="Your level">
          <div class="lvl"><b>${lv.level}</b><small>level</small></div>
          <div class="xp"><p><b>${lv.xp.toLocaleString('en-US')} XP</b></p><span class="xpbar"><i style="width:${(lv.into / XP_LEVEL) * 100}%"></i></span><small>${lv.next} XP to level ${lv.level + 1}</small></div>
        </div>
      </header>
      <section class="hhero hwrap">
        <h1>Choose your kit</h1>
        <p class="lede">Pick a kit, wire it up and make it move. Every lesson you finish earns ${XP_LESSON} XP and every build check ${XP_CHECK} XP.</p>
        <div class="acts"><a class="pill amber big" href="#/levels">Choose your Tech Explorers book</a></div>
      </section>
      <section class="hkits hwrap" aria-label="Kits">${KITS.map(kit).join('')}</section>
      <section class="hcode hwrap" aria-labelledby="code-h">
        <h2 id="code-h">Learn to code</h2>
        <p>No kit needed. Everything runs right here in your browser.</p>
        <article class="kc sc-card" aria-label="Scratch Coding">
          <div class="kc-art sc-art-wrap">${scratchArt()}<span class="kc-live"><i></i>New</span></div>
          <div class="kc-body">
            <div class="ktags"><span class="ktag">No kit needed</span><span class="ktag">Drag and drop blocks</span><span class="ktag">${scratchIds.length} lessons</span></div>
            <h3>Scratch Coding</h3><p>Snap colourful blocks together and make a 3D cat talk and spin. Start with the Scratch screen and every kind of block.</p>
            <div class="acts">${(() => { const all = scratchList(), next = all.find((x) => !p.done.has(x.id)) || all[0];
              return `<a class="pill amber" href="${next.href}">${p.done.has(next.id) ? 'Review' : p.scratchDone ? 'Next' : 'Start'}: ${esc(next.title)}</a>`; })()}<a class="pill ghost" href="#/scratch">All lessons</a></div></div></article>
      </section>
    </div>
    <section class="hbadges" aria-labelledby="badges-h">
      <div class="hwrap">
        <h2 id="badges-h">Your badges</h2>
        <p>Finish lessons and build steps to unlock them.</p>
        <ul class="badges">${badges.map(([n, how, got, d]) => `<li class="${got ? 'got' : ''}"><span class="pad"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg></span><b>${esc(n)}</b><small>${got ? 'Unlocked' : esc(how)}</small></li>`).join('')}</ul>
      </div>
    </section>`;
  return [...el.querySelectorAll('[data-thumb]')].map((d) => ({ el: d, model: d.dataset.thumb }));
}
