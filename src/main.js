import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/figtree';
import './style.css';
import { PARTS, PART_LABELS, steps, moduleName, portName, withBattery, partGroup, PART_GROUPS, JR_LESSONS, JR_BUILD, JR_PARTS, JR_PART_GROUPS, JR_NOTE, JR_INVERTED, jrName, jrSteps, jrWithBattery, cablePins } from './kit.js';
import { renderBlocks, toCpp, cppWithLines, run, usedPins as blockPins } from './blocks.js';
import { createMonitor } from './serial.js';
import { renderScratchHome, renderScratchLesson, SCRATCH_LESSONS, scratchIds, mountEditor, runScript, runner, sb } from './scratch.js';
import { renderChapter1 } from './scratch-ch1.js';
import { levelParts, levelLessons, allLessons, partLevel, BADGE } from './levels.js';
import { createObstacleRig, OBSTACLES, reading } from './obstacle.js';
import { createLampRig, LAMP_MAX } from './lamp.js';
import { createIrRig, IR_THINGS, IR_MAX } from './irrig.js';
import { createLineRig, lineSensors, lineStep } from './line.js';
import { ARENAS, COURSE_OF, buildArena, makeTrail, inStop, gateAt, frontMarker, carFrame, carPoints, blocked, sonar as sonarCm, onTape, sensorsAt, drawMap, makeBeam } from './arena.js';
import { flowSvg, flowActive } from './flow.js';
import { PIN_INFO, PART_INFO, GPIO_PIN, PIN_GPIO, TAG_NOTE, ESP32_DECALS, ESP32_SCHEMATIC } from './esp32.js';
import { PORTS } from './kit.js';
import { signIn, bookOfHash, canOpen, decorate, notice, isStaff, session, dashHref, api } from './access.js';
import { renderAdmin, renderTeach } from './dashboard.js';
import { renderLauncher, kitItems, bookItems, renderBookHub } from './launcher.js';
import { levelOf, badgesOf } from './home.js';
import { sfx, muted, setMuted } from './sfx.js';
import { createAssembly, JR_PROCEDURE } from './assemble.js';
import { BASE_PART, PORT_DOC, PORT_PIN_ROLE, BASE_DECALS, portMap } from './base.js';
import { TB_PIN, TB_GPIO, GPIO_TB, TB_DECALS, bridge, bridgeText } from './tb6612.js';
import { SENSORS, LOGO, sensorKey, ttp223, dht11Frame, echoUs, usToCm, servoPulseMs, jrBoard, ldrAt, roomLux, adcCounts } from './sensors.js';
const sensorDecals = (node, id, tint) => {
  node?.traverse((o) => { if (/_solder$/.test(o.name)) o.visible = false; }); // solder jumpers start open
  const d = SENSORS[id].decals;
  return LOGO.decode().catch(() => {}).then(() => stage.decals(node, typeof d === 'function' ? d(tint) : d));
};

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(`rckit:${k}`)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`rckit:${k}`, JSON.stringify(v)); } catch { /* private mode: progress not saved */ } },
};
const MAIN_ANCHOR = { led: 'anchor_led_led', buzzer: 'anchor_buzzer_buzzer', button: 'anchor_button_button', traffic: 'anchor_traffic_yellow',
  ldr: 'anchor_ldr_ldr', touch: 'anchor_touch_pad', mic: 'anchor_mic_mic', gas: 'anchor_gas_element', soil: 'anchor_soil_probe', rain: 'anchor_rain_comb', battery: 'anchor_battery_cells', tt_motor: 'anchor_tt_motor_shaft', ultrasonic: 'anchor_ultrasonic_transmitter', dht11: 'anchor_dht11_sensor', servo: 'anchor_servo_horn', oled: 'anchor_oled_screen' };
const BODY = { red: 0xd42a1a, yellow: 0xe8b818, green: 0x1fae44 };

let build = null, buildMod = null;
const builds = new Map(); // one build guide per car project (null = the full robot)
const getBuild = (project) => { if (!builds.has(project)) builds.set(project, buildMod.createBuild({ stage, getModel: mod.getModel, url: modelUrl, project })); return builds.get(project); };
const bHash = (sid) => `#/${pfx()}build/${sid}${buildFor ? `/${buildFor}` : ''}`; // build steps keep the project they belong to
const mon = createMonitor($('#monitor'), store);
let lineOf = new Map(), uploading = null; // C++ line of each block; the upload in progress (cancel token)
const buildChecks = store.get('buildChecks', {});
const seen = new Set(store.get('seenParts', [])); // parts the student has opened: a book teaches its components first, then the lessons
let manifest = [], stage = null, mod = null, createHw = null, item = null, mode = 'lessons', running = null, kitInfo = { esp: null, modules: [] };
let tab = store.get('tab', 'overview'), view = store.get('codeView', 'blocks'), prog = null, blockMap = new Map();
let baseNode = null, basePower = true, tbNode = null;
const tbLogic = { ain1: 0, ain2: 0, bin1: 0, bin2: 0, stby: 1 }; // part-page playground
const flipped = { switch_motor_v: false, switch_i2c_v: false };
let espNode = null, usbPlugged = true, bootHeld = false, showSchem = store.get('schematic', true);
const pinGlow = new Set(), portGlow = new Set();
const done = new Set(store.get('done', []));
const values = store.get('values', {});
const edits = store.get('blocks', {});
const byId = (id) => manifest.find((m) => m.id === id);
const modelUrl = (id) => (byId(id) ? `/${byId(id).file}` : null);
const pretty = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

boot();

/** Progress is saved per account on the server (students, teachers and admins alike); localStorage is this browser's copy. */
const push = (body) => api('/progress', { method: 'PUT', body: JSON.stringify(body) }).catch(() => {}); // offline: the next sign-in uploads what is missing
async function syncProgress() {
  const me = session()?.user, srv = me && (await api('/progress').catch(() => null));
  if (!srv) return;
  // this browser's progress is uploaded only if it is this account's (or, once, from before progress was saved online and the account has none yet):
  // on a shared school computer one student's lessons never land on the next student's account
  const owner = store.get('owner', null), mine = owner === me.id || (owner == null && !srv.lessons.length && !srv.parts.length);
  if (!mine) { done.clear(); seen.clear(); }
  const up = { addLessons: [...done].filter((x) => !srv.lessons.includes(x)), addParts: [...seen].filter((x) => !srv.parts.includes(x)) };
  srv.lessons.forEach((x) => done.add(x)); srv.parts.forEach((x) => seen.add(x));
  store.set('done', [...done]); store.set('seenParts', [...seen]); store.set('owner', me.id);
  if (up.addLessons.length || up.addParts.length) await push(up);
}

async function boot() {
  await signIn(); // YugMinds account first: it decides which books open
  await syncProgress();
  manifest = await fetch('/models/manifest.json').then((r) => r.json()).catch(() => []);
  try {
    mod = await import('./stage.js');
    stage = mod.createStage($('#stage'));
    if (import.meta.env.DEV) window.__stage = stage; // dev-only: browser checks
  } catch (e) {
    console.error(e);
    $('#loader p').textContent = 'This page needs WebGL to show the 3D kit.';
    $('.spin').remove();
    return;
  }
  createHw = (await import('./sim.js')).createHw;
  $('#stage').addEventListener('part', (e) => onPart(e.detail));
  $('#stage canvas').addEventListener('dblclick', () => { if (item?.kitbox && kitPick) location.hash = `#/${pfx()}part/${kitPick}`; });
  $('#stage').addEventListener('unfocus', () => stage.focus(null));
  $('#stage').addEventListener('press', (e) => {
    const { root, name, down } = e.detail;
    if (name.startsWith('esp32_btn')) {
      stage.press(root, `${name}_cap`, down);
      if (name === 'esp32_btn_boot') bootHeld = down;
      if (name === 'esp32_btn_en' && !down) resetBoard();
      return;
    }
    if (item.jr && !item.part && /^(button(_body|_plate)?|touch_pad)$/.test(name)) return void jrPress(root, down); // 3D press: stage sends 'button' (cap), 'button_body', 'touch_pad'
    if (name === 'touch_pad' && !running) return touchPress(down);
    if (name.startsWith('button_') && !running) { stage.press(root.parent, 'button_cap', down); return btnPress(down); }
    running ? running.hw.press(root, down) : stage.press(root.parent, 'button_cap', down);
  });
  stage.setHoverLabel(hoverLabel);
  $('#schematic .x').addEventListener('click', () => toggleSchem(false));
  $('[data-act="schematic"]').addEventListener('click', () => toggleSchem(!showSchem));
  document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { stage.view(b.dataset.view); if (['labels', 'clear'].includes(b.dataset.view)) b.classList.toggle('on'); }));
  document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { if (tab !== b.dataset.tab) sfx.move(); tab = b.dataset.tab; store.set('tab', tab); renderTab(); }));
  document.querySelectorAll('[data-code]').forEach((b) => b.addEventListener('click', () => { if (view !== b.dataset.code) sfx.move(); view = b.dataset.code; store.set('codeView', view); renderCode(); }));
  document.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => {
    if (kitJr) { location.hash = b.dataset.nav === 'parts' ? `#/jr/part/${shownParts()[0] ?? 'jr_board'}` : b.dataset.nav === 'build' ? `#/jr/build/${store.get('jrBuild', JR_BUILD[0].id)}` : `#/jr/lesson/${store.get('jrLast', JR_LESSONS[0].id)}`; return; }
    const n = b.dataset.nav, list = lessonList();
    location.hash = n === 'parts' ? (lvl ? `#/${pfx()}part/${shownParts()[0] ?? ''}` : '#/kit') : n === 'build' ? `#/${pfx()}build/${store.get('buildStep', 'parts')}`
      : list.length ? `#/${pfx()}lesson/${(list.find((l) => l.id === store.get(lastKey())) || list[0]).id}` : lvl ? `#/level/${lvl}` : '#/levels'; // kit box: lessons live in the books
  }));
  document.querySelectorAll('[data-scroll]').forEach((b) => b.addEventListener('click', () => step(+b.dataset.scroll)));
  $('#copy').addEventListener('click', () => navigator.clipboard?.writeText(toCpp(prog)).then(() => flash($('#copy'))));
  $('#reset').addEventListener('click', () => { delete edits[item.id]; store.set('blocks', edits); prog = structuredClone(item.blocks); if (item.scratch) scratchRig?.reset(); renderCode(); restart(); });
  $('.info').addEventListener('click', (e) => {
    const b = e.target.closest('[data-asm]'), li = e.target.closest('.steps.live li');
    if (!assembly) return;
    if (b) b.dataset.asm === 'skip' ? (assembly.skip(), startSim()) : assembly.seek(0);
    else if (li) assembly.seek(+li.dataset.i);
  });
  $('#run').addEventListener('click', () => { if (running || uploading) { sfx.back(); return stopSim(); } if (assembly && !assembly.done()) assembly.skip(); if (powered()) sfx.start(); startSim(); });
  { const m = $('#mute'); m.setAttribute('aria-pressed', String(muted())); m.addEventListener('click', () => { const x = !muted(); setMuted(x); m.setAttribute('aria-pressed', String(x)); if (!x) sfx.move(); }); }
  $('#expand').addEventListener('click', () => toggleExpand());
  ['wheel', 'touchmove', 'pointerdown', 'keydown'].forEach((ev) => $('.src').addEventListener(ev, () => { userScrolledAt = Date.now(); }, { passive: true }));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#code-card').classList.contains('max')) toggleExpand(false); });
  { // drag the grip above the monitor to resize it
    const m = $('#monitor'), setH = (h) => m.style.setProperty('--mon-h', `${Math.round(Math.min(420, Math.max(70, h)))}px`);
    setH(store.get('monH', 110));
    $('.mon-grip').addEventListener('pointerdown', (e) => {
      const y0 = e.clientY, h0 = $('#serial').offsetHeight || 130, grip = e.currentTarget;
      grip.setPointerCapture(e.pointerId);
      const mv = (ev) => setH(h0 + (y0 - ev.clientY));
      grip.addEventListener('pointermove', mv);
      grip.addEventListener('pointerup', () => { grip.removeEventListener('pointermove', mv); store.set('monH', $('#serial').offsetHeight || 130); }, { once: true });
    });
  }
  document.querySelectorAll('[data-b]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.b === 'play') togglePlay();
    if (b.dataset.b === 'speed') b.textContent = `${build.cycleSpeed()}×`;
    if (b.dataset.b === 'explode') b.classList.toggle('on', build.explode());
  }));
  const keyDir = { ArrowUp: 'f', w: 'f', ArrowDown: 'b', s: 'b', ArrowLeft: 'l', a: 'l', ArrowRight: 'r', d: 'r' };
  addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select') || e.repeat) return;
    if (arena && mode === 'lessons') { // the arena: drive by hand, pick who drives, follow, put back
      if (keyDir[e.key]) { e.preventDefault(); return holdDrive(keyDir[e.key], true); }
      const k = e.key.toLowerCase(), m = { ' ': 'stop', 1: 'program', 2: 'manual', 3: 'stop' }[k];
      if (m) { e.preventDefault(); return setDriveMode(m); }
      if (k === 'c') return $('[data-ar="chase"]').click();
      if (k === 'r') return putCarBack();
      if (k === 'b') return pushCarButton(true);
    }
    if (mode !== 'build') return;
    const drive = build.steps[build.st.step].drive;
    if (e.key === 'Escape' && buildDetail) return closeDetail();
    if (drive && keyDir[e.key]) { e.preventDefault(); return holdDrive(keyDir[e.key], true); }
    if (e.key === 'ArrowRight') stepBuild(1);
    else if (e.key === 'ArrowLeft') stepBuild(-1);
    else if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    else if (e.key.toLowerCase() === 'e') $('[data-b="explode"]').classList.toggle('on', build.explode());
    else if (e.key.toLowerCase() === 'c' && drive) toggleChase();
  });
  addEventListener('keyup', (e) => { if (keyDir[e.key] && (arena ? mode === 'lessons' : mode === 'build' && build.steps[build.st.step].drive)) holdDrive(keyDir[e.key], false); });
  $('#phases').addEventListener('click', (e) => { const g = e.target.closest('[data-go]'), b = e.target.closest('[data-ph]'); if (g) flowNext(g.dataset.go); else if (b) goPhase(mode === 'build' ? buildFor : item.id, b.dataset.ph); });
  setupArenaHud();
  addEventListener('hashchange', route);
  await route();
  $('#loader').classList.add('gone');
}

let lockedMsg = '';
async function route() {
  if (location.hash === '#/jr/board') return location.replace('#/jr/part/jr_board'); // old link
  if (!canOpen(bookOfHash(location.hash))) { lockedMsg = 'That book is not assigned to you yet. Ask your teacher to assign it.'; return location.replace('#/'); }
  const dash = location.hash.match(/^#\/(admin|teach)(?:\/(.*))?$/); // staff dashboards
  if (location.hash === '#/assign' || (dash && (!isStaff() || (dash[1] === 'admin') !== (session().user.role === 'admin')))) return location.replace(isStaff() ? dashHref() : '#/');
  const [, pre, kind, id] = location.hash.match(/^#\/(jr\/|l[123]\/|scratch\/)?(lesson|part|build)\/([\w-]+)/) || [];
  kitJr = pre === 'jr/'; jrBuild = kitJr && kind === 'build'; lvl = +(pre?.match(/^l(\d)/)?.[1] || 0); sc = pre === 'scratch/';
  const page = location.hash.match(/^#\/(kit|levels|level\/([123]))$/); // kit box, book shelf or one book's page
  if (sc && kind !== 'lesson') return location.replace('#/scratch'); // Scratch has lessons only (no parts, no build)
  if (!kitJr && !lvl && !sc && (kind || page?.[1] === 'kit')) return location.replace(kind === 'build' ? `#/l3/build/${id}` : '#/levels'); // Robo Coders lives in the books (old Classic / kit box links)
  stopSim();
  assembly?.stop(); assembly = null;
  rig?.dispose(); rig = null; lamp?.dispose(); lamp = null; irRig?.dispose(); irRig = null; irWave(false); line?.dispose(); line = null; scratchRig?.dispose(); scratchRig = null; stage.setDrag(null); obstacleDrive(false); stage.setPills(false);
  if (arena) closeDrivePanel();
  arena = null; held.length = 0; stage.setFence(null); $('#arena').hidden = true; $('#stage').classList.remove('arena-on'); $('#phases').hidden = true;
  const atHome = !kind; // '#/', '#' or no hash: the kit picker
  document.body.classList.toggle('at-home', atHome);
  $('#home').hidden = !atHome;
  document.body.classList.toggle('kit-jr', kitJr);
  document.body.classList.toggle('scratch', sc);
  $('.brand h1').innerHTML = sc ? 'Scratch <span>Coding</span>' : kitJr ? 'Jr. Explorer <span>Kit</span>' : lvl ? `Tech Explorers <span>Level ${lvl}</span>` : 'Robo Coders <span>Kit box</span>';
  document.body.classList.toggle('no-build', !kitJr); // the books build inside their lessons (Chassis assembly, then each car's Chassis step)
  $('.mark').href = sc ? '#/scratch' : kitJr ? '#/' : lvl ? `#/level/${lvl}` : '#/kit';
  const scratch = location.hash.match(/^#\/scratch(?:\/([\w-]+))?$/); // Scratch Coding: its own module, no kit
  if (atHome) {
    await (dash ? showDash(dash) : scratch ? showScratch(scratch[1]) : page ? showBook(+page[2] || 0) : showHome());
    decorate($('#home'));
    if (lockedMsg) { notice($('#home'), lockedMsg); lockedMsg = ''; }
    return;
  }
  if (kind === 'build' && !kitJr) { buildFor = location.hash.match(/\/build\/[\w-]+\/(l3-[\w-]+)/)?.[1] || null; if (!buildFor) return location.replace(`#/l3/build/${id}/l3-chassis`); return routeBuild(id); } // old links: the book's Chassis assembly
  if (mode === 'build') leaveBuild();
  if (kind === 'part' && (partOrder().includes(id) || (lvl && byId(id) && id !== 'jr_board'))) { mode = 'parts'; item = { ...byId(id), part: true, jr: kitJr && id === 'jr_board' }; if (lvl) markSeen(id); } // a book can open any kit part (from Explore your kit)
  else if (kitJr) {
    mode = 'lessons';
    const list = lessonList(), key = jrBuild ? 'jrBuild' : 'jrLast';
    item = list.find((l) => l.id === id) || list.find((l) => l.id === store.get(key)) || list[0];
    store.set(key, item.id);
    if (location.hash !== `#/jr/${kindWord()}/${item.id}`) history.replaceState(null, '', `#/jr/${kindWord()}/${item.id}`);
    prog = structuredClone(item.blocks);
  } else {
    mode = 'lessons';
    const list = lessonList();
    if (!list.length) return location.replace(lvl ? `#/level/${lvl}` : '#/kit');
    item = list.find((l) => l.id === id) || list.find((l) => l.id === store.get(lastKey())) || list[0];
    if (item.chassisBuild) return location.replace('#/l3/build/parts/l3-chassis');
    store.set(lastKey(), item.id);
    if (location.hash !== `#/${pfx()}lesson/${item.id}`) history.replaceState(null, '', `#/${pfx()}lesson/${item.id}`);
    prog = structuredClone(edits[item.id] || item.blocks);
    buildFor = null;
    if (item.chassis) { // car lessons go circuit → chassis (build guide) → drive (arena); the tape slider and the obstacle slider are replaced by the arena
      if (lastLesson && lastLesson !== item.id && phaseNav !== item.id) store.set(`phase:${item.id}`, 'circuit'); // coming from another lesson: start at step 1 (a reload or a step change keeps your place)
      const phase = store.get(`phase:${item.id}`, 'circuit');
      item = { ...item, phase, params: item.params?.filter((p) => p.key !== 'drift' && !(phase === 'drive' && p.key === 'cm')) };
    }
    lastLesson = item.id; phaseNav = null;
  }
  document.querySelectorAll('[data-nav]').forEach((b) => b.setAttribute('aria-current', String(b.dataset.nav === (jrBuild ? 'build' : mode))));
  $('[data-tab="steps"]').textContent = item.part ? 'Used in' : 'Steps';
  $('[data-tab="pinout"]').textContent = item.scratch ? 'Blocks' : 'Pinout'; // a Scratch lesson has blocks and a sprite, not pins
  $('[data-tab="specs"]').textContent = item.scratch ? 'Sprite' : 'Specs';
  renderStrip(); renderTab(); renderCode(); renderPhases();
  stage.showTip('');
  stage.setHoverLift(!item.kitbox); // Explore your kit animates the parts itself
  const current = item;
  espNode = baseNode = sensorNode = null;
  if (item.kitbox) return showKitScene(current);
  if (item.scratch) return showScratchStage(current);
  if (item.part) {
    const url = modelUrl(item.id);
    if (!url) return stage.setCallouts([]);
    const root = await stage.load(url, item.id === 'chassis' ? (r) => stage.mountWheels(r, modelUrl('wheel'), modelUrl('tt_motor')) : null);
    if (current !== item) return;
    kitInfo = { esp: root, modules: [] };
    stage.setCallouts(partCallouts(item));
    setupEsp(root.getObjectByName('esp32'));
    setupBase(root.getObjectByName('base'));
    setupTb(root.getObjectByName('tb6612'));
    setupSensor(SENSORS[item.id] ? root.getObjectByName(item.id) : null, item.id);
  } else if (item.jr) {
    const kit = await stage.loadKit({ board: modelUrl('jr_board') }, jrWithBattery(item.kit).map((m) => ({ ...m, url: modelUrl(m.id) })), { board: 'jr_board' });
    if (current !== item) return;
    kit.modules.forEach((m) => { if (m.tint) { const o = stage.find(m.root, 'led_lens'); o.material = o.material.clone(); o.material.color.set(BODY[m.tint]); } });
    kit.modules.forEach((m) => { if (m.id === 'led') stage.glow(m.root, 'led_lens', false, null, 'anchor_led_led'); }); // start dark, like a real LED that's off
    kit.modules.forEach((m) => { if (SENSORS[m.id]) sensorDecals(m.root.getObjectByName(m.id), m.id, m.tint); });
    kitInfo = { esp: null, modules: kit.modules, group: kit.group };
    setupBase(null); setupTb(null); setupEsp(null);
    setupSensor(kit.base.getObjectByName('jr_board'), 'jr_board');
    jr.kit = kit.modules;
    startAssembly(kit);
    stage.setCallouts([
      { root: kit.base, anchor: 'anchor_jr_board_u1', title: 'Jr. board', body: 'IPn switches OPn.' },
      ...kit.modules.map((m) => ({ root: m.root, anchor: MAIN_ANCHOR[m.id], title: jrName(m), body: m.port.startsWith('cn') ? (m.port === 'cn3' ? 'BAT (CN3)' : m.port === 'cn2' ? 'LEFT MOTOR (CN2)' : 'RIGHT MOTOR (CN1)') : m.port.toUpperCase() })),
    ]);
  } else if (item.kit.length || item.chassis) {
    const urls = { base: modelUrl('base'), esp32: modelUrl('esp32'), tb6612: modelUrl('tb6612'), chassis: item.chassis && item.phase !== 'circuit' ? modelUrl('chassis') : null, wheel: modelUrl('wheel'), tt_motor: modelUrl('tt_motor') };
    const kit = await stage.loadKit(urls, withBattery(item.phase === 'circuit' ? [...item.kit, ...DESK_MOTORS] : item.kit).map((m) => ({ ...m, url: modelUrl(m.id), at: item.phase === 'circuit' ? deskSpot(m) : undefined })));
    if (current !== item) return;
    if (import.meta.env.DEV) window.__kit = kit;
    kit.modules.forEach((m) => { if (m.tint) { const o = stage.find(m.root, 'led_lens'); o.material = o.material.clone(); o.material.color.set(BODY[m.tint]); } });
    kit.modules.forEach((m) => { if (m.id === 'led') stage.glow(m.root, 'led_lens', false, null, 'anchor_led_led'); }); // start dark, like a real LED that's off
    kitInfo = { esp: kit.esp, modules: kit.modules, chassis: kit.chassis, group: kit.group };
    kit.modules.forEach((m) => { if (SENSORS[m.id]) sensorDecals(m.root.getObjectByName(m.id), m.id, m.tint); });
    setupBase(kit.base.getObjectByName('base'));
    setupTb(kit.tb.getObjectByName('tb6612'));
    setupEsp(kit.esp.getObjectByName('esp32'));
    const us = kit.modules.find((m) => m.id === 'ultrasonic');
    if (us && item.params?.some((p) => p.key === 'cm')) { // an obstacle to measure, in front of the sensor
      rig = createObstacleRig(kit.group, us.root, us.root.getObjectByName('anchor_ultrasonic_transmitter'), us.root.getObjectByName('anchor_ultrasonic_receiver'));
      if (import.meta.env.DEV) window.__rig = rig; // dev-only: browser checks
      rig.set(store.get('obstacle', 'car')); rig.dist(110); stage.refit(); rig.dist(param('cm')); // camera takes in the whole driving range (to 110 cm)
    }
    const lm = kit.modules.find((m) => m.id === 'ldr');
    if (lm && item.params?.some((p) => p.key === 'light')) { // a desk lamp shining on the LDR
      lamp = createLampRig(kit.group, lm.root.getObjectByName('anchor_ldr_ldr'), kit.base);
      lamp.ldr = lm.root; lamp.port = portName(lm.port);
      if (import.meta.env.DEV) { window.__lamp = lamp; window.__stage = stage; }
      lamp.on(store.get('lampOn', true)); lamp.dist(LAMP_MAX); stage.refit(); lamp.dist(store.get('lampCm', 18));
    }
    const irm = kit.modules.find((m) => m.id === 'ir');
    if (irm && item.params?.some((p) => p.key === 'ircm')) { // a hand (or a card) in front of the IR obstacle module
      irRig = createIrRig(kit.group, irm.root, irm.root.getObjectByName('anchor_ir_ir_led'), irm.root.getObjectByName('anchor_ir_receiver'));
      irRig.ir = irm.root; irRig.set(store.get('irThing', 'hand')); irRig.thr(store.get('irThr', 2.5));
      irRig.dist(IR_MAX); stage.refit(); irRig.dist(param('ircm')); // camera takes in the whole 30 cm
      if (import.meta.env.DEV) window.__ir = irRig;
    }
    stage.setDrag((o) => { // drag the obstacle, the lamp or the IR target along the desk
      const r = rig && o.name === 'obstacle_body' ? rig : lamp && o.name === 'lamp_body' ? lamp : irRig && o.name === 'ir_target' ? irRig : null, at = r?.grab(stage.ray);
      return at ? (ray) => (r === rig ? (obstacleDrive(false), setObstacleCm(at(ray))) : r === irRig ? (irWave(false), setIrCm(at(ray))) : setLampCm(at(ray))) : null;
    });
    startAssembly(kit);
    stage.setCallouts([
      { root: kit.esp, anchor: 'anchor_esp32_module', title: 'ESP32', body: 'Runs your program.' },
      ...kit.modules.map((m) => ({ root: m.root, anchor: MAIN_ANCHOR[m.id], title: moduleName(m), body: `${portName(m.port)} port` })),
      ...(rig ? [{ obj: rig.anchor, anchor: 'obstacle', title: OBSTACLES[rig.st.kind][0], body: `${param('cm')} cm · click to swap`, part: 'obstacle_rig', icon: 'thermo' }] : []),
      ...(lamp ? [{ obj: lamp.anchor, anchor: 'lamp', title: 'Desk lamp', body: '', part: 'lamp_rig', icon: 'bulb' }] : []),
      ...(irRig ? [{ obj: irRig.anchor, anchor: 'ir_target', title: IR_THINGS[irRig.st.kind][0], body: '', part: 'ir_target' }] : []),
      ...(item.callouts || []),
    ]);
    if (lamp) lampUpdate();
    handUpdate();
    if (item.phase === 'circuit') deskFront(kit);
    if (item.phase === 'drive') { setupArena(kit); assembly.skip(); } // the car is built: straight into the arena, program running
    renderPhases();
    if (item.chassis && item.params?.some((p) => p.key === 'drift')) { line = createLineRig(kit.group, kit.chassis); line.set(param('drift')); kitInfo.noDrive = true; } // the tape moves, not the car
  } else {
    const root = await stage.load(modelUrl(item.model));
    if (current !== item) return;
    kitInfo = { esp: root, modules: [] };
    stage.setCallouts(item.callouts || []);
    setupBase(null);
    setupTb(null);
    setupEsp(root.getObjectByName('esp32'));
  }
}

// --- home: kit picker with XP, level and badges ---------------------------------------------------
async function showHome() {
  if (mode === 'build') leaveBuild();
  mode = 'home';
  scrollTo(0, 0);
  buildMod ||= await import('./build.js');
  const checks = Object.values(buildChecks).reduce((n, a) => n + a.length, 0);
  const p = { lessons: allLessons(), done, checks, buildChecks: buildMod.STEPS.reduce((n, s) => n + s.checks.length, 0),
    jrLast: store.get('jrLast'), parts: manifest.filter((m) => !NOT_KIT.includes(m.id)).length,
    scratchDone: scratchIds.filter((x) => done.has(x)).length };
  const shots = renderLauncher($('#home'), { key: 'kits', heading: 'Choose your kit', items: kitItems(p), hud: p }); // console-style kit picker
  fillShots(shots);
}
function showScratch(id) { // #/scratch (module page), #/scratch/ch1 (Chapter 1) or #/scratch/intro (Meet Scratch)
  if (mode === 'build') leaveBuild();
  mode = 'home';
  scrollTo(0, 0);
  const p = { done, store, finish: (x) => { done.add(x); store.set('done', [...done]); push({ addLessons: [x] }); } };
  fillShots(({ ch1: renderChapter1, intro: renderScratchLesson }[id] || renderScratchHome)($('#home'), p) || []);
}
// --- Scratch lessons in the workspace: the cat on a 3D stage, the block editor in the code card ---------------------
let scratchRig = null, scEditor = null;
async function showScratchStage(current) {
  const [{ createScratchStage }, src] = await Promise.all([import('./scratch-stage.js'), mod.getModel(modelUrl('cat'))]);
  if (current !== item) return;
  kitInfo = { esp: null, modules: [] };
  setupEsp(null); setupBase(null); setupTb(null); setupSensor(null);
  const cat = src.clone(true);
  scratchRig = createScratchStage(stage, $('#stage'), cat, scChips);
  stage.setCallouts([{ root: cat, anchor: 'anchor_cat_body', title: 'Cat', body: '' }]);
  scChips(scratchRig.sprite);
  if (import.meta.env.DEV) window.__sc = scratchRig; // dev-only: browser checks
}
/** the sprite's x, y and direction: chips under the editor (where the robotics lessons show pins) and on the cat's label */
function scChips(s) {
  const r = Math.round;
  $('#pins').innerHTML = [['x', r(s.x)], ['y', r(s.y)], ['direction', r(s.dir)]].map(([k, v]) => `<span class="pin">${k}<i>${v}</i></span>`).join('');
  stage.setCalloutText('anchor_cat_body', `x ${r(s.x)} · y ${r(s.y)} · direction ${r(s.dir)}`);
}
function renderScratchCode() {
  $('#params').innerHTML = '';
  $('.src').hidden = true;
  const box = $('#blocks');
  box.hidden = false; box.oninput = null; // drop the robotics editor's handler
  box.innerHTML = '<div class="sc-edit"></div>';
  scEditor = mountEditor(box.firstChild, prog, { ops: item.palette, onChange: () => { edits[item.id] = prog; store.set('blocks', edits); } });
  if (scratchRig) scChips(scratchRig.sprite); else $('#pins').innerHTML = '';
}
function startScratch() { // Run = the green flag: no upload, the script starts at once and ends by itself
  if (!scratchRig) return;
  const me = runner(), hw = { stop: () => { me.stop = true; } };
  let lit = null;
  running = { hw, clear: () => lit?.classList.remove('run') };
  $('#run').classList.add('running');
  $('#stage').classList.add('live');
  runScript(prog, scratchRig.sprite, { stopped: () => me.stop, sleep: me.wait, frame: () => me.wait(1000 / 30),
    step: (b) => { lit?.classList.remove('run'); lit = scEditor.elOf(b); lit?.classList.add('run'); } })
    .catch((e) => console.error(e)).finally(() => { if (running?.hw === hw) stopSim(); });
  if (!done.has(item.id) && !item.chassis) toggleDone(item.id); // a car lesson is done when its Drive step is
}
// --- kit box (#/kit): every part of the box in one 3D scene, a row per group; click one to open it -----------------
const kitLabel = (p) => (kitInsideOn && /^(bottom|top) deck$/i.test(p.label) ? 'Bottom + top deck (2 stacked)' : p.label); // in the box the decks share one pocket
let kitOpened = false, kitInsideOn = false, kitPick = null; // kitPick: the kit part last clicked (double-click opens it)
async function showKitScene(current) { // the workbench, unpacked from the kit box (build.js unbox)
  buildMod ||= await import('./build.js');
  build = await getBuild(null);
  if (current !== item) return;
  kitInfo = { esp: null, modules: [] };
  setupEsp(null); setupBase(null); setupTb(null); setupSensor(null);
  kitInsideOn = false;
  build.unbox(!kitOpened && !matchMedia('(prefers-reduced-motion: reduce)').matches);
  kitOpened = true; // "Open the box again" replays
  build.kitFilter(null);
  if (import.meta.env.DEV) { window.__build = build; window.__stage = stage; } // dev-only: browser checks freeze the unboxing
}
function showDash([, kind, path = '']) { // #/admin… for YugMinds admins, #/teach for teachers and school admins
  if (mode === 'build') leaveBuild();
  mode = 'home';
  scrollTo(0, 0);
  return kind === 'admin' ? renderAdmin($('#home'), path) : renderTeach($('#home'));
}
async function showBook(n) { // n = 0: the shelf of books, else one book's page
  if (mode === 'build') leaveBuild();
  mode = 'home';
  scrollTo(0, 0);
  const p = { done, name: (id) => byId(id)?.name || pretty(id), parts: partsSeen, firstNew };
  fillShots(n ? renderBookHub($('#home'), n, p) : renderLauncher($('#home'), { key: 'books', heading: 'Choose your book', items: bookItems(p), back: '#/', backLabel: 'All kits' }));
}
async function fillShots(shots) { // s.size = [w, h, fit] for big renders (launcher backdrop); model 'base+' = the assembled Robo Coders board
  const model = (m) => (m === 'base+' ? mod.assembledBase({ base: modelUrl('base'), esp32: modelUrl('esp32'), tb6612: modelUrl('tb6612') }) : modelUrl(m));
  for (const s of shots) { const src = await mod.thumbnail(await model(s.model), ...(s.size || [])).catch(() => null); if (src) s.el.style.backgroundImage = `url(${src})`; }
}

// --- build guide tab -------------------------------------------------------------------------------
async function routeBuild(id) {
  if (!buildMod) buildMod = await import('./build.js');
  const project = buildMod.PROJECTS[buildFor] || null, STEPS = buildMod.stepsFor(project), idx = Math.max(0, STEPS.findIndex((s) => s.id === id));
  store.set('buildStep', STEPS[idx].id);
  const entering = mode !== 'build';
  autoPlay = !matchMedia('(prefers-reduced-motion: reduce)').matches; // every step starts playing, so the build carries on from it until you pause
  clearTimeout(autoT); autoT = 0;
  mode = 'build';
  item = { build: true, id: STEPS[idx].id };
  stage.setHoverLift(false); // the build guide animates the parts itself
  document.querySelectorAll('[data-nav]').forEach((b) => b.setAttribute('aria-current', String(b.dataset.nav === (buildFor ? 'lessons' : 'build'))));
  ['#build-panel', '#build-head', '#build-tools'].forEach((s) => { $(s).hidden = false; });
  $('.info').hidden = true; $('#code-card').hidden = true; $('#schematic').hidden = true;
  const b = await getBuild(project);
  if (mode !== 'build' || (buildMod.PROJECTS[buildFor] || null) !== project) return; // left the guide (or switched project) while it was loading
  const switched = build !== b; build = b;
  build.st.onUpdate = buildTick;
  if (import.meta.env.DEV) window.__build = build; // dev-only: lets the browser checks pause the timeline at exact moments
  if (entering || switched) { build.st.step = idx; build.show(); } else build.setStep(idx);
  wasPlaying = build.st.playing; // a new step starts playing: its end will move on
  buildDetail = null; build.select(null); renderBuild(); renderStrip(); renderPhases();
}
function leaveBuild() {
  if (buildDetail) { buildDetail = null; build.select(null); }
  stage.untick('build'); stage.setPills(false); stage.focus(null);
  ['#build-panel', '#build-head', '#build-tools'].forEach((s) => { $(s).hidden = true; });
  $('.info').hidden = false;
}
const checksOf = (s) => buildChecks[s.key || s.id] || [];
let buildDetail = null; // part shown in the panel (roverkit-style detail page)
const EYE = '<svg class="eye" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
function renderDetail(p) {
  const STEPS = build.steps, i = build.st.step, S = p.step != null ? STEPS[p.step] : null;
  const rows = [...(p.specs || []), ...(p.features || []).map((f) => ['', f])];
  $('#build-panel').innerHTML = `<div class="bp-detail"><div class="bd-top"><button class="bd-back">← Back to step ${i + 1} · ${esc(STEPS[i].label)}</button><kbd>Esc</kbd></div>
    <small class="bd-cat">${esc(p.cat || 'Kit part')}</small><h2>${esc(p.label)}</h2><p>${esc(p.info || '')}</p>
    ${rows.length ? `<h4>Specs</h4><table class="specs">${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>` : ''}</div>
    <footer class="bp-foot">${S ? `<small>Fitted in step ${p.step + 1} · ${esc(S.title)}</small>${p.step !== i ? `<button class="next" data-go="${S.id}">Go to step ${p.step + 1} →</button>` : ''}`
      : '<small>Kit part for the lessons — not mounted on the robot.</small>'}</footer>`;
  const bp = $('#build-panel');
  bp.querySelector('.bd-back').addEventListener('click', closeDetail);
  bp.querySelector('[data-go]')?.addEventListener('click', (e) => { location.hash = bHash(e.target.dataset.go); });
}
function closeDetail() { buildDetail = null; build.select(null); stage.focus(null); renderBuild(); }
function renderBuild() {
  const STEPS = build.steps, i = build.st.step, s = STEPS[i], ticks = checksOf(s);
  $('#build-head span').textContent = `Step ${i + 1} · ${s.title}`;
  if (buildDetail) return renderDetail(buildDetail);
  const need = (s.need || []).map(([n, label, part]) => `<li data-part="${part || ''}"><i class="qty">${n}×</i>${esc(label)}</li>`).join('');
  $('#build-panel').innerHTML = `<header class="bp-head"><i class="num">${String(i + 1).padStart(2, '0')}</i><div><small>${esc(s.kicker)} · Step ${i + 1} of ${STEPS.length}</small><h2>${esc(s.title)}</h2></div></header>
    ${buildFor ? `<nav class="bp-steps" aria-label="Build steps">${STEPS.map((x, k) => { const ok = checksOf(x).length === x.checks.length; return `<a href="${bHash(x.id)}" class="${k === i ? 'now' : ok ? 'done' : ''}"${k === i ? ' aria-current="step"' : ''}><i>${ok && k !== i ? '✓' : k + 1}</i>${esc(x.label)}</a>`; }).join('')}</nav>` : ''}
    <div class="bp-body"><p>${esc(s.intro)}</p>
    ${s.id === 'code' ? '<div class="upload"><b>Uploading sketch</b><div class="bar"><i id="upload-fill"></i></div><span id="upload-pct">0%</span></div>' : ''}
    ${s.drive ? `<div class="drive">
      <div class="dpad"><button data-d="f" aria-label="Forward">▲</button><button data-d="l" aria-label="Left">◀</button><button data-d="s" aria-label="Stop">■</button><button data-d="r" aria-label="Right">▶</button><button data-d="b" aria-label="Back">▼</button></div>
      <div class="dctl"><label>Speed <input type="range" min="20" max="100" value="${Math.round(build.drv.speed * 100)}" id="drv-speed"></label>
        <div class="seg"><button data-mode="manual" aria-pressed="true">Manual</button><button data-mode="auto">Auto</button></div>
        <button class="chase" id="drv-chase" aria-pressed="false">Chase view (C)</button>
        <div class="tele" id="drv-tele"></div></div></div>` : ''}
    ${need ? `<h4>You’ll need</h4><ul class="need">${need}</ul>` : ''}
    <h4>${i === 0 ? 'Bill of materials' : 'Do this'} <em>${ticks.length} / ${s.checks.length}</em></h4>
    <ol class="ticks${s.subs ? ' subs' : ''}">${s.checks.map((c, k) => s.subs?.[k]
      ? `<li data-sub="${k}"><input type="checkbox" data-k="${k}"${ticks.includes(k) ? ' checked' : ''} aria-label="Done"><button class="sub" title="Play this part of the step"><i class="n">${k + 1}</i><span>${esc(c)}</span><svg class="play" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></button></li>`
      : `<li${s.bom?.[k] ? ` data-bom="${k}"` : ''}><label><input type="checkbox" data-k="${k}"${ticks.includes(k) ? ' checked' : ''}><span>${esc(c)}</span>${s.bom?.[k] ? EYE : ''}</label></li>`).join('')}</ol></div>
    <footer class="bp-foot"><button data-step="-1"${i === 0 ? ' disabled' : ''}>← Back</button><small>← → steps · Space play · E explode</small>${buildFor === 'l3-chassis' && i === STEPS.length - 1 ? `<button class="next" data-finish>Next lesson: ${esc(lessonList()[lessonList().findIndex((l) => l.id === buildFor) + 1]?.cardTitle || 'the book')} →</button>`
      : buildFor && i === STEPS.length - 1 ? '<button class="next" data-ph="drive">Next: drive it in the arena →</button>'
      : `<button class="next" data-step="1"${i === STEPS.length - 1 ? ' disabled' : ''}>${i < STEPS.length - 1 ? `Next: ${esc(STEPS[i + 1].label)} →` : 'Done'}</button>`}</footer>`;
  const bp = $('#build-panel');
  bp.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => stepBuild(+b.dataset.step)));
  bp.querySelector('[data-ph]')?.addEventListener('click', () => flowNext('drive'));
  bp.querySelector('[data-finish]')?.addEventListener('click', () => flowNext('lesson'));
  bp.querySelectorAll('input[data-k]').forEach((c) => c.addEventListener('change', () => {
    const set = new Set(checksOf(s)); c.checked ? set.add(+c.dataset.k) : set.delete(+c.dataset.k);
    buildChecks[s.key || s.id] = [...set]; store.set('buildChecks', buildChecks);
    bp.querySelector('h4 em').textContent = `${set.size} / ${s.checks.length}`; renderStrip();
  }));
  bp.querySelectorAll('.need li[data-part]').forEach((li) => { // hover isolates the part (everything else ghosted), click opens its page
    const p = build.partById[li.dataset.part];
    if (!p) return;
    const info = build.infoFor(`build:${p.id}`);
    li.addEventListener('mouseenter', () => build.isolate(info.ids));
    li.addEventListener('mouseleave', () => build.isolate(null));
    li.addEventListener('click', () => focusBuildPart(info));
  });
  bp.querySelectorAll('[data-sub] .sub').forEach((b) => b.addEventListener('click', () => build.seek(+b.parentElement.dataset.sub)));
  subShown = null;
  bp.querySelectorAll('[data-bom]').forEach((li) => {
    li.addEventListener('mouseenter', () => build.isolate(s.bom[li.dataset.bom]));
    li.addEventListener('mouseleave', () => build.isolate(null));
  });
  if (s.drive) {
    const dirs = { f: [1, 1], b: [-1, -1], l: [-1, 1], r: [1, -1], s: [0, 0] };
    bp.querySelectorAll('[data-d]').forEach((b) => {
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); holdDrive(b.dataset.d, true, dirs); });
      b.addEventListener('pointerup', () => holdDrive(b.dataset.d, false, dirs));
      b.addEventListener('pointerleave', () => holdDrive(b.dataset.d, false, dirs));
    });
    $('#drv-speed').addEventListener('input', (e) => { build.drv.speed = e.target.value / 100; });
    bp.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
      build.drv.mode = b.dataset.mode; build.drv.L = build.drv.R = 0;
      bp.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    }));
    $('#drv-chase').addEventListener('click', toggleChase);
  }
}
const held = [];
function holdDrive(d, down, dirs = { f: [1, 1], b: [-1, -1], l: [-1, 1], r: [1, -1], s: [0, 0] }) { // latest held direction wins
  const i = held.indexOf(d);
  if (i >= 0) held.splice(i, 1);
  if (down && d !== 's') held.push(d);
  if (d === 's' && down) held.length = 0;
  if (mode !== 'build') return arenaDrive(...dirs[held.at(-1) || 's']);
  if (build.drv.mode === 'auto' && down) { build.drv.mode = 'manual'; document.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.mode === 'manual'))); }
  [build.drv.L, build.drv.R] = dirs[held.at(-1) || 's'];
}
function toggleChase() { build.drv.chase = !build.drv.chase; $('#drv-chase')?.setAttribute('aria-pressed', String(build.drv.chase)); }
function stepBuild(d) { const S = build.steps, i = build.st.step + d; if (i >= 0 && i < S.length) location.hash = bHash(S[i].id); }
function focusBuildPart(p) { // p: build.infoFor() result → detail page in the panel, rings + fly on the stage
  buildDetail = p; renderDetail(p);
  build.isolate(null); build.select(p.ids);
  stage.focus(p.obj, { title: p.label, html: '' });
  $('#focus').hidden = true; // the panel carries the text
}
let subShown = null;
// --- auto-play: while Play shows pause, each finished step moves on to the next (a short pause first) until the build's last step. Only Pause stops it ---
let autoPlay = true, autoT = 0, wasPlaying = false;
function stopAuto() { autoPlay = false; clearTimeout(autoT); autoT = 0; }
function togglePlay() { const on = build.play(); autoPlay = on; wasPlaying = on; if (!on) stopAuto(); }
function autoNext(st) {
  const S = build.steps, i = st.step, done = wasPlaying && !st.playing;
  wasPlaying = st.playing;
  if (!autoPlay || autoT || !(done || (i === 0 && !st.playing)) || i >= S.length - 1 || S[i + 1].drive) return; // the parts list plays at once; stop before driving
  const go = () => { // a part's page open: wait until it is closed
    if (!autoPlay || mode !== 'build' || build.st.step !== i) { autoT = 0; return; }
    if (buildDetail) { autoT = setTimeout(go, 1500); return; }
    autoT = 0; stepBuild(1);
  };
  autoT = setTimeout(go, i === 0 ? 4000 : 1500); // a moment to read the parts list / see the finished step
}
function buildTick(st, drv) {
  autoNext(st);
  const k = build.subNow();
  if (k !== subShown) { // the line of "Do this" that is playing now
    subShown = k;
    document.querySelectorAll('#build-panel [data-sub]').forEach((li) => li.classList.toggle('now', +li.dataset.sub === k));
  }
  const play = $('[data-b="play"]');
  if (play) play.innerHTML = st.playing || autoT ? '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  const f = document.getElementById('upload-fill');
  if (f) { f.style.width = `${Math.round(st.upload * 100)}%`; $('#upload-pct').textContent = st.upload >= 1 ? 'Done ✓' : `${Math.round(st.upload * 100)}%`; }
  const t = document.getElementById('drv-tele');
  if (t) { const w = (v) => (v > 0 ? 'forward' : v < 0 ? 'back' : 'stop'); t.textContent = `Left: ${w(drv.L)} · Right: ${w(drv.R)} · Distance ahead: ${drv.dist.toFixed(0)} cm`; }
}

function partCallouts(m) {
  const only = SENSORS[m.id]?.callouts;
  return m.anchors.filter((a) => !(a in (m.pins || {})) && (!only || only.includes(a.replace(`anchor_${m.id}_`, ''))) && !/_(bolt|nut|bracket|motor_mount)_|^anchor_servo_lead_/.test(a)).map((a) => { // hardware is labelled in the build guide
    const key = a.replace(`anchor_${m.id}_`, '');
    const named = m.id === 'base' ? (BASE_PART[key] || PORT_DOC[key])?.[0] : m.id === 'esp32' ? PART_INFO[key]?.[0] : SENSORS[m.id] ? SENSORS[m.id].part[sensorKey(m.id, `${m.id}_${key}`)]?.[0] : null;
    return { anchor: a, title: named || PART_LABELS[key] || pretty(key), body: '' };
  });
}

function onPart(name) {
  if (!name) return;
  if (item?.scratch) return stage.showTip('<b>Cat sprite</b><small>press Run to start its script</small>');
  if (item?.kitbox) { // click: the part's name where you clicked; double-click opens its page
    const p = build?.infoFor(name); kitPick = p?.part || null;
    stage.showTip(p ? `<b>${esc(kitLabel(p))}</b><small>${p.part ? `${BADGE[partLevel(p.part)]} · double-click to open` : 'in the kit'}</small>` : '');
    return;
  }
  if (mode === 'build') { const p = build.infoFor(name); if (p) focusBuildPart(p); return; }
  if (espNode && name.startsWith('esp32_') && focusEsp(name.slice(6))) return;
  if (baseNode && name.startsWith('base_') && focusBase(name.slice(5))) return;
  if (tbNode && name.startsWith('tb6612_') && focusTb(name.slice(7))) return;
  if (rig && /^obstacle/.test(name)) return focusObstacle();
  if (lamp && /^lamp/.test(name)) return focusLamp();
  if (irRig && name === 'ir_target') return focusIr();
  if (sensorNode && name.startsWith(`${sensorId}_`) && focusSensor(name)) return;
  const key = name.replace(/^[a-z0-9]+_/, '').replace(/_\d+$/, '');
  stage.showTip(`<b>${esc(PART_LABELS[key] || pretty(key))}</b><small>${esc(name)}</small>`);
}

// --- the ESP32 as a real board: artwork, power, buttons, USB, pins ----------------------------
const powered = () => ((item.kit?.length || item.chassis) ? basePower : usbPlugged); // kits run from the battery through SW1
function setupEsp(node) {
  espNode = node || null;
  pinGlow.clear();
  toggleSchem(showSchem);
  if (!espNode) return;
  stage.decals(espNode, ESP32_DECALS);
  stage.hitAreas(espNode, /^esp32_pin_/);
  if (!(item.kit?.length || item.chassis)) stage.usbCable(espNode, usbPlugged);
  powerLed();
}
const powerLed = () => espNode && stage.glow(espNode, 'esp32_led_power', powered(), 0xff3020, 'anchor_esp32_led_power', 6);
function toggleSchem(on) {
  showSchem = on;
  store.set('schematic', on);
  const esp = item.part ? item.id === 'esp32' : item.model === 'esp32' && !(item.kit?.length || item.chassis);
  const base = item.part ? item.id === 'base' : !!(item.kit?.length || item.chassis);
  const gas = item.part && SENSORS[item.id] && !['oled', 'ultrasonic', 'servo'].includes(item.id); // schematic images in public/schematics (none sent for these)
  $('#schematic .title').textContent = esp || gas ? 'Schematic' : 'Port map';
  $('#schematic .body').innerHTML = esp ? ESP32_SCHEMATIC : gas ? `<img class="schem-img" src="/schematics/${item.id}.png" alt="${esc(item.name)} schematic: sensor, LM393 comparator, R6 trimmer, S and P LEDs, 3-pin connector">` : base ? portMap(PORTS, new Set((item.kit || []).map((m) => m.port))) : '';
  $('#schematic').hidden = !(on && (esp || base || gas));
  stage.layoutTags?.();
  $('[data-act="schematic"]').classList.toggle('on', on);
}
const tagChips = (tags) => tags.map((t) => `<i class="chip ${t}">${t === 'adc1' || t === 'adc2' ? t.toUpperCase() : t}</i>`).join('');
function hoverLabel(name) {
  if (item?.scratch) return name.startsWith('cat_') ? '<b>Cat sprite</b><small>direction 90 = facing right</small>' : null;
  if (mode === 'build') { const p = build?.infoFor(name); return p ? `<b>${esc(p.label)}</b><small>${p.step != null ? `step ${p.step + 1}` : 'kit'}</small>` : null; }
  if (item?.kitbox) { const p = build?.infoFor(name); return p ? `<b>${esc(kitLabel(p))}</b><small>${p.part ? `${BADGE[partLevel(p.part)]} · double-click to open` : 'kit'}</small>` : null; }
  const k = name.replace(/^esp32_(pin_)?/, '').replace(/_cap$/, '');
  if (name.startsWith('esp32_pin_') && PIN_INFO[k]) return `<b>${PIN_INFO[k][0]}</b><small>${PIN_INFO[k][1].join(' · ')}</small>`;
  if (name.startsWith('esp32_') && PART_INFO[k.replace(/_spacer$/, '')]) return `<b>${PART_INFO[k.replace(/_spacer$/, '')][0]}</b>`;
  if (/^button_(cap|body)$/.test(name)) return '<b>Push button</b><small>press and hold</small>';
  if (name.startsWith('tb6612_')) { const k = name.slice(7).replace(/^pin_/, ''); if (TB_PIN[k]) return `<b>${TB_PIN[k][0]}</b><small>${TB_PIN[k][1]}${TB_GPIO[k] ? ` · D${TB_GPIO[k]}` : ''}</small>`; if (/^chip/.test(k)) return '<b>TB6612FNG</b><small>dual H-bridge</small>'; }
  const sid = Object.keys(SENSORS).find((id) => name.startsWith(`${id}_`));
  if (SENSORS[sid]) { const g = SENSORS[sid].part[sensorKey(sid, name)]; return g && `<b>${esc(g[0])}</b>`; }
  if (name.startsWith('base_')) { const b = baseInfo(name.slice(5)); return b && `<b>${esc(b.title)}</b>${b.sub ? `<small>${esc(b.sub)}</small>` : ''}`; }
  return null;
}
function focusEsp(key) {
  key = key.replace(/^pin_/, '').replace(/_cap$/, '').replace(/_spacer$/, '');
  key = { pins_left: 'header_l', pins_right: 'header_r', module_shield: 'module', module_pads: 'module', usb_port: 'usb', passive_ends: 'passives' }[key] || key;
  const get = (n) => espNode.getObjectByName(`esp32_${n}`), anchor = (n) => espNode.getObjectByName(`anchor_esp32_${n}`);
  if (PIN_INFO[key]) {
    const [label, tags, note] = PIN_INFO[key], gpio = PIN_GPIO[key];
    const ports = Object.entries(PORTS).filter(([, p]) => Object.values(p.pins).includes(gpio)).map(([n]) => n.toUpperCase());
    const live = running?.hw.pins.get(gpio)?.v;
    stage.focus(get(`pin_${key}`), { title: label, anchor: anchor(key), html: `<div class="chips-row">${tagChips(tags)}</div><p>${esc(note)}</p>` +
      (tags.includes('adc2') ? `<p class="muted small">${esc(TAG_NOTE.adc2)}</p>` : '') +
      (ports.length ? `<p class="small">Kit port: <b>${ports.join(', ')}</b></p>` : '') + (gpio != null && running ? `<p class="small">Now: <b>${live ? 'HIGH' : 'LOW'}</b></p>` : '') });
    return true;
  }
  if (!PART_INFO[key]) return false;
  if (key === 'usb') toggleUsb();
  const side = { header_l: -1, header_r: 1 }[key];
  const target = side ? Object.keys(PIN_INFO).map((p) => get(`pin_${p}`)).filter((o) => o && Math.sign(o.position.x) === side)
    : key === 'module' ? [get('module'), get('module_shield')] : [get(key)].filter(Boolean);
  const [title, body] = PART_INFO[key];
  stage.focus(target, { title, anchor: anchor(side ? (side < 0 ? 'pins_left' : 'pins_right') : key) || target[0], html: `<p>${esc(body)}</p>` +
    (key === 'usb' ? `<p class="small">Cable: <b>${usbPlugged ? 'plugged in' : 'unplugged'}</b></p>` : '') });
  return true;
}
// --- the base board: silkscreen, power switch, slide switches, jumper, ports ------------------------
function setupBase(node) {
  baseNode = node || null;
  if (!baseNode) return;
  LOGO.decode().catch(() => {}).then(() => stage.decals(node, BASE_DECALS)); // the board prints the YUGMINDS logo
  stage.move(baseNode, 'base_sw1_cap', [0, basePower ? -1.2 : 0, 0]);
  Object.entries(flipped).forEach(([n, on]) => stage.move(baseNode, `base_${n}_knob`, [on ? 3 : 0, 0, 0]));
}
// mesh/anchor suffix → { title, sub, html, kind, key }
function baseInfo(k) {
  k = k.replace(/^(u[12]|tb6612_socket_[lr])_hole_\d+$/, '$1').replace(/_(cap|knob|jumper|pins|bore)$/, '');
  const port = Object.keys(PORT_DOC).find((p) => k === p || k.startsWith(`${p}_pin`));
  if (port) {
    const [title, kind, desc] = PORT_DOC[port], n = +(k.match(/_pin_?(\d)$/)?.[1] || 0);
    const role = n && Object.keys(PORTS[port]?.pins || {}).length === 1 ? PORT_PIN_ROLE[n] : '';
    return { key: port, title, sub: n ? `pin ${n}${role ? ` · ${role}` : ''}` : kind, desc, port };
  }
  const part = k.replace(/_[lr]$/, '').replace(/^hole_\d+$/, 'hole').replace(/^smd_\d+$/, 'smd').replace(/^power_module.*$/, 'power_module');
  if (BASE_PART[part]) return { key: part, title: BASE_PART[part][0], desc: BASE_PART[part][1] };
  return null;
}
function focusBase(k) {
  const info = baseInfo(k);
  if (!info) return false;
  const get = (n) => baseNode.getObjectByName(`base_${n}`);
  let extra = '';
  if (info.key === 'sw1') {
    basePower = !basePower;
    stage.move(baseNode, 'base_sw1_cap', [0, basePower ? -1.2 : 0, 0]);
    if (!basePower) stopSim();
    powerLed();
    if (!item.part) serialLine(basePower ? 'SW1 on — the kit has power.' : 'SW1 off — the kit is off.', basePower ? 'sys' : 'warn');
    extra = `<p class="small">Power: <b>${basePower ? 'ON' : 'OFF'}</b></p>`;
  } else if (flipped[info.key] !== undefined) {
    flipped[info.key] = !flipped[info.key];
    stage.move(baseNode, `base_${info.key}_knob`, [flipped[info.key] ? 3 : 0, 0, 0]);
    const v = info.key === 'switch_motor_v' ? (flipped[info.key] ? '5 V rail' : '7 V battery') : (flipped[info.key] ? '3.3 V' : '5 V');
    extra = `<p class="small">Set to: <b>${v}</b></p>`;
  }
  if (info.port) {
    const gp = Object.entries(PORTS[info.port]?.pins || {}).map(([n, g]) => `pin ${n} → <b>IO${g}</b>${running ? ` (${running.hw.pins.get(g)?.v ? 'HIGH' : 'LOW'})` : ''}`);
    const mods = allLessons().filter((l) => l.kit.some((m) => m.port === info.port)).map((l) => `Level ${l.level} · ${l.cardTitle}`);
    extra = (gp.length ? `<p class="small">${gp.join(' · ')}</p>` : '') + (Object.keys(PORTS[info.port]?.pins || {}).length === 1 ? '<p class="small muted">Pins: 1 VCC · 2 GND · 3 signal</p>' : '') +
      (mods.length ? `<p class="small">Used in: ${mods.map(esc).join(', ')}</p>` : '');
  }
  const target = info.port ? [get(info.port)].filter(Boolean)
    : { esp32_socket: ['u2', 'u1'], tb6612_socket: ['tb6612_socket_l', 'tb6612_socket_r'], power_module: ['power_module'], sw1: ['sw1', 'sw1_cap'],
      switch_motor_v: ['switch_motor_v'], switch_i2c_v: ['switch_i2c_v'], u1: ['u1'], u2: ['u2'], smd: ['smd_1', 'smd_2', 'smd_3'], pcb: ['pcb'], hole: ['hole_1'] }[info.key]?.map(get).filter(Boolean);
  if (!target?.length) return false;
  stage.focus(target, { title: info.title, html: `<p>${esc(info.desc)}</p>${extra}`, anchor: baseNode.getObjectByName(`anchor_base_${info.key}`) || undefined });
  return true;
}

// --- TB6612: pin cards, logic playground on its own page, live pins in kits ------------------------
function setupTb(node) {
  tbNode = node || null;
  if (!tbNode) return;
  stage.decals(tbNode, TB_DECALS);
  stage.hitAreas(tbNode, /^tb6612_pin_/);
}
function tbCard() {
  const v = (k) => (running ? running.hw.pins.get(TB_GPIO[k])?.v || 0 : tbLogic[k]);
  const a = bridge(v('ain1'), v('ain2'), tbLogic.stby), b = bridge(v('bin1'), v('bin2'), tbLogic.stby);
  const hl = (k) => `<b class="${v(k) ? 'hi' : ''}">${v(k) ? 'H' : 'L'}</b>`;
  return `<table class="truth"><tr><th></th><th>IN1</th><th>IN2</th><th>Motor</th></tr>` +
    `<tr><td>A · left</td><td>${hl('ain1')}</td><td>${hl('ain2')}</td><td>${bridgeText(a)}</td></tr>` +
    `<tr><td>B · right</td><td>${hl('bin1')}</td><td>${hl('bin2')}</td><td>${bridgeText(b)}</td></tr></table>` +
    (item.part ? '<p class="small muted">Click AIN1, AIN2, BIN1, BIN2 or STBY on the board to flip them.</p>' : '');
}
function focusTb(k) {
  k = k.replace(/^pin_/, '');
  const get = (n) => tbNode.getObjectByName(`tb6612_${n}`);
  if (/^chip/.test(k)) { stage.focus([get('chip')], { title: 'TB6612FNG', html: `<p>Two H-bridges: each one can push current through a motor either way, or stop it.</p>${tbCard()}` }); return true; }
  if (!TB_PIN[k]) return false;
  if (item.part && (k in tbLogic)) tbLogic[k] ^= 1;
  const [label, group, desc] = TB_PIN[k];
  const state = item.part && k in tbLogic ? `<p class="small">${label} is <b>${tbLogic[k] ? 'HIGH' : 'LOW'}</b></p>` : '';
  stage.focus(get(`pin_${k}`), { title: label, anchor: tbNode.getObjectByName(`anchor_tb6612_${k}`), html: `<div class="chips-row"><i class="chip ${group === 'direction' ? 'digital' : group === 'motor' ? 'dac' : group === 'power' ? 'power' : 'uart'}">${group}</i></div><p>${esc(desc)}</p>${state}${['ain1', 'ain2', 'bin1', 'bin2', 'stby', 'pwma', 'pwmb'].includes(k) || /o\d/.test(k) ? tbCard() : ''}` });
  return true;
}

// --- comparator sensor pages (gas, mic): sensor slider and R6 trimmer drive the signal, DO and the S LED ---
let sensorNode = null, sensorId = null, warmT = null, micStream = null, clapRaf = 0;
const sense = { level: 0, thr: 2.5, warm: true };
function setupSensor(node, id) {
  sensorNode = node || null; sensorId = id;
  clearTimeout(warmT); stopMic(); buzzStop(); jrBeep(false); Object.assign(jr, { ip: [0, 0, 0, 0], power: true, hold: [0, 0, 0, 0], level: {}, kit: [] }); clearInterval(sv.sweep); Object.assign(sv, { deg: 90, sweep: 0 }); clearInterval(sonar.auto); clearTimeout(sonar.t); Object.assign(sonar, { cm: 50, auto: 0, last: null }); Object.assign(btn, { down: false, count: 0, trace: [] }); clearInterval(dht.breath); clearInterval(ledm.blink); Object.assign(ledm, { on: 0, duty: 255, blink: 0 }); clearTimeout(tl.timer); Object.assign(tl, { on: { red: 0, yellow: 0, green: 0 }, cycle: false });
  if (!sensorNode) return;
  const s = SENSORS[id];
  sensorDecals(sensorNode, id, ledm.tint);
  stage.hitAreas(sensorNode, new RegExp(`^${id}_xh_pin_`));
  sense.level = s.start ?? 0; sense.white = true; sense.warm = !s.warm;
  if (s.screen) stage.oled(sensorNode, oledMsg.text, oledMsg.invert);
  Object.assign(ttp, { q: 0, last: false, tog: 0, ahlb: 0 }); touching = false;
  stage.glow(sensorNode, `${id}_led_power`, true, 0xffc21a, `anchor_${id}_led_power`, 6);
  (s.glow || []).forEach(([n, c, a, size]) => stage.glow(sensorNode, `${id}_${n}`, true, c, `anchor_${id}_${a}`, size));
  if (s.warm) warmT = setTimeout(() => { sense.warm = true; sensorUpdate(); }, s.warm);
  sensorUpdate();
}
function sensorUpdate() {
  if (!sensorNode) return;
  if (SENSORS[sensorId].touch) return touchUpdate();
  if (SENSORS[sensorId].screen) return;
  if (SENSORS[sensorId].lights) return lightsUpdate();
  if (SENSORS[sensorId].buzz) return buzzUpdate();
  if (SENSORS[sensorId].led) return ledUpdate();
  if (SENSORS[sensorId].dht) return dhtUpdate();
  if (SENSORS[sensorId].btn) return btnUpdate();
  if (SENSORS[sensorId].sonar) return sonarUpdate();
  if (SENSORS[sensorId].servo) return servoUpdate();
  if (SENSORS[sensorId].jr) return jrUpdate();
  const s = SENSORS[sensorId], v = s.read(sense.level, sense), hit = sense.warm && (s.low ? v < sense.thr : v > sense.thr);
  if (s.wet) stage.wet(sensorNode, s.wet[0], sense.level, s.surface ? [...s.wet[1], sense.white] : s.wet[1]);
  stage.glow(sensorNode, `${sensorId}_led_signal`, hit, 0xffc21a, `anchor_${sensorId}_led_signal`, 6);
  const screw = sensorNode.getObjectByName(`${sensorId}_pot_screw`);
  if (screw) screw.rotation.y = -(sense.thr / 5 - 0.5) * 1.5 * Math.PI;   // 270° trimmer travel
  const box = document.querySelector('.gasbox');
  if (!box) return;
  box.querySelector('.ao i').style.width = `${(v / 5) * 100}%`;
  box.querySelector('.ao b').style.left = `${(sense.thr / 5) * 100}%`;
  box.querySelector('[data-k="level"]').value = sense.level;
  box.querySelector('[data-o="level"]').textContent = `${s.unit ? sense.level : Math.round(sense.level)} ${s.unit || '%'}`;
  const sf = box.querySelector('[data-a="surface"]'); if (sf) sf.textContent = sense.white ? '⬜ White surface' : '⬛ Black surface';
  box.querySelector('[data-o="thr"]').textContent = `${sense.thr.toFixed(1)} V`;
  box.querySelector('.read').innerHTML = sense.warm
    ? `${s.signal} <b>${v.toFixed(2)} V</b> · DO <b class="${hit ? 'hi' : ''}">${hit ? 'LOW' : 'HIGH'}</b> — ${s.say(hit)}`
    : 'Heater warming up… readings are not ready yet.';
}
function sensorCard() {
  const s = SENSORS[sensorId];
  const [lo, hi, step] = s.range || [0, 100, 1];
  return `<div class="gasbox"><label>${esc(s.input)} <input type="range" min="${lo}" max="${hi}" step="${step}" value="${sense.level}" data-k="level"><output data-o="level"></output></label>` +
    `<label>R6 threshold <input type="range" min="0.5" max="4.5" step="0.1" value="${sense.thr}" data-k="thr"><output data-o="thr"></output></label>` +
    `<div class="ao" title="${esc(s.signal)} voltage, the marker is the R6 threshold"><i></i><b></b></div><p class="read small"></p>` +
    (s.surface ? '<div class="row-btns"><button type="button" data-a="surface"></button></div><p class="small muted">The card in front of the sensor is the obstacle; its distance is drawn shorter than real.</p>' : '') +
    (s.clap ? `<div class="row-btns"><button type="button" data-a="clap">👏 Clap</button><button type="button" data-a="mic">${micStream ? 'Stop my microphone' : '🎤 Use my microphone'}</button></div>` : '') + '</div>';
}
function clap() {
  cancelAnimationFrame(clapRaf);
  sense.level = 95;
  const fall = () => { sense.level = sense.level > 3 ? sense.level * 0.86 : 0; sensorUpdate(); if (sense.level) clapRaf = requestAnimationFrame(fall); };
  fall();
}
function stopMic() { micStream?.getTracks().forEach((t) => t.stop()); micStream = null; }
async function useMic(btn) {
  if (micStream) { stopMic(); btn.textContent = '🎤 Use my microphone'; sense.level = 0; return sensorUpdate(); }
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch { btn.textContent = 'Microphone not allowed'; return; }
  btn.textContent = 'Stop my microphone';
  const ctx = new AudioContext(), an = ctx.createAnalyser(), buf = new Float32Array(an.fftSize);
  ctx.createMediaStreamSource(micStream).connect(an);
  const loop = () => {
    if (!micStream || sensorId !== 'mic' || !sensorNode) { stopMic(); ctx.close(); return; }
    an.getFloatTimeDomainData(buf);
    let peak = 0; for (const x of buf) peak = Math.max(peak, Math.abs(x));
    sense.level = Math.round(Math.min(100, peak * 160)); // ponytail: fixed gain; a calibration knob if laptop mics differ a lot
    sensorUpdate();
    requestAnimationFrame(loop);
  };
  loop();
}
function focusSensor(name) {
  const s = SENSORS[sensorId], k = sensorKey(sensorId, name), info = s.part[k];
  if (!info) return false;
  if (s.touch) return focusTouch(name, k, info);
  if (s.screen) return focusOled(name, k, info);
  if (s.lights) return focusTraffic(name, k, info);
  if (s.buzz) return focusBuzzer(name, k, info);
  if (s.led) return focusLed(name, k, info);
  if (s.dht) return focusDht(name, k, info);
  if (s.btn) return focusBtn(name, k, info);
  if (s.sonar) return focusSonar(name, k, info);
  if (s.servo) return focusServo(name, k, info);
  if (s.jr) return focusJr(name, k, info);
  if (k === 'pot') sense.thr = sense.thr >= 4.5 ? 0.5 : sense.thr + 0.5; // each click turns R6 a step
  const get = (n) => sensorNode.getObjectByName(`${sensorId}_${n}`);
  const target = s.focus[k] ? s.focus[k].map(get).filter(Boolean) : sensorNode.getObjectByName(name);
  stage.focus(target, { title: info[0], anchor: sensorNode.getObjectByName(`anchor_${sensorId}_${s.anchor[k] || k}`), html: `<p>${esc(info[1])}</p>${item.part ? sensorCard() : ''}` });
  document.querySelectorAll('.gasbox input').forEach((inp) => inp.addEventListener('input', () => { sense[inp.dataset.k] = +inp.value; sensorUpdate(); }));
  document.querySelector('.gasbox [data-a="clap"]')?.addEventListener('click', clap);
  document.querySelector('.gasbox [data-a="surface"]')?.addEventListener('click', () => { sense.white = !sense.white; sensorUpdate(); });
  document.querySelector('.gasbox [data-a="mic"]')?.addEventListener('click', (e) => useMic(e.currentTarget));
  sensorUpdate();
  return true;
}

// --- Jr. Explorer kit: no code. Inputs on IP1..IP4 drive OP1..OP4, LED1..LED4 and the motor sockets (jrBoard). On the board page
// the four inputs are switches; in a lesson they come from the plugged-in modules (button, touch, sensors) --------------------------
const jr = { ip: [0, 0, 0, 0], power: true, hold: [0, 0, 0, 0], level: {}, kit: [] };
const MOTOR_TXT = { 1: 'forward ⟳', '-1': 'backward ⟲', 0: 'stopped', brake: 'braking (both sides on)' };
const SENSE_UI = { ldr: ['Light', 'dark', 'bright'], ir: ['Hand closeness', 'far', 'near'], mic: ['Sound', 'quiet', 'loud'], soil: ['Soil wetness', 'dry', 'wet'],
  rain: ['Rain on the plate', 'dry', 'wet'], gas: ['Gas / smoke', 'clean', 'smoky'] };
const jrMods = () => (item.part ? [] : jr.kit);
const onPort = (port) => jrMods().find((m) => m.port === port);           // the loaded 3D module (effects)
const inLesson = (port) => (item.part ? null : item.kit?.find((m) => m.port === port)); // the lesson's parts list (controls, logic): known before the 3D loads
/** IP signals: switches on the board page; module states in a lesson (sensors: LOW when they detect, i.e. level > 50) */
function jrInputs() {
  if (item.part || item.id === 'jr-meet') return jr.ip; // the board on its own: the four switches are the inputs
  return [1, 2, 3, 4].map((n) => {
    const m = inLesson(`ip${n}`);
    if (!m) return 0;
    if (JR_INVERTED.has(m.id)) return (jr.level[m.port] ?? 0) > 50 ? 0 : 1;
    return jr.hold[n - 1];
  });
}
let jrAudio = null, jrOsc = null;
function jrBeep(on) { // the kit buzzer is active: a steady ~2.3 kHz tone while its OP socket is on
  try {
    if (on && !jrOsc) { jrAudio ||= new AudioContext(); const gn = jrAudio.createGain(); gn.gain.value = 0.035; jrOsc = jrAudio.createOscillator(); jrOsc.type = 'square'; jrOsc.frequency.value = 2300; jrOsc.connect(gn).connect(jrAudio.destination); jrOsc.start(); }
    if (!on && jrOsc) { jrOsc.stop(); jrOsc = null; }
  } catch { /* no audio: the 3D buzzer still vibrates */ }
}
function jrCard() {
  const ins = (item.part ? [] : item.kit || []).filter((m) => m.port.startsWith('ip'));
  const ctl = item.part || item.id === 'jr-meet'
    ? `<p class="small muted">Switch an input on, like pressing a button module plugged into that IP socket:</p><div class="row-btns">${[1, 2, 3, 4].map((n) => `<button type="button" data-jr="${n}">IP${n}</button>`).join('')}</div>`
    : ins.map((m) => SENSE_UI[m.id]
      ? `<label>${esc(SENSE_UI[m.id][0])} (${m.port.toUpperCase()}) <input type="range" min="0" max="100" value="${jr.level[m.port] ?? 0}" data-lvl="${m.port}"><output data-o="${m.port}"></output></label>`
      : `<button type="button" class="hold" data-hold="${m.port[2]}">${m.id === 'touch' ? '☝ Touch the pad' : '👇 Press the button'} (${m.port.toUpperCase()}): hold it</button>`).join('') +
      (item.colours ? `<div class="row-btns">${['red', 'green', 'yellow'].map((c) => `<button type="button" data-tint="${c}">${c[0].toUpperCase() + c.slice(1)} LED</button>`).join('')}</div>` : '');
  return `<div class="gasbox jrbox touchbox"><h3 class="jrh">Try it</h3><div class="row-btns"><button type="button" data-jr="power"></button></div>${ctl}
    <table class="truth jrt"><tr><th></th><th>1</th><th>2</th><th>3</th><th>4</th></tr><tr><td>IP</td>${'<td></td>'.repeat(4)}</tr><tr><td>OP · LED</td>${'<td></td>'.repeat(4)}</tr></table>
    <p class="read small"></p></div>`;
}
function jrUpdate() {
  if (!item.part && !item.jr) return;
  const ip = jrInputs(), r = jrBoard(ip, jr.power);
  if (sensorNode) {
    r.op.forEach((v, i) => stage.glow(sensorNode, `jr_board_led${i + 1}`, !!v, 0xff2a1a, `anchor_jr_board_led${i + 1}`, 9));
    stage.glow(sensorNode, 'jr_board_pled', jr.power, 0xff3020, 'anchor_jr_board_pled', 6);
    stage.move(sensorNode, 'jr_board_sw1_cap', [0, jr.power ? -1.2 : 0, 0]);
  }
  let beep = false;
  for (const m of jrMods()) { // what each plugged-in output does
    const n = +m.port.slice(2);
    if (m.port.startsWith('op')) {
      if (m.id === 'led') stage.glow(m.root, 'led_lens', !!r.op[n - 1], TL_COLOR[m.tint || 'red'], 'anchor_led_led', 10);
      if (m.id === 'buzzer') { stage.vibrate(m.root, 'buzzer_body', !!r.op[n - 1], 'anchor_buzzer_buzzer'); beep ||= !!r.op[n - 1]; }
    }
    if (m.id === 'tt_motor') { const st = m.port === 'cn2' ? r.motorA : r.motorB; stage.spin(m.root, 'tt_motor_shaft', st === 1 ? 1 : st === -1 ? -1 : 0); }
    if (m.id === 'touch') stage.glow(m.root, 'touch_pad', !!jr.hold[n - 1], 0x6fb6ff, 'anchor_touch_pad', 34);
    if (SENSE_UI[m.id]) { const s = SENSORS[m.id]; if (s?.wet && m.port.startsWith('ip')) stage.wet(m.root.getObjectByName(m.id), s.wet[0], m.id === 'ir' ? 20 - (jr.level[m.port] ?? 0) / 5.3 : jr.level[m.port] ?? 0, s.surface ? [...s.wet[1], true] : s.wet[1]); stage.glow(m.root, `${m.id}_led_signal`, (jr.level[m.port] ?? 0) > 50 && jr.power, 0xffc21a, `anchor_${m.id}_led_signal`, 6); stage.glow(m.root, `${m.id}_led_power`, jr.power, 0xffc21a, `anchor_${m.id}_led_power`, 6); }
  }
  jrBeep(beep);
  const on = r.op.filter(Boolean).length;
  if (item.part) { $('#prog-count').textContent = `${ip.filter(Boolean).length}/4`; $('#prog-fill').style.width = `${ip.filter(Boolean).length * 25}%`; }
  for (const box of document.querySelectorAll('.jrbox')) {
    box.querySelector('[data-jr="power"]').textContent = jr.power ? 'SW1 is ON: switch off' : 'SW1 is OFF: switch on';
    box.querySelector('[data-jr="power"]').setAttribute('aria-pressed', String(jr.power));
    box.querySelectorAll('[data-jr]:not([data-jr="power"])').forEach((b) => b.setAttribute('aria-pressed', String(!!jr.ip[b.dataset.jr - 1])));
    box.querySelectorAll('[data-lvl]').forEach((i) => { const m = inLesson(i.dataset.lvl), v = jr.level[m.port] ?? 0; box.querySelector(`[data-o="${m.port}"]`).textContent = v > 50 ? SENSE_UI[m.id][2] : SENSE_UI[m.id][1]; });
    box.querySelectorAll('[data-tint]').forEach((b) => b.setAttribute('aria-pressed', String(onPort('op1')?.tint === b.dataset.tint)));
    const hl = (v) => `<b class="${v ? 'hi' : ''}">${v ? 'ON' : 'off'}</b>`;
    const rows = box.querySelectorAll('.jrt tr');
    ip.forEach((v, i) => { rows[1].cells[i + 1].innerHTML = hl(v); rows[2].cells[i + 1].innerHTML = hl(r.op[i]); });
    const motors = (item.kit || []).some((m) => m.id === 'tt_motor') || item.part;
    box.querySelector('.read').innerHTML = !jr.power ? 'The board is off: nothing turns on until SW1 is switched on.'
      : motors ? `Left motor (CN2): <b>${MOTOR_TXT[r.motorA]}</b> · Right motor (CN1): <b>${MOTOR_TXT[r.motorB]}</b>`
        : on ? `OP${r.op.map((v, i) => (v ? i + 1 : 0)).filter(Boolean).join(', OP')} on.` : 'Waiting for a signal from an input.';
  }
}
function jrWire(root = document) {
  root.querySelectorAll('.jrbox [data-jr]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.jr === 'power') jr.power = !jr.power; else jr.ip[b.dataset.jr - 1] ^= 1; jrUpdate(); }));
  root.querySelectorAll('.jrbox [data-hold]').forEach((b) => {
    const n = +b.dataset.hold, set = (v) => { if (jr.hold[n - 1] === v) return; jr.hold[n - 1] = v; const m = onPort(`ip${n}`); if (m?.id === 'button') stage.press(m.root, 'button_cap', !!v); jrUpdate(); };
    b.addEventListener('pointerdown', (e) => { b.setPointerCapture(e.pointerId); set(1); });
    ['pointerup', 'pointercancel'].forEach((ev) => b.addEventListener(ev, () => set(0)));
  });
  root.querySelectorAll('.jrbox [data-lvl]').forEach((i) => i.addEventListener('input', () => { jr.level[i.dataset.lvl] = +i.value; jrUpdate(); }));
  root.querySelectorAll('.jrbox [data-tint]').forEach((b) => b.addEventListener('click', () => { // swap the LED module (the book: do it with SW1 off)
    const m = onPort('op1'); if (!m) return;
    m.tint = b.dataset.tint; const o = stage.find(m.root, 'led_lens'); o.material.color.set(BODY[m.tint]); jrUpdate();
  }));
}
/** a press on a module in a Jr lesson (button cap or touch pad on the 3D model) */
function jrPress(root, down) {
  const m = jrMods().find((x) => x.root === root || x.root === root?.parent);
  if (!m || !m.port.startsWith('ip')) return false;
  if (m.id === 'button') stage.press(m.root, 'button_cap', down);
  jr.hold[m.port[2] - 1] = down ? 1 : 0;
  jrUpdate();
  return true;
}
function focusJr(name, k, info) {
  if (/^ip\d$/.test(k) && item.part) jr.ip[k[2] - 1] ^= 1;      // board page: clicking an input socket switches it
  if (k === 'sw1') jr.power = !jr.power;
  stage.focus(sensorNode.getObjectByName(name), { title: info[0], anchor: sensorNode.getObjectByName(`anchor_jr_board_${k}`) || undefined, html: `<p>${esc(info[1])}</p>` });
  jrUpdate();
  return true;
}

// --- servo page: set the angle (the horn turns), sweep 0 ↔ 180°, and see the 50 Hz pulse that asks for it ----------------------
const sv = { deg: 90, sweep: 0, dir: 1 };
function servoUpdate() {
  if (!sensorNode) return;
  stage.rotate(sensorNode, 'servo_horn', sv.deg - 90);
  const box = document.querySelector('.svbox');
  if (!box) return;
  const ms = servoPulseMs(sv.deg);
  box.querySelector('[data-k="deg"]').value = sv.deg;
  box.querySelector('[data-o="deg"]').textContent = `${sv.deg}°`;
  box.querySelector('[data-a="sweep"]').textContent = sv.sweep ? '■ Stop sweep' : '↔ Sweep 0–180°';
  const w = (ms / 20) * 170; // 20 ms period drawn 170 px wide
  box.querySelector('.pw').setAttribute('points', `10,26 10,6 ${10 + w},6 ${10 + w},26 180,26 180,6 ${180 + Math.min(w, 18)},6`);
  box.querySelector('.read').innerHTML = `servo.write(${sv.deg}) → a <b>${ms.toFixed(2)} ms</b> pulse every 20 ms (50 Hz)`;
}
function focusServo(name, k, info) {
  const s = SENSORS.servo, get = (n) => sensorNode.getObjectByName(`servo_${n}`);
  stage.focus(s.focus[k] ? s.focus[k].map(get).filter(Boolean) : sensorNode.getObjectByName(name), { title: info[0], anchor: sensorNode.getObjectByName(`anchor_servo_${k === 'lead' ? 'signal' : 'horn'}`), html: `<p>${esc(info[1])}</p>` + (item.part ?
    `<div class="gasbox svbox"><label>Angle <input type="range" min="0" max="180" value="${sv.deg}" data-k="deg"><output data-o="deg"></output></label>` +
    '<div class="row-btns">' + [0, 90, 180].map((d) => `<button type="button" data-deg="${d}">${d}°</button>`).join('') + '<button type="button" data-a="sweep"></button></div>' +
    '<svg viewBox="0 0 200 30" class="bounce" aria-label="Signal pulse"><polyline class="pw" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>' +
    '<p class="read small"></p><p class="small muted">1.0 ms = 0°, 1.5 ms = 90°, 2.0 ms = 180° (datasheet). Libraries often stretch this to 0.5–2.4 ms to reach the very ends.</p></div>' : '') });
  const box = document.querySelector('.svbox');
  if (box) {
    const stop = () => { clearInterval(sv.sweep); sv.sweep = 0; };
    box.querySelector('[data-k="deg"]').addEventListener('input', (e) => { stop(); sv.deg = +e.target.value; servoUpdate(); });
    box.querySelectorAll('[data-deg]').forEach((b) => b.addEventListener('click', () => { stop(); sv.deg = +b.dataset.deg; servoUpdate(); }));
    box.querySelector('[data-a="sweep"]').addEventListener('click', () => {
      if (sv.sweep) stop();
      else sv.sweep = setInterval(() => { sv.deg += sv.dir * 6; if (sv.deg >= 180 || sv.deg <= 0) { sv.deg = Math.max(0, Math.min(180, sv.deg)); sv.dir *= -1; } servoUpdate(); }, 60); // ~0.1 s per 60°, like the datasheet
      servoUpdate();
    });
  }
  servoUpdate();
  return true;
}

// --- ultrasonic lesson: the obstacle in front of the sensor (pick it, move it, let it drive back and forth while running) ---
let rig = null, driveRaf = 0;
function setObstacleCm(cm) {
  cm = Math.round(cm);
  (values[item.id] ||= {}).cm = cm; store.set('values', values);
  rig.dist(cm);
  const inp = document.querySelector('#params [data-key="cm"]');
  if (inp) { inp.value = cm; inp.nextElementSibling.textContent = `${cm} cm`; }
  const c = document.querySelector('.obox'); if (c) { c.querySelector('[data-k="cm"]').value = cm; c.querySelector('[data-o="cm"]').textContent = `${cm} cm`; }
  if (!running) stage.setCalloutText('obstacle', `${cm} cm · click to swap`);
}
function obstacleDrive(on) {
  cancelAnimationFrame(driveRaf); driveRaf = 0;
  if (!on || !rig) return;
  const t0 = performance.now(), mid = 60, amp = 50; // 10 cm ↔ 110 cm, about 8 s a round trip
  const step = () => { if (!rig || !running) return; setObstacleCm(mid - amp * Math.cos(((performance.now() - t0) / 8000) * 2 * Math.PI)); driveRaf = requestAnimationFrame(step); };
  driveRaf = requestAnimationFrame(step);
}
function focusObstacle() {
  const [title, about] = OBSTACLES[rig.st.kind], drive = store.get('obstacleDrive', false);
  stage.focus(rig.st.model, { title, anchor: rig.anchor, html: `<p>${esc(about)}</p><div class="gasbox obox">
    <div class="row-btns">${Object.entries(OBSTACLES).map(([k, [t]]) => `<button type="button" data-obj="${k}" aria-pressed="${k === rig.st.kind}">${esc(k[0].toUpperCase() + k.slice(1))}</button>`).join('')}</div>
    <label>Distance <input type="range" min="2" max="200" value="${rig.st.cm}" data-k="cm"><output data-o="cm">${rig.st.cm} cm</output></label>
    <label class="chk"><input type="checkbox" data-a="drive"${drive ? ' checked' : ''}> Drive back and forth while running</label></div>` });
  const c = document.querySelector('.obox');
  c.querySelectorAll('[data-obj]').forEach((b) => b.addEventListener('click', () => {
    rig.set(b.dataset.obj); store.set('obstacle', b.dataset.obj);
    focusObstacle();
    document.querySelectorAll('.tag').forEach((t) => { if (/Toy car|Cardboard box|Ball|Wall/.test(t.querySelector('b')?.textContent || '')) t.querySelector('b').textContent = OBSTACLES[rig.st.kind][0]; });
  }));
  c.querySelector('[data-k="cm"]').addEventListener('input', (e) => { obstacleDrive(false); setObstacleCm(+e.target.value); });
  c.querySelector('[data-a="drive"]').addEventListener('change', (e) => { store.set('obstacleDrive', e.target.checked); obstacleDrive(e.target.checked && !!running); });
  return true;
}

// --- light-sensor lesson: a desk lamp on the LDR. lamp lux (1/d²) + room lux → LDR ohms → AO volts → ADC counts ---
let lamp = null, line = null; // line: the line-follower tape (line.js)

// --- Level 3 car lessons: circuit → chassis → drive. The drive step puts the built car in a walled test arena (arena.js) ---
const DESK_MOTORS = ['motor_l1', 'motor_l2', 'motor_r1', 'motor_r2'].map((port) => ({ id: 'tt_motor', port })); // circuit step: the 4 motors on the desk
/** circuit step: each project's parts sit where they will go on the car. Sensors on the front edge (-z), battery at the rear; the motors already sit at their corners */
const deskSpot = (m) => (m.id === 'tt_motor' ? { z: /1$/.test(m.port) ? -58 : 58 } : { ultrasonic: { edge: 'front', x: 0 }, button: { edge: 'rear', x: 45 }, ir: { edge: 'front', x: m.port === 'd36' ? -24 : 24 }, battery: { edge: 'rear', x: -30 } }[m.id]); // as on the car: motors CN6 / CN7 at the front corners, CN19 / CN8 at the back; battery rear-left, push button rear-right
function deskFront(kit) { // "▲ Front of the car" on the desk, ahead of the front-most part (measured at rest: the assembly may be flying them in)
  let z = 0;
  const reach = (r) => { kit.group.updateMatrixWorld(true); r.traverse((o) => { if (o.isMesh) { o.geometry.computeBoundingBox(); z = Math.min(z, o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld).min.z); } }); };
  reach(kit.base);
  kit.modules.forEach((m) => { const now = m.root.position.clone(); m.root.position.copy(m.home); reach(m.root); m.root.position.copy(now); });
  const m = frontMarker(); m.position.set(rig ? -0.17 : 0, 0.0005, z - 0.03); kit.group.add(m); // beside the obstacle when there is one
  if (!rig) stage.refit(); // the obstacle lesson already framed its whole 110 cm
}
const PHASES = [['circuit', 'Circuit', 'Wire the board'], ['chassis', 'Chassis', 'Build the car'], ['drive', 'Drive', 'Test arena']];
let lastLesson = null, phaseNav = null; // the lesson shown last, and a step change on its way to this lesson (it keeps its step)
let arena = null, buildFor = null; // buildFor: the car lesson whose chassis the build guide is assembling
const phasesDone = (id) => new Set(store.get(`phasesDone:${id}`, [])); // circuit / chassis / drive finished with Next
function markPhase(id, ph) { const s = phasesDone(id); s.add(ph); store.set(`phasesDone:${id}`, [...s]); }
const goNext = (nx) => `<button type="button" class="go" data-go="lesson"><span><small>${nx ? 'Next lesson' : 'All done'}</small><b>${nx ? esc(nx.cardTitle) : 'Back to the book'}</b></span><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>`;
/** the bar on top of the stage in a book: a car lesson's Circuit → Chassis → Drive with Next, or "Lesson n of N" with Next lesson */
function renderPhases() {
  const nav = $('#phases'), id = mode === 'build' ? buildFor : mode === 'lessons' && item && !item.part ? item.id : item?.kitbox && item.id;
  const L = lvl ? lessonList() : [], li = L.findIndex((l) => l.id === id), lesson = L[li], nx = L[li + 1];
  nav.hidden = !lesson;
  if (!lesson) return;
  let html;
  if (lesson.chassis) {
    const now = PHASES.findIndex(([k]) => k === (mode === 'build' ? 'chassis' : item.phase)), fin = phasesDone(id);
    html = PHASES.map(([k, t, sub], i) => `<button type="button" data-ph="${k}" class="${i === now ? 'now' : fin.has(k) ? 'done' : ''}"${i === now ? ' aria-current="step"' : ''}>`
      + `<i>${i !== now && fin.has(k) ? '✓' : i + 1}</i><span><b>${t}</b><small>${sub}</small></span></button>`).join('')
      + (now < 2 ? `<button type="button" class="go" data-go="${PHASES[now + 1][0]}"><span><small>When you're done</small><b>Next: ${PHASES[now + 1][1]}</b></span><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>` : goNext(nx));
  } else html = `<span class="where"><b>Lesson ${li + 1} of ${L.length}</b><small>${esc(lesson.cardTitle)}</small></span>${goNext(nx)}`;
  nav.innerHTML = html;
}
/** Next: finish this step (or lesson) and move on */
function flowNext(to) {
  const id = mode === 'build' ? buildFor : item.id, L = lessonList(), li = L.findIndex((l) => l.id === id);
  if (to === 'chassis') { markPhase(id, 'circuit'); return goPhase(id, 'chassis'); }
  if (to === 'drive') { markPhase(id, 'chassis'); return goPhase(id, 'drive'); }
  if (L[li]?.chassis) markPhase(id, 'drive');
  if (!done.has(id)) toggleDone(id);
  const nx = L[li + 1];
  location.hash = nx ? `#/l${lvl}/${nx.chassisBuild ? 'build/parts' : 'lesson'}/${nx.id}` : `#/level/${lvl}`;
}
async function goPhase(id, ph) {
  if (ph === 'chassis') { // jump past the car steps already ticked (in Chassis assembly or another project)
    if (mode === 'build') return;
    buildMod ||= await import('./build.js');
    const S = buildMod.stepsFor(buildMod.PROJECTS[id]), next = S.find((x) => x.id !== 'parts' && checksOf(x).length < x.checks.length) || S.at(-1);
    location.hash = `#/l3/build/${next.id}/${id}`; return;
  }
  store.set(`phase:${id}`, ph); phaseNav = id;
  const h = `#/l3/lesson/${id}`;
  if (location.hash === h) route(); else location.hash = h;
}
function setupArena(kit) {
  const g = kit.group, { car, origin } = carFrame(g, kit.chassis), A = ARENAS[COURSE_OF[item.id] || 'obstacle'], map = buildArena(A);
  map.position.copy(origin); map.userData.fx = true; // stage drops it with the next model
  g.attach(map); stage.refit(0.8); map.remove(map.userData.room); stage.scene.attach(map); // frame the whole course, then leave it behind when the car drives
  arena = { A, car, origin, sonarOn: kit.modules.some((m) => m.id === 'ultrasonic'), start: [g.position.clone(), g.rotation.y],
    motor: [0, 0], hand: false, mode: 'program', logged: '', loggedAt: 0, bump: 0, chase: false, ctx: $('#arena canvas').getContext('2d'), html: '', corners: 0, spinning: false, laps: 0, away: false, trail: A.square ? makeTrail() : null, map, bus: A.road ? newBus() : null };
  if (arena.trail) map.add(arena.trail.line);
  stage.setFence((x, z, th) => {
    const hit = blocked(carPoints({ x: x - origin.x, z: z - origin.z, th }, car), A), now = performance.now();
    if (hit) { if (arena.bus && now - arena.bump > 900) arena.bus.bumps++; arena.bump = now; }
    return hit;
  });
  stage.setCallouts([]); // labels would cover the course; the parts are still clickable
  carView();
  const course = COURSE_OF[item.id] || 'obstacle', fmt = (v) => +v.toFixed(2);
  $('#ah-title').textContent = A.title; $('#amap-size').textContent = `Arena · ${fmt(A.x[1] - A.x[0])} × ${fmt(A.z[1] - A.z[0])} m`;
  $('#af-svg').innerHTML = flowSvg(course); arena.course = course; arena.lit = null;
  const us = kit.modules.find((m) => m.id === 'ultrasonic');
  if (us) { // the sound cone in 3D, at the sensor's height
    arena.beam = makeBeam(g, us.root, car, map); map.add(arena.beam.obj);
  }
  openDrivePanel(A);
  $('#arena').hidden = false; $('#stage').classList.add('arena-on');
  $('[data-ar="chase"]').setAttribute('aria-pressed', 'false');
  stage.tick('arena', arenaTick);
  if (import.meta.env.DEV) { window.__arena = arena; window.__pose = arenaPose; window.__car = g; }
}
const GOALS = { // what each course asks of the car
  obstacle: 'Let your program drive: it should steer away from every block and wall without touching. Then take the wheel and try it yourself.',
  line: 'Put the car on the tape and let your program follow it all the way round. Push it off with the arrows and watch it find the line again.',
  pattern: 'Your program should drive the blue square and stop where it started. The orange trail shows where it really went: tune the 0.5 s turn until the square closes.',
  manual: 'You drive the bus: your program rolls only while the push button is held. Hold the big button below (or B) and let go so the car stops fully inside each yellow stop, in order, to pick up the passenger. When the lights flash at the level crossing, stop and wait for the barrier to lift. The last stop is the depot.',
};
function openDrivePanel(A) { // the right side becomes the car's control panel; the serial monitor comes along
  $('#dp-title').textContent = A.title; $('#dp-goal').textContent = GOALS[COURSE_OF[item.id]] || '';
  $('.info').hidden = true; $('#code-card').hidden = true; $('#drive-panel').hidden = false;
  $('#dp-push').hidden = !kitInfo.modules.some((m) => m.id === 'button');
  $('#drive-panel .mon-slot').append($('#monitor'));
  $('.panel').classList.add('driving');
}
function closeDrivePanel() {
  $('#drive-panel').hidden = true; $('.info').hidden = false; $('#code-card').hidden = false;
  $('#code-card').append($('#monitor'));
  $('.panel').classList.remove('driving');
}
const driveMode = () => (running ? 'program' : arena.mode === 'program' ? 'manual' : arena.mode); // the program may have ended on its own
function paintMode(m) { if (paintMode.last !== m) { paintMode.last = m; document.querySelectorAll('#drive-panel [data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m))); } }
function setDriveMode(m) {
  if (!arena) return;
  held.length = 0;
  if (m !== 'program' && running) stopSim();
  arena.mode = m; arenaDrive(0, 0);
  if (m === 'program' && !running) startSim(true);
}
/** the car's push button (manual drive): pressing it hands the wheel to the program, which drives while D35 reads 1 */
function pushCarButton(down) {
  const m = arena && kitInfo.modules.find((x) => x.id === 'button');
  if (!m || pushCarButton.down === down) return;
  pushCarButton.down = down;
  $('#dp-push').classList.toggle('down', down);
  if (down && !running) setDriveMode('program');
  running ? running.hw.press(m.root, down) : stage.press(m.root, 'button_cap', down);
}
function putCarBack() {
  if (!arena) return;
  kitInfo.group.position.copy(arena.start[0]); kitInfo.group.rotation.y = arena.start[1]; carView();
  arena.trail?.clear(); Object.assign(arena, { corners: 0, laps: 0, away: false });
  if (arena.bus) { arena.bus = newBus(); arena.map.userData.stops.forEach((st) => { st.person.position.copy(st.home); st.person.scale.setScalar(1); st.person.visible = true; }); }
}
/** Roverkit's view: close behind the car's right shoulder, looking past it down the course; the camera then rides along with the car */
function carView() {
  const g = kitInfo.group, q = stage.carPose(g), c = Math.cos(q.th), sn = Math.sin(q.th), { cx, cz } = arena.car;
  const x = q.x + cx * c + cz * sn, z = q.z - cx * sn + cz * c, y = arena.origin.y + 0.05; // car centre; forward (c, -sn), right (sn, c)
  stage.setHome([x + c * 0.1, y, z - sn * 0.1], [x - c * 0.62 + sn * 0.55, y + 0.55, z + sn * 0.62 + c * 0.55]);
}
const newBus = () => ({ next: 0, marks: [], bumps: 0, t0: 0, end: 0, gateT0: performance.now() });
/** bus route: the barrier's cycle, each stop made (stopped fully inside) or missed (driven past), passengers boarding, the finish */
function busTick(a, p, [cx, cz], still) {
  const A = a.A, b = a.bus, G = A.gate, now = performance.now(), ud = a.map.userData, t = (now - b.gateT0) / 1000;
  const [lowering, shut] = gateAt(G, t); G.isDown = shut;
  ud.gate.arm.rotation.x += ((lowering ? 0 : 1.4) - ud.gate.arm.rotation.x) * 0.12;
  const warn = t % G.period >= G.lower - 1; // the lights flash a second before the arm comes down, and while it is down
  ud.gate.lamps.forEach((l, i) => { l.material.emissiveIntensity = warn && Math.floor(now / 350) % 2 === i ? 2.5 : 0; });
  const pts = carPoints(p, a.car), back = Math.min(...pts.map((q) => q[0])), S = A.stops[b.next];
  if (!b.t0 && !still) b.t0 = now;
  if (S && still && inStop(pts, S, A)) { b.marks[b.next++] = 'done'; serialLine(b.next === A.stops.length ? `${S[2]}: the bus is home` : `${S[2]}: passenger on board`, 'tele'); }
  else if (S && back > S[1]) { b.marks[b.next++] = 'missed'; serialLine(`${S[2]}: missed, the bus didn't stop inside it`, 'tele'); }
  const made = b.marks.filter((m) => m === 'done').length;
  if (b.next === A.stops.length && !b.end) { b.end = now; serialLine(`Route done: ${made} of ${A.stops.length} stops, ${b.bumps} bump${b.bumps === 1 ? '' : 's'}, ${Math.round((b.end - (b.t0 || now)) / 1000)} s`, 'sys'); }
  ud.stops.forEach((st, i) => {
    const m = b.marks[i];
    st.fill.material.color.setHex(m === 'done' ? 0x22c55e : m === 'missed' ? 0x94a3b8 : 0xfbbf24);
    st.line.material.color.setHex(m === 'done' ? 0x16a34a : m === 'missed' ? 0x64748b : i === b.next ? 0xf59e0b : 0xfde68a);
    if (m === 'done' && st.person.visible) { // the passenger walks to the bus and gets on
      const q = st.person.position; q.x += (cx - q.x) * 0.1; q.z += (cz - q.z) * 0.1; st.person.scale.multiplyScalar(0.94);
      if (st.person.scale.x < 0.15) st.person.visible = false;
    }
  });
  const next = A.stops[b.next], toStop = next ? Math.max(0, Math.round(((next[0] + next[1]) / 2 - cx) * 100)) : 0;
  return { done: !!b.end, made,
    rows: [['Next stop', next ? next[2] : 'None'], ['Stops', `${made}/${A.stops.length}`], ['Gate', shut ? 'Closed' : lowering ? 'Closing' : 'Open'], ...(next ? [['To the stop', toStop, 'cm']] : [])],
    log: next ? `Next: ${next[2]} · ${toStop} cm · gate ${shut ? 'closed' : 'open'}` : '', stops: b.marks };
}
function setArenaMotor(L, R) { // counted when the motors change, not per frame: a 0.5 s spin is a corner even on a slow screen
  const opp = L * R < 0; // one side forward, one back: a corner (pattern mover)
  if (opp && !arena.spinning) arena.corners++;
  arena.spinning = opp; arena.motor = [L, R];
}
const arenaPose = () => { const q = stage.carPose(kitInfo.group); return { x: q.x - arena.origin.x, z: q.z - arena.origin.z, th: q.th }; }; // the true pose; the drawn car eases after it
function arenaDrive(L, R) { // the D-pad / keys: you take the wheel (the program stops, like unplugging it)
  if (!arena) return;
  if (arena.mode === 'stop' && (L || R)) { const p = $('#drive-panel .dpad'); p.classList.remove('shake'); void p.offsetWidth; p.classList.add('shake'); return; } // Stop: no driving until you pick who drives
  if (L || R) arena.mode = 'manual';
  if (running && (L || R)) { stopSim(); serialLine('You took the wheel, so your program stopped. Pick Program to hand it back.', 'sys'); }
  const k = $('#ar-speed').value / 100;
  if (L || R) stage.leash(0); // your hands on the wheel: nothing to wait for
  arena.hand = !!(L || R); setArenaMotor(L, R);
  ['fl', 'rl'].forEach((w) => stage.spin(kitInfo.chassis, `chassis_wheel_${w}`, -L * k));
  ['fr', 'rr'].forEach((w) => stage.spin(kitInfo.chassis, `chassis_wheel_${w}`, -R * k));
  stage.drive(kitInfo.group, L * k, R * k);
}
function arenaTick() {
  if (!arena) return;
  const a = arena, A = a.A, p = arenaPose(), s = sensorsAt(p, a.car), d = a.sonarOn ? sonarCm(...s.sonar, p.th, A) : null, [cx, cz] = s.centre;
  const fromStart = Math.hypot(cx, cz);
  if (fromStart > 0.5) a.away = true;
  if (a.away && fromStart < 0.1) { a.laps++; a.away = false; } // back at the start line (line follower)
  a.trail?.add(cx, cz);
  const still = !a.motor[0] && !a.motor[1], bus = a.bus && busTick(a, p, s.centre, still);
  drawMap(a.ctx, A, p, a.car, { ray: d, trail: a.trail?.pts, stops: bus?.stops });
  const arrow = (v) => `<i class="wh">${v > 0 ? '▲' : v < 0 ? '▼' : '■'}</i>`, dot = (on, t) => `<i class="ir${on ? ' on' : ''}">${t}</i>`, who = driveMode();
  const lineL = A.track && onTape(...s.irL, A.track), lineR = A.track && onTape(...s.irR, A.track);
  const now = performance.now(); if (lineL) a.seenL = now; if (lineR) a.seenR = now; // the eye needs ~¼ s: a sensor flicking on and off 20× a second reads as lit
  const turned = Math.round((-p.th * 180) / Math.PI);
  const rows = [...(d != null ? [['Distance', d.toFixed(1), 'cm']] : []), ['Speed', who === 'program' ? 100 : who === 'stop' ? 0 : $('#ar-speed').value, '%'],
    ['Mode', { program: 'Program', manual: 'Manual', stop: 'Stopped' }[who]],
    ...(A.track ? [['Line sensors', `${dot(now - a.seenL < 250, 'L')}${dot(now - a.seenR < 250, 'R')}`], ['Laps', a.laps]] : []),
    ...(A.square ? [['Corners', a.corners], ['Turned', turned, '°'], ['From start', Math.round(fromStart * 100), 'cm']] : []),
    ...(bus ? bus.rows : []),
    ['Wheels', steady(a, 'wheelsShown', `L ${arrow(a.motor[0])} R ${arrow(a.motor[1])}`)]];
  const won = bus?.done, badge = performance.now() - a.bump < 900 ? 'Bump!' : won ? `Route done! ${bus.made}/${A.stops.length}` : '';
  const html = rows.map(([k, v, u]) => `<div><dt>${k}</dt><dd>${v}${u ? `<small>${u}</small>` : ''}</dd></div>`).join('') + (badge ? `<div class="bump${badge !== 'Bump!' ? ' ok' : ''}"><dd>${badge}</dd></div>` : '');
  if (a.beam) a.beam.set(Math.min(d, 150) / 100, d < 399, d); // drawn on the car you see, which eases after the true pose
  paintFlow(who, d, lineL, lineR);
  paintMode(who);
  const log = bus ? bus.log : d != null ? `Distance: ${d.toFixed(0)} cm` : A.track ? `Line: L ${+lineL} · R ${+lineR} · laps ${a.laps}` : A.square ? `Turned ${turned}° · ${a.corners} corners · ${Math.round(fromStart * 100)} cm from the start` : '';
  if (log && log !== a.logged && performance.now() - a.loggedAt > 1500) { a.logged = log; a.loggedAt = performance.now(); serialLine(log, 'tele'); } // like the real car's telemetry, when something changed
  if (html !== a.html) { a.html = html; $('#arena-tele').innerHTML = html; }
  if (arena.chase) { // camera rides behind the car
    const g = kitInfo.group, c = Math.cos(p.th), sn = Math.sin(p.th), { cx, cz } = arena.car;
    const x = g.position.x + cx * c + cz * sn, z = g.position.z - cx * sn + cz * c, y = arena.origin.y + 0.06, t = stage.controls.target, cam = stage.camera.position;
    t.lerp(t.clone().set(x + c * 0.15, y, z - sn * 0.15), 0.12);
    cam.lerp(cam.clone().set(x - c * 0.5, y + 0.24, z + sn * 0.5), 0.12);
  }
}
/** what the HUD shows changes at most every `ms` (½ s): a line follower flips its wheels and its branch ~20× a second, too fast to read */
function steady(a, key, v, ms = 500) {
  const s = (a[key] ||= { v, at: 0 }), now = performance.now();
  if (v !== s.v && now - s.at >= ms) { s.v = v; s.at = now; }
  return s.v;
}
/** the program-flow card: which step the car is on, and the Run / Stop button */
function paintFlow(who, d, lineL, lineR) {
  const a = arena;
  if (a.motor[0] || a.motor[1]) a.lastMove = a.motor[0] * a.motor[1] < 0 ? 'turn' : 'fwd';
  const lit = steady(a, 'flowShown', who === 'program' ? flowActive(a.course, { L: a.motor[0], R: a.motor[1], near: d != null && d < 20, lineL, lineR, pressed: !!pushCarButton.down, last: a.lastMove }).join() : '').split(','), key = who + lit;
  if (key === a.lit) return;
  a.lit = key;
  $('#af-svg').querySelectorAll('[data-n]').forEach((n) => n.classList.toggle('on', lit.includes(n.dataset.n)));
  $('.aflow').classList.toggle('live', who === 'program');
  const [t, sub] = { program: ['Program is driving', 'The lit step is what the car is doing now'], manual: ['You are driving', 'Press Run to hand the wheel to your program'], stop: ['Stopped', 'Press Run to start your program'] }[who];
  $('#af-t').textContent = t; $('#af-s').textContent = sub;
  const run = $('#af-run'); run.querySelector('span').textContent = who === 'program' ? 'Stop' : 'Run';
  run.querySelector('path').setAttribute('d', who === 'program' ? 'M7 7h10v10H7z' : 'M8 5v14l11-7z');
}
function setupArenaHud() {
  const hud = $('#drive-panel');
  hud.querySelectorAll('[data-d]').forEach((b) => {
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ } holdDrive(b.dataset.d, true); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => b.addEventListener(ev, () => holdDrive(b.dataset.d, false)));
  });
  $('#ar-speed').addEventListener('input', (e) => { $('#ar-speed-v').textContent = `${e.target.value}%`; });
  $('.amap [data-ar="reset"]').addEventListener('click', putCarBack);
  hud.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setDriveMode(b.dataset.mode)));
  const push = $('#dp-push');
  push.addEventListener('pointerdown', (e) => { e.preventDefault(); try { push.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ } pushCarButton(true); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => push.addEventListener(ev, () => pushCarButton(false)));
  addEventListener('keyup', (e) => { if (e.key.toLowerCase() === 'b') pushCarButton(false); });
  $('#af-run').addEventListener('click', () => setDriveMode(driveMode() === 'program' ? 'manual' : 'program'));
  $('#af-big').addEventListener('click', (e) => { const big = $('.aflow').classList.toggle('big'); e.currentTarget.setAttribute('aria-pressed', String(big)); });
  $('[data-ar="chase"]').addEventListener('click', (e) => {
    if (!arena) return;
    arena.chase = !arena.chase; e.currentTarget.setAttribute('aria-pressed', String(arena.chase));
    if (!arena.chase) carView();
  });
}

const LDR_VCC = 5;   // the D35 port powers the module from 5 V (user, 2026-11-22): above 3.3 V on AO the ESP32 reads 4095
// --- IR lesson: a hand or card in front of the IR obstacle module (irrig.js has how the real module works) ---
let irRig = null, irRaf = 0;
function handUpdate() { // S LED, IR1's glow (purple, like a phone camera shows it), the label and the open card follow the rig
  if (!irRig) return;
  const hit = irRig.hit(), v = irRig.volts(), [title] = IR_THINGS[irRig.st.kind], cm = Math.round(irRig.st.cm);
  stage.glow(irRig.ir, 'ir_led_signal', hit, 0xffc21a, 'anchor_ir_led_signal', 6);
  stage.glow(irRig.ir, 'ir_ir_led', powered(), 0x8a5cff, 'anchor_ir_ir_led', 8);
  const screw = irRig.ir.getObjectByName('ir_pot_screw'); if (screw) screw.rotation.y = -(irRig.st.thr / 5 - 0.5) * 1.5 * Math.PI; // 270° trimmer travel
  stage.setCalloutText('ir_target', `${cm} cm · ${hit ? 'seen' : 'not seen'}`);
  const inp = document.querySelector('#params [data-key="ircm"]');
  if (inp) { inp.value = cm; inp.nextElementSibling.textContent = `${cm} cm`; }
  const c = document.querySelector('.irbox');
  if (!c) return;
  c.querySelector('[data-k="cm"]').value = cm; c.querySelector('[data-o="cm"]').textContent = `${cm} cm`;
  c.querySelector('[data-o="thr"]').textContent = `${irRig.st.thr.toFixed(1)} V`;
  c.querySelector('.ao i').style.width = `${(v / 5) * 100}%`; c.querySelector('.ao b').style.left = `${(irRig.st.thr / 5) * 100}%`;
  c.querySelector('.read').innerHTML = `Receiver <b>${v.toFixed(2)} V</b> ${hit ? '&lt;' : '&gt;'} trimmer ${irRig.st.thr.toFixed(1)} V → <b class="${hit ? 'hi' : ''}">${hit ? 'seen' : 'not seen'}</b>` +
    ` · S LED ${hit ? 'on' : 'off'} · D34 reads ${hit ? 1 : 0}<br>A ${esc(title.toLowerCase())} is seen up to about <b>${Math.min(IR_MAX, irRig.range()).toFixed(0)} cm</b> at this trimmer setting.`;
}
function setIrCm(cm) {
  irRig.dist(cm); (values[item.id] ||= {}).ircm = Math.round(irRig.st.cm); store.set('values', values);
  handUpdate();
}
function irWave(on) { // the hand moves in and out on its own while the program runs (3 cm ↔ 25 cm, 5 s a round trip)
  cancelAnimationFrame(irRaf); irRaf = 0;
  if (!on || !irRig) return;
  const t0 = performance.now(), step = () => { if (!irRig || !running) return; setIrCm(14 - 11 * Math.cos(((performance.now() - t0) / 5000) * 2 * Math.PI)); irRaf = requestAnimationFrame(step); };
  irRaf = requestAnimationFrame(step);
}
function focusIr() {
  const [title, about] = IR_THINGS[irRig.st.kind], wave = store.get('irWave', true);
  stage.focus(irRig.st.model, { title, anchor: irRig.anchor, html: `<p>${esc(about)}</p><div class="gasbox irbox">
    <div class="row-btns">${Object.entries(IR_THINGS).map(([k, [t]]) => `<button type="button" data-obj="${k}" aria-pressed="${k === irRig.st.kind}">${esc(t)}</button>`).join('')}</div>
    <label>Distance <input type="range" min="1" max="${IR_MAX}" value="${Math.round(irRig.st.cm)}" data-k="cm"><output data-o="cm"></output></label>
    <label>R6 trimmer <input type="range" min="0.5" max="4.5" step="0.1" value="${irRig.st.thr}" data-k="thr"><output data-o="thr"></output></label>
    <div class="ao" title="Receiver voltage; the marker is the trimmer setting"><i></i><b></b></div><p class="read small"></p>
    <label class="chk"><input type="checkbox" data-a="wave"${wave ? ' checked' : ''}> Wave it in and out while running</label></div>` });
  const c = document.querySelector('.irbox');
  c.querySelectorAll('[data-obj]').forEach((b) => b.addEventListener('click', () => {
    irRig.set(b.dataset.obj); store.set('irThing', b.dataset.obj);
    document.querySelectorAll('.tag').forEach((t) => { if (Object.values(IR_THINGS).some(([n]) => n === t.querySelector('b')?.textContent)) t.querySelector('b').textContent = IR_THINGS[irRig.st.kind][0]; });
    focusIr();
  }));
  c.querySelector('[data-k="cm"]').addEventListener('input', (e) => { irWave(false); setIrCm(+e.target.value); });
  c.querySelector('[data-k="thr"]').addEventListener('input', (e) => { irRig.thr(+e.target.value); store.set('irThr', irRig.st.thr); handUpdate(); });
  c.querySelector('[data-a="wave"]').addEventListener('change', (e) => { store.set('irWave', e.target.checked); irWave(e.target.checked && !!running); });
  handUpdate();
  return true;
}
function ldrNow() {
  const lux = roomLux(param('light')) + lamp.lux(), { r, v } = ldrAt(lux, LDR_VCC);
  return { lux, r, v, n: adcCounts(v), bright: v < LDR_VCC / 2 }; // S LED: the comparator, trimmer at mid travel
}
function setLampCm(cm) { lamp.dist(Math.round(cm)); store.set('lampCm', lamp.st.cm); lampUpdate(); }
function lampUpdate() {
  const k = ldrNow(), ohms = k.r >= 1000 ? `${(k.r / 1000).toFixed(k.r < 1e4 ? 1 : 0)} kΩ` : `${Math.round(k.r)} Ω`;
  const b = lamp.beam(), where = b > 0.99 ? 'sensor in the beam' : b > 0 ? 'sensor at the beam edge' : 'sensor outside the beam';
  stage.setCalloutText('lamp', `${lamp.st.cm} cm · ${lamp.st.on ? where : 'off'} · drag me`);
  if (!running) stage.setCalloutText(MAIN_ANCHOR.ldr, `${lamp.port} ≈ ${k.n} · ${k.bright ? 'bright' : 'dark'}`);
  stage.glow(lamp.ldr, 'ldr_led_signal', k.bright, 0xffc21a, 'anchor_ldr_led_signal', 6);
  const c = document.querySelector('.lbox');
  if (!c) return;
  c.querySelector('[data-k="lcm"]').value = lamp.st.cm; c.querySelector('[data-o="lcm"]').textContent = `${lamp.st.cm} cm`;
  c.querySelector('.read').innerHTML = `Light on the LDR <b>${Math.round(k.lux).toLocaleString('en-US')} lux</b> → LDR <b>${ohms}</b> → AO <b>${k.v.toFixed(2)} V</b> → D35 <b>${k.n}</b>${k.v > 3.3 ? ' (clipped: above 3.3 V)' : ''}` +
    `<br>${lamp.st.on ? where[0].toUpperCase() + where.slice(1) : 'Lamp off'} · S LED <b class="${k.bright ? 'hi' : ''}">${k.bright ? 'on (bright)' : 'off (dark)'}</b>`;
}
function focusLamp() {
  stage.focus(lamp.anchor.parent.children[0], { title: 'Desk lamp', anchor: lamp.anchor, html: `<p>The shade points one way and lights a patch of desk. While the LDR is inside that beam it gets the lamp's light; move the lamp back and the sensor ends up outside the beam, in the dark.</p>
    <div class="gasbox lbox">
    <label>Lamp distance <input type="range" min="${lamp.st.min}" max="${LAMP_MAX}" value="${lamp.st.cm}" data-k="lcm"><output data-o="lcm"></output></label>
    <label class="chk"><input type="checkbox" data-a="lon"${lamp.st.on ? ' checked' : ''}> Lamp switched on</label>
    <p class="read small"></p>
    <p class="small muted">More light → the LDR's resistance drops → AO is pulled down → a smaller number. The distance is along the desk, from under the lamp head to the sensor. Or drag the lamp in the scene.</p></div>` });
  const c = document.querySelector('.lbox');
  c.querySelector('[data-k="lcm"]').addEventListener('input', (e) => setLampCm(+e.target.value));
  c.querySelector('[data-a="lon"]').addEventListener('change', (e) => { lamp.on(e.target.checked); store.set('lampOn', e.target.checked); lampUpdate(); });
  lampUpdate();
  return true;
}

// --- ultrasonic page: move the wall, ping, watch T click and R hear the echo, read the ECHO pulse width and the distance it gives ---
const sonar = { cm: 50, auto: 0, t: 0, last: null };
function sonarUpdate() {
  if (!sensorNode) return;
  stage.wet(sensorNode, 'obstacle', sonar.cm, SENSORS.ultrasonic.wet[1]);
  const box = document.querySelector('.sonarbox');
  if (!box) return;
  box.querySelector('[data-k="cm"]').value = sonar.cm;
  box.querySelector('[data-o="cm"]').textContent = `${sonar.cm} cm`;
  box.querySelector('[data-a="auto"]').textContent = sonar.auto ? '■ Stop' : '↻ Ping every ½ s';
  const us = sonar.last;
  box.querySelector('.echo').setAttribute('x2', 30 + (us ? Math.min(165, 165 * us / 23300) : 0));
  box.querySelector('.read').innerHTML = us == null ? 'Press Ping to measure.'
    : sonar.cm > 400 ? 'Nothing within 4 m: ECHO times out (~38 ms).'
      : `ECHO HIGH for <b>${Math.round(us)} µs</b> → ${Math.round(us)} × 0.0343 ÷ 2 = <b>${usToCm(us).toFixed(1)} cm</b>`;
}
function ping() {
  if (!sensorNode) return;
  const us = echoUs(sonar.cm) * (1 + (Math.random() - 0.5) * 0.01); // ±0.5 %, like a real reading
  stage.glow(sensorNode, 'ultrasonic_transmitter_mesh', true, 0x4fc3ff, 'anchor_ultrasonic_transmitter', 18);
  clearTimeout(sonar.t);
  // ponytail: the echo is shown 2 ms per cm late (slowed down ~30x) so the eye can follow it
  sonar.t = setTimeout(() => {
    stage.glow(sensorNode, 'ultrasonic_transmitter_mesh', false);
    stage.glow(sensorNode, 'ultrasonic_receiver_mesh', true, 0x4fc3ff, 'anchor_ultrasonic_receiver', 18);
    sonar.last = us; sonarUpdate();
    sonar.t = setTimeout(() => stage.glow(sensorNode, 'ultrasonic_receiver_mesh', false), 150);
  }, 120 + sonar.cm * 2);
}
function focusSonar(name, k, info) {
  const s = SENSORS.ultrasonic, get = (n) => sensorNode.getObjectByName(`ultrasonic_${n}`);
  stage.focus(s.focus[k] ? s.focus[k].map(get).filter(Boolean) : sensorNode.getObjectByName(name), { title: info[0], anchor: sensorNode.getObjectByName(`anchor_ultrasonic_${s.anchor[k] || k}`), html: `<p>${esc(info[1])}</p>` + (item.part ?
    `<div class="gasbox sonarbox"><label>Wall distance <input type="range" min="2" max="200" value="${sonar.cm}" data-k="cm"><output data-o="cm"></output></label>` +
    '<div class="row-btns"><button type="button" data-a="ping">📡 Ping</button><button type="button" data-a="auto"></button></div>' +
    '<svg viewBox="0 0 200 44" class="bounce timing" aria-label="TRIG and ECHO timing"><text x="2" y="12">TRIG</text><text x="2" y="36">ECHO</text>' +
    '<polyline points="30,16 34,16 34,6 37,6 37,16 198,16" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="30" y1="30" x2="198" y2="30" stroke="#b9ad99" stroke-width="1.5"/>' +
    '<line class="echo" x1="30" y1="26" x2="30" y2="26" stroke="currentColor" stroke-width="8"/></svg><p class="read small"></p>' +
    '<p class="small muted">The wall in front is drawn closer than real; the bar shows the ECHO pulse (full width = 4 m).</p></div>' : '') });
  const box = document.querySelector('.sonarbox');
  if (box) {
    box.querySelector('[data-k="cm"]').addEventListener('input', (e) => { sonar.cm = +e.target.value; sonarUpdate(); });
    box.querySelector('[data-a="ping"]').addEventListener('click', ping);
    box.querySelector('[data-a="auto"]').addEventListener('click', () => { if (sonar.auto) { clearInterval(sonar.auto); sonar.auto = 0; } else { ping(); sonar.auto = setInterval(ping, 500); } sonarUpdate(); });
  }
  sonarUpdate();
  return true;
}

// --- push button page: press it (on the board or in the card), watch DO, count presses, and see the contact bounce a real switch makes ---
const btn = { down: false, count: 0, trace: [] };
function btnPress(down) {
  if (down === btn.down) return;
  btn.down = down;
  if (down) btn.count++;
  // ponytail: a fixed made-up bounce pattern (real ones last 1–5 ms and differ every press)
  btn.trace = down ? [0, 0, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1] : [1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0];
  if (sensorNode) stage.glow(sensorNode, 'button_cap', down, 0x6fb6ff, 'anchor_button_button', 10);
  btnUpdate();
}
function btnUpdate() {
  const box = document.querySelector('.btnbox');
  if (!box) return;
  const pts = (btn.trace.length ? btn.trace : [0]).map((v, i, a) => `${(i / Math.max(1, a.length - 1)) * 200},${v ? 4 : 26}`).join(' ');
  box.querySelector('svg polyline').setAttribute('points', pts);
  box.querySelector('.read').innerHTML = `DO <b class="${btn.down ? 'hi' : ''}">${btn.down ? 'HIGH' : 'LOW'}</b> — ${btn.down ? 'pressed: VCC → DO, 0.33 mA through R1' : 'released: R1 pulls DO to 0 V'} · presses: <b>${btn.count}</b>`;
}
function focusBtn(name, k, info) {
  const s = SENSORS.button, get = (n) => sensorNode.getObjectByName(`button_${n}`);
  stage.focus(s.focus[k] ? s.focus[k].map(get).filter(Boolean) : sensorNode.getObjectByName(name), { title: info[0], anchor: sensorNode.getObjectByName(`anchor_button_${s.anchor[k] || k}`), html: `<p>${esc(info[1])}</p>` + (item.part ?
    '<div class="gasbox touchbox btnbox"><button type="button" class="hold" data-a="hold">👇 Press and hold</button><p class="read small"></p>' +
    '<svg viewBox="0 0 200 30" class="bounce" aria-label="DO while the contacts settle"><polyline fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" points="0,26 200,26"/></svg>' +
    '<p class="small muted">Contacts bounce for a few milliseconds when they meet or part (drawn above), so code waits ~20 ms (debounce) before trusting a change.</p></div>' : '') });
  const box = document.querySelector('.btnbox');
  if (box) {
    const hold = box.querySelector('[data-a="hold"]');
    hold.addEventListener('pointerdown', (e) => { hold.setPointerCapture(e.pointerId); stage.press(sensorNode.parent, 'button_cap', true); btnPress(true); });
    ['pointerup', 'pointercancel'].forEach((ev) => hold.addEventListener(ev, () => { if (btn.down) { stage.press(sensorNode.parent, 'button_cap', false); btnPress(false); } }));
  }
  btnUpdate();
  return true;
}

// --- DHT11 page: set the room, breathe on it, and see the 40-bit frame (and checksum) the sensor sends on DO ---------------------
const dht = { t: 26, rh: 55, breath: 0 };
function dhtUpdate() {
  if (!sensorNode) return;
  const box = document.querySelector('.dhtbox');
  if (!box) return;
  for (const k of ['t', 'rh']) { box.querySelector(`[data-k="${k}"]`).value = dht[k]; box.querySelector(`[data-o="${k}"]`).textContent = `${Math.round(dht[k])} ${k === 't' ? '°C' : '%'}`; }
  const f = dht11Frame(dht.t, dht.rh), names = ['RH', 'RH .', 'T', 'T .', 'sum'];
  box.querySelector('.frame').innerHTML = f.map((b, i) => `<span><small>${names[i]}</small><code>${b.toString(2).padStart(8, '0')}</code><small>${b}</small></span>`).join('');
  box.querySelector('.read').innerHTML = `Reads <b>${Math.round(dht.t)} °C</b> and <b>${Math.round(dht.rh)} %RH</b>. Checksum ${f[0]} + ${f[1]} + ${f[2]} + ${f[3]} = ${f[4]} ✓`;
}
function focusDht(name, k, info) {
  const s = SENSORS.dht11, get = (n) => sensorNode.getObjectByName(`dht11_${n}`);
  stage.focus(s.focus[k] ? s.focus[k].map(get).filter(Boolean) : sensorNode.getObjectByName(name), { title: info[0], anchor: sensorNode.getObjectByName(`anchor_dht11_${s.anchor[k] || k}`), html: `<p>${esc(info[1])}</p>` + (item.part ?
    '<div class="gasbox dhtbox"><label>Room <input type="range" min="0" max="50" value="26" data-k="t"><output data-o="t"></output></label>' +
    '<label>Humidity <input type="range" min="20" max="90" value="55" data-k="rh"><output data-o="rh"></output></label>' +
    '<div class="row-btns"><button type="button" data-a="breath">😮‍💨 Breathe on it</button></div><div class="frame"></div><p class="read small"></p></div>' : '') });
  const box = document.querySelector('.dhtbox');
  if (box) {
    box.querySelectorAll('input').forEach((i) => i.addEventListener('input', () => { clearInterval(dht.breath); dht[i.dataset.k] = +i.value; dhtUpdate(); }));
    box.querySelector('[data-a="breath"]').addEventListener('click', () => { // warm, wet breath: jumps, then drifts back over ~10 s
      clearInterval(dht.breath);
      const base = { t: Math.round(dht.t), rh: Math.round(dht.rh) };
      dht.t = Math.min(50, base.t + 4); dht.rh = Math.min(90, base.rh + 30); dhtUpdate();
      dht.breath = setInterval(() => { dht.t += (base.t - dht.t) * 0.15; dht.rh += (base.rh - dht.rh) * 0.15; dhtUpdate(); if (Math.abs(dht.rh - base.rh) < 0.5) clearInterval(dht.breath); }, 1000); // one reading a second, like the real part
    });
  }
  dhtUpdate();
  return true;
}

// --- LED module page: switch DI, dim with PWM, blink, and swap the colour (lens + silkscreen title) like the three real boards ---
const ledm = { tint: 'red', on: 0, duty: 255, blink: 0 };
const VF = { red: 2.0, yellow: 2.1, green: 2.2 }; // typical forward voltages
function ledUpdate() {
  if (!sensorNode) return;
  const lens = sensorNode.getObjectByName('led_lens');
  if (lens) { if (!lens.userData.own) { lens.material = lens.material.clone(); lens.userData.own = true; } lens.material.color.set(BODY[ledm.tint]); }
  stage.glow(sensorNode, 'led_lens', !!ledm.on && ledm.duty > 0, TL_COLOR[ledm.tint], 'anchor_led_led', 10);
  if (lens && ledm.on) lens.material.emissiveIntensity = 1.1 * ledm.duty / 255;
  const box = document.querySelector('.ledbox');
  if (!box) return;
  box.querySelectorAll('[data-tint]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tint === ledm.tint)));
  box.querySelector('[data-a="sw"]').textContent = ledm.on ? 'Switch off (DI LOW)' : 'Switch on (DI HIGH)';
  box.querySelector('[data-a="blink"]').textContent = ledm.blink ? '■ Stop blinking' : '▶ Blink 1 s';
  box.querySelector('[data-o="duty"]').textContent = `${ledm.duty}`;
  const mA = ((3.3 - VF[ledm.tint]) / 1000) * 1000 * (ledm.duty / 255);
  box.querySelector('.read').innerHTML = `DI <b class="${ledm.on ? 'hi' : ''}">${ledm.on ? (ledm.duty < 255 ? `PWM ${Math.round(ledm.duty / 2.55)} %` : 'HIGH') : 'LOW'}</b> — ${ledm.on ? `about ${mA.toFixed(1)} mA through R1` : 'LED off'}`;
}
function ledTint(t) { ledm.tint = t; sensorDecals(sensorNode, 'led', t); ledUpdate(); }
function focusLed(name, k, info) {
  const s = SENSORS.led, get = (n) => sensorNode.getObjectByName(`led_${n}`);
  stage.focus(s.focus[k] ? s.focus[k].map(get).filter(Boolean) : sensorNode.getObjectByName(name), { title: info[0], anchor: sensorNode.getObjectByName(`anchor_led_${s.anchor[k] || k}`), html: `<p>${esc(info[1])}</p>` + (item.part ?
    '<div class="gasbox ledbox"><div class="row-btns">' + ['red', 'yellow', 'green'].map((t) => `<button type="button" data-tint="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('') + '</div>' +
    '<div class="row-btns"><button type="button" data-a="sw"></button><button type="button" data-a="blink"></button></div>' +
    `<label>PWM <input type="range" min="0" max="255" value="${ledm.duty}" data-k="duty"><output data-o="duty"></output></label><p class="read small"></p></div>` : '') });
  const box = document.querySelector('.ledbox');
  if (box) {
    box.querySelectorAll('[data-tint]').forEach((b) => b.addEventListener('click', () => ledTint(b.dataset.tint)));
    box.querySelector('[data-a="sw"]').addEventListener('click', () => { clearInterval(ledm.blink); ledm.blink = 0; ledm.on ^= 1; ledUpdate(); });
    box.querySelector('[data-a="blink"]').addEventListener('click', () => {
      if (ledm.blink) { clearInterval(ledm.blink); ledm.blink = 0; } else { ledm.on = 1; ledm.blink = setInterval(() => { ledm.on ^= 1; ledUpdate(); }, 1000); }
      ledUpdate();
    });
    box.querySelector('[data-k="duty"]').addEventListener('input', (e) => { ledm.duty = +e.target.value; ledm.on = 1; ledUpdate(); });
  }
  ledUpdate();
  return true;
}

// --- buzzer page: hold to beep, pick the pitch, or play a short tune; Q2 switching and the vibrating body follow the sound -------
const bz = { hz: 2000, on: false, ctx: null, osc: null, tune: 0 };
function buzzSet(on, hz = bz.hz) {
  bz.on = on;
  try {
    bz.ctx ||= new AudioContext();
    if (on && !bz.osc) {
      const g = bz.ctx.createGain(); g.gain.value = 0.04;
      bz.osc = bz.ctx.createOscillator(); bz.osc.type = 'square';
      bz.osc.connect(g).connect(bz.ctx.destination); bz.osc.start();
    }
    if (bz.osc) bz.osc.frequency.value = hz;
    if (!on && bz.osc) { bz.osc.stop(); bz.osc = null; }
  } catch { /* no audio: the 3D board still shows it */ }
  buzzUpdate();
}
function buzzStop() { clearTimeout(bz.tune); bz.tune = 0; if (bz.on) buzzSet(false); }
function buzzUpdate() {
  if (!sensorNode) return;
  stage.vibrate(sensorNode, 'buzzer_body', bz.on, 'anchor_buzzer_buzzer');
  const box = document.querySelector('.bzbox');
  if (!box) return;
  box.querySelector('[data-o="hz"]').textContent = `${bz.hz} Hz`;
  box.querySelector('.read').innerHTML = `DI <b class="${bz.on ? 'hi' : ''}">${bz.on ? 'HIGH' : 'LOW'}</b> · Q2 <b class="${bz.on ? 'hi' : ''}">${bz.on ? 'ON' : 'OFF'}</b> — ${bz.on ? `buzzer sounding at ${bz.hz} Hz` : 'silent'}`;
}
const TUNE = [[262, 300], [294, 300], [330, 300], [262, 300], [330, 300], [349, 300], [392, 600]]; // C D E C E F G
function playTune(i = 0) {
  if (i >= TUNE.length || !sensorNode) { buzzStop(); return; }
  const [hz, ms] = TUNE[i];
  bz.hz = hz; buzzSet(true, hz);
  bz.tune = setTimeout(() => { buzzSet(false); bz.tune = setTimeout(() => playTune(i + 1), 60); }, ms);
}
function focusBuzzer(name, k, info) {
  const s = SENSORS.buzzer, get = (n) => sensorNode.getObjectByName(`buzzer_${n}`);
  stage.focus(s.focus[k] ? s.focus[k].map(get).filter(Boolean) : sensorNode.getObjectByName(name), { title: info[0], anchor: sensorNode.getObjectByName(`anchor_buzzer_${s.anchor[k] || k}`), html: `<p>${esc(info[1])}</p>` + (item.part ?
    `<div class="gasbox touchbox bzbox"><button type="button" class="hold" data-a="hold">🔊 Press and hold to beep</button>` +
    `<label>Pitch <input type="range" min="200" max="4000" step="50" value="${bz.hz}" data-k="hz"><output data-o="hz"></output></label>` +
    '<div class="row-btns"><button type="button" data-a="tune">♪ Play a tune</button></div><p class="read small"></p></div>' : '') });
  const box = document.querySelector('.bzbox');
  if (box) {
    const hold = box.querySelector('[data-a="hold"]');
    hold.addEventListener('pointerdown', (e) => { hold.setPointerCapture(e.pointerId); buzzStop(); buzzSet(true); });
    ['pointerup', 'pointercancel'].forEach((ev) => hold.addEventListener(ev, () => bz.on && buzzSet(false)));
    box.querySelector('[data-k="hz"]').addEventListener('input', (e) => { bz.hz = +e.target.value; if (bz.on) buzzSet(true); else buzzUpdate(); });
    box.querySelector('[data-a="tune"]').addEventListener('click', () => { buzzStop(); playTune(); });
  }
  buzzUpdate();
  return true;
}

// --- traffic light page: click an LED to switch it, or run the red → green → yellow cycle a lesson would program ------------
const TL_COLOR = { red: 0xff2a1a, yellow: 0xffc21a, green: 0x22ff55 };
const TL_CYCLE = [['red', 3000], ['green', 3000], ['yellow', 1000]];
const tl = { on: { red: 0, yellow: 0, green: 0 }, cycle: false, step: 0, timer: 0 };
function lightsUpdate() {
  if (!sensorNode) return;
  for (const c of Object.keys(tl.on)) stage.glow(sensorNode, `traffic_led_${c}`, !!tl.on[c], TL_COLOR[c], `anchor_traffic_${c}`, 9);
  const box = document.querySelector('.tlbox');
  if (!box) return;
  box.querySelector('[data-a="cycle"]').textContent = tl.cycle ? '■ Stop cycle' : '▶ Run traffic cycle';
  box.querySelector('.read').innerHTML = ['red', 'yellow', 'green'].map((c) => `${c[0].toUpperCase()} <b class="${tl.on[c] ? 'hi' : ''}">${tl.on[c] ? 'HIGH' : 'LOW'}</b>`).join(' · ');
}
function tlStep() {
  if (!tl.cycle || !sensorNode) return;
  const [c, ms] = TL_CYCLE[tl.step % TL_CYCLE.length];
  tl.on = { red: 0, yellow: 0, green: 0, [c]: 1 };
  lightsUpdate();
  tl.step++;
  tl.timer = setTimeout(tlStep, ms);
}
function focusTraffic(name, k, info) {
  const c = k.replace(/^led_/, '');
  if (c in tl.on) { tl.cycle = false; clearTimeout(tl.timer); tl.on[c] ^= 1; }
  stage.focus(sensorNode.getObjectByName(name), { title: info[0], anchor: sensorNode.getObjectByName(`anchor_traffic_${SENSORS.traffic.anchor[k] || k}`), html: `<p>${esc(info[1])}</p>` + (item.part ?
    '<div class="gasbox tlbox"><div class="row-btns"><button type="button" data-a="cycle"></button><button type="button" data-a="off">All off</button></div><p class="read small"></p>' +
    '<p class="small muted">Cycle: red 3 s → green 3 s → yellow 1 s, like the traffic-light lesson.</p></div>' : '') });
  const box = document.querySelector('.tlbox');
  if (box) {
    box.querySelector('[data-a="cycle"]').addEventListener('click', () => { tl.cycle = !tl.cycle; clearTimeout(tl.timer); if (tl.cycle) { tl.step = 0; tlStep(); } else lightsUpdate(); });
    box.querySelector('[data-a="off"]').addEventListener('click', () => { tl.cycle = false; clearTimeout(tl.timer); tl.on = { red: 0, yellow: 0, green: 0 }; lightsUpdate(); });
  }
  lightsUpdate();
  return true;
}

// --- OLED page: type a message and it appears on the 128 x 64 screen, as oled.println() would draw it ----------------------
const oledMsg = { text: 'Hello, Robo Coders!\n\nI2C 0x3C\n128 x 64 pixels', invert: false };
function focusOled(name, k, info) {
  const s = SENSORS.oled, get = (n) => sensorNode.getObjectByName(`oled_${n}`);
  stage.focus(s.focus[k] ? s.focus[k].map(get).filter(Boolean) : sensorNode.getObjectByName(name), { title: info[0], anchor: sensorNode.getObjectByName(`anchor_oled_${s.anchor[k] || k}`), html: `<p>${esc(info[1])}</p>` + (item.part ?
    `<div class="gasbox oledbox"><textarea rows="4" maxlength="168" spellcheck="false" aria-label="Text on the OLED">${esc(oledMsg.text)}</textarea>` +
    `<div class="row-btns"><button type="button" data-a="invert">Invert</button><button type="button" data-a="clear">Clear</button></div>` +
    '<p class="small muted">21 characters × 8 lines, the default 6 × 8 font.</p></div>' : '') });
  const box = document.querySelector('.oledbox');
  if (box) {
    const ta = box.querySelector('textarea'), draw = () => stage.oled(sensorNode, oledMsg.text, oledMsg.invert);
    ta.addEventListener('input', () => { oledMsg.text = ta.value; draw(); });
    box.querySelector('[data-a="invert"]').addEventListener('click', () => { oledMsg.invert = !oledMsg.invert; draw(); });
    box.querySelector('[data-a="clear"]').addEventListener('click', () => { oledMsg.text = ta.value = ''; draw(); });
  }
  return true;
}

// --- touch page: the pad, J1 (toggle) and J2 (active LOW) drive OUT and LED1 like a real TTP223 ---------------------------
const ttp = { q: 0, last: false, tog: 0, ahlb: 0 };
let touching = false, touchOut = 0;
function touchPress(down) { touching = down; touchOut = ttp223(ttp, down); touchUpdate(); }
function touchUpdate() {
  if (!sensorNode) return;
  if (!touching) touchOut = ttp223(ttp, false);
  stage.glow(sensorNode, 'touch_led', !!touchOut, 0xffd21a, 'anchor_touch_led', 6);
  stage.glow(sensorNode, 'touch_pad', touching, 0x6fb6ff, 'anchor_touch_pad', 34);
  ['j1', 'j2'].forEach((j, i) => { const o = sensorNode.getObjectByName(`touch_${j}_solder`); if (o) o.visible = !!(i ? ttp.ahlb : ttp.tog); });
  const box = document.querySelector('.touchbox');
  if (!box) return;
  box.querySelector('[data-j="tog"]').checked = !!ttp.tog;
  box.querySelector('[data-j="ahlb"]').checked = !!ttp.ahlb;
  box.querySelector('.read').innerHTML = `OUT (DO) <b class="${touchOut ? 'hi' : ''}">${touchOut ? 'HIGH' : 'LOW'}</b> — LED1 ${touchOut ? 'on' : 'off'} · ${touching ? 'finger on the pad' : 'no touch'} · ${ttp.tog ? 'toggle' : 'momentary'}, active ${ttp.ahlb ? 'LOW' : 'HIGH'}`;
}
function focusTouch(name, k, info) {
  if (k === 'j1') ttp.tog ^= 1;
  if (k === 'j2') ttp.ahlb ^= 1;
  if (k === 'j1' || k === 'j2') { ttp.q = 0; ttp.last = false; }
  const s = SENSORS.touch, get = (n) => sensorNode.getObjectByName(`touch_${n}`);
  stage.focus(s.focus[k] ? s.focus[k].map(get).filter(Boolean) : sensorNode.getObjectByName(name), { title: info[0], anchor: sensorNode.getObjectByName(`anchor_touch_${k}`), html: `<p>${esc(info[1])}</p>` + (item.part ?
    `<div class="gasbox touchbox"><button type="button" class="hold" data-a="hold">✋ Press and hold to touch the pad</button>` +
    `<label class="chk"><input type="checkbox" data-j="tog"> J1 closed · toggle mode</label><label class="chk"><input type="checkbox" data-j="ahlb"> J2 closed · active LOW</label>` +
    `<p class="read small"></p><p class="small muted">You can also press the pad on the 3D board.</p></div>` : '') });
  const box = document.querySelector('.touchbox');
  if (box) {
    const hold = box.querySelector('[data-a="hold"]');
    hold.addEventListener('pointerdown', (e) => { hold.setPointerCapture(e.pointerId); touchPress(true); });
    ['pointerup', 'pointercancel'].forEach((ev) => hold.addEventListener(ev, () => touching && touchPress(false)));
    box.querySelectorAll('[data-j]').forEach((c) => c.addEventListener('change', () => { ttp[c.dataset.j] = +c.checked; ttp.q = 0; ttp.last = false; touchOut = ttp223(ttp, touching); touchUpdate(); }));
  }
  touchUpdate();
  return true;
}

// --- lesson assembly: modules go in one by one, then the upload procedure, then the program runs ---
let assembly = null;
function setPower(on) { basePower = on; if (baseNode) stage.move(baseNode, 'base_sw1_cap', [0, on ? -1.2 : 0, 0]); powerLed(); }
function startAssembly(kit) {
  if (item.jr) {
    assembly = createAssembly(kit, {
      procedure: JR_PROCEDURE,
      highlight: (obj) => stage.highlight(obj),
      onStep: (i) => document.querySelectorAll('.steps.live li').forEach((li) => li.classList.toggle('now', +li.dataset.i === i)),
      act(key) { // SW1 stays off while the modules go in, then on
        if (key === 'reset') { jr.power = false; jr.hold = [0, 0, 0, 0]; }
        if (key === 'power-on') jr.power = true;
        jrUpdate();
      },
    });
    return assembly.seek(0);
  }
  assembly = createAssembly(kit, {
    highlight: (obj) => stage.highlight(obj),
    onStep: (i) => document.querySelectorAll('.steps.live li').forEach((li) => li.classList.toggle('now', +li.dataset.i === i)),
    act(key, instant) {
      if (key === 'reset') { stopSim(); stage.usbCable(espNode, false); setPower(true); return; }
      if (key === 'power-off') { setPower(false); if (!instant) serialLine('SW1 off: no power while you wire and upload.', 'warn'); }
      if (key === 'blocks' && !instant) { const c = $('#code-card'); c.classList.add('pulse'); setTimeout(() => c.classList.remove('pulse'), 1600); }
      if (key === 'upload') { stage.usbCable(espNode, true); if (!instant) { mon.clear(); uploadLog({}); } }
      if (key === 'power-on') { stage.usbCable(espNode, false); setPower(true); if (!instant) serialLine('USB out, battery in, SW1 on — running from the battery.', 'sys'); }
      if (key === 'observe') { if (instant) serialLine('USB out, battery in, SW1 on — running from the battery.', 'sys'); startSim(true); } // Skip to working: same status line the full assembly prints
    },
  });
  assembly.seek(0);
}

function toggleUsb() {
  usbPlugged = !usbPlugged;
  if ((item.kit?.length || item.chassis)) return; // kit lessons: power comes from the battery
  stage.usbCable(espNode, usbPlugged);
  if (!usbPlugged) stopSim();
  powerLed();
  if (!item.part) serialLine(usbPlugged ? 'USB connected — the board has power.' : 'USB unplugged — the board is off.', usbPlugged ? 'sys' : 'warn');
}
function resetBoard() {
  if (!powered()) return serialLine('No power: click the USB port to plug the cable in.', 'warn');
  const was = !!running;
  stopSim();
  if (!item.part) mon.clear();
  stage.glow(espNode, 'esp32_led_power', false);
  setTimeout(powerLed, 160);
  const log = bootHeld
    ? ['ets Jun  8 2016 00:22:57', '', 'rst:0x1 (POWERON_RESET),boot:0x3 (DOWNLOAD_BOOT(UART0/UART1/SDIO_REI_REO_V2))', 'waiting for download']
    : ['ets Jun  8 2016 00:22:57', '', 'rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)', 'configsip: 0, SPIWP:0xee', 'mode:DIO, clock div:1', 'entry 0x400805e4'];
  if (!item.part) log.forEach((l) => serialLine(l, 'boot'));
  if (was && !bootHeld) setTimeout(() => startSim(true), 450);
}

function renderTab() {
  document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  const el = $('#tab-body');
  const info = item.part ? PARTS[item.id] || {} : item;
  if (item.kitbox) { // same panel on every tab
    const n = (lv) => allParts().filter((id) => partLevel(id) === lv).length;
    const first = lessonList()[1]; // the next lesson in the book (Chassis assembly in Level 3)
    el.innerHTML = `<h2>Chapter 1 · Explore your kit</h2><p>Before the projects, meet every part in your Robo Coders kit box: all ${allParts().length} of them. Click any part, in the box or on the workbench, to see its name; double-click it to open its page. Look inside the box shows every part in its pocket from above.</p>` +
      `<ul class="feat"><li>Every book: ${n(0)} parts (brain, cables, battery)</li><li>Level 1: ${n(1)} · Level 2: ${n(2)} · Level 3: ${n(3)}</li><li>Extra: ${n(-1)} parts, in the box but in no book yet</li></ul>` +
      `<div class="chips"><a href="#/l${lvl}/lesson/${first.id}" data-kitdone>Done exploring: start the lessons</a><a href="#" data-kitinside>${kitInsideOn ? 'Unpack onto the workbench' : 'Look inside the box'}</a><a href="#" data-kitreplay>Open the box again</a></div>`;
    el.querySelector('[data-kitreplay]').addEventListener('click', (e) => { e.preventDefault(); kitOpened = false; kitInsideOn = false; route(); });
    el.querySelector('[data-kitinside]').addEventListener('click', (e) => { e.preventDefault(); kitInsideOn = !kitInsideOn; build?.kitInside(kitInsideOn); renderTab(); });
    el.querySelector('[data-kitdone]').addEventListener('click', () => { if (!done.has('kit')) toggleDone('kit'); });
    return;
  }
  if (tab === 'overview') {
    el.innerHTML = `<h2>${esc(item.part ? item.name : item.heading)}</h2><p>${esc(item.part ? info.blurb || '' : item.lede)}</p>` +
      `<ul class="feat">${(info.features || []).map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` + (kitJr && item.part && JR_NOTE[item.id] && item.id !== 'jr_board' ? `<p class="obs"><b>On the Jr. board</b>${esc(JR_NOTE[item.id])}</p>` : '') + (item.jr ? jrCard() : '') +
      (item.observation ? `<p class="obs"><b>Observation</b>${esc(item.observation)}</p>` : '');
    if (item.jr) { jrWire(el); jrUpdate(); }
  } else if (tab === 'steps') {
    if (item.part) {
      const cable = +item.id.match(/^jst(\d)$/)?.[1]; // a cable is used wherever a module needs that many pins
      const uses = cable ? (kitJr ? JR_LESSONS.filter((l) => l.kit.some((m) => cablePins(m) === cable)) : bookPool().filter((l) => (l.kit.length || l.chassis ? withBattery(l.kit) : l.kit).some((m) => cablePins(m) === cable)))
        : kitJr ? JR_LESSONS.filter((l) => item.id === 'jr_board' || jrWithBattery(l.kit).some((m) => m.id === item.id))
        : bookPool().filter((l) => (l.kit.length || l.chassis ? withBattery(l.kit) : l.kit).some((m) => m.id === item.id) || ['base', 'esp32'].includes(item.id) || (l.chassis && ['chassis', 'tt_motor', 'wheel', 'tb6612'].includes(item.id)));
      el.innerHTML = '<h2>Used in</h2>' + (uses.length ? `<div class="chips">${uses.map((l) => `<a href="#/${kitJr ? 'jr/' : `l${l.level || lvl}/`}lesson/${l.id}">${esc(l.level ? `Level ${l.level} · ${l.cardTitle}` : l.cardTitle)}</a>`).join('')}</div>` : '<p class="muted">No lesson uses this part yet.</p>');
    } else {
      const live = !item.scratch && (item.jr || item.kit.length || item.chassis);
      el.innerHTML = (item.craft ? `<h2>Craft first</h2><ol class="steps">${item.craft.map((c) => `<li>${esc(c)}</li>`).join('')}</ol>` : '') + `<h2>${item.jr ? 'Build the circuit' : 'Instructions'}</h2>${live ? '<div class="asm-bar"><button data-asm="replay">▶ Replay assembly</button><button data-asm="skip">Skip to working</button></div>' : ''}` +
        `<ol class="steps${live ? ' live' : ''}">${(item.jr ? jrSteps(item) : item.scratch ? item.steps : steps(item)).map((s, i) => `<li data-i="${i}"${assembly?.st.step === i ? ' class="now"' : ''}>${esc(s)}</li>`).join('')}</ol>` +
        `<p class="obs"><b>Observation</b>${esc(item.observation)}</p>` + (item.jr ? jrCard() : ''); // Jr: try it right under the steps
      if (item.jr) { jrWire(el); jrUpdate(); }
    }
  } else if (tab === 'pinout' && item.scratch) { // the "Blocks" tab: each block, drawn, and what it does
    el.innerHTML = `<table class="sc-ref"><tr><th>Block</th><th>What it does</th></tr>${item.ref.map(([b, w]) => `<tr><td>${sb(b)}</td><td>${esc(w)}</td></tr>`).join('')}</table>`;
  } else if (tab === 'pinout') {
    const rows = item.part
      ? Object.entries(item.pins || {}).map(([a, label]) => [a.replace(`anchor_${item.id}_`, ''), label || '—', a])
      : (item.pinout || []).map(([p, f]) => [p, f, null]);
    el.innerHTML = rows.length
      ? `<table><tr><th>${item.part ? 'Pin' : 'Pin / port'}</th><th>${item.part ? 'What it is (schematic)' : 'Connects to'}</th></tr>` +
        rows.map(([p, f, a]) => `<tr${a ? ` data-anchor="${a}"` : ''}><td>${esc(p)}</td><td>${esc(f)}</td></tr>`).join('') + '</table>'
      : '<p class="muted">No pins on this part.</p>';
    el.querySelectorAll('tr[data-anchor]').forEach((tr) => {
      tr.addEventListener('mouseenter', () => stage.highlight(tr.dataset.anchor));
      tr.addEventListener('mouseleave', () => stage.highlight(null));
    });
  } else {
    const d = item.part && item.dimensions_mm;
    const rows = item.part
      ? [['Size (w × d × h)', `${d.w} × ${d.d} × ${d.h} mm`], ['Size source', d.source], ['Interface', item.interface], ['Voltage', item.voltage], ['Model status', item.status]]
      : item.specs || [];
    el.innerHTML = `<table>${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>` +
      (item.part && item.todo?.length ? `<p class="todo"><b>To confirm:</b> ${item.todo.map(esc).join(' · ')}</p>` : '');
  }
}

// --- code card: blocks / C++ / inputs / pins / signals / serial ------------------------------------
const param = (key) => +(values[item.id]?.[key] ?? item.params?.find((p) => p.key === key)?.value ?? 0);
const usedPins = () => blockPins(prog);

function renderCode() {
  $('#code-card').hidden = !!(item.part || item.jr); // the Jr. kit has no code: its Try it panel is in the Overview
  if (item.part || item.jr) return;
  if (item.scratch) return renderScratchCode(); // blocks only
  document.querySelectorAll('[data-code]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.code === view)));
  $('#params').innerHTML = (item.params || []).map((p) =>
    `<label>${esc(p.label)}<input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${param(p.key)}" data-key="${p.key}"><output>${param(p.key)} ${esc(p.unit || '')}</output></label>`).join('');
  $('#params').querySelectorAll('input').forEach((inp) => inp.addEventListener('input', () => {
    (values[item.id] ||= {})[inp.dataset.key] = +inp.value;
    store.set('values', values);
    inp.nextElementSibling.textContent = `${inp.value} ${item.params.find((p) => p.key === inp.dataset.key).unit || ''}`;
    if (rig && inp.dataset.key === 'cm') setObstacleCm(+inp.value);
    if (lamp && inp.dataset.key === 'light') lampUpdate();
    if (inp.dataset.key === 'ircm') { irWave(false); setIrCm(+inp.value); }
    if (line && inp.dataset.key === 'drift') line.set(+inp.value);
  }));
  $('#blocks').hidden = view !== 'blocks';
  $('.src').hidden = view !== 'cpp';
  if (view === 'blocks') blockMap = renderBlocks($('#blocks'), prog, () => { edits[item.id] = prog; store.set('blocks', edits); renderSrc(); renderPins(); restart(); });
  renderSrc();
  renderPins();
  if (!running && !uploading) { mon.clear(); mon.status('idle'); drawSignals([]); }
  { // open the editor at the part that repeats (loop / forever), not at setup
    const box = view === 'cpp' ? $('.src') : $('#blocks');
    const at = view === 'cpp' ? [...box.querySelectorAll('.l')].find((l) => /\bvoid loop\b/.test(l.textContent)) : box.querySelector('.bk.forever');
    if (at) box.scrollTop = Math.max(0, at.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 8);
  }
}

function renderSrc() {
  const cw = cppWithLines(prog);
  lineOf = cw.lineOf;
  $('#code').innerHTML = highlight(cw.code);
}
/** light up the C++ line of the statement that is running, and keep it in view */
let userScrolledAt = 0; // last time the reader scrolled the C++ view by hand
function markLine(st) {
  const src = $('.src'), prev = src.querySelector('.l.now'), el = st && src.querySelectorAll('.l')[lineOf.get(st)];
  prev?.classList.remove('now');
  if (!el) return;
  el.classList.add('now');
  if (Date.now() < userScrolledAt + 4000) return; // the reader scrolled: don't pull them back for a few seconds
  if (el.offsetTop < src.scrollTop || el.offsetTop + el.offsetHeight > src.scrollTop + src.clientHeight) src.scrollTop = el.offsetTop - src.clientHeight / 2;
}
let cardHome = null; // where the editor card lives while it is not expanded
function toggleExpand(on = !$('#code-card').classList.contains('max')) {
  const card = $('#code-card');
  if (on && !cardHome) { cardHome = [card.parentNode, card.nextSibling]; document.body.append(card); } // out of the side panel's stacking context
  if (!on && cardHome) { cardHome[0].insertBefore(card, cardHome[1]); cardHome = null; }
  card.classList.toggle('max', on);
  $('#expand').setAttribute('aria-pressed', String(on));
  document.body.classList.toggle('code-max', on);
}
/** what the Arduino IDE prints while it builds and flashes the sketch (sizes estimated from the code), then the ESP32 boot ROM */
async function uploadLog(token) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const size = 262000 + toCpp(prog).length * 37, kb = (n) => n.toLocaleString('en-US');
  const status = (st) => { if (!running) mon.status(st); }; // never overwrite 'running'
  status('compiling');
  serialLine('Compiling sketch…', 'sys'); await wait(550); if (token.cancel) return false;
  serialLine(`Sketch uses ${kb(size)} bytes (${Math.round((size / 1310720) * 100)}%) of program storage space. Maximum is 1,310,720 bytes.`, 'sys');
  status('uploading');
  serialLine('Connecting to ESP32 on USB…', 'sys'); await wait(450); if (token.cancel) return false;
  serialLine('Chip is ESP32-D0WD-V3 (revision v3.0) · Uploading stub… Changing baud rate to 921600', 'sys');
  for (const pct of [25, 50, 75, 100]) { await wait(260); if (token.cancel) return false; serialLine(`Writing at 0x${(0x10000 + Math.round((size * pct) / 100)).toString(16).padStart(8, '0')}… (${pct} %)`, 'sys'); }
  serialLine(`Wrote ${kb(size)} bytes in 1.6 seconds. Hard resetting via RTS pin…`, 'sys'); await wait(350); if (token.cancel) return false;
  ['rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)', 'load:0x3fff0030,len:1184 · entry 0x400805e4'].forEach((l) => serialLine(l, 'boot'));
  return true;
}

function renderPins(state = new Map()) {
  $('#pins').innerHTML = usedPins().map((g) => `<span class="pin${state.get(g)?.v ? ' hi' : ''}" data-g="${g}">IO${g}<i>${state.get(g)?.v ? 'HIGH' : 'LOW'}</i></span>`).join('');
}

function highlight(src) {
  const re = /(\/\/.*)|("(?:[^"\\]|\\.)*")|(\b\d+(?:\.\d+)?\b)|(#include|\b(?:void|int|float|const|if|else|return|HIGH|LOW|OUTPUT|INPUT)\b)|(\b[A-Za-z_]\w*(?=\())/g;
  return src.replace(/\n$/, '').split('\n').map((line) => `<span class="l">${esc(line).replace(/&quot;/g, '"').replace(re, (m, c, s, n, k) =>
    c ? `<span class="c">${m}</span>` : s ? `<span class="s">${m}</span>` : n ? `<span class="n">${m}</span>` : k ? `<span class="k">${m}</span>` : `<span class="f">${m}</span>`)}</span>`).join('');
}

function serialLine(t, kind = '') { mon.line(t, kind); }

async function startSim(keepSerial) {
  if (item.part || item.jr || running || uploading) return;
  if (item.scratch) return startScratch();
  if (!powered()) { sfx.locked(); mon.status('off'); return serialLine('No power: click the USB port on the board to plug the cable in.', 'warn'); }
  if (!keepSerial) { // ▶ in the editor: build and flash first, like the real IDE
    const token = uploading = { cancel: false }, current = item;
    mon.clear(); $('#run').classList.add('running');
    const ok = await uploadLog(token);
    if (uploading === token) uploading = null;
    if (!ok || token.cancel || current !== item) return;
  }
  let active = null;
  const hw = createHw(stage, kitInfo, {
    param,
    distance: arena?.sonarOn ? () => { stage.settleCar(); const p = arenaPose(); return Math.max(2, sonarCm(...sensorsAt(p, arena.car).sonar, p.th, arena.A) + (Math.random() - 0.5) * 0.6); } : rig ? () => { const d = reading(rig.st.kind, rig.st.cm); rig.ping(d > 0); stage.setCalloutText('obstacle', d ? `${d.toFixed(0)} cm` : 'no echo'); return d; } : null,
    analog: lamp ? (m) => { if (m.id !== 'ldr') return null; const n = Math.max(0, Math.min(4095, ldrNow().n + Math.round((Math.random() - 0.5) * 16))); stage.setCalloutText(MAIN_ANCHOR.ldr, `${lamp.port} reads ${n}`); return n; } : null,
    digital: (m) => (arena?.A.track && m.id === 'ir' ? (stage.settleCar(), +onTape(...sensorsAt(arenaPose(), arena.car)[m.port === 'd36' ? 'irL' : 'irR'], arena.A.track)) // the arena's tape: 1 over black
      : irRig && m.id === 'ir' ? +irRig.hit() // Tech Explorers L2: D34 reads 1 while the module sees something (book p. 144)
      : lamp && m.id === 'ldr' ? +ldrNow().bright // DO = 1 in bright light (Tech Explorers L2, p. 127)
      : line && m.id === 'ir' ? lineSensors(line.drift)[m.port === 'd36' ? 0 : 1] : null), // line follower: left IR on D36, right on D35
    motor: (mo) => { if (arena) setArenaMotor(+mo.a || 0, +mo.b || 0); if (line) { line.a = +mo.a || 0; line.b = +mo.b || 0; } },
    serial: serialLine,
    step(st) { active?.classList.remove('active'); active = blockMap.get(st); active?.classList.add('active'); markLine(st); },
    pin(g, v) {
      if (espNode && GPIO_PIN[g]) { stage.glow(espNode, `esp32_pin_${GPIO_PIN[g]}`, v, 0xff8a2a, `anchor_esp32_${GPIO_PIN[g]}`, 5); pinGlow.add(g); }
      if (tbNode && GPIO_TB[g]) { stage.glow(tbNode, `tb6612_pin_${GPIO_TB[g]}`, v, 0xff8a2a, `anchor_tb6612_${GPIO_TB[g]}`, 5); portGlow.add(`tb:${GPIO_TB[g]}`); }
      if (baseNode) Object.entries(PORTS).forEach(([p, d]) => Object.entries(d.pins).forEach(([n, gp]) => {
        if (gp === g) { stage.glow(baseNode, `base_${p}_pin_${n}`, v, 0xff8a2a, `anchor_base_${p}_pin${n}`, 5); portGlow.add(`${p}_pin_${n}`); }
      }));
      const chip = $(`.pin[data-g="${g}"]`); if (chip) { chip.classList.toggle('hi', !!v); chip.querySelector('i').textContent = v ? 'HIGH' : 'LOW'; } },
  });
  running = { hw, clear: () => { active?.classList.remove('active'); markLine(null); } };
  if (line) running.tick = setInterval(() => { // the oval curves; the program's steering pulls the car back over the tape
    line.set(lineStep(line.drift, line.a, line.b, 3 * Math.sin(performance.now() / 2500)));
    const inp = $('#params [data-key="drift"]'); if (inp) { inp.value = Math.round(line.drift); inp.nextElementSibling.textContent = Math.round(line.drift); }
  }, 100);
  if (rig && store.get('obstacleDrive', false)) obstacleDrive(true);
  if (irRig && store.get('irWave', true)) irWave(true);
  mon.status('running');
  $('#run').classList.add('running');
  $('#stage').classList.add('live');
  run(prog, hw).catch((e) => serialLine(`Error: ${e.message}`, 'warn'));
  (function plot() { if (running?.hw === hw) { drawSignals(hw.history, hw.now()); requestAnimationFrame(plot); } })();
  if (!done.has(item.id)) toggleDone(item.id);
}
function stopSim() {
  obstacleDrive(false); irWave(false);
  if (arena) arena.motor = [0, 0];
  if (uploading) { uploading.cancel = true; uploading = null; serialLine('Upload cancelled.', 'warn'); mon.status('stopped'); }
  $('#run').classList.remove('running');
  if (!running) return;
  clearInterval(running.tick);
  running.hw.stop();
  running.clear();
  pinGlow.forEach((g) => stage.glow(espNode, `esp32_pin_${GPIO_PIN[g]}`, false));
  pinGlow.clear();
  portGlow.forEach((k) => (k.startsWith('tb:') ? stage.glow(tbNode, `tb6612_pin_${k.slice(3)}`, false) : stage.glow(baseNode, `base_${k}`, false)));
  portGlow.clear();
  running = null;
  mon.status('stopped');
  $('#stage').classList.remove('live');
  if (!item.scratch) renderPins();
}
function restart() { if (running) { stopSim(); startSim(); } }

// signal plot: one lane per pin used by the program, last 6 s
function drawSignals(history, now = 0) {
  const c = $('#signals'), g = c.getContext('2d');
  const pins = usedPins(), dpr = devicePixelRatio || 1;
  const W = c.clientWidth, H = Math.max(28, pins.length * 22 + 8);
  c.style.height = `${H}px`; c.width = W * dpr; c.height = H * dpr;
  g.scale(dpr, dpr);
  g.clearRect(0, 0, W, H);
  g.font = '11px "JetBrains Mono", monospace';
  const span = 6000, x0 = 46, x = (t) => x0 + ((t - (now - span)) / span) * (W - x0 - 6);
  pins.forEach((pin, i) => {
    const top = 6 + i * 22, hi = top + 3, lo = top + 16;
    g.fillStyle = '#8ea3cc'; g.fillText(`IO${pin}`, 4, lo);
    g.strokeStyle = 'rgb(255 255 255 / .12)'; g.beginPath(); g.moveTo(x0, lo + 0.5); g.lineTo(W - 6, lo + 0.5); g.stroke();
    let v = 0, px = x0;
    g.strokeStyle = '#6ea2ff'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, lo);
    for (const [t, p, val] of history) {
      if (p !== pin) continue;
      const tx = Math.max(x0, x(t));
      if (tx > px) { g.lineTo(tx, v ? hi : lo); px = tx; }
      v = val; g.lineTo(px, v ? hi : lo);
    }
    g.lineTo(W - 6, v ? hi : lo); g.stroke(); g.lineWidth = 1;
  });
}

// --- lesson / component strip --------------------------------------------------------------------
/** component ids in the kids' order: brain, inputs, outputs, power & motion, robot body */
let kitJr = false, jrBuild = false, lvl = 0, sc = false; // lvl: Tech Explorers book 1–3, 0 = Classic. which kit the page is in: Robo Coders (ESP32) or Jr. Explorer (no code); Jr build guide or lessons. sc: a Scratch Coding lesson
const NOT_KIT = ['jr_board', 'cat']; // models that are not Robo Coders kit parts
const KIT_CHAPTER = { id: 'kit', kitbox: true, part: true, cardTitle: 'Explore your kit', name: 'Explore your kit', thumb: 'base', kit: [], blocks: { setup: [], loop: [] } };
const CHASSIS_CHAPTER = { id: 'l3-chassis', chassisBuild: true, cardTitle: 'Chassis assembly', thumb: 'chassis', kit: [], blocks: { setup: [], loop: [] } }; // book 3: opens the bare-car build
const lessonList = () => (sc ? SCRATCH_LESSONS : kitJr ? (jrBuild ? JR_BUILD : JR_LESSONS) : lvl ? [KIT_CHAPTER, ...(lvl === 3 ? [CHASSIS_CHAPTER] : []), ...levelLessons(lvl)] : []); // every book starts with Explore your kit
const bookPool = () => (lvl ? lessonList() : allLessons()); // "Used in": this book, or every book from the kit box
const pfx = () => (sc ? 'scratch/' : kitJr ? 'jr/' : lvl ? `l${lvl}/` : ''); // route prefix: Jr kit, a book, or Classic
const lastKey = () => (sc ? 'lastScratch' : lvl ? `last${lvl}` : 'last');
const kindWord = () => (jrBuild ? 'build' : 'lesson');
const groupOf = (id) => { if (!kitJr) return partGroup(id); const i = JR_PART_GROUPS.findIndex(([, ids]) => ids.includes(id)); return i < 0 ? [99, 'Other', 0] : [i, JR_PART_GROUPS[i][0], JR_PART_GROUPS[i][1].indexOf(id)]; };
const bookParts = (n) => manifest.map((m) => m.id).filter((id) => !NOT_KIT.includes(id) && (!n || levelParts(n).includes(id))).sort((a, b) => { const [ga, , ia] = partGroup(a), [gb, , ib] = partGroup(b); return ga - gb || ia - ib; });
const partOrder = () => (kitJr ? JR_PARTS.filter((id) => manifest.some((m) => m.id === id)) : bookParts(lvl));
/** [parts opened, parts in the book's Components row] */
const partsSeen = (n) => { const all = bookParts(n); return [all.filter((id) => seen.has(id)).length, all.length]; };
const firstNew = (n) => { const all = bookParts(n); return all.find((id) => !seen.has(id)) || all[0]; };
/** Opening a part ticks it. The last one in a book finishes "Explore your kit" and points to the first lesson. */
function markSeen(id) {
  if (seen.has(id) || !bookParts(lvl).includes(id)) return;
  seen.add(id); store.set('seenParts', [...seen]); push({ addParts: [id] });
  const [got, all] = partsSeen(lvl);
  if (got < all) return;
  if (!done.has('kit')) toggleDone('kit');
  try { sessionStorage.removeItem(`lx:book${lvl}`); } catch { /* storage off */ } // the book page then opens on the next project (launcher.js remembers the last tile)
  const next = lessonList().find((l) => !done.has(l.id) && l.id !== 'kit'); // L3: the Chassis assembly comes first
  setTimeout(() => { banner(`<b>All parts explored<em>${all} of ${all}</em></b><small>You know your kit. Now build your first project.</small>${next ? `<a class="rw-go" href="#/l${lvl}/lesson/${next.id}">Start the lessons</a>` : ''}`, { ms: 8000 }); sfx.ok(); }, 600);
}
let partFilter = store.get('partFilter', 'All');
const kitBox = () => !!item?.kitbox; // Explore your kit: the whole box, filtered by book level
const shownParts = () => partOrder().filter((id) => partFilter === 'All' || groupOf(id)[1] === partFilter); // the strip, after the filter
const allParts = () => manifest.map((m) => m.id).filter((id) => !NOT_KIT.includes(id)).sort((a, b) => { const [ga, , ia] = partGroup(a), [gb, , ib] = partGroup(b); return ga - gb || ia - ib; });
function renderFilters() {
  const f = $('#filters');
  f.hidden = mode !== 'parts';
  if (f.hidden) return;
  const count = (g) => partOrder().filter((id) => g === 'All' || groupOf(id)[1] === g).length;
  if (count(partFilter) === 0) partFilter = 'All'; // a group the other kit doesn't have
  f.innerHTML = ['All', ...(kitJr ? JR_PART_GROUPS : PART_GROUPS).map(([g]) => g)].map((g) =>
    `<button type="button" data-f="${esc(g)}" class="g-${g[0].toLowerCase()}" aria-pressed="${g === partFilter}">${esc(g)} <i>${count(g)}</i></button>`).join('');
  f.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => {
    partFilter = b.dataset.f; store.set('partFilter', partFilter);
    renderStrip();
    const ids = shownParts();
    if (ids.length && !ids.includes(item.id)) location.hash = `#/${pfx()}part/${ids[0]}`; // show the first part of the chosen kind
  }));
}
function renderStrip() {
  renderFilters();
  if (mode === 'build' && !buildFor) { // the full robot guide (Explore your kit links): its steps; a book's build keeps its lessons row
    const S = build.steps;
    $('#strip-title').textContent = 'Build steps';
    $('#prog-label').textContent = 'Steps done';
    $('#cards').innerHTML = S.map((s, i) => `<li><a href="${bHash(s.id)}" aria-current="${i === build.st.step}"><span class="ph" data-model="${s.thumb}"></span><span><i class="snum">${String(i + 1).padStart(2, '0')}</i>${esc(s.label)}<small class="tick">${checksOf(s).length} / ${s.checks.length}</small></span></a></li>`).join('');
    const n = S.filter((s) => checksOf(s).length === s.checks.length).length;
    $('#prog-count').textContent = `${n}/${S.length}`; $('#prog-fill').style.width = `${(n / S.length) * 100}%`;
    const cur = $('#cards [aria-current="true"]')?.parentElement, ol = $('#cards');
    if (cur) ol.scrollLeft = cur.offsetLeft - ol.offsetLeft - (ol.clientWidth - cur.offsetWidth) / 2; if (cur) ol.scrollTop = cur.offsetTop - (ol.clientHeight - cur.offsetHeight) / 2;
    return fillThumbs();
  }
  const pre = `#/${pfx()}`;
  const list = mode === 'parts'
    ? shownParts().map((id) => manifest.find((m) => m.id === id))
      .map((m) => ({ id: m.id, title: m.name, href: `${pre}part/${m.id}`, model: m.id, group: groupOf(m.id)[1], explored: !!lvl && seen.has(m.id) }))
    : lessonList().map((l, i) => ({ id: l.id, title: l.cardTitle, n: i + 1, href: `${pre}${kindWord()}/${l.id}`, model: l.thumb || (l.jr ? (l.kit.find((m) => m.port.startsWith('op'))?.id || 'jr_board') : l.chassis ? 'chassis' : l.kit[0]?.id || l.model), lesson: true }));
  $('#strip-title').textContent = mode === 'parts' ? (kitJr || lvl ? 'Components' : 'Kit box') : jrBuild ? 'Build steps' : 'Lessons';
  $('#prog-label').textContent = mode === 'parts' ? (lvl ? 'Parts explored' : 'Models approved') : jrBuild ? 'Steps done' : 'Lessons done';
  const ol = $('#cards');
  const now = mode === 'build' ? buildFor : item.id; // building a lesson's car: that lesson stays current
  ol.innerHTML = list.map((c) => `<li><a href="${c.href}" aria-current="${c.id === now}">` +
    (c.n ? `<i class="nd">${c.n}</i>` : '') + `<span class="ph" data-model="${c.model}"></span><span>${c.group ? `<i class="grp g-${c.group[0].toLowerCase()}">${esc(c.group)}</i>` : ''}${esc(c.title)}</span>` +
    (c.lesson ? `<button class="done" data-done="${c.id}" aria-pressed="${done.has(c.id)}" aria-label="Mark done"></button>` : c.explored ? '<span class="done seen" role="img" aria-label="Explored"></span>' : '') + '</a></li>').join('');
  ol.querySelectorAll('[data-done]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); toggleDone(b.dataset.done); }));
  const cur = ol.querySelector('[aria-current="true"]')?.parentElement;
  if (cur) ol.scrollLeft = cur.offsetLeft - ol.offsetLeft - (ol.clientWidth - cur.offsetWidth) / 2; if (cur) ol.scrollTop = cur.offsetTop - (ol.clientHeight - cur.offsetHeight) / 2;
  progress();
  fillThumbs();
}
async function fillThumbs() {
  for (const ph of document.querySelectorAll('.ph[data-model]')) {
    const url = modelUrl(ph.dataset.model);
    if (!url) continue;
    const src = await mod.thumbnail(url).catch(() => null);
    if (src && ph.isConnected) { const img = new Image(); img.src = src; img.alt = ''; ph.replaceWith(img); }
  }
}
function toggleDone(id) {
  const before = player();
  done.has(id) ? done.delete(id) : done.add(id);
  store.set('done', [...done]); push(done.has(id) ? { addLessons: [id] } : { removeLessons: [id] });
  document.querySelectorAll(`[data-done="${id}"]`).forEach((b) => b.setAttribute('aria-pressed', String(done.has(id))));
  progress();
  if (done.has(id)) reward(before, player()); // finishing is celebrated; unticking changes XP quietly
}
/** XP, player level and badges: the same sums as the home launcher (home.js levelOf / badgesOf). */
function player() {
  const lessons = allLessons(), finished = lessons.filter((l) => done.has(l.id)).length;
  const checks = Object.values(buildChecks).reduce((n, a) => n + a.length, 0);
  return { lv: levelOf(finished + scratchIds.filter((x) => done.has(x)).length, checks), badges: badgesOf(finished, lessons.length, checks) };
}
function xpHud() {
  const { lv } = player();
  $('#xpc-lvn').textContent = lv.level; $('#xpc-xp').textContent = `${lv.xp.toLocaleString('en-US')} XP`;
  $('#xpc-fill').style.width = `${(lv.into / (lv.into + lv.next)) * 100}%`;
  $('#xpc').title = `Player level ${lv.level}: ${lv.next} XP to level ${lv.level + 1}`;
}
/** One message banner at the top of the 3D stage; a click closes it. */
function banner(inner, { up = false, ms = 3200 } = {}) {
  document.querySelector('#stage > .reward')?.remove();
  const el = document.createElement('div');
  el.className = `reward${up ? ' up' : ''}`; el.setAttribute('role', 'status');
  el.innerHTML = `<i>${STAR}</i><div>${inner}</div>`;
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 300); };
  el.addEventListener('click', close); setTimeout(close, ms);
  $('#stage').append(el);
}
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.2 6.6L12 17.3l-5.8 3.2 1.2-6.6-4.9-4.6 6.6-.8z"/></svg>';
/** Lesson complete (+XP), level up and new badges: one banner at the top of the 3D stage, with a jingle. */
function reward(before, after) {
  const gained = after.lv.xp - before.lv.xp, up = after.lv.level > before.lv.level;
  const badge = after.badges.find((b, i) => b[2] && !before.badges[i][2]);
  if (gained <= 0 && !badge) return; // e.g. "Done exploring" the kit box: no XP
  banner(`${up
    ? `<b>Level up!<em>Player level ${after.lv.level}</em></b><small>+${gained} XP for finishing this lesson</small>`
    : `<b>Lesson complete<em>+${gained} XP</em></b><small>${after.lv.next} XP to player level ${after.lv.level + 1}</small>`}${badge ? `<small class="badge">Badge unlocked: ${esc(badge[0])}</small>` : ''}`, { up, ms: up ? 4200 : 3200 });
  const lvEl = $('#xpc-lv'); lvEl.classList.remove('pop'); void lvEl.offsetWidth; lvEl.classList.add('pop');
  up ? sfx.levelup() : sfx.ok();
}
function progress() {
  const [n, total] = mode === 'parts'
    ? (lvl ? partsSeen(lvl) : [partOrder().filter((id) => byId(id)?.status === 'approved').length, partOrder().length])
    : [lessonList().filter((l) => done.has(l.id)).length, lessonList().length];
  $('#prog-count').textContent = `${n}/${total}`;
  $('#prog-fill').style.width = `${total ? (n / total) * 100 : 0}%`;
  xpHud();
}
function step(dir) {
  const ids = mode === 'parts' ? shownParts() : lessonList().map((l) => l.id);
  location.hash = `#/${pfx()}${mode === 'parts' ? 'part' : kindWord()}/${ids[(ids.indexOf(item.id) + dir + ids.length) % ids.length]}`;
}
function flash(btn) { btn.classList.add('on'); setTimeout(() => btn.classList.remove('on'), 600); }
