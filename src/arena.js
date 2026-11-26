// Test arenas for the Level 3 car lessons, one course per project (ARENAS): walls, toy blocks, a road with bus stops, and painted marks.
// Everything here is in arena metres, top view: x = the car's start heading, z = to its right, origin = the car's start centre.
// A pose is { x, z, th } with forward = (cos th, -sin th), the same convention as stage.drive().
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// line follower track: a bean (one dent), so the car has to steer both ways. Closed, through the start (0, 0) heading +x.
const BEAN = [[0, 0], [0.3, 0], [0.55, 0], [0.95, -0.3], [0.95, -0.75], [0.6, -1.05], [0.25, -0.95], [0, -0.7], [-0.25, -0.95], [-0.6, -1.05], [-0.95, -0.75], [-0.95, -0.3], [-0.55, 0], [-0.3, 0]]; // extra points keep the start straight straight (the curve overshoots between far-apart points)
const beanPts = new THREE.CatmullRomCurve3(BEAN.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal').getSpacedPoints(240).map((v) => [v.x, Math.min(0, v.z)]); // the whole bean lies beyond the start line (z ≤ 0): flatten the curve's overshoot there

/** [centre x, centre z, width (x), depth (z), height, colour, shape?] for blocks; marks are painted on the mat */
export const ARENAS = {
  obstacle: { title: 'Block maze', x: [-1.25, 1.25], z: [-1.4, 0.4],
    boxes: [[1.05, -0.5, 0.22, 0.3, 0.16, 0xd6a56c], [0, -0.5, 0.3, 0.2, 0.12, 0xe2b77f], [-1.0, -1.15, 0.24, 0.24, 0.2, 0xc99559],
      [-0.55, 0.25, 0.2, 0.16, 0.14, 0xe2b77f], [0.6, -1.2, 0.26, 0.18, 0.12, 0xd6a56c], [0.8, 0.02, 0.2, 0.2, 0.14, 0xc99559]] }, // cardboard boxes, like a real test floor
  line: { title: 'Tape track', x: [-1.25, 1.25], z: [-1.4, 0.4], boxes: [], track: { pts: beanPts, w: 0.03 } },
  pattern: { title: 'Square test', x: [-0.7, 1.0], z: [-0.6, 0.9], boxes: [], square: 0.3 }, // the book: 1 s forward ≈ 30 cm, then a right turn
  // push button: forward only, so the course tests timing. Stop fully inside each stop in order; wait while the level-crossing barrier is down
  manual: { title: 'Bus route', x: [-0.3, 2.3], z: [-0.42, 0.42], boxes: [], road: 0.34,
    stops: [[0.42, 0.78, 'Stop 1'], [0.98, 1.34, 'Stop 2'], [1.84, 2.3, 'Depot']], // x from, x to, name; the depot runs up to the end wall, so pulling right in still counts
    gate: { x: 1.6, period: 7, lower: 3.5, shut: 4, isDown: false } }, // seconds into each period: the arm starts down at `lower`, blocks the road from `shut`
};
export const ARENA = ARENAS.obstacle;
export const SONAR_MAX = 400; // HC-SR04 range, cm

/** car outline points (arena coords) for a pose; car = { cx, cz, hx, hz }: the chassis box in the car's own frame */
export function carPoints({ x, z, th }, { cx, cz, hx, hz }) {
  const c = Math.cos(th), s = Math.sin(th), at = (u, v) => [x + (cx + u) * c + (cz + v) * s, z - (cx + u) * s + (cz + v) * c];
  return [[hx, hz], [hx, -hz], [-hx, hz], [-hx, -hz], [hx, 0], [-hx, 0], [0, hz], [0, -hz]].map(([u, v]) => at(u, v));
  // ponytail: 8 sample points, not a full box-box test; a 6 cm cone can slip between two of them
}
const inBox = ([px, pz], [bx, bz, w, d]) => Math.abs(px - bx) < w / 2 && Math.abs(pz - bz) < d / 2;
/** true when any point is outside the walls or inside a block */
export const blocked = (pts, A = ARENA) => pts.some((p) => p[0] < A.x[0] || p[0] > A.x[1] || p[1] < A.z[0] || p[1] > A.z[1] || A.boxes.some((b) => inBox(p, b))) || underGate(pts, A);
/** the lowered barrier: the car can't be on both sides of it (on the road) */
const underGate = (pts, A) => !!A.gate?.isDown && pts.some(([x, z]) => x < A.gate.x && Math.abs(z) < A.road / 2) && pts.some(([x, z]) => x > A.gate.x && Math.abs(z) < A.road / 2);
/** is the barrier down `t` seconds into the course? [arm lowering, road shut] */
export const gateAt = (G, t) => { const ph = t % G.period; return [ph >= G.lower, ph >= G.shut]; };

/** distance (cm) to the nearest echo: an HC-SR04 hears across a cone about 15° either side of straight ahead */
export const sonar = (x, z, th, A = ARENA) => Math.min(...[-0.26, 0, 0.26].map((d) => sonarRay(x, z, th + d, A)));
// ponytail: 3 rays stand in for the cone; add more if a thin obstacle slips between them
/** distance (cm) from (x, z) along heading th to the first wall or block, capped at the sensor's range */
function sonarRay(x, z, th, A) {
  const dx = Math.cos(th), dz = -Math.sin(th);
  const slab = (o, d, lo, hi) => (d ? [(lo - o) / d, (hi - o) / d].sort((a, b) => a - b) : o > lo && o < hi ? [-Infinity, Infinity] : [Infinity, -Infinity]);
  let t = Infinity;
  for (const [bx, bz, w, d] of A.boxes) { // ray vs block (slab test)
    const [a0, a1] = slab(x, dx, bx - w / 2, bx + w / 2), [b0, b1] = slab(z, dz, bz - d / 2, bz + d / 2), near = Math.max(a0, b0), far = Math.min(a1, b1);
    if (near <= far && far > 0) t = Math.min(t, Math.max(0, near));
  }
  const wx = dx > 0 ? (A.x[1] - x) / dx : dx < 0 ? (A.x[0] - x) / dx : Infinity, wz = dz > 0 ? (A.z[1] - z) / dz : dz < 0 ? (A.z[0] - z) / dz : Infinity;
  return Math.min(SONAR_MAX, Math.max(0, Math.min(t, wx, wz)) * 100);
}

/** is (x, z) on the tape? Distance to the nearest piece of the track */
export function onTape(x, z, T = ARENAS.line.track) {
  const P = T.pts;
  for (let i = 0; i < P.length; i++) {
    const [ax, az] = P[i], [bx, bz] = P[(i + 1) % P.length], dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz;
    const k = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)) : 0;
    if (Math.hypot(x - ax - k * dx, z - az - k * dz) < T.w / 2) return true;
  }
  return false;
}

/** is the whole car inside a stop? */
export const inStop = (pts, [x0, x1], A) => pts.every(([x, z]) => x > x0 && x < x1 && Math.abs(z) < A.road / 2);

/** where the car's sensors are for a pose: sonar = front centre, irL / irR = front corners looking down (left on D36, right on D35) */
export function sensorsAt(pose, car) {
  const c = Math.cos(pose.th), s = Math.sin(pose.th), at = (u, v) => [pose.x + (car.cx + u) * c + (car.cz + v) * s, pose.z - (car.cx + u) * s + (car.cz + v) * c];
  return { sonar: at(car.hx, 0), irL: at(car.hx - 0.015, -0.028), irR: at(car.hx - 0.015, 0.028), centre: at(0, 0) };
}

const flat = (geo, color, y) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.y = y; m.raycast = () => {}; return m; };
const outline = (pts, w) => { // flat ribbon along a closed polyline (x, z)
  const pos = [], idx = [];
  pts.forEach(([x, z], i) => {
    const [px, pz] = pts[(i - 1 + pts.length) % pts.length], [nx, nz] = pts[(i + 1) % pts.length], tx = nx - px, tz = nz - pz, l = Math.hypot(tx, tz) || 1;
    pos.push(x - (tz / l) * w / 2, 0, z + (tx / l) * w / 2, x + (tz / l) * w / 2, 0, z - (tx / l) * w / 2);
    const a = i * 2, b = ((i + 1) % pts.length) * 2; idx.push(a, a + 1, b, a + 1, b + 1, b);
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  return g;
};
const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];

/** the 3D course; place its origin at the car's start centre on the floor */
export function buildArena(A = ARENA) {
  const g = new THREE.Group(), W = A.x[1] - A.x[0], D = A.z[1] - A.z[0], mx = (A.x[0] + A.x[1]) / 2, mz = (A.z[0] + A.z[1]) / 2;
  const mesh = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.receiveShadow = true; m.castShadow = true; m.raycast = () => {}; g.add(m); return m; };
  const mat = (c, r = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const floor = mat(0xffffff, 0.95); floor.map = tiles(W, D);
  mesh(new THREE.BoxGeometry(W, 0.004, D), floor, mx, -0.002, mz).castShadow = false; // pale blue floor, 20 cm tiles
  const wall = mat(0xd6e1f5, 0.8), t = 0.05, wh = 0.13, slab = (w, d, x, z) => mesh(new RoundedBoxGeometry(w, wh, d, 3, 0.014), wall, x, wh / 2, z); // chunky rounded walls
  slab(W + 2 * t, t, mx, A.z[0] - t / 2); slab(W + 2 * t, t, mx, A.z[1] + t / 2);
  slab(t, D, A.x[0] - t / 2, mz); slab(t, D, A.x[1] + t / 2, mz);
  const tape = mat(0xf3dcb4, 0.45);
  A.boxes.forEach(([x, z, w, d, h, c]) => {
    mesh(new RoundedBoxGeometry(w, h, d, 2, 0.008), mat(c, 0.85), x, h / 2, z);
    const along = w > d; // packing tape over the lid's seam, along the long side
    mesh(new THREE.BoxGeometry(along ? w * 0.86 : 0.05, 0.002, along ? 0.05 : d * 0.86), tape, x, h + 0.001, z).castShadow = false;
  });
  const paint = (geo, color, y = 0.0008) => { const m = flat(geo, color, y); g.add(m); return m; };
  if (A.track) paint(outline(A.track.pts, A.track.w), 0x15181f).rotation.x = 0; // ribbon is already flat
  if (A.square) paint(outline(rect(0, 0, A.square, A.square), 0.012), 0x2563eb).rotation.x = 0; // the square the car should drive
  if (A.road) busRoute(g, A, mesh, mat, paint);
  if (A.square) paint(new THREE.CircleGeometry(0.05, 32), 0xbccaf0, 0.0005); // the start pad
  const room = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01)); room.visible = false; room.position.set(A.x[1] + 0.45, 0, mz); // framing room for the drive pad (removed after the camera fits)
  g.add(room); g.userData.room = room;
  return g;
}

/** the floor's tiles: a pale blue with soft lines every 20 cm, started at the arena's corner */
function tiles(W, D) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); g.fillStyle = '#f1f5fd'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#d8e2f4'; g.fillRect(0, 0, 128, 2); g.fillRect(0, 0, 2, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(W / 0.2, D / 0.2); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}

/** the road: asphalt, kerb lines, three painted stops with a sign and a waiting passenger each, and a level-crossing barrier */
function busRoute(g, A, mesh, mat, paint) {
  const W = A.x[1] - A.x[0], mx = (A.x[0] + A.x[1]) / 2, h = A.road / 2, at = (m, x, y, z, layer) => { m.position.set(x, y, z); if (layer) m.renderOrder = layer; return m; }; // layer: paint is see-through, so draw road → lines → stops in that order
  at(paint(new THREE.PlaneGeometry(W, A.road), 0x3d4555, 0.0003), mx, 0.0003, 0, 1);
  [-1, 1].forEach((sd) => at(paint(new THREE.PlaneGeometry(W, 0.008), 0xf8fafc, 0.0006), mx, 0.0006, sd * (h - 0.014), 2));
  for (let x = A.x[0] + 0.04; x < A.x[1] - 0.06; x += 0.14) at(paint(new THREE.PlaneGeometry(0.07, 0.006), 0xf8fafc, 0.0006), x + 0.035, 0.0006, 0, 2); // dashed centre line
  const SHIRTS = [0x2563eb, 0xe11d48, 0x16a34a];
  g.userData.stops = A.stops.map(([x0, x1], i) => {
    const fill = at(paint(new THREE.PlaneGeometry(x1 - x0, A.road - 0.03), 0xfbbf24, 0.0008), (x0 + x1) / 2, 0.0008, 0, 3);
    fill.material.opacity = 0.92;
    const line = paint(outline(rect(x0, -h + 0.016, x1, h - 0.016), 0.012), 0xf59e0b, 0.001); line.rotation.x = 0; line.position.y = 0.001; line.renderOrder = 4;
    const sz = -h - 0.06; // the kerb on the car's left
    mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.16, 10), mat(0x94a3b8, 0.4), x0 + 0.03, 0.08, sz);
    mesh(new THREE.BoxGeometry(0.006, 0.05, 0.05), mat(i === A.stops.length - 1 ? 0x0a1f4d : 0x2563eb, 0.5), x0 + 0.03, 0.15, sz);
    const person = new THREE.Group(), skin = mat(0xe9b58f, 0.7);
    person.add(at(new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.03, 4, 10), mat(SHIRTS[i % 3], 0.6)), 0, 0.03, 0), at(new THREE.Mesh(new THREE.SphereGeometry(0.012, 14, 10), skin), 0, 0.068, 0));
    person.traverse((o) => { o.castShadow = true; o.raycast = () => {}; });
    at(person, (x0 + x1) / 2, 0, sz - 0.01); g.add(person);
    return { fill, line, person, home: person.position.clone() };
  });
  const G = A.gate, pz = h + 0.04, post = mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.1, 12), mat(0x475569, 0.4), G.x, 0.05, pz);
  post.castShadow = true;
  const arm = new THREE.Group(), len = A.road + 0.06;
  for (let k = 0; k < 6; k++) arm.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, len / 6), mat(k % 2 ? 0xf8fafc : 0xdc2626, 0.5)), 0, 0, -(k + 0.5) * (len / 6)));
  arm.traverse((o) => { o.castShadow = true; o.raycast = () => {}; });
  at(arm, G.x, 0.085, pz); arm.rotation.x = 1.4; g.add(arm); // up
  const lamp = (dx) => { const m = mesh(new THREE.SphereGeometry(0.008, 12, 8), new THREE.MeshStandardMaterial({ color: 0x7f1d1d, emissive: 0xff2a2a, emissiveIntensity: 0 }), G.x + dx, 0.07, pz - 0.012); m.castShadow = false; return m; };
  g.userData.gate = { arm, lamps: [lamp(-0.012), lamp(0.012)] };
}

/** the ultrasonic's sound cone (±15°), drawn like RoverKit: from the transducers on the drawn car, fading out toward what it hears,
 *  red when close, amber, green when clear; a dot where the echo comes from. `group` = the car, `root` = the sensor, `car` = carFrame's box */
export function makeBeam(group, root, car, map) {
  const ends = ['anchor_ultrasonic_transmitter', 'anchor_ultrasonic_receiver'].map((n) => root.getObjectByName(n)).filter(Boolean);
  const color = new THREE.Color(), Y = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), at = new THREE.Vector3(), tmp = new THREE.Vector3();
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(Math.tan(0.26), 0, 1, 40, 1, true).translate(0, 0.5, 0), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { color: { value: color } },
    vertexShader: 'varying float t; void main() { t = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 color; varying float t; void main() { gl_FragColor = vec4(color, 0.32 * pow(1.0 - t, 2.0) + 0.015); }', // strong at the sensor, fading out
  }));
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.008, 16, 12), new THREE.MeshBasicMaterial({ color }));
  const obj = new THREE.Group(); obj.add(cone, dot); obj.traverse((o) => { o.raycast = () => {}; o.renderOrder = 3; });
  return { obj, set(L, hit, cm) {
    color.setHex(cm < 20 ? 0xef4444 : cm < 50 ? 0xf59e0b : 0x22c55e); dot.material.color.copy(color); // red: closer than the program's 20 cm, amber: getting close, green: clear
    group.updateMatrixWorld(true); map.updateMatrixWorld(); // from the transducers as they are now (the sensor settles onto the car after the arena opens)
    at.set(0, 0, 0); ends.forEach((o) => at.add(o.getWorldPosition(tmp))); at.divideScalar(ends.length || 1);
    const ahead = car.cx + car.hx - group.worldToLocal(tmp.copy(at)).x; // the sonar measures from the car's front; the beam starts at the transducers
    map.worldToLocal(at);
    dir.set(1, 0, 0).transformDirection(group.matrixWorld);
    const len = Math.max(0.001, L + ahead);
    cone.position.copy(at); cone.quaternion.setFromUnitVectors(Y, dir); cone.scale.setScalar(len);
    dot.position.copy(at).addScaledVector(dir, len); dot.visible = hit;
  } };
}

/** the path the car has driven (pattern mover): a line on the mat */
export function makeTrail(max = 6000) {
  const pos = new Float32Array(max * 3), geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setDrawRange(0, 0);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xf59e0b })); line.raycast = () => {}; line.frustumCulled = false;
  const pts = [];
  return { line, pts,
    add(x, z) { const l = pts.at(-1); if (l && Math.hypot(x - l[0], z - l[1]) < 0.005) return; if (pts.length >= max) return; pts.push([x, z]); pos.set([x, 0.0015, z], (pts.length - 1) * 3); geo.attributes.position.needsUpdate = true; geo.setDrawRange(0, pts.length); },
    clear() { pts.length = 0; geo.setDrawRange(0, 0); } };
}

/** top-down map: walls, blocks, marks, trail, the car and (if it has one) its sonar line */
export function drawMap(ctx, A, pose, car, { ray, trail, stops } = {}) {
  const { width: cw, height: ch } = ctx.canvas, W = A.x[1] - A.x[0], D = A.z[1] - A.z[0], k = Math.min(cw / W, ch / D);
  const X = (x) => (x - A.x[0]) * k, Z = (z) => (z - A.z[0]) * k;
  const poly = (pts, close) => { ctx.beginPath(); pts.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z)))); if (close) ctx.closePath(); };
  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = '#f1f5fd'; ctx.fillRect(0, 0, W * k, D * k);
  ctx.strokeStyle = '#dde6f6'; ctx.lineWidth = 1; ctx.beginPath(); // the floor's 20 cm tiles
  for (let x = A.x[0] + 0.2; x < A.x[1]; x += 0.2) { ctx.moveTo(X(x), 0); ctx.lineTo(X(x), D * k); }
  for (let z = A.z[0] + 0.2; z < A.z[1]; z += 0.2) { ctx.moveTo(0, Z(z)); ctx.lineTo(W * k, Z(z)); }
  ctx.stroke();
  ctx.strokeStyle = '#b8c6e3'; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, W * k - 3, D * k - 3);
  if (A.track) { ctx.strokeStyle = '#15181f'; ctx.lineWidth = Math.max(2, A.track.w * k); poly(A.track.pts, true); ctx.stroke(); }
  if (A.square) { ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 2; poly(rect(0, 0, A.square, A.square), true); ctx.stroke(); }
  if (A.road) {
    const h = A.road / 2; ctx.fillStyle = '#3d4555'; ctx.fillRect(X(A.x[0]), Z(-h), W * k, A.road * k);
    A.stops.forEach(([x0, x1], i) => { const st = stops?.[i]; ctx.fillStyle = st === 'done' ? '#22c55e' : st === 'missed' ? '#94a3b8' : '#fbbf24'; ctx.fillRect(X(x0), Z(-h + 0.02), (x1 - x0) * k, (A.road - 0.04) * k); });
    ctx.strokeStyle = A.gate.isDown ? '#dc2626' : '#cbd5e1'; ctx.lineWidth = 3; ctx.setLineDash(A.gate.isDown ? [] : [3, 3]);
    ctx.beginPath(); ctx.moveTo(X(A.gate.x), Z(-h - 0.02)); ctx.lineTo(X(A.gate.x), Z(h + 0.04)); ctx.stroke(); ctx.setLineDash([]);
  }
  A.boxes.forEach(([x, z, w, d, , c]) => { ctx.fillStyle = `#${c.toString(16).padStart(6, '0')}`; ctx.fillRect(X(x - w / 2), Z(z - d / 2), w * k, d * k); });
  if (trail?.length > 1) { ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2; poly(trail); ctx.stroke(); }
  const s = sensorsAt(pose, car);
  if (ray != null) { // the ultrasonic line, to what it sees
    const L = ray / 100; ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(X(s.sonar[0]), Z(s.sonar[1])); ctx.lineTo(X(s.sonar[0] + Math.cos(pose.th) * L), Z(s.sonar[1] - Math.sin(pose.th) * L)); ctx.stroke(); ctx.setLineDash([]);
  }
  const p = carPoints(pose, car); // [hx,hz] [hx,-hz] [-hx,hz] [-hx,-hz] …
  ctx.fillStyle = '#0a1f4d'; poly([p[0], p[2], p[3], p[1]], true); ctx.fill();
  ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(X(s.sonar[0]), Z(s.sonar[1]), 3, 0, Math.PI * 2); ctx.fill(); // the front
}

/** the car's footprint in its own frame (from the chassis + wheels) and the arena origin under its centre, in world coords */
export function carFrame(group, chassis) {
  group.updateMatrixWorld(true);
  const world = new THREE.Box3().setFromObject(chassis), local = world.clone().applyMatrix4(group.matrixWorld.clone().invert());
  const c = local.getCenter(new THREE.Vector3()), s = local.getSize(new THREE.Vector3());
  const car = { cx: c.x, cz: c.z, hx: s.x / 2, hz: s.z / 2 };
  const origin = group.localToWorld(new THREE.Vector3(c.x, 0, c.z)).setY(world.min.y);
  return { car, origin };
}

/** "▲ Front of the car" painted on the desk (circuit step): width w metres, text along +x, arrow toward -z. */
export function frontMarker(w = 0.15) {
  const c = document.createElement('canvas'); c.width = 600; c.height = 120;
  const x = c.getContext('2d'), label = 'Front of the car';
  x.font = '700 54px "Bricolage Grotesque Variable", sans-serif'; x.textBaseline = 'middle';
  const left = (600 - (x.measureText(label).width + 104)) / 2; // arrow + text, centred
  x.fillStyle = '#2563eb'; x.beginPath(); x.moveTo(left + 40, 14); x.lineTo(left + 80, 66); x.lineTo(left, 66); x.closePath(); x.fill(); x.fillRect(left + 28, 64, 24, 42);
  x.fillText(label, left + 104, 62);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, (w * 120) / 600), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.raycast = () => {}; m.renderOrder = 1;
  return m;
}

/** which course each car lesson drives on */
export const COURSE_OF = { 'l3-pattern': 'pattern', 'l3-manual': 'manual', 'l3-obstacle': 'obstacle', 'l3-line': 'line' };
