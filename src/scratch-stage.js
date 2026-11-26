// The Scratch stage in 3D: a 480 × 360 mm mat (one Scratch step = 1 mm, (0, 0) in the middle, +y away from you)
// with the cat sprite on it, and a speech bubble that follows the cat's head on screen.
import * as THREE from 'three';
import { newSprite } from './scratch.js';

const MM = 0.001, W = 480, H = 360;

function matTexture() { // white stage, 20-step grid, x/y axes with their end values, Scratch-blue border
  const k = 4, c = document.createElement('canvas');
  c.width = W * k; c.height = H * k;
  const g = c.getContext('2d');
  g.scale(k, k);
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  g.lineWidth = 0.5; g.strokeStyle = '#e4eaf5'; g.beginPath();
  for (let x = 0; x <= W; x += 20) { g.moveTo(x, 0); g.lineTo(x, H); }
  for (let y = 0; y <= H; y += 20) { g.moveTo(0, y); g.lineTo(W, y); }
  g.stroke();
  g.lineWidth = 1.2; g.strokeStyle = '#a9b8d6'; g.beginPath();
  g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke();
  g.fillStyle = '#5b6a88'; g.font = '600 10px "Figtree Variable", system-ui, sans-serif';
  g.fillText('x: −240', 8, H / 2 - 6); g.fillText('y: 180', W / 2 + 6, 16); g.fillText('y: −180', W / 2 + 6, H - 10);
  g.textAlign = 'right'; g.fillText('x: 240', W - 8, H / 2 - 6);
  g.lineWidth = 4; g.strokeStyle = '#4c97ff'; g.strokeRect(2, 2, W - 4, H - 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/** stage: stage.js API. el: the #stage element. cat: a clone of cat.glb. onMove(sprite): when x, y or direction change.
 *  Shows the scene on the stage. → { sprite (the interpreter's state), reset(), dispose() } */
export function createScratchStage(stage, el, cat, onMove = () => {}) {
  const side = new THREE.MeshStandardMaterial({ color: 0xdfe6f3, roughness: 0.8 });
  const mat = new THREE.Mesh(new THREE.BoxGeometry(W * MM, 6 * MM, H * MM), [side, side, new THREE.MeshStandardMaterial({ map: matTexture(), roughness: 0.85 }), side, side, side]);
  mat.name = 'scratch_stage'; mat.position.y = -3 * MM;
  const holder = new THREE.Group(), group = new THREE.Group();
  holder.add(cat); group.add(mat, holder);
  stage.show(group, 1.05); // before tick(): showing new content clears the stage's ticks

  const sprite = newSprite(), head = cat.getObjectByName('anchor_cat_head'), tail = cat.getObjectByName('cat_tail'), v = new THREE.Vector3();
  const bubble = Object.assign(document.createElement('div'), { className: 'sc-bubble3d', hidden: true });
  el.append(bubble);
  let last = '';
  stage.tick('scratch', (t) => {
    holder.position.set(sprite.x * MM, 0, -sprite.y * MM);
    holder.rotation.y = THREE.MathUtils.degToRad(90 - sprite.dir); // the cat faces +X = Scratch direction 90
    holder.scale.setScalar(sprite.size / 100);
    if (tail) tail.rotation.y = 0.35 * Math.sin(t * 2.5);         // idle tail swish
    const now = `${Math.round(sprite.x)} ${Math.round(sprite.y)} ${Math.round(sprite.dir)}`;
    if (now !== last) { last = now; onMove(sprite); }
    bubble.hidden = !sprite.say;
    if (!sprite.say) return;
    if (bubble.textContent !== sprite.say) bubble.textContent = sprite.say;
    head.getWorldPosition(v).project(stage.camera);
    bubble.style.left = `${((v.x + 1) / 2) * 100}%`; bubble.style.top = `${((1 - v.y) / 2) * 100}%`;
  });
  return { sprite, reset: () => Object.assign(sprite, newSprite()), dispose: () => { stage.untick('scratch'); bubble.remove(); } };
}
