// Verify every model in manifest.json: Khronos validator, triangle budget, bbox vs manifest dims,
// anchors present, node names lowercase_underscore.   Usage: node models/check.mjs [id ...]
import { NodeIO, getBounds } from '@gltf-transform/core';
import validator from 'gltf-validator';
import { readFile } from 'node:fs/promises';

const MAX_TRIS = 5000, TOL_MM = 1;
const manifest = JSON.parse(await readFile(new URL('./manifest.json', import.meta.url)));
const only = process.argv.slice(2);
const io = new NodeIO();
let failed = 0;

for (const m of manifest) {
  if (only.length && !only.includes(m.id)) continue;
  const errs = [];
  let bytes;
  try { bytes = new Uint8Array(await readFile(new URL(`../${m.file}`, import.meta.url))); }
  catch { console.log(`FAIL ${m.id}: missing ${m.file}`); failed++; continue; }

  const report = await validator.validateBytes(bytes);
  if (report.issues.numErrors) errs.push(`validator ${report.issues.numErrors} errors: ` +
    report.issues.messages.filter((x) => x.severity === 0).slice(0, 3).map((x) => x.message).join('; '));

  const doc = await io.readBinary(bytes);
  const scene = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];
  const names = new Set();
  let tris = 0;
  scene.traverse((n) => {
    const name = n.getName();
    if (!/^[a-z0-9_]+$/.test(name)) errs.push(`bad node name "${name}"`);
    names.add(name);
    for (const p of n.getMesh()?.listPrimitives() ?? []) {
      tris += (p.getIndices() ?? p.getAttribute('POSITION')).getCount() / 3;
    }
  });
  if (tris > MAX_TRIS) errs.push(`${tris} triangles > ${MAX_TRIS}`);

  const missing = m.anchors.filter((a) => !names.has(a));
  if (missing.length) errs.push(`anchors missing in glb: ${missing.join(', ')}`);
  const extra = [...names].filter((n) => n.startsWith('anchor_') && !m.anchors.includes(n));
  if (extra.length) errs.push(`anchors not in manifest: ${extra.join(', ')}`);

  const { min, max } = getBounds(scene);
  const [w, h, d] = max.map((v, i) => +((v - min[i]) * 1000).toFixed(2)); // glTF: X=w, Y=h, Z=d
  const dims = m.dimensions_mm;
  for (const [k, got] of Object.entries({ w, d, h })) {
    if (dims[k] && Math.abs(dims[k] - got) > TOL_MM) errs.push(`${k}: manifest ${dims[k]} vs bbox ${got}`);
  }
  // origin = bottom-centre of the PCB/body: x and z centred within tolerance
  const cx = ((max[0] + min[0]) / 2) * 1000, cz = ((max[2] + min[2]) / 2) * 1000;
  if (Math.abs(cx) > dims.w / 2 || Math.abs(cz) > dims.d / 2) errs.push(`origin far from centre (${cx}, ${cz})`);

  const line = `${m.id}: ${tris} tris, bbox w${w} d${d} h${h} mm, ${m.anchors.length} anchors, ` +
    `${(bytes.length / 1024).toFixed(1)} KB, validator warnings ${report.issues.numWarnings}`;
  if (errs.length) { failed++; console.log(`FAIL ${line}\n  - ${errs.join('\n  - ')}`); }
  else console.log(`ok   ${line}`);
}
process.exit(failed ? 1 : 0);
