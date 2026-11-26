// Run: node src/assemble.test.mjs — plays a lesson assembly on a fake clock and checks the order of events.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAssembly } from './assemble.js';

let now = 0, queue = [];
globalThis.requestAnimationFrame = (f) => queue.push(f);
const frames = (sec) => { for (let i = 0; i < sec * 30; i++) { now += 1000 / 30; const q = queue; queue = []; q.forEach((f) => f(now)); } };

const tube = () => { const g = new THREE.BufferGeometry(); g.setIndex(Array.from({ length: 60 }, (_, i) => i)); return { geometry: g, visible: true }; };
const mod = (side) => ({ root: new THREE.Object3D(), home: new THREE.Vector3(side * 0.1, 0, 0), side, tubes: [tube()], plugs: [{ userData: { end: 'port' }, visible: true }] });
const kit = { modules: [mod(1), mod(1)] };
const acts = [], seen = [];
const a = createAssembly(kit, { act: (k) => acts.push(k), onStep: (i) => seen.push(i), highlight() {} });

a.seek(0);
assert.equal(kit.modules[1].root.visible, false);               // second module waits off-stage
frames(1.2);
assert.ok(kit.modules[0].root.position.distanceTo(kit.modules[0].home) < 1e-6); // first one has landed
assert.equal(kit.modules[0].plugs[0].visible, false);           // its port plug seats after the cable grows
frames(1.2);
assert.equal(kit.modules[0].plugs[0].visible, true);
frames(20);
assert.deepEqual(acts, ['reset', 'power-off', 'blocks', 'upload', 'power-on', 'observe']); // procedure in order, once each
assert.deepEqual(seen, [0, 1, 2, 3, 4, 5, 6, -1]);
assert.ok(a.done());

acts.length = 0;
a.seek(4);                                                       // replay from "upload": earlier steps applied at once
assert.deepEqual(acts, ['reset', 'power-off', 'blocks', 'upload']); // ...and the chosen step starts at once
// Jr. Explorer lessons: the Steps list has one line per assembly step (battery + modules, SW1 on, try it)
const { JR_LESSONS, jrSteps, jrWithBattery } = await import('./kit.js');
const { JR_PROCEDURE } = await import('./assemble.js');
for (const l of JR_LESSONS) assert.equal(jrSteps(l).length, jrWithBattery(l.kit).length + JR_PROCEDURE.length, l.id);
console.log('assemble: all checks passed');
