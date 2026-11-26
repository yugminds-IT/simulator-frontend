// Yugminds sign-in and assigned books. The backend (simulator/backend, /api) checks the Yugminds account;
// students open only the books a teacher or school admin assigned, staff open everything.
// ponytail: UI-level gate — lesson data ships in the bundle; serve it per book from /api if it must be secret.
import { sfx, muted, setMuted } from './sfx.js';
import { SCENE, attract } from './title.js';
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const STAFF = ['teacher', 'school_admin', 'admin'];
const ROLE = { teacher: 'Teacher', school_admin: 'School admin', admin: 'Admin', student: 'Student' };

let me = null; // { user, books: Set, catalog: [{ id, title, blurb }] }

export async function api(path, opts = {}) {
  const r = await fetch(`/api${path}`, { ...opts, headers: { 'content-type': 'application/json', ...opts.headers } });
  const body = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) throw Object.assign(new Error(body?.message ? [].concat(body.message).join(', ') : `Request failed (${r.status})`), { status: r.status });
  return body;
}
const keep = (m) => { me = { ...m, books: new Set(m.books) }; return me; };

/** Which book a route belongs to: l1–l3, jr, scratch, or null (home, shelf, assign). */
export function bookOfHash(h) {
  const m = h.match(/^#\/(?:l([123])\/|level\/([123])$)/);
  if (m) return `l${m[1] || m[2]}`;
  if (/^#\/jr(\/|$)/.test(h)) return 'jr';
  if (/^#\/scratch(\/|$)/.test(h)) return 'scratch';
  return null;
}
export const canOpen = (book) => !book || !!me?.books.has(book);
export const isStaff = () => STAFF.includes(me?.user.role);
export const session = () => me;
/** Where a staff member's dashboard lives. */
export const dashHref = () => (me?.user.role === 'admin' ? '#/admin' : '#/teach');

/** Resolves with the session once the visitor is signed in (shows the login screen if needed). */
export async function signIn() {
  try { return keep(await api('/auth/me')); } catch (e) { if (e.status !== 401) console.error(e); }
  return new Promise((done) => {
    // Console title screen → sign-in, one frame, with the simulator playing its own demo behind (title.js).
    const box = document.createElement('div');
    box.className = 'lg'; box.dataset.step = 'title';
    box.innerHTML = `${SCENE}
      <header class="lg-top"><span class="hmark"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 20a22 22 0 0 1 32 0M14 26a13 13 0 0 1 20 0M20 32a5 5 0 0 1 8 0"/><circle cx="24" cy="38" r="3"/></svg><span>Robo Coders</span></span>
        <button type="button" class="lx-mute" aria-pressed="${muted()}" aria-label="Mute sounds"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="on" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/><path class="off" d="M16 9l5 6M21 9l-5 6"/></svg></button></header>
      <main class="lg-main">
        <section class="lg-title">
          <h1>Build robots.<br>Break nothing.</h1>
          <p>A 3D robot lab in your browser. Snap the kit together part by part, wire every pin, code it with blocks or C++, then test-drive your car in the arena. Every lesson you finish earns XP.</p>
          <button type="button" class="lg-go lg-start"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>Press start</button>
        </section>
        <form class="lg-form" novalidate hidden>
          <h1>Sign in to play</h1><p>Use your YugMinds email and password.</p>
          <label>Email<input name="email" type="email" autocomplete="username" required></label>
          <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
          <p class="lg-err" role="alert" hidden></p>
          <div class="lg-acts"><button class="lg-go" type="submit">Sign in</button><button class="lg-back" type="button">Back</button></div>
        </form>
      </main>
      <footer class="lg-foot"><p class="lg-keys" data-for="title"><kbd>Enter</kbd> start</p><p class="lg-keys" data-for="form"><kbd>Tab</kbd> next <kbd>Enter</kbd> sign in <kbd>Esc</kbd> back</p></footer>`;
    document.body.append(box);
    const demo = attract(box);
    const f = box.querySelector('form'), err = box.querySelector('.lg-err'), btn = f.querySelector('.lg-go'), title = box.querySelector('.lg-title'), mute = box.querySelector('.lx-mute');
    let quiet = false; // programmatic focus makes no tick
    const step = (s) => {
      box.dataset.step = s; title.hidden = s !== 'title'; f.hidden = s !== 'form';
      quiet = true; (s === 'form' ? f.email : title.querySelector('.lg-start')).focus(); quiet = false;
    };
    const start = () => { sfx.start(); sfx.rev(); demo.boost(); step('form'); };
    const back = () => { sfx.back(); err.hidden = true; step('title'); };
    title.querySelector('.lg-start').addEventListener('click', start);
    f.querySelector('.lg-back').addEventListener('click', back);
    mute.addEventListener('click', () => { const m = !muted(); setMuted(m); mute.setAttribute('aria-pressed', String(m)); if (!m) sfx.move(); });
    const onKey = (e) => {
      if (box.dataset.step === 'title' && e.key === 'Enter' && !e.target.closest?.('button')) { e.preventDefault(); start(); }
      else if (box.dataset.step === 'form' && e.key === 'Escape' && !btn.disabled) back();
    };
    addEventListener('keydown', onKey);
    f.addEventListener('input', () => sfx.key());
    f.addEventListener('focusin', (e) => { if (!quiet && e.target.matches('input')) sfx.move(); });
    const fail = (msg) => { err.textContent = msg; err.hidden = false; sfx.locked(); demo.brake(); f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); };
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (btn.disabled) return;
      if (!f.email.value.trim() || !f.password.value) return fail('Enter your email and password.');
      btn.disabled = true; btn.textContent = 'Signing in…'; err.hidden = true; box.setAttribute('aria-busy', 'true'); sfx.ping();
      try {
        const m = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: f.email.value, password: f.password.value }) });
        removeEventListener('keydown', onKey);
        box.removeAttribute('aria-busy'); box.classList.add('ok'); btn.textContent = 'Signed in'; sfx.ok(); sfx.rev(); demo.boost();
        setTimeout(() => { box.classList.add('out'); setTimeout(() => box.remove(), 450); }, 700); // let the car take off, then fade into the launcher
        done(keep(m));
      } catch (x) {
        box.removeAttribute('aria-busy'); btn.disabled = false; btn.textContent = 'Sign in';
        fail(x.status === 400 ? 'Enter a valid email address.' : x.status === 429 ? 'Too many tries. Wait a minute and try again.' : x.message);
      }
    });
  });
}

async function signOut() { await api('/auth/logout', { method: 'POST' }).catch(() => {}); location.hash = '#/'; location.reload(); }

/**
 * After a home/shelf/book page renders: put the user chip in its header and lock links to books
 * this student was not given (the card stays visible, marked "Not assigned").
 */
export function decorate(el) {
  const head = el.querySelector('.hhead');
  if (head && me && !head.querySelector('.uchip')) {
    const chip = document.createElement('div');
    chip.className = 'uchip';
    chip.innerHTML = `<span><b>${esc(me.user.name)}</b><small>${ROLE[me.user.role] || ''}</small></span>
      ${isStaff() && !location.hash.startsWith(dashHref()) ? `<a class="pill ghost" href="${dashHref()}">Dashboard</a>` : ''}${isStaff() && location.hash.startsWith(dashHref()) ? '<a class="pill ghost" href="#/">Kits</a>' : ''}<button class="pill ghost" type="button">Sign out</button>`;
    chip.querySelector('button').addEventListener('click', signOut);
    head.append(chip);
  }
  el.querySelectorAll('a[href^="#/"]').forEach((a) => {
    if (canOpen(bookOfHash(a.getAttribute('href')))) return;
    a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); a.tabIndex = -1;
    a.closest('.kc, .shelf-item, .proj, .sc-card')?.setAttribute('data-na', 'Not assigned');
  });
}

/** One-time message on the next page (a locked book was opened directly). */
export function notice(el, text) {
  const n = document.createElement('p');
  n.className = 'na-note hwrap'; n.setAttribute('role', 'status'); n.textContent = text;
  el.querySelector('.hhead')?.after(n);
}
