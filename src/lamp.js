// Light-sensor lesson: a desk lamp beside the LDR module. Drag it closer or further, switch it on or off.
// Real behaviour: the shade points one way and lights a patch of desk. The LDR only gets the lamp's light while it sits
// inside that beam (fading across the soft edge). Inside, the light falls with the square of the distance and with the
// slant it hits the LDR's flat top. Move the lamp back far enough and the sensor is outside the beam: only room light.
// Drawn 1 mm per real cm, like the obstacle in the ultrasonic lesson.
import * as THREE from 'three';

const MM = 0.001, SCALE = 1.0 * MM, D2R = Math.PI / 180;
export const LAMP_CD = 150;                  // ponytail: a typical LED desk lamp, on its beam axis (≈ 1 000 lux at 35 cm), not a measured part
export const LAMP_MAX = 70;                  // cm along the desk
export const AIM = 60 * D2R, INNER = 18 * D2R, OUTER = 28 * D2R; // shade tilt below horizontal; full-light and edge-of-beam half angles
const HB = 32;                               // bulb height above the desk, cm (drawn mm)

/** how much of the beam reaches a point `h` cm along the desk and `dy` cm below the bulb: 1 inside, 0 outside, smooth across the edge */
export function beamAt(h, dy) {
  const off = Math.abs(Math.atan2(dy, Math.max(0, h)) - AIM);
  if (off <= INNER) return 1;
  if (off >= OUTER) return 0;
  const k = (OUTER - off) / (OUTER - INNER);
  return k * k * (3 - 2 * k);
}
/** lux the lamp adds on the LDR's face-up top, `h` cm along the desk from under the bulb, `dy` cm below it */
export function lampLux(h, dy, on = true) {
  if (!on) return 0;
  const r = Math.hypot(h, dy) / 100;         // metres
  return LAMP_CD * beamAt(h, dy) * (dy / 100 / r) / (r * r);
}

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...o });
function rod(a, b, r, m) { // a cylinder from a to b (mm)
  const d = new THREE.Vector3().subVectors(b, a), o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 14), m);
  o.position.copy(a).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return o;
}

/** Adds a desk lamp beside the LDR (`ldr` = the LDR's anchor), on the side away from `board`, shining back toward it. */
export function createLampRig(group, ldr, board) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const at = ldr.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
  const out = at.clone().sub(board.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv)).setY(0).normalize(); // away from the board
  const dy = HB - at.y / SCALE;               // bulb above the LDR's top, cm
  const st = { cm: 18, on: true, min: 0 };
  const REACH = 16;                           // head in front of the base, mm

  // the lamp, in mm: base at the origin, head reaching along +Z, shade tilted AIM below horizontal
  const lamp = new THREE.Group(), body = mat(0x1f2f4d, { roughness: 0.35 }), metal = mat(0x9aa1ab, { roughness: 0.3, metalness: 0.8 }), red = mat(0xd8452f, { roughness: 0.35 });
  const add = (o) => { lamp.add(o); return o; }, v = (x, y, z) => new THREE.Vector3(x, y, z);
  add(new THREE.Mesh(new THREE.CylinderGeometry(10, 11, 3, 40), body)).position.y = 1.5;
  add(new THREE.Mesh(new THREE.CylinderGeometry(3, 3.5, 2, 20), body)).position.y = 3.6;
  const elbow = v(0, 26, -7), head = v(0, HB + 5, REACH - 5);
  add(rod(v(0, 4, 0), elbow, 1.1, metal)); add(rod(elbow, head, 1.1, metal));
  for (const p of [v(0, 4.5, 0), elbow, head]) add(new THREE.Mesh(new THREE.SphereGeometry(2, 16, 12), red)).position.copy(p);
  const aimLocal = v(0, -Math.sin(AIM), Math.cos(AIM));
  const shade = add(new THREE.Group()); shade.position.set(0, HB, REACH); shade.quaternion.setFromUnitVectors(v(0, -1, 0), aimLocal);
  const cone = new THREE.CylinderGeometry(3.5, 11, 12, 40, 1, true).translate(0, -3, 0);
  shade.add(new THREE.Mesh(cone, red), new THREE.Mesh(cone, mat(0xf3ead8, { side: THREE.BackSide, roughness: 0.8 })));
  const bulbMat = mat(0xfff6dc, { emissive: 0xffd27a, emissiveIntensity: 0, roughness: 0.2 });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 2.5, 24), red), globe = new THREE.Mesh(new THREE.SphereGeometry(4.2, 20, 14), bulbMat);
  cap.position.y = 3.8; globe.position.y = -4.5; shade.add(cap, globe); // (add() returns the parent, so place the children first)
  lamp.scale.setScalar(MM);
  lamp.traverse((o) => { if (o.isMesh) { o.name = 'lamp_body'; o.castShadow = true; } });

  const holder = new THREE.Group(), anchor = new THREE.Object3D(), target = new THREE.Object3D();
  anchor.name = 'lamp_rig';
  anchor.position.set(0, (HB + 16) * MM, REACH * MM);
  holder.add(lamp, anchor);
  group.add(holder, target);
  // the light: a spot along the shade's fixed axis (its pool moves with the lamp), and a faint visible beam to the desk
  const spot = new THREE.SpotLight(0xffd9a0, 0, 0, OUTER, (OUTER - INNER) / OUTER, 2);
  spot.target = target; group.add(spot);
  const beamGeo = new THREE.CylinderGeometry(0, Math.tan(OUTER * 0.92), 1, 48, 1, true).translate(0, -0.5, 0).rotateX(Math.PI); // apex at 0, opens along +Y
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xffc960, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }));
  beam.raycast = () => {}; beam.renderOrder = 3; group.add(beam);

  const bulb = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  function place() {
    holder.position.copy(at).addScaledVector(out, st.cm * SCALE + REACH * MM).setY(0);
    holder.rotation.y = Math.atan2(-out.x, -out.z); // lamp's +Z points back toward the sensor
    bulb.copy(at).addScaledVector(out, st.cm * SCALE).setY(HB * SCALE);
    const axis = out.clone().negate().multiplyScalar(Math.cos(AIM)).setY(-Math.sin(AIM)); // fixed: down and toward the sensor
    spot.position.copy(bulb); target.position.copy(bulb).add(axis);
    spot.intensity = st.on ? 0.0018 : 0;        // candela in scene units (1 mm per cm)
    bulbMat.emissiveIntensity = st.on ? 2.2 : 0;
    beam.visible = st.on;
    beam.position.copy(bulb); beam.quaternion.setFromUnitVectors(Y, axis); beam.scale.setScalar(bulb.y / Math.sin(AIM)); // down to the desk
  }

  const rig = {
    st, anchor,
    dist(cm) { st.cm = Math.min(LAMP_MAX, Math.max(st.min, cm)); place(); },
    on(x) { st.on = x; place(); },
    /** lux the lamp puts on the LDR now, and how much of the beam reaches it (0..1) */
    lux: () => lampLux(st.cm, dy, st.on),
    beam: () => beamAt(st.cm, dy),
    /** start dragging at this (world) ray; returns ray → cm, or null when the ray misses the desk */
    grab(ray0) {
      group.updateMatrixWorld(true); inv.copy(group.matrixWorld).invert();
      const desk = new THREE.Plane(Y, 0), along = (ray) => { const p = ray.clone().applyMatrix4(inv).intersectPlane(desk, new THREE.Vector3()); return p && p.sub(at).dot(out); };
      const s0 = along(ray0), cm0 = st.cm;
      return s0 == null ? null : (ray) => { const s = along(ray); return s == null ? st.cm : Math.min(LAMP_MAX, Math.max(st.min, cm0 + (s - s0) / SCALE)); };
    },
    dispose() { group.remove(holder, target, spot, beam); spot.dispose(); },
  };
  rig.dist(st.cm);
  return rig;
}
