// Staff dashboards. #/admin…: YugMinds admins (every school). #/teach: teachers (own sections) and school admins (whole school).
// The signature piece is the shelf: one spine per book, filled by the share of students who hold it. Click a spine to give
// (or take back) that book for the whole section.
import { api, esc, session } from './access.js';
import { levelLessons, levelParts } from './levels.js';
import { JR_LESSONS } from './kit.js';
import { scratchIds } from './scratch.js';

const COLOR = { l1: '#1f78dc', l2: '#3a2c72', l3: '#5e2449', jr: '#1b9a47', scratch: '#e8780f' }; // printed covers; Jr. green, Scratch orange
const SHORT = { l1: 'Level 1', l2: 'Level 2', l3: 'Level 3', jr: 'Jr. Explorer', scratch: 'Scratch' };
const PREVIEW = { l1: '#/level/1', l2: '#/level/2', l3: '#/level/3', jr: '#/jr/lesson/jr-meet', scratch: '#/scratch' };
const MARK = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 20a22 22 0 0 1 32 0M14 26a13 13 0 0 1 20 0M20 32a5 5 0 0 1 8 0"/><circle cx="24" cy="38" r="3"/></svg>';
const head = (back = '') => `<header class="hhead hwrap"><a class="hmark" href="#/" aria-label="Robo Coders home">${MARK}<span>Robo Coders</span></a>${back}</header>`;
const plural = (n, w) => `${n.toLocaleString('en-IN')} ${w}${n === 1 ? '' : 's'}`;
const ago = (t) => {
  const s = (new Date(t) - Date.now()) / 1000, f = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [u, n] of [['day', 86400], ['hour', 3600], ['minute', 60]]) if (Math.abs(s) >= n) return f.format(Math.round(s / n), u);
  return 'just now';
};
const books = () => session().catalog;

/** One spine. have/total → fill height. attrs makes it a button (section shelves) or a plain figure (overview). */
function spine(b, have, total, attrs = '') {
  const pct = total ? Math.round((have / total) * 100) : 0, tag = attrs ? 'button' : 'div';
  return `<${tag} class="spine${have === total && total ? ' full' : ''}" style="--c:${COLOR[b.id]};--f:${pct}%" ${attrs}>
    <span class="spine-fill" aria-hidden="true"></span><span class="spine-name">${esc(SHORT[b.id])}</span>
    <span class="spine-n"><b>${have.toLocaleString('en-IN')}</b>/${total.toLocaleString('en-IN')}</span></${tag}>`;
}

// --- classes: section shelves + per-student table (teacher page and admin school page) ---------------------------
const sectionName = (s) => `Grade ${s.grade ?? '?'}, ${/^section/i.test(s.section ?? '') ? s.section : `Section ${s.section ?? '?'}`}`;

/** el gets the section cards for these students; changes are saved through PUT /assignments. */
function classes(el, students, { schools = false } = {}) {
  if (!students.length) {
    el.innerHTML = `<p class="dash-empty">No students yet. Students show up here once they are placed in a grade and section in YugMinds.</p>`;
    return;
  }
  const groups = [...Map.groupBy(students, (s) => `${s.school}|${sectionName(s)}`)].map(([k, ss]) => ({ k, school: ss[0].school, name: sectionName(ss[0]), ss }));
  const bySchool = Map.groupBy(groups, (g) => g.school);
  const card = (g, i) => `<article class="cls" data-i="${i}">
      <header><h3>${esc(g.name)}</h3><small>${plural(g.ss.length, 'student')}</small></header>
      <div class="shelf" role="group" aria-label="Books for ${esc(g.name)}">${shelfOf(g)}</div>
      <details class="cls-list"><summary>Students in ${esc(g.name)}</summary><div class="tbl-wrap"><table class="tick">
        <thead><tr><th scope="col">Student</th>${books().map((b) => `<th scope="col"><i style="--c:${COLOR[b.id]}"></i>${esc(SHORT[b.id])}</th>`).join('')}</tr></thead>
        <tbody>${g.ss.map((s) => `<tr data-q="${esc(`${s.name} ${s.email}`.toLowerCase())}"><th scope="row"><b>${esc(s.name)}</b><small>${esc(s.email)}</small></th>${books().map((b) => `<td><input type="checkbox" data-s="${s.id}" data-b="${b.id}"${s.books.includes(b.id) ? ' checked' : ''} aria-label="${esc(SHORT[b.id])} for ${esc(s.name)}"></td>`).join('')}</tr>`).join('')}</tbody></table></div></details></article>`;
  const shelfOf = (g) => books().map((b) => {
    const have = g.ss.filter((s) => s.books.includes(b.id)).length, all = have === g.ss.length;
    return spine(b, have, g.ss.length, `type="button" data-g="${groups.indexOf(g)}" data-b="${b.id}" aria-label="${esc(SHORT[b.id])}: ${have} of ${g.ss.length} students. ${all ? 'Take it back from' : 'Give it to'} the whole section"`);
  }).join('');
  el.innerHTML = `<div class="dash-bar"><input type="search" placeholder="Find a student by name or email" aria-label="Find a student"><span class="dash-st" role="status"></span></div>
    ${[...bySchool].map(([school, gs]) => `${schools || bySchool.size > 1 ? `<h2 class="cls-school">${esc(school)}</h2>` : ''}<div class="cls-grid">${gs.map((g) => card(g, groups.indexOf(g))).join('')}</div>`).join('')}`;
  const st = el.querySelector('.dash-st'), byId = new Map(students.map((s) => [s.id, s]));
  const redraw = (gi) => { el.querySelector(`.cls[data-i="${gi}"] .shelf`).innerHTML = shelfOf(groups[gi]); };
  async function save(ss, book, on, section) { // section: the whole section's spine, so students who join later get it too
    const before = ss.map((s) => [...s.books]);
    const apply = () => ss.forEach((s) => { const x = el.querySelector(`[data-s="${s.id}"][data-b="${book}"]`); if (x) x.checked = s.books.includes(book); });
    ss.forEach((s) => { s.books = on ? [...new Set([...s.books, book])] : s.books.filter((x) => x !== book); });
    apply(); groups.forEach((g, i) => { if (g.ss.some((s) => ss.includes(s))) redraw(i); });
    st.textContent = 'Saving…';
    try {
      await api('/assignments', { method: 'PUT', body: JSON.stringify({ studentIds: ss.map((s) => s.id), add: on ? [book] : [], remove: on ? [] : [book], ...(section && { section }) }) });
      st.textContent = `${on ? 'Gave' : 'Took back'} ${SHORT[book]} ${ss.length === 1 ? `${on ? 'to' : 'from'} ${ss[0].name}` : `${on ? 'to' : 'from'} ${ss.length} students`}${section && on ? '. New students in this section get it too.' : ''}`;
    } catch (x) {
      ss.forEach((s, i) => { s.books = before[i]; }); apply(); groups.forEach((g, i) => { if (g.ss.some((s) => ss.includes(s))) redraw(i); });
      st.textContent = `Not saved: ${x.message}`;
      if (x.status === 401) location.reload();
    }
  }
  el.addEventListener('click', (e) => {
    const sp = e.target.closest('.spine[data-g]');
    if (!sp) return;
    const g = groups[sp.dataset.g], book = sp.dataset.b, all = g.ss.every((s) => s.books.includes(book));
    if (all && !confirm(`Take ${SHORT[book]} back from all ${g.ss.length} students in ${g.name}? They will no longer be able to open it.`)) return;
    const sec = [g.ss[0].schoolId, g.ss[0].grade ?? '', g.ss[0].section ?? ''];
    save(all ? g.ss : g.ss.filter((s) => !s.books.includes(book)), book, !all, sec);
  });
  el.addEventListener('change', (e) => { const c = e.target; if (c.dataset.s) save([byId.get(+c.dataset.s)], c.dataset.b, c.checked); });
  el.querySelector('input[type=search]').addEventListener('input', (e) => {
    const t = e.target.value.trim().toLowerCase();
    el.querySelectorAll('.cls').forEach((c) => {
      let hit = 0;
      c.querySelectorAll('tbody tr').forEach((r) => { r.hidden = !!t && !r.dataset.q.includes(t); hit += !r.hidden; });
      c.hidden = !!t && !hit;
      if (t && hit) c.querySelector('details').open = true;
    });
  });
}

const previews = () => `<section class="hwrap dash-sec" aria-labelledby="pv-h"><h2 id="pv-h">Preview a book</h2>
  <p class="dash-note">Open any book to see exactly what your students will see.</p>
  <ul class="covers">${books().map((b) => `<li><a class="cover" href="${PREVIEW[b.id]}" style="--c:${COLOR[b.id]}"><b>${esc(SHORT[b.id])}</b><span>${esc(b.blurb)}</span></a></li>`).join('')}</ul></section>`;

// --- #/teach ---------------------------------------------------------------------------------------------------------
export async function renderTeach(el) {
  const sa = session().user.role === 'school_admin';
  el.innerHTML = `<div class="hwash dash">${head()}
    <section class="hwrap dash-top"><h1>${sa ? 'Your school' : 'Your classes'}</h1>
      <p class="lede">Each shelf is one section. A spine fills up as more students get that book. Click a spine to give the book to the whole section, including students who join it later, or open the student list to choose one by one.</p></section>
    <section class="hwrap dash-sec" aria-label="Sections"><div id="cls"><p class="dash-empty">Loading your students…</p></div></section>
    <section class="hwrap dash-sec" aria-labelledby="pg-h"><h2 id="pg-h">Progress</h2><p class="lede">Lessons each student has finished and parts they have explored, per book.</p><div id="prog"><p class="dash-empty">Loading progress…</p></div></section>
    ${previews()}</div>`;
  try { classes(el.querySelector('#cls'), (await api('/roster')).students); }
  catch (e) { el.querySelector('#cls').innerHTML = `<p class="dash-empty">${esc(e.message)}</p>`; }
  try { progressTable(el.querySelector('#prog'), (await api('/progress/students')).people); }
  catch (e) { el.querySelector('#prog').innerHTML = `<p class="dash-empty">${esc(e.message)}</p>`; }
}

// --- #/admin, #/admin/schools, #/admin/settings, #/admin/school/<id> -------------------------------------------------
const TABS = [['', 'Overview'], ['schools', 'Schools'], ['progress', 'Progress'], ['settings', 'Student sign-in']];
const adminFrame = (tab, body) => `<div class="hwash dash">${head()}
  <section class="hwrap dash-top"><h1>Admin</h1>
    <nav class="tabs-d" aria-label="Admin">${TABS.map(([k, t]) => `<a href="#/admin${k ? `/${k}` : ''}"${k === tab ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav></section>${body}</div>`;

export async function renderAdmin(el, path) {
  const [tab, id] = path.split('/');
  if (tab === 'school' && id) return adminSchool(el, id);
  el.innerHTML = adminFrame(tab || '', '<section class="hwrap dash-sec"><p class="dash-empty">Loading…</p></section>');
  const body = el.querySelector('.dash-sec');
  try {
    if (tab === 'schools') return adminSchools(body);
    if (tab === 'settings') return adminSettings(body);
    if (tab === 'progress') return await adminProgress(body);
    return await adminOverview(body);
  } catch (e) { body.innerHTML = `<p class="dash-empty">${esc(e.message)}</p>`; }
}

async function adminOverview(body) {
  const o = await api('/admin/overview'), c = o.counts;
  body.innerHTML = `<div class="ov">
    <div class="ov-shelf"><div class="shelf big" role="img" aria-label="Students holding each book">${books().map((b) => spine(b, o.perBook[b.id], c.students)).join('')}</div>
      <p class="ov-cap">Students holding each book, out of ${plural(c.students, 'active student')} in YugMinds.</p></div>
    <div class="ov-side">
      <p class="ov-sum"><b>${c.studentsWithBooks.toLocaleString('en-IN')}</b> students have at least one book. ${plural(c.schools, 'active school')}, ${plural(c.teachers, 'teacher')}; ${plural(c.staffSignedIn, 'teacher or school admin')} signed in here so far.</p>
      <p class="ov-gate ${o.studentsOpen ? 'on' : ''}"><span>${o.studentsOpen ? 'Students can sign in.' : 'Student sign-in is closed.'}</span><a href="#/admin/settings">Change</a></p>
      <h2>Latest books given</h2>
      ${o.recent.length ? `<ol class="feed">${o.recent.map((r) => `<li><i style="--c:${COLOR[r.book]}"></i><p><b>${esc(r.by)}</b> gave <b>${esc(SHORT[r.book])}</b> to ${esc(r.student)}${r.school ? ` at ${esc(r.school)}` : ''}</p><time datetime="${r.at}">${ago(r.at)}</time></li>`).join('')}</ol>`
        : '<p class="dash-empty">No books given yet. Open a school to start.</p>'}
      <a class="pill amber" href="#/admin/schools">Give books to a school</a></div></div>`;
}

async function adminSchools(body) {
  const { schools } = await api('/admin/schools');
  body.innerHTML = `<div class="dash-bar"><input type="search" placeholder="Find a school by name or city" aria-label="Find a school"><span class="dash-st">${plural(schools.length, 'school')}</span></div>
    <div class="tbl-wrap card"><table class="list"><thead><tr><th scope="col">School</th><th scope="col">Students</th><th scope="col">Teachers</th><th scope="col">Have a book</th></tr></thead>
    <tbody>${schools.map((s) => { const p = s.students ? Math.round((s.withBooks / s.students) * 100) : 0;
      return `<tr data-q="${esc(`${s.name} ${s.city ?? ''}`.toLowerCase())}"><th scope="row"><a href="#/admin/school/${esc(s.id)}">${esc(s.name)}</a><small>${esc(s.city ?? '')}${s.isActive ? '' : `${s.city ? ', ' : ''}deactivated`}</small></th>
        <td>${s.students}</td><td>${s.teachers}</td><td><span class="meter" style="--f:${p}%"><i></i></span>${s.withBooks} <small>(${p}%)</small></td></tr>`; }).join('')}</tbody></table></div>`;
  body.querySelector('input').addEventListener('input', (e) => { const t = e.target.value.trim().toLowerCase(); body.querySelectorAll('tbody tr').forEach((r) => { r.hidden = !!t && !r.dataset.q.includes(t); }); });
}

// Progress: everyone who has used the simulator (students, teachers, admins), per book: lessons finished and parts explored
const ROLE = { student: 'Student', teacher: 'Teacher', school_admin: 'School admin', admin: 'Admin' };
const TRACK = [
  ...[1, 2, 3].map((n) => ({ id: `l${n}`, lessons: levelLessons(n).map((l) => l.id), parts: levelParts(n) })),
  { id: 'jr', lessons: JR_LESSONS.map((l) => l.id) }, { id: 'scratch', lessons: scratchIds },
];
const who = (n) => `${n.toLocaleString('en-IN')} ${n === 1 ? 'person' : 'people'}`;
const bar = (got, all, what) => `<span class="meter" style="--f:${all ? Math.round((got / all) * 100) : 0}%"><i></i></span>${got}/${all} <small>${what}</small>`;
async function adminProgress(body) {
  const { people } = await api('/admin/progress');
  progressTable(body, people, { roles: true });
}
/** people: [{ name, role?, school?, grade?, section?, last, lessons, parts }]. Search by name/school/class; admins also filter by role. */
function progressTable(body, people, { roles = false } = {}) {
  if (!people.length) { body.innerHTML = `<p class="dash-empty">${roles ? 'Nobody has finished a lesson or opened a part yet. Progress shows up here as soon as someone does.' : 'No students in your sections yet.'}</p>`; return; }
  const sub = (p) => roles ? `${ROLE[p.role] ?? p.role}${p.school ? `, ${p.school}` : ''}` : sectionName(p);
  body.innerHTML = `<div class="dash-bar"><input type="search" placeholder="${roles ? 'Find a person or school' : 'Find a student or class'}" aria-label="Search">
      ${roles ? `<select aria-label="Show"><option value="">Everyone</option>${Object.entries(ROLE).map(([k, v]) => `<option value="${k}">${v}s</option>`).join('')}</select>` : ''}
      <span class="dash-st">${who(people.length)}</span></div>
    <div class="tbl-wrap card"><table class="list prog"><thead><tr><th scope="col">${roles ? 'Person' : 'Student'}</th>${TRACK.map((t) => `<th scope="col">${SHORT[t.id]}</th>`).join('')}<th scope="col">Last active</th></tr></thead>
    <tbody>${people.map((p) => `<tr data-role="${esc(p.role ?? '')}" data-q="${esc(`${p.name} ${sub(p)}`.toLowerCase())}">
      <th scope="row"><b>${esc(p.name)}</b><small>${esc(sub(p))}</small></th>
      ${TRACK.map((t) => { const l = t.lessons.filter((id) => p.lessons.includes(id)).length, pt = t.parts?.filter((id) => p.parts.includes(id)).length;
        return `<td>${bar(l, t.lessons.length, 'lessons')}${t.parts ? `<br>${bar(pt, t.parts.length, 'parts')}` : ''}</td>`; }).join('')}
      <td>${p.last ? `<time datetime="${p.last}">${ago(p.last)}</time>` : '<small>Not started</small>'}</td></tr>`).join('')}</tbody></table></div>`;
  const q = body.querySelector('input'), role = body.querySelector('select'), st = body.querySelector('.dash-st');
  const filter = () => { const t = q.value.trim().toLowerCase(); let n = 0;
    body.querySelectorAll('tbody tr').forEach((r) => { r.hidden = (!!t && !r.dataset.q.includes(t)) || (!!role?.value && r.dataset.role !== role.value); n += !r.hidden; });
    st.textContent = who(n); };
  q.addEventListener('input', filter); role?.addEventListener('change', filter);
}

async function adminSettings(body) {
  let { studentsOpen } = await api('/admin/settings');
  body.innerHTML = `<div class="card gate">
    <div><h2>Students can sign in</h2><p>When this is off, only teachers, school admins and admins can sign in. Students who try are told sign-in is not open yet. Books you give now are kept and open as soon as you switch this on.</p></div>
    <button type="button" role="switch" class="switch" aria-checked="${studentsOpen}" aria-label="Students can sign in"><span></span></button>
    <p class="dash-st" role="status"></p></div>`;
  const sw = body.querySelector('.switch'), st = body.querySelector('.dash-st');
  sw.addEventListener('click', async () => {
    if (!studentsOpen && !confirm('Let every YugMinds student sign in to the simulator? They will see only the books given to them.')) return;
    sw.disabled = true; st.textContent = 'Saving…';
    try { ({ studentsOpen } = await api('/admin/settings', { method: 'PUT', body: JSON.stringify({ studentsOpen: !studentsOpen }) })); st.textContent = studentsOpen ? 'Student sign-in is open.' : 'Student sign-in is closed.'; }
    catch (e) { st.textContent = `Not saved: ${e.message}`; }
    sw.setAttribute('aria-checked', studentsOpen); sw.disabled = false;
  });
}

async function adminSchool(el, id) {
  el.innerHTML = `<div class="hwash dash">${head('<a class="pill ghost" href="#/admin/schools">All schools</a>')}<section class="hwrap dash-top"><h1>Loading…</h1></section></div>`;
  let d, roster;
  try { [d, roster] = await Promise.all([api(`/admin/schools/${encodeURIComponent(id)}`), api(`/roster?schoolId=${encodeURIComponent(id)}`)]); }
  catch (e) { el.querySelector('h1').textContent = e.status === 404 ? 'School not found' : e.message; return; }
  el.querySelector('.dash-top').innerHTML = `<h1>${esc(d.school.name)}</h1><p class="lede">${esc(d.school.city ?? '')}${d.school.isActive ? '' : ' This school is deactivated in YugMinds, so nobody from it can sign in.'}</p>`;
  el.querySelector('.dash-top').insertAdjacentHTML('afterend', `<section class="hwrap dash-sec" aria-labelledby="c-h"><h2 id="c-h">Classes</h2><div id="cls"></div></section>
    <section class="hwrap dash-sec" aria-labelledby="t-h"><h2 id="t-h">Teachers</h2>${d.teachers.length ? `<div class="tbl-wrap card"><table class="list">
      <thead><tr><th scope="col">Teacher</th><th scope="col">Sections</th><th scope="col">Last signed in here</th></tr></thead>
      <tbody>${d.teachers.map((t) => `<tr><th scope="row"><b>${esc(t.name)}</b><small>${esc(t.email)}</small></th>
        <td>${t.sections.length ? `<ul class="chips">${t.sections.map((s) => `<li>${esc(sectionName(s))} <small>${plural(s.students, 'student')}</small></li>`).join('')}</ul>` : '<small>No sections yet</small>'}</td>
        <td>${t.lastSeen ? `<time datetime="${t.lastSeen}">${ago(t.lastSeen)}</time>` : '<small>Never</small>'}</td></tr>`).join('')}</tbody></table></div>`
      : '<p class="dash-empty">No teachers linked to this school in YugMinds.</p>'}</section>`);
  classes(el.querySelector('#cls'), roster.students);
}
