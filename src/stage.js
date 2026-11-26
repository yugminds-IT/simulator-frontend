// 3D stage: loads one model or a whole kit (base board + ESP32 + modules wired to ports), frames it,
// draws leader-line callouts to anchors, and runs the visual effects the simulator asks for.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const COLORS = ['#2563eb', '#f59e0b', '#8a4fd6', '#18a36b', '#e0393e', '#0e9fb5'];
const WIRE = [0x1c1c1c, 0xd63a1f, 0xe8781c, 0xe9b81c]; // black, red, orange (+ yellow) — workbook cable colours
// servo: its own lead goes straight onto the 3 male pins of the SERVO header (pin 1 GND, 2 VCC, 3 signal) in a black plug
const SERVO_LEAD = { lead_gnd: [1, 0x5a2a12], lead_vcc: [2, 0xd02a1a], lead_signal: [3, 0xf08a1a] };
const DUPONT = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.55 });
// base-board ports with a side-entry (right-angle) XH: which way the opening faces, in base-board x (left edge -1, right edge +1)
const SIDE_PORT = {}; // none on the current board: every port is top-entry
const MM = 0.001;
// direction the cable plugs in, as a yaw in three.js terms (0 = +X); default 0
const CONNECTOR_YAW = { battery: Math.PI / 2, touch: Math.PI / 2, tt_motor: Math.PI, ultrasonic: -Math.PI / 2 }; // ultrasonic: transducers face the front (the obstacle comes toward the viewer) // tt_motor: terminals (can end) face the board
const TOP_ENTRY = new Set(['touch']); // module XH is vertical: the cable plug drops in from above, like the base ports
const CABLE_PINS = { battery: ['positive', 'negative'], servo: ['lead_gnd', 'lead_vcc', 'lead_signal'], tt_motor: ['terminal_1', 'terminal_2'] };
const PLUG = new THREE.MeshStandardMaterial({ color: 0xece6d8, roughness: 0.6 }); // JST-XH cable plug
const unitBox = new THREE.BoxGeometry(1, 1, 1);
/** SG90 case: translucent blue plastic, so the gears inside show */
function seeThrough(o) {
  if (!o.isMesh) return;
  if (/^servo_blue/.test(o.material?.name) && !o.material.transparent) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.62; o.material.depthWrite = false; }
  if (/^led_/.test(o.material?.name) && !o.material.isMeshPhysicalMaterial) o.material = ledEpoxy(o.material); // LED lens: tinted glassy epoxy
}
/** clear-coloured epoxy like a real 5 mm LED: refracting, tinted by its colour (transmission × color), glossy, the lead frame shows through.
 *  thickness is in the lens's own units (mm inside the 0.001-scaled model root). */
function ledEpoxy(m) {
  const e = new THREE.MeshPhysicalMaterial({ name: m.name, color: m.color.clone(), roughness: 0.06, metalness: 0, transmission: 0.94, thickness: 4.5, ior: 1.52,
    clearcoat: 1, clearcoatRoughness: 0.04, specularIntensity: 1 });
  e.userData.led = true;
  return e;
}
/** remove the battery pack's modelled lead + plug (battery_lead_*, battery_plug*) where a live cable to BAT is drawn instead */
function dropLead(root) {
  const gone = [];
  root.traverse((o) => { if (/^(battery_(lead|plug)|servo_(wire|plug))/.test(o.name)) gone.push(o); });
  gone.forEach((o) => o.removeFromParent());
}

const loader = new GLTFLoader();
const cache = new Map();
export const getModel = (url) => {
  if (!cache.has(url)) cache.set(url, loader.loadAsync(url).then((g) => g.scene));
  return cache.get(url);
};
const wp = (o) => o.getWorldPosition(new THREE.Vector3());

const edgeCache = new Map();
// clear acrylic like the real plates: faces almost see-through with a crisp reflection, cut edges and hole walls lit white
const glassCache = new Map();
function glass(m) {
  if (!glassCache.has(m.name)) {
    const g = new THREE.MeshPhysicalMaterial({ name: m.name, metalness: 0 });
    if (m.name === 'acrylic_edge') Object.assign(g, { color: new THREE.Color(0xeef8ff), emissive: new THREE.Color(0xbfe4ff), emissiveIntensity: 0.45, roughness: 0.15, transparent: true, opacity: 0.9 });
    else Object.assign(g, { color: new THREE.Color(0xe6f5ff), roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.4, transparent: true, opacity: 0.16, depthWrite: false });
    glassCache.set(m.name, g);
  }
  return glassCache.get(m.name);
}
const INK = new THREE.LineBasicMaterial({ color: 0x15161a, transparent: true, opacity: 0.5 });
const INK_GLASS = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }); // clear acrylic: light outlines
function ink(obj) {
  obj.traverse((o) => {
    if (!o.isMesh || o.userData.inked || o.geometry.type === 'TubeGeometry' || o.material?.userData?.led) return; // no dark outline on glassy LEDs
    if (!edgeCache.has(o.geometry.uuid)) edgeCache.set(o.geometry.uuid, new THREE.EdgesGeometry(o.geometry, 32));
    const e = new THREE.LineSegments(edgeCache.get(o.geometry.uuid), o.userData.glass ? INK_GLASS : INK);
    e.raycast = () => {};
    o.add(e);
    o.userData.inked = true;
  });
}

// callout icons (stroke SVG), picked from the anchor name
const ICONS = {
  chip: '<rect x="6" y="6" width="12" height="12" rx="1"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  wifi: '<path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0"/><circle cx="12" cy="19.5" r="1"/>',
  pins: '<path d="M5 21h14M7 21V7M12 21V4M17 21V7M5 7h4M10 4h4M15 7h4"/>',
  usb: '<rect x="2.5" y="8.5" width="19" height="7" rx="3.5"/><path d="M7 12h10"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 2v2M4.2 5.2l1.4 1.4M19.8 5.2l-1.4 1.4M2 12h2M20 12h2"/><path d="M8 15a5 5 0 1 1 8 0c-.8.8-1 1.6-1 3H9c0-1.4-.2-2.2-1-3z"/>',
  button: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="12" r="4.5"/>',
  plug: '<path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0zM12 17v5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/><circle cx="12" cy="12" r="7"/>',
  plugin: '<rect x="4" y="8" width="16" height="10" rx="1.5"/><path d="M8 8V5M12 8V5M16 8V5M8 12v2M12 12v2M16 12v2"/>',
  sound: '<path d="M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  screen: '<rect x="3" y="5" width="18" height="12" rx="1.5"/><path d="M8 21h8M12 17v4"/>',
  thermo: '<path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z"/><path d="M12 9v7"/>',
};
const ICON_RULES = [[/antenna/, 'wifi'], [/usb/, 'usb'], [/led|traffic_|red$|yellow$|green$|ldr/, 'bulb'], [/btn|button/, 'button'],
  [/3v3|vin|gnd|power|regulator|bat|sw1|switch|battery|cells|positive|negative/, 'plug'], [/pins|pin\d|header|cn$|servo_pin/, 'pins'],
  [/wheel|motor|shaft|horn|servo/, 'gear'], [/socket|xh|port|_d\d\d$/, 'plugin'], [/buzzer|mic/, 'sound'], [/ultra|transmitter|receiver|emitter|ir_/, 'eye'],
  [/screen|oled/, 'screen'], [/dht|sensor|temp/, 'thermo'], [/module|chip|uart|esp32|tb6612/, 'chip']];
const iconFor = (name) => ICONS[(ICON_RULES.find(([re]) => re.test(name)) || [0, 'chip'])[1]];

// floor: a perspective grid (fine + bold lines) on the ground, fading out with distance
const gridMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, extensions: { derivatives: true },
  uniforms: { cell: { value: 0.01 }, fade: { value: 0.3 }, centre: { value: new THREE.Vector3() }, color: { value: new THREE.Color(0x8496bd) } },
  vertexShader: 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: `uniform float cell; uniform float fade; uniform vec3 centre; uniform vec3 color; varying vec3 vW;
    float grid(float c) { vec2 p = vW.xz / c; vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p); return 1.0 - min(min(g.x, g.y), 1.0); }
    void main() { float a = grid(cell) * 0.22 + grid(cell * 5.0) * 0.4; a *= 1.0 - smoothstep(fade * 0.3, fade, length(vW.xz - centre.xz));
      if (a < 0.01) discard; gl_FragColor = vec4(color, a); }`,
});

let haloTex = null;
function halo(color) {
  if (!haloTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    haloTex = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.scale.setScalar(14 * MM);
  s.visible = false;
  return s;
}

export function createStage(el) {
  const canvas = el.querySelector('canvas');
  const svg = el.querySelector('#leaders');
  const tagLayer = el.querySelector('#tags');
  const tip = el.querySelector('#tooltip');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.NeutralToneMapping; // Khronos PBR Neutral: keeps product colours (yellow plastics) true
  renderer.toneMappingExposure = 0.82;              // keep lit faces below the highlight roll-off so colours stay saturated
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 6;
  scene.add(sun, sun.target);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.16 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), gridMat);
  floor.rotation.x = -Math.PI / 2; floor.renderOrder = -1; floor.raycast = () => {};
  scene.add(floor);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.001, 10);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.screenSpacePanning = true;

  let content = null, home = null, callouts = [], showTags = true, hl = null, wires = [], pills = false, pillPref = false, focused = null, hovered = null;
  const card = el.querySelector('#focus');
  const fx = new Map(); // key -> (t) => void, per-frame effects
  const state = new WeakMap(); // node -> saved material/position/halo

  function resize() {
    const { clientWidth: w, clientHeight: h } = el;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }
  new ResizeObserver(() => { resize(); layoutTags(); }).observe(el);

  function setContent(obj, fit = 1.25) {
    if (content) scene.remove(content);
    scene.children.filter((o) => o.isSprite || o.userData.fx).forEach((o) => scene.remove(o));
    fx.clear(); carMove = null;
    wires = [];
    content = obj;
    el.querySelector('.oled-view')?.setAttribute('hidden', ''); // a new scene: no OLED until one draws
    content.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      if (/^acrylic/.test(o.material?.name)) { o.material = glass(o.material); o.userData.glass = true; }
      seeThrough(o);
    });
    ink(content);
    scene.add(content);
    focus(null);
    frame(fit);
    fx.delete('fly');
  }

  async function load(url, prep) {
    const root = (await getModel(url)).clone(true);
    if (prep) await prep(root);
    setContent(root);
    return root;
  }

  // kit: base board + ESP32 + TB6612 in their sockets, modules beside their ports, cables between anchors.
  /** opts.board: id of a stand-alone board (Jr. Explorer) loaded from models.board instead of base + ESP32 + TB6612; its modules sit in
   *  front of / behind it (inputs at the front edge, outputs at the back) and every cable wire goes pin N → pin N. */
  async function loadKit(models, modules, opts = {}) {
    const prefix = opts.board || 'base', rows = !!opts.board;
    const [base, esp, tb] = (await Promise.all(rows ? [models.board] : [models.base, models.esp32, models.tb6612]).then((a) => a.map(getModel)).then((a) => Promise.all(a))).map((s) => s.clone(true));
    const g = new THREE.Group();
    g.add(...[base, esp, tb].filter(Boolean));
    let chassis = null;
    if (models.chassis) { // robot: the base board sits on the chassis top plate
      chassis = (await getModel(models.chassis)).clone(true);
      g.add(chassis);
      await mountWheels(chassis, models.wheel, models.tt_motor);
      g.updateMatrixWorld(true);
      base.position.y = wp(chassis.getObjectByName('anchor_chassis_mount')).y;
      base.rotation.y = -Math.PI / 2; // the board's front edge (ESP32 end, -z on the desk) faces the car's front (+x), as in the build guide
    }
    g.updateMatrixWorld(true);
    const lift = new THREE.Vector3(0, 2.5 * MM, 0); // male-header spacer sits on the socket
    if (esp) esp.position.copy(wp(base.getObjectByName('anchor_base_esp32_socket'))).add(lift);
    if (tb) tb.position.copy(wp(base.getObjectByName('anchor_base_tb6612_socket'))).add(lift);
    [esp, tb].forEach((m) => { if (m) m.rotation.y = base.rotation.y; });
    const bb = new THREE.Box3().setFromObject(base), half = bb.max.x, halfZ = bb.max.z;

    const placed = [];
    for (const m of modules) {
      const root = (await getModel(m.url)).clone(true);
      dropLead(root); // the live cable to the port replaces the battery's own lead
      root.traverse(seeThrough);
      const portPins = [];
      base.traverse((o) => { if (o.name.startsWith(`anchor_${prefix}_${m.port}_pin`)) portPins.push(o); });
      const c = portPins.reduce((a, o) => a.add(wp(o)), new THREE.Vector3()).divideScalar(portPins.length || 1);
      const side = rows ? (c.z > 0 ? 2 : -2) : c.x < 0 ? -1 : 1;              // rows: 2 = in front of the board, -2 = behind it
      root.rotation.y = (rows ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : side < 0 ? 0 : Math.PI) - (CONNECTOR_YAW[m.id] || 0);
      if (m.id === 'oled' && !rows) { // the screen faces the viewer: header to the back, text left-to-right, propped up ~26°
        root.rotation.y += side < 0 ? Math.PI / 2 : -Math.PI / 2;
        root.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), 0.45);
      }
      if (m.at?.edge && !rows) root.rotation.y = (m.at.edge === 'front' ? -Math.PI / 2 : Math.PI / 2) - (CONNECTOR_YAW[m.id] || 0); // m.at: { edge: front (-z) | rear (+z), x mm }: plugs face the board
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      placed.push({ ...m, root, side, z: c.z, x: c.x, box, portPins, byNumber: rows, y: m.id === 'oled' && !rows ? -box.min.y : 0, // a tilted module rests on its lowest edge
        dirA: rows ? new THREE.Vector3(0, 0, -Math.sign(side)) : m.at?.edge ? new THREE.Vector3(0, 0, m.at.edge === 'front' ? 1 : -1) : new THREE.Vector3(-side, 0, 0) });
    }
    if (rows) for (const side of [-2, 2]) { // a row of modules along the board edge, kept from overlapping
      const list = placed.filter((p) => p.side === side).sort((a, b) => a.x - b.x);
      for (let i = 1; i < list.length; i++) {
        const min = list[i - 1].x + list[i - 1].box.max.x - list[i].box.min.x + 10 * MM;
        if (list[i].x < min) list[i].x = min;
      }
    }
    for (const side of [-1, 1]) { // keep modules on one side from overlapping
      const list = placed.filter((p) => p.side === side && !p.at).sort((a, b) => (a.id === 'oled') - (b.id === 'oled') || a.z - b.z); // port order, so no cable crosses another; the propped-up OLED goes in front, so it hides nothing
      for (let i = 1; i < list.length; i++) {
        const stand = list[i].y ? list[i].box.max.y - list[i].box.min.y : 0; // room for the camera to see over a standing module
        const min = list[i - 1].z + list[i - 1].box.max.z - list[i].box.min.z + 8 * MM + stand;
        if (list[i].z < min) list[i].z = min;
      }
    }
    for (const p of placed) {
      if (rows) { p.root.position.set(p.x - (p.box.min.x + p.box.max.x) / 2, 0, p.side > 0 ? halfZ + 34 * MM - p.box.min.z : -halfZ - 34 * MM - p.box.max.z); g.add(p.root); continue; }
      // the ultrasonic's beam points toward the viewer: when modules sit in front of it on its side, it moves out past them into its own lane
      const ahead = !chassis && p.id === 'ultrasonic' ? placed.filter((q) => q !== p && q.side === p.side && !q.at && q.z > p.z) : [];
      const lane = ahead.length ? Math.max(...ahead.map((q) => q.box.max.x - q.box.min.x)) + 22 * MM : 0;
      const x = p.side < 0 ? -half - 28 * MM - lane - p.box.max.x : half + 28 * MM + lane - p.box.min.x;
      p.root.position.set(x, p.y, p.z);
      if (p.at && !p.at.edge) p.root.position.z = p.at.z * MM - (p.box.min.z + p.box.max.z) / 2; // m.at: { z mm }: beside the board at this depth
      else if (p.at) p.root.position.set(p.at.x * MM - (p.box.min.x + p.box.max.x) / 2, 0, p.at.edge === 'front' ? -halfZ - 30 * MM - p.box.max.z : halfZ + 30 * MM - p.box.min.z);
      if (chassis && p.id === 'battery') { p.root.rotation.y = Math.PI; p.root.position.set(-92 * MM, base.position.y, -24.5 * MM); } // rides on the top plate behind the board, plug toward BAT (as in the build guide)
      if (chassis && (p.id === 'ultrasonic' || p.id === 'ir')) { // on the car like the build guide: the ultrasonic on the top deck's front, the IR pair flat under the front of the bottom deck; both looking forward
        const ends = p.id === 'ir' ? ['anchor_ir_ir_led', 'anchor_ir_receiver'] : ['anchor_ultrasonic_transmitter', 'anchor_ultrasonic_receiver'];
        p.root.rotation.set(0, 0, 0); p.root.position.set(0, 0, 0); p.root.updateMatrixWorld(true);
        const c0 = new THREE.Box3().setFromObject(p.root).getCenter(new THREE.Vector3());
        const front = ends.map((n) => wp(p.root.getObjectByName(n))).reduce((a, b) => a.add(b)).multiplyScalar(0.5);
        p.root.quaternion.setFromUnitVectors(front.clone().sub(c0).setY(0).normalize(), new THREE.Vector3(1, 0, 0)); p.root.updateMatrixWorld(true);
        const b = new THREE.Box3().setFromObject(p.root), c = b.getCenter(new THREE.Vector3());
        const under = new THREE.Box3().setFromObject(chassis.getObjectByName('chassis_plate_bottom')).min.y;
        if (p.id === 'ultrasonic') p.root.position.set(122 * MM - b.max.x, base.position.y - b.min.y, -c.z);
        else p.root.position.set(140 * MM - b.max.x, under - b.max.y, (p.port === 'd36' ? -28 : 28) * MM - c.z); // left sensor on D36, right on D35
        p.root.updateMatrixWorld(true);
        const pins = []; p.root.traverse((o) => { if (/^anchor_(ultrasonic|ir)_pin\d$/.test(o.name)) pins.push(wp(o)); });
        if (pins.length) p.dirA = pins.reduce((a, v) => a.add(v), new THREE.Vector3()).divideScalar(pins.length).sub(wp(p.root)).setY(0).normalize(); // the cable leaves the plug side
      }
      if (chassis && p.id === 'button') { // on the top deck's rear, right of the battery and clear of the wheels: out in the open, easy to reach and press; pins toward the board
        p.root.rotation.y = -(CONNECTOR_YAW.button || 0); p.root.position.set(0, 0, 0); p.root.updateMatrixWorld(true);
        const b = new THREE.Box3().setFromObject(p.root), c = b.getCenter(new THREE.Vector3());
        p.root.position.set(-half - 30 * MM - c.x, base.position.y - b.min.y, 20 * MM - c.z); // between the right rear wheel and the battery
        p.dirA = new THREE.Vector3(1, 0, 0);
        hitAreas(p.root, /^button_cap$/, [20, 14, 20]); // a finger-sized target over the small cap
      }
      g.add(p.root);
    }
    g.updateMatrixWorld(true);
    for (const p of placed) p.lift = rows || p.at || p.id === 'ultrasonic' ? 9 : 9 + 12 * placed.filter((q) => q !== p && q.side === p.side && !q.at && q.z > p.z).length; // a module with others in front of it: its cable arcs higher, over theirs
    for (const p of placed) { p.home = p.root.position.clone(); p.wires = cable(p); }
    // cables that pass through each other (a sensor lead crossing the battery or a motor lead): lift the sensor's cable over and redraw it
    const pts = (p) => Object.values(p.wires).flatMap((w) => w.curve.getSpacedPoints(60));
    const touch = (p, q) => { const A = pts(p), B = pts(q); return A.some((a) => B.some((b) => a.distanceTo(b) < 2.6 * MM)); };
    // (if lifting it twice doesn't help, the clash is where it drops into its port: put it back and lift the other cable over instead)
    const redraw = (p) => { [...(p.tubes || []), ...(p.plugs || [])].forEach((o) => o.parent?.remove(o)); p.tubes = []; p.plugs = []; p.wires = cable(p); };
    const tries = new Map(), lift0 = new Map(placed.map((p) => [p, p.lift])), gave = new Set();
    for (let pass = 0; pass < 6; pass++) {
      const raise = new Set(), back = new Set();
      placed.forEach((p, i) => placed.slice(i + 1).forEach((q) => {
        if (!touch(p, q)) return;
        let a = p.id === 'battery' || (q.id !== 'battery' && q.lift < p.lift) ? q : p;
        if (gave.has(a) || (tries.get(a) || 0) >= 2) { if (!gave.has(a)) back.add(a); a = a === p ? q : p; }
        raise.add(a);
      }));
      if (!raise.size) break;
      for (const p of back) { p.lift = lift0.get(p); gave.add(p); redraw(p); } // gave up on this one
      for (const p of raise) if (!back.has(p)) { p.lift += 10; tries.set(p, (tries.get(p) || 0) + 1); redraw(p); }
    }
    setContent(g, chassis ? 1.05 : 0.92);
    wires = placed.flatMap((p) => Object.values(p.wires));
    return { base, esp, tb, chassis, group: g, modules: placed };
  }

  function cable(p) {
    const names = CABLE_PINS[p.id]?.map((n) => `anchor_${p.id}_${n}`);
    const ends = [];
    p.root.traverse((o) => { if (names ? names.includes(o.name) : o.name.match(new RegExp(`^anchor_${p.id}_pin\\d$`))) ends.push(o); });
    const servo = p.id === 'servo';
    const pinNo = (o) => +o.name.match(/(\d)$/)?.[1];
    if (servo) ends.sort((u, v) => SERVO_LEAD[u.name.replace('anchor_servo_', '')][0] - SERVO_LEAD[v.name.replace('anchor_servo_', '')][0]); // GND, VCC, signal
    if (p.byNumber && names) ends.sort((u, v) => names.indexOf(u.name) - names.indexOf(v.name));     // battery +/−, motor 1/2: in list order
    else if (p.byNumber) ends.sort((u, v) => pinNo(u) - pinNo(v));                                  // module pin N → port pin N
    const a = servo || p.byNumber ? ends.map(wp) : ends.map(wp).sort((u, v) => u.z - v.z);
    const b = p.portPins.map((o) => ({ o, v: wp(o) })).sort(servo || p.byNumber ? (u, v) => pinNo(u.o) - pinNo(v.o) : (u, v) => u.v.z - v.v.z);
    const out = {};
    const up = new THREE.Vector3(0, 1, 0);
    const dirA = p.dirA || new THREE.Vector3(-p.side, 0, 0); // module plugs face the board; base ports are top-entry, so cables drop in from above
    const top = TOP_ENTRY.has(p.id);
    const plugged = !CABLE_PINS[p.id] && !top; // module has a right-angle XH shell: the cable plug sits in it, wires leave the plug's back face
    const sideB = SIDE_PORT[p.port], dirB = sideB && p.portPins[0] ? new THREE.Vector3(sideB, 0, 0).transformDirection(p.portPins[0].parent.matrixWorld).setY(0).normalize() : null;
    a.slice(0, b.length).forEach((tip, i) => {
      const pb = dirB ? b[i].v.clone().addScaledVector(dirB, 3.7 * MM) : b[i].v, pa = plugged ? tip.clone().addScaledVector(dirA, 3.7 * MM) : tip;
      const mid = pa.clone().lerp(pb, 0.5).add(up.clone().multiplyScalar((p.lift || 9) * MM));
      const into = dirB ? [pb.clone().addScaledVector(dirB, 12 * MM).addScaledVector(up, 3 * MM), pb.clone().addScaledVector(dirB, 4 * MM).addScaledVector(up, 0.5 * MM), pb] // slides into the side-entry shell
        : [pb.clone().addScaledVector(up, (14 + (p.lift || 9) - 9) * MM), pb.clone().addScaledVector(up, 5 * MM), pb]; // a lifted cable comes down onto its port from higher too                                                            // drops into a top-entry port
      const curve = new THREE.CatmullRomCurve3([pa, top ? pa.clone().addScaledVector(up, 10 * MM) : pa.clone().addScaledVector(dirA, 8 * MM).addScaledVector(up, 1.5 * MM), mid, ...into], false, 'centripetal');
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.55 * MM, 6), new THREE.MeshStandardMaterial({ color: servo ? SERVO_LEAD[ends[i].name.replace('anchor_servo_', '')][1] : WIRE[i % WIRE.length], roughness: 0.45 }));
      tube.castShadow = true;
      p.root.parent.add(tube);
      (p.tubes ||= []).push(tube); // the lesson assembly grows these with drawRange
      out[b[i].o.name.replace(/^.*_pin/, 'pin')] = { curve, dots: null, on: false, dir: 1 };
    });
    // JST-XH plug pushed 5 mm into a right-angle shell over the pins (dir points out of the shell), latch ramp on top locks it
    function seated(ap, dir, end) {
      const c = avg(ap), along = ap.length > 1 ? ap.at(-1).clone().sub(ap[0]).setY(0).normalize() : new THREE.Vector3(0, 0, 1);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), along);
      const block = (w, h, d, at) => {
        const m = new THREE.Mesh(unitBox, PLUG);
        m.scale.set(w * MM, h * MM, d * MM); m.quaternion.copy(q); m.position.copy(at);
        m.castShadow = true; m.raycast = () => {};
        p.root.parent.add(m);
        m.userData.end = end; (p.plugs ||= []).push(m);
      };
      const w = (ap.length - 1) * 2.54 + 3.1;
      block(w, 4.3, 9.5, c.clone().addScaledVector(dir, -1.05 * MM).addScaledVector(up, 0.75 * MM));          // body: inside the shell, 4.5 mm out
      block(2.6, 0.9, 2.4, c.clone().addScaledVector(dir, 2.2 * MM).addScaledVector(up, 3.3 * MM));            // latch ramp, just outside the shell
      block(w + 0.6, 4.8, 1.2, c.clone().addScaledVector(dir, 3.1 * MM).addScaledVector(up, 0.75 * MM));       // grip collar at the back
    }
    // plug housings: one seated in the base port (vertical), one in the module connector (horizontal)
    const housing = (pts, centre, size, lift, end = 'port', mat = PLUG) => {
      if (!pts.length) return;
      const along = pts.length > 1 ? pts.at(-1).clone().sub(pts[0]).setY(0).normalize() : new THREE.Vector3(0, 0, 1);
      const m = new THREE.Mesh(unitBox, mat);
      m.scale.set(((pts.length - 1) * 2.5 + 3.4) * MM, size[0] * MM, size[1] * MM);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), along);
      m.position.copy(centre).add(lift);
      m.castShadow = true; m.raycast = () => {};
      p.root.parent.add(m);
      m.userData.end = end; (p.plugs ||= []).push(m);
    };
    const avg = (pts) => pts.reduce((s, q) => s.add(q), new THREE.Vector3()).divideScalar(pts.length || 1);
    const bp = b.map((q) => q.v);
    if (servo) housing(bp, avg(bp), [14, 2.6], up.clone().multiplyScalar(3.5 * MM), 'port', DUPONT); // the servo's own 3-pin plug, down over the male pins
    else if (dirB) seated(bp, dirB, 'port');                                                          // plug pushed into the base's side-entry shell
    else housing(bp, avg(bp), [7, 4.6], up.clone().multiplyScalar(1.2 * MM));
    if (top) { const ap = a.slice(0, b.length); housing(ap, avg(ap), [7, 4.6], up.clone().multiplyScalar(1.2 * MM), 'mod'); }
    if (plugged) seated(a.slice(0, b.length), dirA, 'mod');
    return out;
  }

  let lastFit = 1;
  function frame(fit = lastFit) {
    lastFit = fit;
    content.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(content);
    const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
    const r = size.length() / 2;
    ground.position.y = box.min.y - 0.0005;
    ground.scale.setScalar(r * 12);
    floor.position.set(centre.x, ground.position.y + 0.0001, centre.z); floor.scale.setScalar(r * 16);
    const cell = 10 ** Math.floor(Math.log10(r / 3)); // 1, 10 or 100 mm cells depending on the model size
    gridMat.uniforms.cell.value = cell * (r / 3 / cell > 4 ? 5 : 1); gridMat.uniforms.fade.value = r * 5; gridMat.uniforms.centre.value.copy(centre);
    sun.position.set(centre.x + r * 2, centre.y + r * 5, centre.z + r * 3);
    sun.target.position.copy(centre);
    const s = sun.shadow.camera;
    s.left = s.bottom = -r * 2; s.right = s.top = r * 2; s.near = r; s.far = r * 12;
    s.updateProjectionMatrix();
    const dist = r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * fit;
    home = { target: centre.clone(), pos: centre.clone().add(new THREE.Vector3(0.35, 0.95, 0.75).normalize().multiplyScalar(dist)) };
    camera.near = dist / 100; camera.far = dist * 20; camera.updateProjectionMatrix();
    controls.minDistance = dist * 0.15; controls.maxDistance = dist * 3;
    view('reset');
  }

  function view(v) {
    if (!home) return;
    const off = camera.position.clone().sub(controls.target);
    if (v === 'reset') { controls.target.copy(home.target); camera.position.copy(home.pos); }
    else if (v === 'top') { camera.position.copy(controls.target).add(new THREE.Vector3(0, off.length(), 0.0001)); }
    else if (v === 'left' || v === 'right') { off.applyAxisAngle(new THREE.Vector3(0, 1, 0), (v === 'left' ? 1 : -1) * Math.PI / 4); camera.position.copy(controls.target).add(off); }
    else if (v === 'in' || v === 'out') { camera.position.copy(controls.target).add(off.multiplyScalar(v === 'in' ? 0.8 : 1.25)); }
    else if (v === 'clear') { showTags = !showTags; tagLayer.hidden = !showTags; svg.style.display = showTags ? '' : 'none'; if (showTags) layoutTags(); } // clean view: no names, no lines
    else if (v === 'labels') { pillPref = !pillPref; pills = pillPref || !!focused; tagLayer.classList.toggle('pills', pills); if (!pills) layoutTags(); } // names on dots, no leader lines
    controls.update();
    if (v === 'reset') requestAnimationFrame(layoutTags);
  }

  function project(obj) {
    const p = wp(obj).project(camera);
    return { x: (p.x + 1) / 2 * el.clientWidth, y: (1 - p.y) / 2 * el.clientHeight, behind: p.z > 1 };
  }

  // callouts: [{anchor, title, body, root?}] — sides assigned from anchor screen position
  function setCallouts(list) {
    tagLayer.replaceChildren();
    callouts = list.map((c) => ({ ...c, obj: c.obj || (c.root || content)?.getObjectByName(c.anchor) })).filter((c) => c.obj).map((c, i) => {
      const tag = document.createElement('div');
      tag.className = `tag${c.below ? ' below' : ''}${c.hot ? ' hot' : ''}`;
      tag.style.setProperty('--c', COLORS[i % COLORS.length]);
      tag.innerHTML = `<i class="ic"><svg viewBox="0 0 24 24">${c.icon ? ICONS[c.icon] : iconFor(c.anchor)}</svg></i><b></b><span></span>`;
      tag.addEventListener('click', () => el.dispatchEvent(new CustomEvent('part', { detail: c.part || c.obj.name.replace(/^anchor_/, '') })));
      tag.querySelector('b').textContent = c.title;
      tag.querySelector('span').textContent = c.body || '';
      tagLayer.append(tag);
      return { ...c, tag, color: COLORS[i % COLORS.length] };
    });
    layoutTags();
  }
  const setCalloutText = (anchor, text) => { const c = callouts.find((x) => x.anchor === anchor); if (c) c.tag.querySelector('span').textContent = text; };

  function layoutTags() {
    if (!content || !callouts.length) return;
    tagLayer.classList.toggle('pills', pills);
    if (pills) return;
    callouts.forEach((c) => { c.tag.style.left = ''; });
    const W = el.clientWidth, H = el.clientHeight;
    const sides = { l: [], r: [] };
    for (const c of callouts) { c.p = project(c.obj); sides[c.p.x < W / 2 ? 'l' : 'r'].push(c); }
    while (sides.l.length - sides.r.length > 1) sides.r.push(sides.l.splice(sides.l.reduce((m, it, i, a) => (it.p.x > a[m].p.x ? i : m), 0), 1)[0]);
    while (sides.r.length - sides.l.length > 1) sides.l.push(sides.r.splice(sides.r.reduce((m, it, i, a) => (it.p.x < a[m].p.x ? i : m), 0), 1)[0]);
    const card = el.querySelector('#schematic');
    for (const [side, items] of Object.entries(sides)) {
      items.sort((a, b) => a.p.y - b.p.y);
      const room = side === 'r' && card && !card.hidden ? card.offsetTop - 8 + 56 : H; // keep right-side labels above the schematic card
      const gap = room / (items.length + 1);
      let stack = 8; // narrow stage: stack tags in the top corners so they don't cover the model
      items.forEach((c, i) => {
        c.tag.dataset.side = side;
        if (W < 600) { c.tag.style.top = `${stack}px`; stack += c.tag.offsetHeight + 6; return; }
        c.tag.style.top = `${Math.max(8, Math.min(room - c.tag.offsetHeight - 56, gap * (i + 1) - c.tag.offsetHeight / 2))}px`;
      });
    }
  }

  function drawLeaders() {
    const rect = el.getBoundingClientRect();
    let html = '';
    const placed = []; // pill labels: pushed down until they clear the ones already placed
    for (const { c, p } of pills ? callouts.map((c) => ({ c, p: project(c.obj) })).sort((a, b) => a.p.y - b.p.y || a.p.x - b.p.x) : []) {
      const w = c.tag.offsetWidth, h = c.tag.offsetHeight, l = Math.max(4, Math.min(el.clientWidth - w - 4, c.below ? p.x - w / 2 : p.x + 12)), t0 = c.below ? p.y + 2 : p.y - 14;
      let t = t0;
      for (let hit = true; hit;) {
        hit = false;
        for (const o of placed) if (l < o.r && o.l < l + w && t < o.b && o.t < t + h) { t = o.b + 1; hit = true; }
      }
      placed.push({ l, r: l + w, t, b: t + h });
      c.tag.style.left = `${l}px`; c.tag.style.top = `${t}px`;
      if (c.below) continue;
      html += `<circle cx="${p.x}" cy="${p.y}" r="5.5" fill="${c.color}" class="ring"/>`;
    }
    for (const c of callouts) {
      if (pills) continue;
      const p = project(c.obj);
      const r = c.tag.getBoundingClientRect();
      const x = (c.tag.dataset.side === 'l' ? r.right : r.left) - rect.left, y = r.top + r.height / 2 - rect.top;
      if (p.behind) continue;
      html += `<path d="M${x} ${y} L${(x + p.x) / 2} ${y} L${p.x} ${p.y}" stroke="${c.color}"/>` +
        `<circle cx="${x}" cy="${y}" r="4" fill="${c.color}"/><circle cx="${p.x}" cy="${p.y}" r="5.5" fill="${c.color}" class="ring"/>`;
    }
    if (focused && !card.hidden) {
      const p = project(focused.obj), r = card.getBoundingClientRect();
      const x = r.left - rect.left + 40, y = r.bottom - rect.top;
      html += `<path d="M${x} ${y} L${x} ${y + 40} L${p.x} ${p.y}" stroke="#f59e0b"/><circle cx="${p.x}" cy="${p.y}" r="6" fill="#fff" stroke="#f59e0b" stroke-width="3"/>`;
    }
    const h = hl && (hl.isObject3D ? hl : content?.getObjectByName(hl));
    if (h) { const p = project(h); html += `<circle cx="${p.x}" cy="${p.y}" r="9" class="pulse"/>`; }
    svg.innerHTML = html;
  }
  const highlight = (name) => { hl = name; };

  // pointer: click → inspector event; press-and-hold on a button cap → 'press' events
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let down = null, pressed = null, dragFn = null, dragging = null; // dragFn(mesh) → (ray) => void, for parts that slide (the obstacle)
  const hitAt = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = content && ray.intersectObject(content, true).find((h) => h.object.isMesh && !(h.object.geometry instanceof THREE.TubeGeometry));
    return hit && hit.object.material.visible === false ? { ...hit, object: hit.object.parent } : hit; // hit box → the real part
  };
  canvas.addEventListener('pointerdown', (e) => {
    down = [e.clientX, e.clientY];
    const hit = hitAt(e);
    if (hit && /^(button_(cap|body|plate)|esp32_btn_(boot|en)(_cap)?|touch_pad)$/.test(hit.object.name)) {
      pressed = { root: hit.object.parent, name: hit.object.name.replace(/_cap$/, '') };
      controls.enabled = false;
      el.dispatchEvent(new CustomEvent('press', { detail: { ...pressed, down: true } }));
    } else if (hit && dragFn && (dragging = dragFn(hit.object))) { controls.enabled = false; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; }
  });
  canvas.addEventListener('pointermove', (e) => { if (dragging) { hitAt(e); dragging(ray.ray); } });
  addEventListener('pointerup', (e) => {
    if (pressed) { el.dispatchEvent(new CustomEvent('press', { detail: { ...pressed, down: false } })); pressed = null; controls.enabled = true; }
    if (dragging) { dragging = null; controls.enabled = true; canvas.style.cursor = ''; }
    if (!down || e.target !== canvas || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) { down = null; return; }
    down = null;
    const hit = hitAt(e);
    if (!hit) { tip.hidden = true; return; }
    const r = canvas.getBoundingClientRect();
    el.dispatchEvent(new CustomEvent('part', { detail: hit.object.name, bubbles: false }));
    tip.style.left = `${e.clientX - r.left + 12}px`;
    tip.style.top = `${e.clientY - r.top + 12}px`;
  });
  function showTip(html) { tip.innerHTML = html; tip.hidden = !html; }

  let hoverLabel = () => null, hoverEvt = null;
  canvas.addEventListener('pointermove', (e) => { hoverEvt = e; });
  canvas.addEventListener('pointerleave', () => { hoverEvt = null; setHover(null); });
  // hover lift: the part under the pointer eases up off its board, then settles back (additive, so other moves still work)
  let hoverLift = true;
  const lifts = new Map(); // part -> { v: full lift in parent space, cur, target }
  function liftPart(o) { // the hovered piece plus its siblings of the same component (base_d34 + base_d34_pin_1..3)
    if (!hoverLift || !o?.parent) return [];
    if (o.material?.visible === false) o = o.parent; // a finger-sized hit box: lift the pin it belongs to
    if (o.parent.userData.oled || /^oled_/.test(o.name)) return []; // the OLED's live picture is a separate layer: lifting its glass would cover the text
    const root = o.name.replace(/_pin_\d+$/, ''), parts = o.parent.children.filter((c) => c.name === root || c.name.startsWith(`${root}_`));
    if (!parts.includes(o)) parts.push(o);
    if (parts.some((c) => state.get(c)?.y !== undefined)) return []; // press() owns these parts' height (buttons, switch caps)
    const box = new THREE.Box3(); parts.forEach((c) => box.expandByObject(c));
    const size = box.getSize(new THREE.Vector3());
    return Math.max(size.x, size.z) > 40 * MM ? [] : parts; // boards and plates stay put
  }
  function lift(parts, up) {
    for (const o of parts) {
      let l = lifts.get(o);
      if (!l) {
        const w = o.getWorldPosition(new THREE.Vector3()), a = o.parent.worldToLocal(w.clone()), b = o.parent.worldToLocal(w.add(new THREE.Vector3(0, 2.5 * MM, 0)));
        l = { v: b.sub(a), cur: 0, target: 0 }; lifts.set(o, l);
      }
      l.target = up ? 1 : 0;
    }
  }
  let liftT = performance.now();
  function liftTick() {
    const now = performance.now(), k = 1 - Math.exp(-(now - liftT) / 70); liftT = now; // time-based: same speed at any frame rate (~0.25 s)
    lifts.forEach((l, o) => {
      const next = Math.abs(l.target - l.cur) < 0.01 ? l.target : l.cur + (l.target - l.cur) * k;
      o.position.addScaledVector(l.v, next - l.cur); l.cur = next;
      if (!l.target && !l.cur) lifts.delete(o);
    });
  }
  function setHover(o, e) {
    if (hovered !== o) {
      lift(liftPart(hovered), false); lift(liftPart(o), true);
      if (hovered) { hovered.material.emissive.copy(hovered.userData.em); hovered.material.emissiveIntensity = hovered.userData.ei; }
      hovered = o;
      if (o) {
        if (!o.userData.ownMat) { o.material = o.material.clone(); o.userData.ownMat = true; }
        o.userData.em = o.material.emissive.clone(); o.userData.ei = o.material.emissiveIntensity;
        if (o.userData.ei < 0.5) { o.material.emissive.set(0xf59e0b); o.material.emissiveIntensity = 0.35; }
      }
      canvas.style.cursor = o ? 'pointer' : '';
    }
    if (o && e) {
      const r = canvas.getBoundingClientRect();
      tip.innerHTML = hoverLabel(o.name); tip.hidden = false;
      tip.style.left = `${e.clientX - r.left + 14}px`; tip.style.top = `${e.clientY - r.top + 14}px`;
    } else if (!o) tip.hidden = true;
  }
  function hoverTick() {
    if (!hoverEvt || down || dragging) return;
    const hit = hitAt(hoverEvt), o = hit?.object;
    setHover(o && hoverLabel(o.name) ? o : null, hoverEvt);
    hoverEvt = null;
  }

  // focus: info card + flat orange ring around the part + camera fly-in; other callouts become pills
  const rings = [0xf59e0b, 0xfcd34d].map((c, i) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(i ? 0.8 : 0.9, i ? 0.85 : 1, 72), new THREE.MeshBasicMaterial({ color: c, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 2; scene.add(m);
    return m;
  });
  function fly(target, pos, ms = 700) {
    const t0 = performance.now(), a = [controls.target.clone(), camera.position.clone()];
    fx.set('fly', () => {
      const k = Math.min(1, (performance.now() - t0) / ms), e = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2;
      controls.target.lerpVectors(a[0], target, e); camera.position.lerpVectors(a[1], pos, e);
      if (k === 1) fx.delete('fly');
    });
  }
  function focus(target, info) {
    const objs = target ? [].concat(target) : [], obj = objs[0];
    focused = obj ? { obj: info?.anchor || obj } : null;
    pills = pillPref || !!obj;
    card.hidden = !obj;
    rings.forEach((m) => { m.visible = !!obj; });
    tagLayer.classList.toggle('pills', pills);
    if (!obj) { fx.delete('ring'); if (home && content) fly(home.target, home.pos); requestAnimationFrame(layoutTags); return; }
    card.querySelector('h3').textContent = info.title;
    card.querySelector('.fbody').innerHTML = info.html;
    const box = new THREE.Box3();
    objs.forEach((o) => box.expandByObject(o));
    const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const rx = size.x / 2 * 1.35 + 3 * MM, rz = size.z / 2 * 1.35 + 3 * MM, t0 = performance.now();
    rings.forEach((m) => m.position.set(c.x, box.max.y - Math.min(size.y, 1.2 * MM), c.z)); // around the part, at board level
    fx.set('ring', () => {
      const k = Math.min(1, (performance.now() - t0) / 400), s = (0.7 + 0.3 * k) * (1 + Math.sin(performance.now() / 300) * 0.02);
      box.makeEmpty(); objs.forEach((o) => box.expandByObject(o)); // follow a part that moves (the obstacle)
      box.getCenter(c); rings.forEach((m) => m.position.set(c.x, m.position.y, c.z));
      rings.forEach((m, i) => { m.scale.set(rx * s, rz * s, 1); m.material.opacity = 0.9 * k * (i ? 0.7 : 1); });
    });
    const dir = camera.position.clone().sub(controls.target).normalize();
    const dist = Math.max(size.length() / 2 / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 2.2, controls.minDistance * 1.2);
    fly(c, c.clone().addScaledVector(dir, dist));
  }
  card.querySelector('.x').addEventListener('click', () => el.dispatchEvent(new CustomEvent('unfocus')));

  // printed artwork (silkscreen, module marking) as canvas textures on thin planes; at/size in model mm (Blender axes)
  function decals(node, list) {
    if (!node || node.userData.decals === list) return; // a different list replaces the old artwork (LED module colour)
    (node.userData.decalMeshes || []).forEach((m) => { node.remove(m); m.material.map.dispose(); m.material.dispose(); m.geometry.dispose(); });
    node.userData.decals = list; node.userData.decalMeshes = [];
    const A = (n) => { const o = node.getObjectByName(n); return o ? [o.position.x, -o.position.z] : null; }; // anchor → Blender x, y (mm)
    for (const d of list) {
      const at = typeof d.at === 'function' ? d.at(A) : d.at;
      const c = document.createElement('canvas');
      c.width = Math.round(d.size[0] * d.px); c.height = Math.round(d.size[1] * d.px);
      d.draw(c.getContext('2d'), c.width, c.height, A);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const m = new THREE.Mesh(new THREE.PlaneGeometry(d.size[0], d.size[1]),
        new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.position.set(at[0], at[2], -at[1]);
      if (d.face !== 'front') m.rotation.x = -Math.PI / 2; // 'front': standing on the -Y face (Blender), e.g. the servo sticker
      m.raycast = () => {};
      node.add(m); node.userData.decalMeshes.push(m);
    }
  }

  // surroundings of a sensor, level 0..100: 'soil' = soil bed over the prongs (darker when wetter), 'drops' = rain drops on the plate,
  // 'light' = a lamp beam onto the LDR. r = rect [x0, y0, x1, y1] in model mm (Blender axes), or [x, y, z] of the LDR face for 'light'.
  function wet(node, kind, level, r) {
    if (!node) return;
    let g = node.userData.wet;
    const fresh = !g;
    if (!g) {
      g = node.userData.wet = new THREE.Group();
      const [x0, y0, x1, y1] = r;
      if (kind === 'obstacle') {           // a card standing in front of the sensor (-X); r = [x, y] of the LED tips, level = distance in cm
        const card = new THREE.Mesh(new THREE.BoxGeometry(1.5, 28, 34), new THREE.MeshStandardMaterial({ roughness: 0.8 }));
        card.position.set(r[0], 14, -r[1]);
        card.add(new THREE.LineSegments(new THREE.EdgesGeometry(card.geometry), new THREE.LineBasicMaterial({ color: 0x3a3a3a })));
        g.add(card);
      } else if (kind === 'light') {
        const [x, y, z] = r, H = 30;
        const beam = new THREE.Mesh(new THREE.ConeGeometry(9, H, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        beam.position.set(x, z + H / 2, -y);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff6d0, transparent: true }));
        bulb.position.set(x, z + H, -y);
        g.add(beam, bulb);
      } else if (kind === 'soil') {
        const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 5, y1 - y0), new THREE.MeshStandardMaterial({ roughness: 1, transparent: true, opacity: 0.92 }));
        m.position.set((x0 + x1) / 2, 2.5, -(y0 + y1) / 2);
        g.add(m);
      } else {
        const geo = new THREE.SphereGeometry(1, 12, 8), mat = new THREE.MeshPhysicalMaterial({ color: 0xd6ecff, roughness: 0.05, transparent: true, opacity: 0.55, clearcoat: 1 });
        for (let i = 0; i < 40; i++) {
          const d = new THREE.Mesh(geo, mat), k = 0.5 + Math.random() * 0.9;
          d.scale.set(k, k * 0.45, k);
          d.position.set(x0 + Math.random() * (x1 - x0), 1.6 + k * 0.2, -(y0 + Math.random() * (y1 - y0)));
          g.add(d);
        }
      }
      g.children.forEach((c) => { c.raycast = () => {}; });
      node.add(g);
    }
    if (kind === 'obstacle') {
      g.children[0].position.x = r[0] - (r[4] ?? 1) - level * (r[3] ?? 2); // ponytail: drawn r[3] mm per cm (not to scale) so board and card fit one view
      g.children[0].material.color.set(r[2] === false ? 0x1c1c1e : 0xf4f1ea);
      if (fresh) frame(); // camera takes in the card at its starting height
    } else if (kind === 'light') { g.children[0].material.opacity = 0.32 * level / 100; g.children[1].material.opacity = 0.15 + 0.85 * level / 100; g.visible = level > 0; }
    else if (kind === 'soil') g.children[0].material.color.set(0x8a6a45).lerp(new THREE.Color(0x1a1009), level / 100);
    else g.children.forEach((d, i) => { d.visible = i < Math.round(level * 0.4); });
  }

  // 0.96" OLED: a live 128 x 64 SSD1306 picture on the active area (anchor_oled_screen). The module is turned so its header is on
  // the right: text runs along -Y (Blender) with its top toward +X. text '' = blank (off).
  function oled(root, text, invert = false) {
    const a = find(root, 'anchor_oled_screen'), node = a?.parent;
    if (!node) return;
    let s = node.userData.oled;
    if (!s) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 64;
      const tex = new THREE.CanvasTexture(c);
      tex.magFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(21.7, 10.9), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.position.set(a.position.x, a.position.y + 0.01, a.position.z);
      m.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
      m.raycast = () => {};
      node.add(m);
      s = node.userData.oled = { c, tex };
    }
    const g = s.c.getContext('2d'), on = text !== '';
    g.fillStyle = on && invert ? '#cfefff' : '#000'; g.fillRect(0, 0, 128, 64);
    g.fillStyle = invert ? '#000' : '#cfefff'; g.font = '8px monospace'; g.textBaseline = 'top';
    const lines = [];                                  // 6 x 8 font: 21 characters, 8 lines
    String(text).split('\n').forEach((l) => { do { lines.push(l.slice(0, 21)); l = l.slice(21); } while (l); });
    lines.slice(0, 8).forEach((l, i) => g.fillText(l, 1, i * 8));
    s.tex.needsUpdate = true;
    let view = el.querySelector('.oled-view'); // the real screen is tiny in 3D: show the same picture, big enough to read
    if (!view) { view = document.createElement('figure'); view.className = 'oled-view'; view.innerHTML = '<figcaption>OLED screen</figcaption><canvas width="128" height="64"></canvas>'; el.append(view); }
    view.querySelector('canvas').getContext('2d').drawImage(s.c, 0, 0);
    view.hidden = false;
  }

  // slide/lift a part by an offset in its own axes (local mm), animated; used for switch knobs, jumper, buttons
  function move(root, name, offset, visible = true) {
    const o = find(root, name);
    if (!o) return;
    if (!state.has(o)) state.set(o, {});
    const s = state.get(o);
    s.home ||= o.position.clone();
    const to = s.home.clone().add(new THREE.Vector3(...offset).applyQuaternion(o.quaternion)), from = o.position.clone(), t0 = performance.now();
    if (visible) o.visible = true;
    fx.set(`move:${o.uuid}`, () => {
      const k = Math.min(1, (performance.now() - t0) / 220);
      o.position.lerpVectors(from, to, 1 - (1 - k) ** 3);
      if (k === 1) { fx.delete(`move:${o.uuid}`); o.visible = visible; }
    });
  }

  // invisible, finger-sized hit boxes around small parts (header pins) so they are easy to hover and click
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  function hitAreas(node, re, size = [2.4, 5, 2.4]) {
    if (!node || node.userData.hits) return;
    node.userData.hits = true;
    const geo = new THREE.BoxGeometry(...size);
    const targets = [];
    node.traverse((o) => { if (o.isMesh && re.test(o.name)) targets.push(o); }); // collect first: the boxes share the name
    for (const o of targets) {
      const h = new THREE.Mesh(geo, hitMat);
      h.name = o.name; h.position.y = size[1] / 2 - 0.5; // local mm, from just under the PCB top
      o.add(h);
    }
  }

  // USB cable that slides into the micro-USB port (along the board's USB direction)
  function usbCable(node, plugged) {
    if (!node) return;
    let cab = node.userData.cable;
    if (!cab) {
      const a = node.getObjectByName('anchor_esp32_usb');
      cab = new THREE.Group();
      const grey = new THREE.MeshStandardMaterial({ color: 0x2a2c31, roughness: 0.6 }), steel = new THREE.MeshStandardMaterial({ color: 0xb8bcc4, metalness: 1, roughness: 0.3 });
      const tip = new THREE.Mesh(new THREE.BoxGeometry(6.6, 1.9, 5), steel); tip.position.set(0, 0, 2.2);
      const body = new THREE.Mesh(new THREE.BoxGeometry(10.5, 6, 14), grey); body.position.set(0, 0, -7);
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, -14), new THREE.Vector3(0, 0, -26), new THREE.Vector3(0, -6, -42), new THREE.Vector3(8, -a.position.y + 1.5, -60), new THREE.Vector3(20, -a.position.y + 1.5, -90)]);
      const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 1.6, 8), grey);
      cab.add(tip, body, wire);
      cab.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.raycast = () => {}; } });
      ink(cab);
      cab.position.set(a.position.x, a.position.y, a.position.z);
      cab.userData.base = a.position.z;
      node.add(cab);
      node.userData.cable = cab;
    }
    const from = cab.position.z, to = cab.userData.base - (plugged ? 0 : 16), t0 = performance.now();
    cab.visible = true;
    fx.set(`usb:${node.uuid}`, () => {
      const k = Math.min(1, (performance.now() - t0) / 450);
      cab.position.z = from + (to - from) * (1 - (1 - k) ** 3);
      if (k === 1) { fx.delete(`usb:${node.uuid}`); cab.visible = plugged; }
    });
  }

  // --- effects (all take the instance root so kits with two LED modules work) ----------------
  const find = (root, name) => (root || content)?.getObjectByName(name);
  function glow(root, name, on, color, anchor, size = 14) {
    on = !!on; // callers pass pin levels (0/1): three.js only hides a sprite when visible === false, so 0 would still draw the halo
    const o = find(root, name);
    if (!o?.material) return;
    let s = state.get(o);
    if (!s?.halo) { // state may already hold press()/move() data for this part
      o.material = o.material.clone();
      s = Object.assign(s || {}, { halo: halo(color ?? o.material.color) });
      s.halo.scale.setScalar(size * MM);
      s.halo.userData.fx = true;
      scene.add(s.halo);
      state.set(o, s);
    }
    if (o.material.userData.led) { // a glassy LED: clearly dark when off, and lights up the board around it when on
      s.base ??= o.material.color.clone();
      s.trans ??= o.material.transmission;
      o.material.color.copy(s.base).multiplyScalar(on ? 1 : 0.42);
      o.material.transmission = on ? Math.min(s.trans, 0.15) : s.trans; // clear glass lets the glow pass through: a lit lens has to look lit, not dark with a halo around it (stays >0: no shader recompile)
      if (!s.light) { s.light = new THREE.PointLight(color ?? s.base, 0, 0.06, 2); s.light.userData.fx = true; scene.add(s.light); } // stays in the scene: toggling lights would recompile shaders
      s.light.color.set(color ?? s.base); s.light.intensity = on ? 0.00012 : 0;
    }
    o.material.emissive.set(on ? (color ?? o.material.color) : 0x000000);
    o.material.emissiveIntensity = on ? (o.material.userData.led ? 1.6 : 2.2) : 0; // glassy LEDs stay saturated instead of washing out
    s.halo.visible = on;
    if (color != null) s.halo.material.color.set(color);
    s.at = find(root, anchor) || o;
    s.halo.position.copy(wp(s.at)); s.light?.position.copy(s.halo.position);
    s.halo.onBeforeRender = () => { s.halo.position.copy(wp(s.at)); s.halo.updateMatrixWorld(); s.light?.position.copy(s.halo.position); }; // follow a part that moves (assembly fly-in)
  }
  function press(root, name, isDown) {
    const o = find(root, name);
    if (!o) return;
    if (!state.has(o)) state.set(o, { y: o.position.y });
    o.position.y = state.get(o).y - (isDown ? 0.9 : 0); // local units are mm
  }
  function vibrate(root, name, on, anchor) {
    const o = find(root, name);
    if (!o) return;
    const key = `vib:${o.uuid}`, s = state.get(o) || {};
    if (!s.rings) {
      const at = wp(find(root, anchor) || o);
      s.rings = [0, 1, 2].map(() => {
        const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 32), new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
        m.rotation.x = -Math.PI / 2; m.position.copy(at); m.userData.fx = true; m.visible = false; scene.add(m);
        return m;
      });
      state.set(o, s);
    }
    s.rings.forEach((m) => { m.visible = on; });
    if (!on) { fx.delete(key); o.scale.set(1, 1, 1); return; }
    fx.set(key, (t) => {
      o.scale.y = 1 + Math.sin(t * 90) * 0.03;
      s.rings.forEach((m, i) => { const k = (t * 1.6 + i / 3) % 1; m.scale.setScalar((4 + k * 14) * MM); m.material.opacity = 0.7 * (1 - k); });
    });
  }
  // spin a shaft about its own axis (TT motor shaft lies along the node's Z); dir -1 | 0 | 1
  function spin(root, name, dir) {
    const o = find(root, name);
    if (!o) return;
    if (!dir) { fx.delete(`spin:${o.uuid}`); return; }
    fx.set(`spin:${o.uuid}`, () => { o.rotation.z += dir * 0.18; });
  }
  // wheel.glb on each chassis axle anchor, inside a pivot named chassis_wheel_<fl|fr|rl|rr> that spins about the axle
  async function mountWheels(chassis, url, motorUrl) { // wheel.glb on the axles, tt_motor.glb on the motor mounts
    if (!url) return;
    const [src, motor] = await Promise.all([getModel(url), motorUrl && getModel(motorUrl)]);
    chassis.updateMatrixWorld(true);
    for (const nm of motor ? ['fl', 'fr', 'rl', 'rr'] : []) {
      const a = chassis.getObjectByName(`anchor_chassis_motor_mount_${nm}`);
      if (!a) continue;
      const m = motor.clone(true);
      m.name = `chassis_motor_${nm}`;
      m.position.copy(chassis.worldToLocal(wp(a)));
      m.rotation.y = nm[0] === 'r' ? Math.PI : 0; // gearbox toward the bumper, can toward the middle
      chassis.add(m);
    }
    for (const nm of ['fl', 'fr', 'rl', 'rr']) {
      const a = chassis.getObjectByName(`anchor_chassis_axle_${nm}`);
      if (!a) continue;
      const pivot = new THREE.Group(), turn = new THREE.Group(), w = src.clone(true);
      pivot.name = `chassis_wheel_${nm}`;
      pivot.position.copy(chassis.worldToLocal(wp(a)));
      turn.rotation.y = nm[1] === 'r' ? Math.PI : 0; // rims face outward on both sides
      w.position.y = -32.5 * MM;                      // wheel.glb origin is on the floor; put its axle on the pivot
      turn.add(w); pivot.add(turn); chassis.add(pivot);
    }
  }

  // differential drive: a = left motor, b = right motor (-1 | 0 | 1 | 'brake'); robot front = +X
  let fence = null; // (x, z, heading) → true where the car can't go
  // the car drives by real elapsed time, in 20 ms steps (so walls still stop it), and a motor change first finishes the old move:
  // the same program draws the same path on a fast or a slow screen
  let carMove = null, leash = 0; // carMove: { group, v, w, last }; leash: the program is awake until then (ms), 0 = no program holding the car
  /** the car's true pose (what the sensors and walls see); the drawn car eases after it. Reset when something else moved the car (put back, a new kit) */
  function poseOf(g) {
    const u = g.userData, sh = u.shown;
    if (!u.pose || !sh || sh.x !== g.position.x || sh.z !== g.position.z || sh.th !== g.rotation.y) { u.pose = { x: g.position.x, z: g.position.z, th: g.rotation.y }; u.shown = { ...u.pose, t: sh?.t }; }
    return u.pose;
  }
  function advanceCar(now) {
    if (!carMove) return;
    const { group, v, w } = carMove, q = poseOf(group);
    const end = leash ? Math.min(now, leash) : now; // a program that stalled (busy page, hidden tab) can't steer: the car waits for it, a real loop never stalls
    let left = Math.min(1, Math.max(0, end - carMove.last) / 1000); carMove.last = now; // ponytail: after a hidden tab, at most 1 s of driving catches up
    while (left > 1e-6) {
      const dt = Math.min(0.02, left); left -= dt;
      const th = q.th + w * dt, x = q.x + Math.cos(th) * v * dt, z = q.z - Math.sin(th) * v * dt;
      const stop = (px, pz) => (fence ? fence(px, pz, th) : Math.hypot(px, pz) >= 0.4); // the arena's walls and blocks, else a 40 cm fence
      const stuck = fence && fence(q.x, q.z, q.th); // already touching something: any move may free it
      if (!stuck && stop(x, z)) { // bumped: scrape along the wall, turn on the spot, or back off and turn (a real bumper scrapes off the wall)
        const gx = q.x, gz = q.z, slide = !stop(x, gz) ? [x, gz] : !stop(gx, z) ? [gx, z] : null;
        if (v && slide) Object.assign(q, { th, x: slide[0], z: slide[1] });
        else if (!stop(gx, gz)) q.th = th;
        else if (w) { // back off, else sideways, until the turn fits: a corner wedged against a block scrapes free
          const c = Math.cos(th), sn = Math.sin(th);
          for (const r of [0.005, 0.012, 0.025]) {
            const m = [[-1, 0], [0, 1], [0, -1], [-1, 1], [-1, -1], [1, 1], [1, -1], [1, 0]].map(([a, b]) => [gx + (a * c - b * sn) * r, gz - (a * sn + b * c) * r]).find(([px, pz]) => !stop(px, pz));
            if (m) { Object.assign(q, { th, x: m[0], z: m[1] }); break; }
          }
        }
        continue;
      }
      Object.assign(q, { th, x, z });
    }
  }
  // The book's steering flips a wheel on and off every 20 ms; drawn as is, the car shudders. The drawing eases after the true pose
  // (90 ms, about a real chassis' sway); the program, the sensors and the walls all use the true pose, so the driving is unchanged.
  function showCar(g, now) {
    const q = poseOf(g), sh = g.userData.shown;
    const k = 1 - Math.exp(-Math.max(0, now - (sh.t ?? now)) / 1000 / 0.09); // a slow frame catches up more, so the drawing never falls far behind
    sh.t = now;
    const dth = Math.atan2(Math.sin(q.th - g.rotation.y), Math.cos(q.th - g.rotation.y));
    const d = new THREE.Vector3((q.x - g.position.x) * k, 0, (q.z - g.position.z) * k);
    g.position.add(d); controls.target.add(d); camera.position.add(d); // camera follows the robot
    g.rotation.y += dth * k;
    Object.assign(sh, { x: g.position.x, z: g.position.z, th: g.rotation.y });
    if (!carMove && Math.abs(dth) < 1e-4 && Math.hypot(q.x - g.position.x, q.z - g.position.z) < 1e-4) fx.delete('carShow'); // settled
  }
  function drive(group, a, b) {
    const now = performance.now();
    advanceCar(now);
    poseOf(group);
    const n = (x) => (typeof x === 'number' ? x : 0), v = (n(a) + n(b)) / 2 * 0.3, w = (n(b) - n(a)) * 1.4; // 30 cm/s; a 0.5 s spin ≈ 80° (the book says tune it to 90°)
    carMove = v || w ? { group, v, w, last: now } : null;
    fx.set('carShow', () => { const t = performance.now(); advanceCar(t); showCar(group, t); });
  }
  function rotate(root, name, deg) {
    const o = find(root, name);
    if (!o) return;
    const target = THREE.MathUtils.degToRad(deg);
    fx.set(`rot:${o.uuid}`, () => { o.rotation.y += (target - o.rotation.y) * 0.12; });
  }
  // signal pulses travelling along a wire (dir 1: board → module, -1: module → board)
  function pulse(wire, on, color = 0xffe08a, dir = 1) {
    if (!wire) return;
    wire.on = on; wire.dir = dir;
    if (!wire.dots) {
      wire.dots = [0, 1, 2].map(() => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.9 * MM, 10, 8), new THREE.MeshBasicMaterial({ color }));
        m.userData.fx = true; scene.add(m); return m;
      });
      fx.set(`wire:${wire.curve.uuid}`, (t) => wire.dots.forEach((m, i) => {
        m.visible = wire.on;
        const k = (t * 0.7 + i / 3) % 1;
        m.position.copy(wire.curve.getPointAt(wire.dir > 0 ? 1 - k : k));
      }));
    }
  }

  (function loop() {
    requestAnimationFrame(loop);
    const t = performance.now() / 1000;
    fx.forEach((f) => f(t));
    hoverTick();
    liftTick();
    controls.update();
    renderer.render(scene, camera);
    if (showTags) drawLeaders();
  })();
  resize();

  return { load, loadKit, view, setCallouts, setCalloutText, highlight, showTip, glow, press, vibrate, rotate, spin, drive, setFence: (f) => { fence = f; }, settleCar: () => advanceCar(performance.now()), carPose: poseOf, leash: (ms) => { advanceCar(performance.now()); leash = ms ? performance.now() + ms : 0; }, /* bring the car's pose up to now, for a sensor read */ pulse, find, mountWheels,
    focus, decals, usbCable, hitAreas, move, layoutTags, wet, oled, refit: (fit) => frame(fit), setHome: (t, p) => { home = { target: new THREE.Vector3(...t), pos: new THREE.Vector3(...p) }; controls.minDistance = Math.min(controls.minDistance, home.pos.distanceTo(home.target) * 0.3); view('reset'); }, // a home view of the caller's choosing (the drive arena: close on the car)
    // raw access for the build guide
    show: (obj, fit = 1.1) => setContent(obj, fit), tick: (k, f) => fx.set(k, f), untick: (k) => fx.delete(k), look: (t, p, ms) => fly(t, p, ms),
    setPills: (on) => { pills = on || pillPref; tagLayer.classList.toggle('pills', pills); if (!pills) layoutTags(); }, camera, controls, setHoverLabel: (f) => { hoverLabel = f; }, setHoverLift: (on) => { hoverLift = on; if (!on) lifts.forEach((l) => { l.target = 0; }); }, scene, setDrag: (f) => { dragFn = f; }, get ray() { return ray.ray; } };
}

// Small offscreen renderer for lesson/component card images (shares the model cache).
let thumbR = null;
/** The Robo Coders board as it ships: ESP32 and TB6612 seated in their sockets (same placement as loadKit). */
export async function assembledBase({ base, esp32, tb6612 }) {
  const [b, e, t] = (await Promise.all([base, esp32, tb6612].map(getModel))).map((m) => m.clone(true));
  const g = new THREE.Group().add(b, e, t);
  g.updateMatrixWorld(true);
  const lift = new THREE.Vector3(0, 2.5 * MM, 0); // male-header spacer sits on the socket
  e.position.copy(wp(b.getObjectByName('anchor_base_esp32_socket'))).add(lift);
  t.position.copy(wp(b.getObjectByName('anchor_base_tb6612_socket'))).add(lift);
  return g;
}

/**
 * The finished robot car for the title screen: the same parts and placements as the build guide (build.js createBuild),
 * front = +x. url(id) → model url. sensor: 'ultrasonic' (obstacle project) or 'ir' (line project: two IR modules under the bumper).
 * Returns { robot, spinners, eyes }: spinners[fl|rl|fr|rr].rotation.z -= angle drives forward; eyes = markers where the sensors look from.
 * ponytail: placement numbers copied from build.js; if the car's build changes there, change it here too.
 */
export async function assembledCar(url, sensor = 'ultrasonic') {
  const ids = ['chassis', 'base', 'esp32', 'tb6612', 'battery', 'wheel', 'tt_motor', sensor];
  const [chassis, base, esp, tb, bat, wheel, motor, sens] = (await Promise.all(ids.map((id) => getModel(url(id))))).map((m) => m.clone(true));
  const gone = []; bat.traverse((o) => { if (/^battery_(lead|plug)/.test(o.name)) gone.push(o); }); gone.forEach((o) => o.removeFromParent());
  const robot = new THREE.Group().add(chassis), at = (o, n) => wp(o.getObjectByName(n));
  robot.updateMatrixWorld(true);
  const top = at(chassis, 'anchor_chassis_mount'), lift = new THREE.Vector3(0, 2.5 * MM, 0);
  base.rotation.y = -Math.PI / 2; base.position.copy(top).add(new THREE.Vector3(0, 10 * MM, 0)); robot.add(base); // 10 mm standoffs
  robot.updateMatrixWorld(true);
  for (const [m, a] of [[esp, 'anchor_base_esp32_socket'], [tb, 'anchor_base_tb6612_socket']]) { m.rotation.y = -Math.PI / 2; m.position.copy(at(base, a)).add(lift); robot.add(m); }
  bat.rotation.y = Math.PI; bat.position.set(-92 * MM, top.y, -24.5 * MM);
  robot.add(bat);
  const eyes = [], mark = (p) => { const e = new THREE.Object3D(); e.position.copy(p); robot.add(e); eyes.push(e); };
  if (sensor === 'ultrasonic') { // HC-SR04 upright at the front edge, transducers forward
    sens.rotation.y = Math.PI; sens.position.set(98 * MM, top.y, 0); robot.add(sens); robot.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(sens); mark(new THREE.Vector3(b.max.x, (b.min.y + b.max.y) / 2, 0));
  } else { // two IR modules flat under the bottom deck, LEDs 12 mm past the front edge, left (D36) then right (D35)
    const deckUnder = new THREE.Box3().setFromObject(chassis.getObjectByName('chassis_plate_bottom')).min.y;
    [-28, 28].forEach((z) => {
      const m = sens.clone(true), c0 = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3());
      m.quaternion.setFromUnitVectors(wp(m.getObjectByName('anchor_ir_ir_led')).sub(c0).setY(0).normalize(), new THREE.Vector3(1, 0, 0));
      robot.add(m); m.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(m), c = b.getCenter(new THREE.Vector3());
      m.position.set(140 * MM - b.max.x, deckUnder - b.max.y, z * MM - c.z); m.updateMatrixWorld(true);
      mark(at(m, 'anchor_ir_ir_led'));
    });
  }
  const spinners = {};
  for (const m of ['fl', 'rl', 'fr', 'rr']) {
    const mo = motor.clone(true);
    mo.position.copy(at(chassis, `anchor_chassis_motor_mount_${m}`)); mo.rotation.y = m[0] === 'r' ? Math.PI : 0; robot.add(mo);
    const holder = new THREE.Group(), spinner = new THREE.Group(), turn = new THREE.Group(), w = wheel.clone(true);
    holder.position.copy(at(chassis, `anchor_chassis_axle_${m}`)); turn.rotation.y = m[1] === 'r' ? Math.PI : 0; w.position.y = -32.5 * MM;
    turn.add(w); spinner.add(turn); holder.add(spinner); robot.add(holder); spinners[m] = spinner;
  }
  robot.traverse((o) => { // same materials as on the stage: clear acrylic plates, glassy LEDs
    if (!o.isMesh) return;
    o.castShadow = true;
    if (/^acrylic/.test(o.material?.name)) o.material = glass(o.material);
    seeThrough(o);
  });
  robot.updateMatrixWorld(true);
  return { robot, spinners, eyes };
}

/**
 * PNG data URL of a model url, or of an Object3D (e.g. assembledBase). Default 232×148 (cards); the launcher backdrop
 * asks for a bigger one. fit > 1 leaves a margin so the whole board shows; 0.95 crops tight for small cards.
 */
export async function thumbnail(url, w = 232, h = 148, fit = 0.95) {
  const src = typeof url === 'string' ? await getModel(url) : url;
  if (!thumbR) {
    thumbR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    thumbR.toneMapping = THREE.NeutralToneMapping;
    thumbR.scene = new THREE.Scene();
    thumbR.scene.environment = new THREE.PMREMGenerator(thumbR).fromScene(new RoomEnvironment(), 0.04).texture;
  }
  thumbR.setSize(w, h, false);
  const scene = thumbR.scene, obj = src.clone(true);
  scene.add(obj);
  const box = new THREE.Box3().setFromObject(obj), c = box.getCenter(new THREE.Vector3());
  const r = box.getSize(new THREE.Vector3()).length() / 2;
  const cam = new THREE.PerspectiveCamera(30, w / h, r / 50, r * 20);
  cam.position.copy(c).add(new THREE.Vector3(0.5, 0.9, 0.7).normalize().multiplyScalar(r / Math.sin(THREE.MathUtils.degToRad(15)) * fit));
  cam.lookAt(c);
  thumbR.render(scene, cam);
  scene.remove(obj);
  return thumbR.domElement.toDataURL('image/png');
}
