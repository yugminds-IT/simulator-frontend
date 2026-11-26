// Signed-out title screen in "attract mode", like a console cycling its game demos: the two Level 3 sensor missions,
// each with the robot the book builds for it, in its own arena, running the book's program in 3D.
//   Obstacle run: ultrasonic car in the block maze, real sonar (arena.js) — under 20 cm it turns right.
//   Line follower: two IR sensors under the bumper on the tape track — the sensor that sees the tape steers.
// attract(root) returns { boost, brake } for the sign-in screen.

const MISSIONS = [
  { id: 'obstacle', name: 'Obstacle run', arena: 'obstacle', sensor: 'ultrasonic',
    hud: `<div><dt>Distance</dt><dd data-k="cm">–</dd></div><div class="two"><dt>Doing</dt><dd data-k="act">–</dd></div>
      <div class="wide"><dt>Sonar echo</dt><dd><span class="lg-bar"><i data-k="bar"></i></span></dd></div>`,
    code: `<p data-r="ping">Measure the distance</p><p data-r="turn">If it is under 20 cm, turn right</p><p data-r="fwd">Otherwise, drive forward</p>` },
  { id: 'line', name: 'Line follower', arena: 'line', sensor: 'ir',
    hud: `<div><dt>Left IR</dt><dd data-k="l">0</dd></div><div><dt>Right IR</dt><dd data-k="r">0</dd></div><div><dt>Lap time</dt><dd data-k="time">0.0 s</dd></div>
      <div class="wide"><dt>Doing</dt><dd data-k="act">–</dd></div>`,
    code: `<p data-r="fwd">If both sensors read 0, drive straight</p><p data-r="left">If the left one reads 1, turn left</p><p data-r="right">If the right one reads 1, turn right</p><p data-r="stop">If both read 1, stop</p>` },
];
const SHOW_FOR = 14000; // ms per mission before the reel switches

export const SCENE = `<div class="lg-arena" aria-hidden="true">
  <canvas class="lg-3d"></canvas>
  <section class="lg-hud">
    <header><i></i><b data-m="name"></b><span data-m="arena"></span></header>
    <ol class="lg-reel">${MISSIONS.map((m) => `<li>${m.name}</li>`).join('')}</ol>
    <dl data-m="hud"></dl>
  </section>
  <div class="lg-code"><p class="hat">When the program starts</p><div class="loop"><p>Forever</p><div data-m="code"></div></div></div>
</div>`;

export function attract(root) {
  const ctl = { boostUntil: 0, brakeUntil: 0 };
  run(root, ctl).catch((e) => { console.warn('Title demo off:', e); root.querySelector('.lg-arena')?.remove(); }); // no WebGL: just the words
  return { boost: () => { ctl.boostUntil = performance.now() + 1300; }, brake: () => { ctl.brakeUntil = performance.now() + 900; } };
}

async function run(root, ctl) {
  const [THREE, { RoomEnvironment }, { ARENAS, buildArena, sonar, blocked, carPoints }, { assembledCar }] = await Promise.all([
    import('three'), import('three/addons/environments/RoomEnvironment.js'), import('./arena.js'), import('./stage.js')]);
  const el = root.querySelector('.lg-arena'), canvas = el?.querySelector('.lg-3d');
  if (!canvas?.isConnected) return; // signed in before the demo loaded
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.toneMapping = THREE.NeutralToneMapping;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(), pm = new THREE.PMREMGenerator(r);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  const sun = new THREE.DirectionalLight(0xffffff, 1.4); // follows the car, so a small shadow box stays sharp
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0004;
  Object.assign(sun.shadow.camera, { left: -0.8, right: 0.8, top: 0.8, bottom: -0.8, near: 0.5, far: 6 });
  scene.add(sun, sun.target);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.03, 30), OFF = new THREE.Vector3(0.5, 0.78, 0.82).setLength(1.08), look = new THREE.Vector3();
  const floor = (x, z) => new THREE.Vector3(x, 0, z);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // each mission: its arena (night colours), its car, and a step() that moves the car the way its program would
  const sims = MISSIONS.map((m) => {
    const A = ARENAS[m.arena], arena = buildArena(A);
    arena.traverse((o) => { // navy floor and walls, lit-up tape; the cardboard blocks keep their colour
      if (!o.isMesh) return;
      const c = o.material.color.getHex(), basic = o.material.isMeshBasicMaterial, tiles = !!o.material.map, wall = c === 0xd6e1f5;
      if (!basic && !tiles && !wall) return;
      o.material = o.material.clone();
      o.material.color.set(basic ? 0xeaf1ff : tiles ? 0x3a5da6 : 0x25447f);
    });
    const car = new THREE.Group(), sim = { A, arena, car, spin: null, fx: null, half: { cx: 0, cz: 0, hx: 0.1, hz: 0.07 }, v: 0, read: {} };
    arena.visible = car.visible = false; scene.add(arena, car);
    assembledCar((id) => `/models/${id}.glb`, m.sensor).then(({ robot, spinners, eyes }) => {
      const box = new THREE.Box3().setFromObject(robot), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
      robot.position.set(-c.x, -box.min.y, -c.z); car.add(robot); sim.spin = spinners;
      sim.half = { cx: 0, cz: 0, hx: s.x / 2, hz: s.z / 2 };
      sim.fx = m.sensor === 'ultrasonic' ? sonarCone(THREE, eyes[0]) : irSpots(THREE, robot, eyes, box.min.y);
    }).catch((e) => console.warn('Title demo car:', e));
    sim.step = m.id === 'obstacle' ? obstacleStep(sim, sonar, blocked, carPoints) : lineStep(sim, A);
    return sim;
  });

  const hudEl = el.querySelector('[data-m="hud"]'), codeEl = el.querySelector('[data-m="code"]'), reel = [...el.querySelectorAll('.lg-reel li')];
  let at = 0, shownAt = 0, k = {}, rows = {};
  const show = (i) => {
    sims.forEach((s, j) => { s.arena.visible = s.car.visible = j === i; });
    at = i; shownAt = performance.now(); sims[i].reset?.();
    el.querySelector('[data-m="name"]').textContent = MISSIONS[i].name; el.querySelector('[data-m="arena"]').textContent = sims[i].A.title;
    hudEl.innerHTML = MISSIONS[i].hud; codeEl.innerHTML = MISSIONS[i].code;
    k = Object.fromEntries([...hudEl.querySelectorAll('[data-k]')].map((e) => [e.dataset.k, e]));
    rows = Object.fromEntries([...codeEl.querySelectorAll('[data-r]')].map((e) => [e.dataset.r, e]));
    reel.forEach((li, j) => li.toggleAttribute('aria-current', j === i));
    const p = sims[i].pose(); cam.position.copy(floor(p.x, p.z)).add(OFF); look.copy(floor(p.x, p.z)); // cut, don't fly across the room
  };
  el.style.setProperty('--reel', `${SHOW_FOR}ms`);
  show(0);

  let last = performance.now(), shown = 0, parked = false, switching = false;
  const frame = (now) => {
    if (!root.isConnected) { r.dispose(); pm.dispose(); r.forceContextLoss(); return; } // signed in: free the GPU
    requestAnimationFrame(frame);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w && (canvas.width !== Math.round(w * r.getPixelRatio()) || canvas.height !== Math.round(h * r.getPixelRatio()))) { r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!still && !switching && (now - shownAt > SHOW_FOR || sims[at].stuck)) { // channel change: wipe, swap mid-wipe
      switching = true; el.classList.remove('lg-switch'); void el.offsetWidth; el.classList.add('lg-switch');
      setTimeout(() => { show((at + 1) % sims.length); switching = false; }, 260);
    }
    const s = sims[at], { wl, wr, hud } = s.step(still ? 0 : dt, now, now < ctl.brakeUntil, now < ctl.boostUntil), p = s.pose();
    s.car.position.set(p.x, 0, p.z); s.car.rotation.y = p.th;
    if (s.spin) { const R = 0.0325; s.spin.fl.rotation.z -= (wl * dt) / R; s.spin.rl.rotation.z -= (wl * dt) / R; s.spin.fr.rotation.z -= (wr * dt) / R; s.spin.rr.rotation.z -= (wr * dt) / R; }
    s.fx?.(s.read, now);
    const tgt = floor(p.x, p.z).add(floor(Math.cos(p.th), -Math.sin(p.th)).multiplyScalar(0.08)); // look a little ahead of the car
    cam.position.lerp(tgt.clone().add(OFF), Math.min(1, dt * 2)); look.lerp(tgt, Math.min(1, dt * 3)); cam.lookAt(look);
    sun.position.copy(tgt).add(floor(0.6, 0.4).setY(3)); sun.target.position.copy(tgt);
    if (!still || !parked) { r.render(scene, cam); parked = still && !!s.spin; } // reduced motion: draw until the car is in, then hold
    if (now - shown > 90) { // HUD at ~11 fps is plenty
      shown = now;
      for (const [key, val] of Object.entries(hud)) if (k[key]) { if (key === 'bar') k.bar.style.width = val; else k[key].textContent = val; }
      Object.entries(rows).forEach(([key, row]) => row.classList.toggle('on', hud.row === key || (key === 'ping' && !!hud.ping)));
    }
  };
  requestAnimationFrame(frame);
}

/** obstacle project: drive forward; when the echo is under 20 cm, turn right on the spot until the way is clear */
export function obstacleStep(sim, sonar, blocked, carPoints) {
  const p = { x: -0.6, z: -0.2, th: 0.3 };
  let mode = 'drive', turnFor = 0, escape = 0, mark = null;
  sim.pose = () => p;
  sim.reset = () => { Object.assign(p, { x: -0.6, z: -0.2, th: 0.3 }); mode = 'drive'; sim.v = 0; escape = 0; mark = null; sim.stuck = false; }; // each showing starts at the same spot
  return (dt, now, braking, boost) => {
    const { hx, hz } = sim.half, cm = Math.round(sonar(p.x + Math.cos(p.th) * hx, p.z - Math.sin(p.th) * hx, p.th, sim.A));
    sim.read.cm = cm;
    const target = braking ? 0 : (boost ? 2 : 1) * 0.26;
    sim.v += (target - sim.v) * Math.min(1, dt * (braking ? 9 : 4));
    let wl = 0, wr = 0;
    if (mode === 'drive') {
      if (cm < 20) { mode = 'turn'; turnFor = 0.45 + Math.random() * 0.55; }
      else {
        const nx = p.x + Math.cos(p.th) * sim.v * dt, nz = p.z - Math.sin(p.th) * sim.v * dt;
        if (blocked(carPoints({ x: nx, z: nz, th: p.th }, sim.half), sim.A)) { mode = 'turn'; turnFor = 0.5; } else { p.x = nx; p.z = nz; wl = wr = sim.v; }
      }
    }
    if (mode === 'turn') { // spin right on the spot: left wheels forward, right wheels back
      const w = braking ? 0 : 1.7 * (boost ? 1.6 : 1);
      turnFor -= dt;
      const spin = (dir) => { const th = p.th + dir * w * dt; if (blocked(carPoints({ ...p, th }, sim.half), sim.A)) return false; p.th = th; wl = -dir * w * hz; wr = dir * w * hz; return true; };
      if (escape > 0) { escape -= dt; spin(1); } // committed to turning left out of a pocket
      else if (!spin(-1)) { // a corner would swing into the block: reverse a little, or else turn left out of it for a moment
        const bx = p.x - Math.cos(p.th) * 0.12 * dt, bz = p.z + Math.sin(p.th) * 0.12 * dt;
        if (!blocked(carPoints({ ...p, x: bx, z: bz }, sim.half), sim.A)) { p.x = bx; p.z = bz; wl = wr = -0.12; } else escape = 0.6;
      }
      if (turnFor <= 0 && cm >= 45) mode = 'drive'; // turn until there is room to drive, not just past the 20 cm line
    }
    // ponytail: arena.js tests 8 points round the car, so a block corner can slip between them and pin it in a pocket.
    // Under 12 cm of progress in 2.5 s counts as stuck, and the reel cuts away (the next showing starts over).
    if (!mark || braking) mark = { x: p.x, z: p.z, t: now };
    else if (now - mark.t > 2500) { sim.stuck = Math.hypot(p.x - mark.x, p.z - mark.z) < 0.12; mark = { x: p.x, z: p.z, t: now }; }
    const turning = mode === 'turn' && !braking;
    return { wl, wr, hud: { cm: `${cm} cm`, act: braking ? 'Stopped' : turning ? 'Turning right' : 'Driving forward', bar: `${Math.max(4, 100 - Math.min(100, cm))}%`,
      row: braking ? '' : turning ? 'turn' : 'fwd', ping: !braking && Math.floor(now / 300) % 2 === 0 } };
  };
}

/** line project: the car rides the tape; whichever IR sensor drifts over it reads 1 and steers that way */
export function lineStep(sim, A) {
  const P = A.track.pts, cum = [0];
  P.forEach(([x, z], i) => { const [x1, z1] = P[(i + 1) % P.length]; cum.push(cum[i] + Math.hypot(x1 - x, z1 - z)); });
  const L = cum[P.length];
  const at = (d) => {
    d = ((d % L) + L) % L;
    let i = 0; while (cum[i + 1] < d) i++;
    const t = (d - cum[i]) / (cum[i + 1] - cum[i] || 1), [x0, z0] = P[i], [x1, z1] = P[(i + 1) % P.length];
    return [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t];
  };
  const heading = (d) => { const [xa, za] = at(d - 0.03), [xb, zb] = at(d + 0.03); return Math.atan2(-(zb - za), xb - xa); }; // forward = (cos th, -sin th)
  let d = 0.2, lapAt = performance.now();
  sim.pose = () => { const [x, z] = at(d); return { x, z, th: heading(d) }; };
  sim.reset = () => { lapAt = performance.now(); }; // the lap clock only runs while this mission is on screen
  return (dt, now, braking, boost) => {
    let turn = heading(d + 0.07) - heading(d); turn = Math.atan2(Math.sin(turn), Math.cos(turn)); // + = the tape bends left
    const target = braking ? 0 : (boost ? 2 : 1) * 0.3 * (1 - Math.min(0.4, Math.abs(turn) * 1.4));
    sim.v += (target - sim.v) * Math.min(1, dt * (braking ? 9 : 3));
    d += sim.v * dt;
    if (d >= L) { d -= L; lapAt = now; }
    const l = !braking && turn > 0.1 ? 1 : 0, rr = !braking && turn < -0.1 ? 1 : 0, k = Math.max(-0.6, Math.min(0.6, turn * 2.5));
    sim.read.l = l; sim.read.r = rr;
    return { wl: sim.v * (1 - k), wr: sim.v * (1 + k), hud: { l: String(l), r: String(rr), time: `${((now - lapAt) / 1000).toFixed(1)} s`,
      act: braking ? 'Stopped' : l ? 'Turning left' : rr ? 'Turning right' : 'Driving straight', row: braking ? '' : l ? 'left' : rr ? 'right' : 'fwd' } };
  };
}

/** the HC-SR04's listening cone (±15°), stretched to the echo, red when something is closer than 20 cm */
function sonarCone(THREE, eye) {
  const geo = new THREE.ConeGeometry(Math.tan(Math.PI / 12), 1, 32, 1, true).translate(0, -0.5, 0).rotateZ(Math.PI / 2); // apex at the sensor, opening along +x
  const mat = new THREE.MeshBasicMaterial({ color: 0x7fb0ff, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const cone = new THREE.Mesh(geo, mat); eye.add(cone);
  return (read, now) => {
    const near = read.cm < 20;
    cone.scale.setScalar(Math.max(0.03, Math.min(1.2, (read.cm || 0) / 100)));
    mat.color.set(near ? 0xff4d4d : 0x7fb0ff);
    mat.opacity = (near ? 0.34 : 0.16) + (Math.floor(now / 300) % 2 ? 0 : 0.08); // pulses with each ping
  };
}

/** a glow on the floor under each IR sensor: bright while it reads 1 (over the tape) */
function irSpots(THREE, robot, eyes, floorY) {
  const spots = eyes.map((eye) => {
    const mat = new THREE.MeshBasicMaterial({ color: 0xff5a5a, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending });
    const spot = new THREE.Mesh(new THREE.CircleGeometry(0.022, 24), mat);
    spot.rotation.x = -Math.PI / 2; spot.position.set(eye.position.x, floorY + 0.0015, eye.position.z); robot.add(spot);
    return [spot, mat];
  });
  return (read) => [read.l, read.r].forEach((on, i) => { const [spot, mat] = spots[i]; mat.opacity = on ? 1 : 0.45; spot.scale.setScalar(on ? 1.8 : 1); });
}
