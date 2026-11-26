// Run: node src/lamp.test.mjs — the desk lamp on the LDR: the beam, the light it puts on the sensor, the LDR divider, where the lamp stands.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { lampLux, beamAt, createLampRig, LAMP_MAX, AIM } from './lamp.js';
import { ldrAt, roomLux, adcCounts } from './sensors.js';

const dy = 31, centre = dy / Math.tan(AIM);                            // bulb 31 cm above the LDR; the beam's centre lands ~18 cm out
assert.equal(beamAt(centre, dy), 1);                                   // in the beam
assert.equal(beamAt(60, dy), 0);                                       // lamp moved back: the beam misses the sensor
assert.equal(lampLux(60, dy), 0);                                      // ...so the lamp adds nothing
assert.equal(beamAt(0, dy), 0);                                        // right under the head: the shade's rim shades it
const edge = [...Array(70).keys()].find((h) => h > centre && beamAt(h, dy) < 1);
assert.ok(beamAt(edge, dy) > 0 && beamAt(edge + 16, dy) === 0, 'a soft edge (≈ 34–50 cm), then dark');
assert.ok(lampLux(10, dy) > 900 && lampLux(10, dy) < 1600);           // ≈ 1 000+ lux in the beam
assert.equal(lampLux(centre, dy, false), 0);                           // switched off

const counts = (lux) => adcCounts(ldrAt(lux, 5).v);                   // module on 5 V
assert.equal(counts(roomLux(0)), 4095);                                // dark room: LDR ≈ 377 kΩ → 4.87 V, past the ADC's 3.3 V: clipped
assert.ok(counts(roomLux(20)) > 2000);                                 // room at night (1 lux): the night light is on...
assert.ok(counts(roomLux(20) + lampLux(centre, dy)) < 2000);           // ...until the sensor is in the lamp's beam
assert.ok(counts(roomLux(20) + lampLux(60, dy)) > 2000);               // move the lamp back: dark again
assert.equal(adcCounts(5), 4095);                                      // the ADC clips at 3.3 V

// the rig: LDR 10 mm up, board behind it; the bulb stands `cm` (1 mm per cm) along the desk, away from the board, 32 mm up
const group = new THREE.Group(), ldr = new THREE.Object3D(), board = new THREE.Object3D();
ldr.position.set(0, 0.01, 0); board.position.set(0.1, 0, 0); group.add(ldr, board);
const rig = createLampRig(group, ldr, board);
const spot = () => { let s; group.traverse((o) => { if (o.isSpotLight) s = o; }); return s; };
rig.dist(20);
assert.ok(Math.abs(spot().position.x + 0.02) < 1e-9 && Math.abs(spot().position.y - 0.032) < 1e-9, 'bulb 20 mm out, 32 mm up');
const aim = spot().target.position.clone().sub(spot().position);
assert.ok(aim.x > 0 && aim.y < 0, 'shade points down and back toward the sensor');
rig.dist(40); assert.deepEqual(spot().target.position.clone().sub(spot().position).toArray(), aim.toArray()); // fixed aim: it doesn't follow the sensor
assert.equal(rig.lux(), lampLux(40, 22)); // bulb 32 cm up, test LDR 10 cm up
rig.dist(500); assert.equal(rig.st.cm, LAMP_MAX);
rig.dist(20);
const down = (x) => new THREE.Ray(new THREE.Vector3(x, 1, 0), new THREE.Vector3(0, -1, 0));
const at = rig.grab(down(-0.05));
assert.equal(Math.round(at(down(-0.07))), 40);                        // drag 20 mm away → 20 cm further
assert.equal(at(down(1)), 0);
console.log('lamp: all checks passed');
