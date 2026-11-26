// Console-style entry: a row of tiles, the selected one grows, and its 3D render fills the screen behind a big title.
// ← → choose, Enter plays, Esc goes back. Used for kits (#/) and for Tech Explorers books (#/levels).
import { KITS, levelOf, badgesOf } from './home.js';
import { LEVELS, levelLessons } from './levels.js';
import { scratchArt, scratchList, scratchIds } from './scratch.js';
import { canOpen, isStaff, session, dashHref, esc } from './access.js';
import { sfx, muted, setMuted } from './sfx.js';

const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const MARK = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 20a22 22 0 0 1 32 0M14 26a13 13 0 0 1 20 0M20 32a5 5 0 0 1 8 0"/><circle cx="24" cy="38" r="3"/></svg>';
const GRID = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>';
const COVER = { 1: '#1f78dc', 2: '#3a2c72', 3: '#5e2449' };
const BOOK_THUMB = { 1: 'led', 2: 'traffic', 3: 'chassis' };
const store = { get: (k) => { try { return sessionStorage.getItem(`lx:${k}`); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(`lx:${k}`, v); } catch { /* private mode */ } } };

/** Why a tile is locked, in the player's words. */
const lockText = (book) => (canOpen(book) ? null : book === 'scratch' ? 'Only admins can open Scratch for now.' : session()?.user.role === 'student' ? 'Not given to you yet. Ask your teacher for it.' : 'Not available for your account.');

/** p: { lessons, done, checks, buildChecks, jrLast, parts, scratchDone } (same as renderHome) */
export function kitItems(p) {
  const finished = p.lessons.filter((l) => p.done.has(l.id)).length;
  const robo = KITS.find((k) => k.id === 'robo-coders'), jr = KITS.find((k) => k.jr);
  const anyBook = ['l1', 'l2', 'l3'].some(canOpen), sc = scratchList(), next = sc.find((x) => !p.done.has(x.id)) || sc[0];
  return [
    { id: 'robo', name: 'Robo Coders', title: robo.name, blurb: robo.blurb, accent: '#2563eb', thumb: 'base+', // fully assembled board
      tags: ['3 books', `${p.parts} parts`, 'Blocks and C++'], play: { label: 'Choose a book', href: '#/levels' },
      meters: [['Projects done', finished, p.lessons.length], ['Build checks', p.checks, p.buildChecks]],
      locked: anyBook ? null : lockText('l1') },
    { id: 'jr', name: 'Jr. Explorer', title: jr.name, blurb: jr.blurb, accent: '#1b9a47', thumb: jr.thumb,
      tags: ['No coding', '4 inputs, 4 outputs', '2 motors'], play: { label: 'Play', href: `#/jr/lesson/${p.jrLast || 'jr-meet'}` },
      alt: { label: 'Explore parts', href: '#/jr/part/jr_board' }, locked: lockText('jr') },
    { id: 'scratch', name: 'Scratch', title: 'Scratch Coding', blurb: 'Snap colourful blocks together and make a 3D cat talk and spin. No kit needed: it all runs in your browser.',
      accent: '#e8780f', art: scratchArt(), tags: ['No kit needed', `${scratchIds.length} lessons`],
      play: { label: `${p.scratchDone ? 'Next' : 'Start'}: ${next.title}`, href: next.href }, alt: { label: 'All lessons', href: '#/scratch' },
      meters: [['Lessons done', p.scratchDone, scratchIds.length]], locked: lockText('scratch') },
    ...(isStaff() ? [{ id: 'dash', name: 'Dashboard', title: 'Dashboard', system: true, accent: '#5b6a88', icon: GRID,
      blurb: session().user.role === 'admin' ? 'Schools, classes and teachers. Give books and open student sign-in.' : 'Your classes. Give books to a whole section or one student at a time.',
      play: { label: 'Open dashboard', href: dashHref() } }] : []),
  ];
}

/** p: { done, name(partId) } → one tile per Tech Explorers book */
export function bookItems(p) {
  return LEVELS.map((l) => {
    const ready = l.projects.filter((x) => x.lesson), got = ready.filter((x) => p.done.has(x.lesson)).length;
    return { id: `l${l.n}`, name: `Level ${l.n}`, title: `Level ${l.n}: ${l.theme}`, blurb: l.blurb, accent: COVER[l.n], thumb: BOOK_THUMB[l.n],
      cover: l.n, tags: [`${l.projects.length} projects`, `New parts: ${l.parts.map((x) => p.name(x)).join(', ')}`],
      play: { label: 'Open book', href: `#/level/${l.n}` }, alt: { label: 'Explore the parts', href: `#/l${l.n}/part/${l.parts[0]}` },
      meters: [['Projects done', got, l.projects.length]], locked: lockText(`l${l.n}`) };
  });
}

/**
 * el: #home. o: { key, heading, items, initial?, back?: href, backLabel?, hud?: { lessons, done, checks }, book?: html, foot?: html }.
 * Returns the thumbnails to render: small ones for tiles, big ones for the backdrop.
 */
export function renderLauncher(el, o) {
  const { items } = o;
  const saved = items.findIndex((x) => x.id === store.get(o.key));
  let at = saved >= 0 ? saved : Math.max(0, o.initial ?? 0);
  if (items[at]?.locked) at = Math.max(0, items.findIndex((x) => !x.locked));
  const hud = o.hud && (() => {
    const total = o.hud.lessons.length, finished = o.hud.lessons.filter((l) => o.hud.done.has(l.id)).length, lv = levelOf(finished + (o.hud.scratchDone || 0), o.hud.checks);
    const badges = badgesOf(finished, total, o.hud.checks);
    return { lv, badges };
  })();
  el.innerHTML = `<div class="lx" style="--ac:${items[at].accent}">
    <div class="lx-bg" aria-hidden="true">${items.map((x, i) => `<div class="lx-art${i === at ? ' on' : ''}${x.locked ? ' locked' : ''}" data-i="${i}" style="--ac:${x.accent}">${x.art ? `<div class="lx-art-html">${x.art}</div>` : x.thumb ? `<span data-big="${x.thumb}" data-fit="${x.thumb === 'base+' || /board/.test(x.thumb) ? 1 : 1.4}"></span>` : ''}</div>`).join('')}</div>
    <header class="hhead lx-top"><a class="hmark" href="#/" aria-label="Robo Coders home">${MARK}<span>Robo Coders</span></a>
      ${o.back ? `<a class="lx-back" href="${o.back}">${esc(o.backLabel || 'Back')}</a>` : ''}
      ${hud ? `<div class="lx-lvl" aria-label="Level ${hud.lv.level}, ${hud.lv.xp} XP"><b>${hud.lv.level}</b><span><i style="width:${(hud.lv.into / (hud.lv.into + hud.lv.next)) * 100}%"></i></span><small>${hud.lv.xp.toLocaleString('en-IN')} XP</small></div>` : ''}</header>
    <main class="lx-main">
      ${o.book ? o.book : `<h1 class="lx-h">${esc(o.heading)}</h1>`}
      <div class="lx-row" role="listbox" aria-label="${esc(o.heading)}" aria-orientation="horizontal">${items.map((x, i) => `${x.system && !items[i - 1]?.system ? '<span class="lx-sep" aria-hidden="true"></span>' : ''}
        <button class="lx-tile${x.locked ? ' locked' : ''}${x.system ? ' sys' : ''}" role="option" data-i="${i}" aria-selected="${i === at}" tabindex="${i === at ? 0 : -1}" style="--ac:${x.accent}">
          ${x.cover ? `<span class="lx-cover"><b>Tech Explorers</b><i>Level ${x.cover}</i></span>` : x.icon ? `<span class="lx-icon">${x.icon}</span>` : x.art ? `<span class="lx-mini">${x.art}</span>` : `<span class="lx-shot" data-thumb="${x.thumb}"></span>`}
          ${x.seq ? `<span class="lx-seq">${x.seq}</span>` : ''}${x.done ? '<span class="lx-done" title="Done"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>' : ''}
          ${x.locked ? `<span class="lx-lock">${LOCK}</span>` : ''}<span class="lx-name">${esc(x.name)}</span></button>`).join('')}</div>
      <section class="lx-info" aria-live="polite"></section>
    </main>
    <footer class="lx-foot">
      ${o.foot ? o.foot : hud ? `<ul class="lx-trophies" aria-label="Trophies">${hud.badges.map(([n, how, got, d]) => `<li class="${got ? 'got' : ''}" title="${esc(n)}: ${got ? 'unlocked' : esc(how)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg><span class="sr">${esc(n)}, ${got ? 'unlocked' : 'locked'}</span></li>`).join('')}<li class="lx-tcount">${hud.badges.filter((b) => b[2]).length} of ${hud.badges.length} trophies</li></ul>` : '<span></span>'}
      <div class="lx-sys"><button type="button" class="lx-mute" aria-pressed="${muted()}" aria-label="Mute sounds"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="on" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/><path class="off" d="M16 9l5 6M21 9l-5 6"/></svg></button>
      <p class="lx-keys" aria-hidden="true"><kbd>←</kbd><kbd>→</kbd> choose <kbd>Enter</kbd> play${o.back ? ' <kbd>Esc</kbd> back' : ''}</p></div></footer></div>`;
  const root = el.querySelector('.lx'), tiles = [...root.querySelectorAll('.lx-tile')], info = root.querySelector('.lx-info');
  const show = (i, focus) => {
    if (focus !== undefined && i !== at) sfx.move(); // user moved: tick
    at = i; const x = items[i];
    store.set(o.key, x.id);
    root.style.setProperty('--ac', x.accent);
    tiles.forEach((t, j) => { t.setAttribute('aria-selected', String(j === i)); t.tabIndex = j === i ? 0 : -1; });
    root.querySelectorAll('.lx-art').forEach((a) => a.classList.toggle('on', +a.dataset.i === i));
    info.innerHTML = `<h2 class="lx-title">${esc(x.title)}</h2>
      ${x.tags ? `<ul class="lx-tags">${x.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      <p class="lx-blurb">${esc(x.blurb)}</p>
      ${x.locked ? `<p class="lx-locked">${LOCK}<span>${esc(x.locked)}</span></p>`
        : `<div class="lx-acts"><a class="lx-play" href="${x.play.href}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>${esc(x.play.label)}</a>${x.alt ? `<a class="lx-alt" href="${x.alt.href}">${esc(x.alt.label)}</a>` : ''}</div>`}
      ${x.meters && !x.locked ? `<dl class="lx-meters">${x.meters.map(([k, n, of]) => `<div><dt>${esc(k)}</dt><dd>${n} of ${of}</dd><span><i style="width:${of ? (n / of) * 100 : 0}%"></i></span></div>`).join('')}</dl>` : ''}`;
    if (focus) tiles[i].focus();
  };
  show(at);
  const go = (href, sound = sfx.play) => { sound(); location.hash = href; };
  const press = () => (items[at].locked ? sfx.locked() : go(items[at].play.href)); // the selected tile pressed again, or Enter
  tiles.forEach((t, i) => t.addEventListener('click', () => (i === at ? press() : show(i, false))));
  info.addEventListener('click', (e) => { if (e.target.closest('.lx-play, .lx-alt')) sfx.play(); });
  root.querySelector('.lx-back')?.addEventListener('click', () => sfx.back());
  const mute = root.querySelector('.lx-mute');
  mute.addEventListener('click', () => { const m = !muted(); setMuted(m); mute.setAttribute('aria-pressed', String(m)); if (!m) sfx.move(); });
  const onKey = (e) => {
    if (!document.body.contains(root)) return removeEventListener('keydown', onKey); // left the launcher
    if (e.target.closest?.('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); show((at + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length, true); }
    else if (e.key === 'Enter' && (e.target === document.body || e.target.classList?.contains('lx-tile'))) { e.preventDefault(); press(); }
    else if (e.key === 'Escape' && o.back) go(o.back, sfx.back);
  };
  addEventListener('keydown', onKey);
  return [...root.querySelectorAll('[data-thumb]')].map((d) => ({ el: d, model: d.dataset.thumb }))
    .concat([...root.querySelectorAll('[data-big]')].map((d) => ({ el: d, model: d.dataset.big, size: [1400, 900, +d.dataset.fit] })));
}

/** #/level/N as a level select: the projects are the tiles, in book order. p: { done, name(partId) } */
export function renderBookHub(el, n, p) {
  const l = LEVELS.find((x) => x.n === n), lessons = levelLessons(n), ac = COVER[n];
  const [seenN, partsN] = p.parts(n), explored = seenN >= partsN; // components first: open every part, then the projects
  const kit = { id: 'kit', name: 'Explore your kit', title: 'Explore your kit', accent: ac, thumb: 'base+', done: explored,
    blurb: 'Start here: open every part in your kit in 3D to see what it does and where it plugs in. Then the projects begin.', tags: ['Start here', `${seenN} of ${partsN} parts explored`],
    play: { label: explored ? 'Explore again' : seenN ? 'Keep exploring' : 'Start', href: `#/l${n}/part/${p.firstNew(n)}` }, alt: { label: 'Open the kit box', href: `#/l${n}/lesson/kit` } };
  const items = [kit, ...l.projects.map((x, i) => {
    const href = x.build ? `#/l${n}/build/parts` : x.lesson ? `#/l${n}/lesson/${x.lesson}` : null, got = !!x.lesson && p.done.has(x.lesson);
    return { id: x.lesson || `p${i}`, seq: i + 1, name: x.title, title: x.title, accent: ac, thumb: x.uses[0], done: got,
      blurb: lessons.find((k) => k.id === x.lesson)?.lede || (x.build ? 'Put the chassis, motors and wheels together, one step at a time.' : 'This project is coming soon.'),
      tags: [`Project ${i + 1} of ${l.projects.length}`, ...x.uses.map((u) => p.name(u))],
      play: href ? { label: got ? 'Play again' : x.build ? 'Build it' : 'Start', href } : null,
      locked: href ? null : 'Coming soon. This project is still being written.' };
  })];
  const doneN = items.slice(1).filter((x) => x.done).length;
  const book = `<div class="lx-book"><span class="lx-cover lx-cover-sm" style="--ac:${ac}" aria-hidden="true"><b>Tech Explorers</b><i>Level ${n}</i></span>
    <div><h1 class="lx-bh">Level ${n}: ${esc(l.theme)}</h1><p class="lx-bp"><span class="lx-bm"><i style="width:${(doneN / l.projects.length) * 100}%"></i></span>${doneN} of ${l.projects.length} projects done</p></div></div>`;
  const foot = `<div class="lx-parts"><h2>New parts in this book</h2><ul>${l.parts.map((id) => `<li><a href="#/l${n}/part/${id}"><span class="lx-pshot" data-thumb="${id}"></span><span>${esc(p.name(id))}</span></a></li>`).join('')}</ul></div>`;
  const next = items.findIndex((x) => !x.done && !x.locked);
  return renderLauncher(el, { key: `book${n}`, heading: `Level ${n}: ${l.theme}`, items, initial: next < 0 ? 0 : next, back: '#/levels', backLabel: 'All books', book, foot });
}
