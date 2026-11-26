// Line-follower track (Tech Explorers L3, p. 174). The car stays in place and the black tape slides under it.
// drift = the car's offset from the tape: -100 (car far left of it) … 0 (tape between the sensors) … 100 (car far right).
import * as THREE from 'three';

/** [left, right] IR readings for a drift; 1 = over the black tape. Both 1 when the tape is lost, as the book says. */
export const lineSensors = (drift) => { const d = Math.abs(drift); return d >= 70 ? [1, 1] : d < 25 ? [0, 0] : drift > 0 ? [1, 0] : [0, 1]; };

/** One 100 ms tick: driving straight the oval's curve pushes the car off, steering pulls it back (a, b: motor A/B, 1 = forward). */
export const lineStep = (drift, a, b, curve) => Math.max(-100, Math.min(100, drift + (a > 0 && b > 0 ? curve : 0) + (a > 0 ? 6 : 0) - (b > 0 ? 6 : 0)));
// ponytail: drift only, no real path; swap for a drawn oval the car drives on if kids need to see whole laps

export function createLineRig(group, chassis) {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(chassis).applyMatrix4(group.matrixWorld.clone().invert());
  const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const tape = new THREE.Mesh(new THREE.PlaneGeometry(size.x * 4, size.z * 0.14), new THREE.MeshBasicMaterial({ color: 0x141414 }));
  tape.rotation.x = -Math.PI / 2;
  tape.position.set(c.x, box.min.y + size.y * 0.004, c.z);
  tape.raycast = () => {};
  group.add(tape);
  return {
    drift: 0, a: 0, b: 0,
    set(d) { this.drift = d; tape.position.z = c.z - (d / 100) * (size.z / 2); }, // drift > 0: the tape is to the car's left (-z)
    dispose() { group.remove(tape); tape.geometry.dispose(); tape.material.dispose(); },
  };
}
