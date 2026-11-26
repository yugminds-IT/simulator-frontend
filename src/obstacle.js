// Ultrasonic lesson: an obstacle in front of the HC-SR04 (toy car, box, ball, wall), the sound burst on every reading,
// and how well each obstacle echoes. Drawn 1 mm per real cm so a 2–200 cm range fits next to the kit.
//
// How the real sensor works (what the waves show): TRIG starts a burst of 8 pulses of 40 kHz from the transmitter (T).
// The sound spreads as curved wavefronts inside a cone (datasheet: measuring angle 15°), bounces off the near face of
// the obstacle and spreads back out from there; the receiver (R) hears the echo and ECHO goes LOW. A flat face sends
// a tight echo back; a round ball scatters it, and sometimes no echo reaches R at all (pulseIn times out → 0 cm).
import * as THREE from 'three';

const MM = 0.001, SCALE = 1.0 * MM;
// [title, what the echo is like, reading noise (cm), chance of no echo (pulseIn timeout → 0), echo spread (deg)]
export const OBSTACLES = {
  car: ['Toy car', 'Its flat bumper sends back a clear echo.', 0.6, 0, 25],
  box: ['Cardboard box', 'Flat and hard: a strong, steady echo.', 0.3, 0, 20],
  ball: ['Ball', 'Round, so most of the sound bounces away: shaky readings, sometimes no echo at all (0 cm).', 3, 0.15, 55],
  wall: ['Wall', 'A big flat wall: the best echo there is.', 0.2, 0, 18],
};
/** one HC-SR04 reading for an obstacle at cm (rnd injectable for tests) */
export function reading(kind, cm, rnd = Math.random) {
  const [, , noise, miss] = OBSTACLES[kind];
  if (rnd() < miss) return 0;
  return Math.max(2, cm + (rnd() - 0.5) * 2 * noise);
}

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });

// Toy car, side profile in mm (x along the car, nose at +x; y up), extruded across its width with rounded edges.
function carBody() {
  const s = new THREE.Shape();
  s.moveTo(-23, 5.5); s.lineTo(-20.6, 5.5);
  s.absarc(-14, 6, 6.6, Math.PI, 0, true); // rear wheel arch
  s.lineTo(7.4, 5.5);
  s.absarc(14, 6, 6.6, Math.PI, 0, true);  // front wheel arch
  s.lineTo(22.5, 5.5); s.quadraticCurveTo(24, 6, 24, 9);
  s.lineTo(23.3, 12.6); s.quadraticCurveTo(22.7, 13.6, 21, 13.8); // bonnet
  s.lineTo(8.5, 14.6); s.lineTo(2.6, 20.9); s.quadraticCurveTo(1.9, 21.8, 0.5, 21.8); // windscreen, roof
  s.lineTo(-11, 21.8); s.quadraticCurveTo(-12.4, 21.8, -13, 21); s.lineTo(-18, 14.6); // rear window
  s.lineTo(-22, 13.8); s.quadraticCurveTo(-23.8, 13.4, -23.8, 11); s.lineTo(-23.8, 7); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 19, bevelEnabled: true, bevelThickness: 1.6, bevelSize: 1.2, bevelSegments: 3, curveSegments: 14 });
  g.translate(0, 0, -9.5);
  return g;
}
function build(kind) { // models in mm, standing on y = 0, facing the sensor along -Z (local)
  const g = new THREE.Group(), add = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  const box = (w, h, d, m, x, y, z) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z);
  if (kind === 'car') {
    const car = new THREE.Group();
    const paint = mat(0xd8322a, { roughness: 0.28, metalness: 0.1 }), glass = mat(0x1d2c3c, { roughness: 0.08, metalness: 0.3 });
    const rubber = mat(0x1b1b1b, { roughness: 0.9 }), rim = mat(0xc9ccd1, { roughness: 0.25, metalness: 0.8 }), trim = mat(0x2a2a2a, { roughness: 0.7 });
    const lamp = mat(0xfff4c8, { emissive: 0xfff1b0, emissiveIntensity: 0.6, roughness: 0.2 }), tail = mat(0xff2a2a, { emissive: 0xb00000, emissiveIntensity: 0.5, roughness: 0.3 });
    const put = (o) => { car.add(o); return o; };
    put(new THREE.Mesh(carBody(), paint));
    // side windows (front and rear, split by the B-pillar) on both flat sides
    const win = (pts) => { const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))); return new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: false }); };
    const wf = win([[7.6, 15.3], [2.2, 20.7], [-3.4, 20.7], [-3.4, 15.3]]), wr = win([[-4.6, 15.3], [-4.6, 20.7], [-10.6, 20.7], [-16.4, 15.3]]);
    for (const z of [11.15, -11.45]) for (const w of [wf, wr]) put(new THREE.Mesh(w, glass)).position.z = z;
    // windscreen and rear window, laid on the slopes
    const pane = (x0, y0, x1, y1, out) => {
      const len = Math.hypot(x1 - x0, y1 - y0), p = put(new THREE.Mesh(new THREE.BoxGeometry(len - 1.2, 0.3, 18.6), glass));
      const a = Math.atan2(y1 - y0, x1 - x0), n = [-Math.sin(a) * out, Math.cos(a) * out];
      p.position.set((x0 + x1) / 2 + n[0] * 1.25, (y0 + y1) / 2 + n[1] * 1.25, 0); p.rotation.z = a;
    };
    pane(8.5, 14.6, 2.6, 20.9, -1); pane(-13, 21, -18, 14.6, -1);
    // bumpers, grille, lights, mirrors
    const bump = (x) => { const b = put(new THREE.Mesh(new THREE.BoxGeometry(2.4, 3, 22.4), trim)); b.position.set(x, 7, 0); };
    bump(24.4); bump(-24.2);
    const gr = put(new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.6, 9), trim)); gr.position.set(24.75, 10.6, 0);
    for (const z of [7.2, -7.2]) {
      const h = put(new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.8, 16), lamp)); h.rotation.z = Math.PI / 2; h.position.set(24.5, 11, z);
      const t = put(new THREE.Mesh(new THREE.BoxGeometry(0.6, 2, 3.8), tail)); t.position.set(-24.85, 11.2, z);
      const m = put(new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.3, 2.2), paint)); m.position.set(6.6, 15.6, z > 0 ? 12.2 : -12.2);
    }
    // wheels: tyre, alloy rim, hub cap
    const tyre = new THREE.CylinderGeometry(6, 6, 4.6, 28), rimG = new THREE.CylinderGeometry(3.7, 3.7, 4.9, 20), hub = new THREE.CylinderGeometry(1.2, 1.2, 5.2, 12);
    for (const x of [14, -14]) for (const z of [9.6, -9.6]) {
      const w = new THREE.Group(); w.position.set(x, 6, z); w.rotation.x = Math.PI / 2; car.add(w);
      w.add(new THREE.Mesh(tyre, rubber), new THREE.Mesh(rimG, rim), new THREE.Mesh(hub, trim));
    }
    const under = put(new THREE.Mesh(new THREE.BoxGeometry(40, 2, 16), trim)); under.position.set(0, 4.6, 0);
    car.rotation.y = Math.PI / 2; // nose toward the sensor
    g.add(car);
  } else if (kind === 'box') {
    const card = mat(0xc99a5f), tape = mat(0xe8d4a8);
    box(34, 32, 34, card, 0, 16); box(6, 0.6, 34.4, tape, 0, 32.2); box(34.4, 0.6, 6, tape, 0, 32.2);
  } else if (kind === 'ball') {
    add(new THREE.SphereGeometry(15, 28, 18), mat(0x3a7bd5, { roughness: 0.35 }), 0, 15);
    add(new THREE.TorusGeometry(15.05, 1.2, 8, 40), mat(0xffd34d), 0, 15);
  } else {
    box(70, 50, 6, mat(0xd8cfc0), 0, 25); for (let i = 0; i < 4; i++) box(70.2, 0.8, 6.2, mat(0xb9ad99), 0, 6 + i * 12);
  }
  g.scale.setScalar(MM);
  g.traverse((o) => { if (o.isMesh) { o.name = 'obstacle_body'; o.castShadow = true; } });
  return g;
}

// sound, drawn slowed right down: 8 wavefronts one (drawn) wavelength apart, travelling at V
const PULSES = 8, LAMBDA = 1.3 * MM, V = 0.11 * MM, BEAM = THREE.MathUtils.degToRad(15); // V in m per ms
const caps = new Map(), capGeo = (a) => caps.get(a) || caps.set(a, new THREE.SphereGeometry(1, 32, 3, 0, 2 * Math.PI, 0, a)).get(a);
const Y = new THREE.Vector3(0, 1, 0);

/** Adds the obstacle to `group` in front of the HC-SR04 (module root `root`, transducer anchors `tx`, `rx`). */
export function createObstacleRig(group, root, tx, rx = tx) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const local = (o) => o.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
  const from = local(tx), to = local(rx);             // transmitter and receiver faces, in group space
  const dir = new THREE.Vector3(-1, 0, 0).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize();
  const holder = new THREE.Group(), anchor = new THREE.Object3D(), fx = new THREE.Group();
  anchor.name = 'obstacle_rig';
  holder.add(anchor);
  group.add(holder, fx);
  const st = { kind: 'car', cm: 30, half: 0, top: 0, model: null, pings: [], raf: 0 };
  const hit = () => { const p = from.clone().addScaledVector(dir, st.cm * SCALE); p.y = Math.min(p.y, st.top * 0.7); return p; }; // where the sound meets the near face (the cone's lower edge, for a low toy car)
  const quiet = (m) => { m.raycast = () => {}; m.renderOrder = 3; fx.add(m); return m; };

  // the beam: a faint cone, 15° each side of the axis, from T to the obstacle
  const coneGeo = new THREE.CylinderGeometry(Math.tan(BEAM), 0, 1, 40, 1, true).translate(0, 0.5, 0);
  const cone = quiet(new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0x2fb3a0, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false })));
  cone.position.copy(from); cone.quaternion.setFromUnitVectors(Y, dir);
  // R lights up when the echo reaches it
  const heard = quiet(new THREE.Mesh(new THREE.RingGeometry(5.2 * MM, 8.6 * MM, 32), new THREE.MeshBasicMaterial({ color: 0xf2a33a, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })));
  heard.position.copy(to).addScaledVector(dir, 0.3 * MM); heard.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);

  const place = () => {
    const p = from.clone().addScaledVector(dir, st.cm * SCALE + st.half); p.y = 0;
    holder.position.copy(p);
    holder.rotation.y = Math.atan2(dir.x, dir.z); // local +Z along the beam, so local -Z faces the sensor
    anchor.position.set(0, st.top + 4 * MM, 0); // label dot just above the obstacle
    cone.scale.setScalar(st.cm * SCALE);
  };

  function tick() {
    const now = performance.now();
    let hear = 0;
    st.pings = st.pings.filter((p) => {
      const d = (now - p.t0) * V; // how far the first wavefront has travelled
      let alive = false;
      p.fronts.forEach((m, i) => {
        const r = d - i * LAMBDA, back = r - p.L;
        m.visible = r > 0 && back < p.Lb;
        if (!m.visible) { if (r <= 0) alive = true; return; }
        alive = true;
        if (back <= 0) { // on its way out from T
          m.geometry = capGeo(BEAM); m.position.copy(from); m.quaternion.setFromUnitVectors(Y, dir);
          m.scale.setScalar(r); m.material.color.set(0x2fb3a0); m.material.opacity = 0.5 * (1 - 0.45 * r / p.L);
        } else {         // the echo, spreading back out from the face it hit
          m.geometry = capGeo(p.spread); m.position.copy(p.P); m.quaternion.setFromUnitVectors(Y, p.back);
          m.scale.setScalar(Math.max(back, 0.2 * MM)); m.material.color.set(0xf2a33a); m.material.opacity = 0.42 * (1 - 0.6 * back / p.Lb);
          if (p.echo && back > p.Lb - LAMBDA) hear = 1;
        }
      });
      if (!alive) p.fronts.forEach((m) => { fx.remove(m); m.material.dispose(); });
      return alive;
    });
    heard.material.opacity = Math.max(hear * 0.95, heard.material.opacity * 0.9);
    st.raf = st.pings.length || heard.material.opacity > 0.02 ? requestAnimationFrame(tick) : 0;
    if (!st.raf) heard.material.opacity = 0;
  }

  const rig = {
    st, anchor,
    set(kind) {
      if (st.model) holder.remove(st.model);
      st.kind = kind; st.model = build(kind);
      st.model.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(st.model, true);
      st.half = -b.min.z; st.top = b.max.y; // centre → near face, and its height
      holder.add(st.model); place();
    },
    dist(cm) { st.cm = cm; place(); },
    /** one measurement: the burst goes out; echo = false means it scattered away and never reached R */
    ping(echo = true) {
      if (st.pings.length > 2) return; // a few bursts in the air at once is plenty to read
      const P = hit(), spread = THREE.MathUtils.degToRad(OBSTACLES[st.kind][4]);
      const back = echo ? to.clone().sub(P).normalize() : dir.clone().negate().applyAxisAngle(Y, (Math.random() < 0.5 ? 1 : -1) * 1.2).setY(0.35).normalize();
      const fronts = Array.from({ length: PULSES }, () => quiet(new THREE.Mesh(capGeo(BEAM), new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false }))));
      fronts.forEach((m) => { m.visible = false; });
      st.pings.push({ t0: performance.now(), fronts, P, back, spread, echo, L: st.cm * SCALE, Lb: echo ? to.distanceTo(P) : st.cm * SCALE * 0.8 });
      if (!st.raf) st.raf = requestAnimationFrame(tick);
    },
    /** start dragging at this (world) ray; returns ray → cm along the beam, or null when the ray misses the floor */
    grab(ray0) {
      group.updateMatrixWorld(true);
      inv.copy(group.matrixWorld).invert();
      const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), -from.y);
      const along = (ray) => { const p = ray.clone().applyMatrix4(inv).intersectPlane(floor, new THREE.Vector3()); return p && p.sub(from).dot(dir); };
      const s0 = along(ray0), cm0 = st.cm;
      return s0 == null ? null : (ray) => { const s = along(ray); return s == null ? st.cm : Math.min(200, Math.max(2, cm0 + (s - s0) / SCALE)); };
    },
    dispose() { cancelAnimationFrame(st.raf); group.remove(holder, fx); },
  };
  rig.set('car');
  return rig;
}
