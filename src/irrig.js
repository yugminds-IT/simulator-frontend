// Hand-wave lesson: something in front of the IR obstacle module: a hand, a white card or a black card. Drag it closer or further.
// How the real module works: IR1 shines 940 nm infrared straight ahead all the time. Whatever is in front bounces some of it
// back into the CGQ1 phototransistor beside it; more light pulls its node voltage lower. The LM393 compares that voltage with
// the R6 trimmer and switches DO (and the S LED) when it drops below. So it answers yes/no, not "how far". White bounces back
// most infrared, so it is seen from far away; black soaks it up and is seen only up close. Drawn 3 mm per real cm (1–30 cm).
import * as THREE from 'three';

const MM = 0.001, SCALE = 3 * MM, HALF = THREE.MathUtils.degToRad(17); // IR1's half-angle
export const IR_MAX = 30;
// [title, what happens, how much infrared it bounces back]
export const IR_THINGS = {
  hand: ['Hand', 'Skin bounces back about half of the infrared light.', 0.55],
  white: ['White card', 'White bounces back almost all of it, so the sensor sees it from the farthest away.', 1],
  black: ['Black card', 'Black soaks up infrared, so the sensor only sees it up close.', 0.12],
};
/** CGQ1 node voltage on the 5 V module with a surface of reflectance `refl` at `cm` (same curve as sensors.js irVolts) */
export const irVolts = (cm, refl) => 5 / (1 + 13.4 * refl * (3 / Math.max(0.5, cm)) ** 2);
/** farthest distance (cm) this surface is seen at trimmer voltage `thr`: where irVolts = thr */
export const irRange = (refl, thr) => 3 * Math.sqrt((13.4 * refl) / (5 / thr - 1));

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });
function build(kind) { // mm, standing on the desk (y = 0), face toward the sensor along local -Z
  const g = new THREE.Group(), add = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  if (kind === 'hand') { // an open hand held up, palm toward the sensor
    const skin = mat(0xe9b58f, { roughness: 0.75 });
    add(new THREE.BoxGeometry(24, 26, 7), skin, 0, 14);
    [-9, -3, 3, 9].forEach((x, i) => add(new THREE.CapsuleGeometry(2.7, [13, 16, 15, 11][i], 4, 10), skin, x, 27 + [13, 16, 15, 11][i] / 2 + 2.7));
    add(new THREE.CapsuleGeometry(2.9, 10, 4, 10), skin, -15.5, 17).rotation.z = 0.6;
  } else {
    const face = mat(kind === 'white' ? 0xf6f5ef : 0x1d1f24, { roughness: 0.85 }), foot = mat(0x9aa1ab, { roughness: 0.4, metalness: 0.6 });
    add(new THREE.BoxGeometry(36, 44, 2), face, 0, 24);
    add(new THREE.BoxGeometry(24, 2, 12), foot, 0, 1);
  }
  g.scale.setScalar(MM);
  g.traverse((o) => { if (o.isMesh) { o.name = 'ir_target'; o.castShadow = true; } });
  return g;
}

/** Adds the target in front of the IR module (`root`), on the beam from IR1 (`led` anchor); `rx` = CGQ1's anchor. */
export function createIrRig(group, root, led, rx) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const local = (o) => o.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
  const from = local(led), to = local(rx), mid = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3()).applyMatrix4(inv);
  const dir = from.clone().sub(mid).setY(0).normalize(); // IR1 points out of the module's front edge, away from the board
  const st = { kind: 'hand', cm: 20, thr: 2.5, half: 0, model: null };
  const holder = new THREE.Group(), anchor = new THREE.Object3D(), fx = new THREE.Group();
  anchor.name = 'ir_target';
  holder.add(anchor);
  group.add(holder, fx);
  const Y = new THREE.Vector3(0, 1, 0), quiet = (m) => { m.raycast = () => {}; m.renderOrder = 3; fx.add(m); return m; };
  const coneGeo = new THREE.CylinderGeometry(Math.tan(HALF), 0, 1, 40, 1, true).translate(0, 0.5, 0); // apex at 0, opens along +Y
  const beam = (c) => quiet(new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false })));
  const out = beam(0x9a6bff), back = beam(0xd86bff); // infrared drawn purple, the way a phone camera shows it
  const seen = quiet(new THREE.Mesh(new THREE.RingGeometry(2.2 * MM, 3.6 * MM, 28), new THREE.MeshBasicMaterial({ color: 0xf2a33a, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })));
  seen.position.copy(to).addScaledVector(dir, 0.4 * MM); seen.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);

  const volts = () => irVolts(st.cm, IR_THINGS[st.kind][2]);
  const hit = () => volts() < st.thr;
  function place() {
    holder.position.copy(from).addScaledVector(dir, st.cm * SCALE + st.half).setY(0);
    holder.rotation.y = Math.atan2(dir.x, dir.z); // local +Z along the beam, so local -Z faces the sensor
    out.position.copy(from); out.quaternion.setFromUnitVectors(Y, dir); out.scale.setScalar(st.cm * SCALE);
    const face = from.clone().addScaledVector(dir, st.cm * SCALE), toRx = to.clone().sub(face);
    back.position.copy(face); back.quaternion.setFromUnitVectors(Y, toRx.clone().normalize()); back.scale.setScalar(toRx.length());
    back.material.opacity = 0.04 + 0.4 * (1 - volts() / 5); // brighter the more light comes back
    seen.visible = hit();
  }

  const rig = {
    st, anchor, volts, hit,
    range: () => irRange(IR_THINGS[st.kind][2], st.thr),
    set(kind) {
      if (st.model) holder.remove(st.model);
      st.kind = kind; st.model = build(kind);
      const b = new THREE.Box3().setFromObject(st.model, true);
      st.half = -b.min.z;
      anchor.position.set(0, b.max.y + 4 * MM, 0);
      holder.add(st.model); place();
    },
    dist(cm) { st.cm = Math.min(IR_MAX, Math.max(1, cm)); place(); },
    thr(v) { st.thr = v; place(); },
    /** start dragging at this (world) ray; returns ray → cm along the beam, or null when the ray misses the desk */
    grab(ray0) {
      group.updateMatrixWorld(true); inv.copy(group.matrixWorld).invert();
      const desk = new THREE.Plane(Y, 0), along = (ray) => { const p = ray.clone().applyMatrix4(inv).intersectPlane(desk, new THREE.Vector3()); return p && p.sub(from).dot(dir); };
      const s0 = along(ray0), cm0 = st.cm;
      return s0 == null ? null : (ray) => { const s = along(ray); return s == null ? st.cm : Math.min(IR_MAX, Math.max(1, cm0 + (s - s0) / SCALE)); };
    },
    dispose() { group.remove(holder, fx); },
  };
  rig.set('hand');
  return rig;
}
