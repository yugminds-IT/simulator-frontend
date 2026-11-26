// Build guide: a long work desk with two mats. The PARTS MAT holds every kit item, laid out on a
// grid with its name under it. The ASSEMBLY MAT is where the robot grows. Each step plays in three
// phases: gather (desk view, the step's parts ringed and highlighted) → carry (they lift off, the
// camera glides over, they arc across) → assemble (they settle into place; cables grow to their ports).
// The last step drives the finished robot (D-pad / keys / Auto using the ultrasonic distance).
import * as THREE from 'three';
import { PARTS as KIT_PARTS } from './kit.js';
import { COURSE_OF } from './arena.js';

const MM = 0.001;
const B = (x, y, z = 0) => new THREE.Vector3(x * MM, z * MM, -y * MM); // Blender mm (X right/front, Y back/left, Z up) → three metres
const PM = { w: 1000, d: 640, cx: -330 }; // parts mat (mm), centre x on the desk
const AM = { w: 600, d: 440, cx: 520 };   // assembly mat
const ROBOT_AT = B(AM.cx, 0);
const GATHER = 2.2;                        // seconds spent on the desk before the parts lift off
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const seg = (t, a, b) => clamp01((t - a) / (b - a));

// ---------------------------------------------------------------------------------------------
export const STEPS = [
  { id: 'parts', label: 'Parts', kicker: 'Get ready', title: 'Gather the parts', thumb: 'chassis',
    intro: 'Everything for the Robo Coders 4WD robot and the lessons, laid out on the parts mat. Tick each item off. Hover anything on the mat for its name, or click it for details.',
    bom: [['deck_'], ['motor_', 'bracket_', 'bolt_'], ['wheel_'], ['standoff', 'bstand', 'screw', 'bscrew', 'nut_', 'stnut', 'tray'], ['base'], ['usb'], ['ultrasonic'], ['battery'], ['cable'], ['module']],
    checks: ['2× Acrylic chassis plates, 255 × 148 mm (bottom and top deck are the same part)', '4× TT gear motors (1:48) + 8 motor fixing pieces + 8 M3 × 30 bolts', '4× Wheels, 65 mm', '10× brass standoffs (6 × M3×30 male–female, 4 × M3×10) · 14 M3 nuts · 14 M3 × 6 screws',
      '1× Robo Coders base board with the ESP32 DevKit and TB6612 driver fitted', '1× USB cable', '1× HC-SR04 ultrasonic sensor', '1× 2-cell battery pack with 2-pin plug',
      'JST-XH cables: 5× 2-pin, 4× 3-pin, 3× 4-pin', 'Modules: 3× LED, buzzer, button, touch, IR, mic, LDR, DHT11, traffic light, OLED, gas, servo, soil, rain'] },
  { id: 'motors', label: 'Motors', kicker: 'Build', title: 'Motors & wheels', thumb: 'tt_motor',
    intro: 'Each TT motor is a small DC motor with a 1:48 gearbox. The two left motors and the two right motors always turn together, like the tracks of a tank: the robot steers by driving its two sides at different speeds.',
    need: [[1, 'Bottom deck', 'deck_bottom'], [4, 'TT gear motors', 'motor_fl'], [8, 'T-shaped acrylic motor brackets', 'bracket_fl_out'], [8, 'M3 × 30 bolts', 'bolt_fl_1'], [8, 'M3 nuts', 'nut_fl_1'], [4, 'Wheels, 65 mm', 'wheel_fl']],
    lift: [4.75, 11.4], // pick the deck up for the brackets, put it down again before the wheels (s after GATHER)
    subs: [['deck_bottom', 'motor_'], ['bracket_'], ['bolt_', 'nut_'], ['wheel_']],
    checks: ['Lay the bottom deck on the mat and stand the four motors on it: gearbox at each corner, shaft pointing outwards, motor ends toward the middle.',
      'Pick the deck up. From underneath, push a T-bracket up through the slot inside each motor and another into the notch in the deck edge outside it.',
      'Pass two M3 × 30 bolts through bracket, gearbox and bracket (heads on the wheel side) and tighten an M3 nut on each.',
      'Put the deck down and push a wheel onto each shaft, lining up the two flats.'] },
  { id: 'decks', label: 'Decks', kicker: 'Build', title: 'Stack the decks', thumb: 'chassis',
    intro: 'Both decks are the same laser-cut plate. Six 30 mm brass standoffs hold the top one clear of the motors and give the electronics a flat floor: a nut under each stud, a screw on top.',
    need: [[6, 'Brass standoffs, M3 × 30 (male–female)', 'standoff_1'], [6, 'M3 nuts', 'stnut_1'], [1, 'Top deck', 'deck_top'], [6, 'M3 × 6 screws', 'screw_t_1']],
    subs: [['standoff_'], ['stnut_'], ['deck_top'], ['screw_t_']],
    checks: ['Push a standoff’s stud down through each of the six standoff holes: four at the bumper corners, two at the side tabs.', 'Spin an M3 nut onto each stud under the deck.',
      'Lower the top deck (the same plate) onto the standoffs, holes lined up.', 'Fix it with an M3 × 6 screw into the top of each standoff.'] },
  { id: 'board', label: 'Board', kicker: 'Build', title: 'Mount the base board', thumb: 'base',
    intro: 'The Robo Coders base board comes with the ESP32 DevKit and the TB6612FNG motor driver already plugged into their sockets. It carries every connector, so no breadboard is needed.',
    need: [[4, 'Brass standoffs, M3 × 10', 'bstand_1'], [8, 'M3 × 6 screws', 'bscrew_b_1'], [1, 'Base board with ESP32 + TB6612', 'base']],
    subs: [['bscrew_b_', 'bstand_'], ['base'], ['bscrew_t_']],
    checks: ['Fix four 10 mm standoffs to the top deck with M3 × 6 screws from below.', 'Check the ESP32 (USB toward the front) and the TB6612 are pushed fully into their sockets.', 'Lower the board onto the standoffs and screw it down at its four corner holes.'] },
  { id: 'sensor', label: 'Sensor', kicker: 'Build', title: 'Add the ultrasonic eye', thumb: 'ultrasonic',
    intro: 'The HC-SR04 sends a 40 kHz ping and times the echo, so the robot knows how far away the nearest wall is. It plugs into the ULTRASONIC port: TRIG on D19, ECHO on D18.',
    need: [[1, 'HC-SR04 ultrasonic sensor', 'ultrasonic'], [1, '4-pin JST-XH cable', null]],
    subs: [['ultrasonic'], ['cables']],
    checks: ['Stand the sensor at the front edge, transducers facing forward.', 'Plug its cable into the ULTRASONIC port.'] },
  { id: 'power', label: 'Power', kicker: 'Build', title: 'Battery & power', thumb: 'battery',
    intro: 'The 2-cell battery pack powers everything through the BAT connector. SW1 switches it on and off, and the CA-1235 module under the ESP32 makes the 5 V rail.',
    need: [[1, '2-cell battery pack', 'battery']],
    subs: [['battery'], ['cables']],
    checks: ['Place the battery pack on the rear of the top deck.', 'Plug its 2-pin cable into BAT.', 'Leave SW1 off until the code is uploaded.'] },
  { id: 'wiring', label: 'Wiring', kicker: 'Build', title: 'Wire the motors', thumb: 'base',
    intro: 'Four motor ports, four motors. CN6 and CN19 share channel A (left side); CN7 and CN8 share channel B (right side). Each pair always turns together.',
    need: [[4, '2-pin JST-XH cables', null]],
    checks: ['Front-left motor → CN6, rear-left → CN19.', 'Front-right motor → CN7, rear-right → CN8.', 'If a wheel turns the wrong way later, swap that motor’s two wires.'] },
  { id: 'code', label: 'Code', kicker: 'Program', title: 'Upload the code', thumb: 'esp32',
    intro: 'The drive program reads the four direction pins (D27, D14, D26, D25) and the ultrasonic sensor. Upload it over USB, then switch to the battery.',
    need: [[1, 'USB cable', 'usb']],
    checks: ['Remove the CN jumper (or keep SW1 off) while programming.', 'Connect the USB cable and upload the sketch.', 'Unplug USB, refit the jumper and press SW1 on.'] },
  { id: 'drive', label: 'Drive', kicker: 'Play', title: 'Drive it!', thumb: 'chassis', drive: true,
    intro: 'Hold the arrows (or W A S D) to drive. Left and right turn the two sides in opposite directions. In Auto the robot uses its ultrasonic eye to stay on the assembly mat.',
    checks: ['Drive forward, back and turn on the spot.', 'Try Auto and watch it avoid the mat’s edge.'] },
];

// --- one build per car project: same chassis, its own sensor step, parts list and program; the arena replaces the drive step ---
export const PROJECTS = { ...COURSE_OF, 'l3-chassis': 'chassis' }; // chassis = the book's Chassis assembly chapter: the bare car, no sensor or code
const CAR_STEPS = ['motors', 'decks', 'board', 'power', 'wiring']; // the same in every build: ticked once, done everywhere
const STEP_IDS = STEPS.map((s) => s.id);
const SENSOR_MODEL = { manual: 'button', line: 'ir' };
const SENSOR_STEP = {
  manual: { id: 'sensor-button', base: 'sensor', label: 'Button', kicker: 'Build', title: 'Add the push button', thumb: 'button',
    intro: 'The push button is your remote control: while it is held, D35 reads 1 and the program drives forward; let go and it reads 0 and the robot stops. It sits on the top deck at the back, beside the battery, where your finger can reach it easily.',
    need: [[1, 'Push button module', 'sensor_1'], [1, '3-pin JST-XH cable', null]],
    subs: [['sensor_'], ['cables']],
    checks: ['Place the button module on the free rear corner of the top deck, beside the battery, button facing up.', 'Plug its 3-pin cable into the D35 port.'] },
  line: { id: 'sensor-ir', base: 'sensor', label: 'IR sensors', kicker: 'Build', title: 'Fit the line sensors', thumb: 'ir',
    intro: 'Two IR modules look straight down at the floor, one each side of the black tape. Black soaks up infrared, so a sensor over the tape reads 1; over the light floor it reads 0. They sit flat under the bottom deck with their LEDs poking out past the front bumper, bent down to look at the floor.',
    need: [[2, 'IR sensor modules', 'sensor_1'], [2, '3-pin JST-XH cables', null]],
    subs: [['sensor_'], ['cables']],
    checks: ['Fix the two IR modules flat under the front of the bottom deck, about 5–6 cm apart, LEDs sticking out past the bumper and bent down at the floor.', 'Left sensor → D36, right sensor → D35 (3-pin cables).'] },
};
const CODE_INTRO = {
  pattern: 'The pattern program needs no sensor. It switches the four direction pins (D27, D14 left; D26, D25 right) on a timer: forward, stop, turn, four times round a square. Upload it over USB, then switch to the battery.',
  manual: 'The manual-drive program reads the button on D35 over and over: pressed, all four direction pins say forward; released, they all go LOW. Upload it over USB, then switch to the battery.',
  obstacle: 'The obstacle program pings the ultrasonic sensor (TRIG D19, ECHO D18) every loop and steers right when something is closer than 20 cm. Upload it over USB, then switch to the battery.',
  line: 'The line-follower program reads D36 and D35 every loop: both 0, drive straight; one on the tape, steer that way; both 1, stop. Upload it over USB, then switch to the battery.',
};
const BOM_SENSOR = { manual: ['1× Push button module', ['sensor_']], line: ['2× IR sensor modules', ['sensor_']] };
/** the steps of one project's build (null = the full robot guide, with its own drive step). key = where its ticks are saved */
export function stepsFor(project) {
  if (!project) return STEPS;
  return STEPS.flatMap((s) => {
    let out = s;
    if (s.id === 'drive' || (s.id === 'sensor' && ['pattern', 'chassis'].includes(project)) || (s.id === 'code' && project === 'chassis')) return [];
    if (s.id === 'sensor' && SENSOR_STEP[project]) out = SENSOR_STEP[project];
    if (s.id === 'code') out = { ...s, intro: CODE_INTRO[project] };
    if (s.id === 'parts') {
      const checks = [...s.checks], bom = [...s.bom], b = BOM_SENSOR[project];
      checks[8] = `JST-XH cables: 4× 2-pin for the motors${{ manual: ', 1× 3-pin for the button', line: ', 2× 3-pin for the IR sensors', obstacle: ', 1× 4-pin for the ultrasonic' }[project] || ''}`;
      checks.splice(9, 1); bom.splice(9, 1); // the spare modules stay in the box
      if (b) { checks[6] = b[0]; bom[6] = b[1]; } else if (project !== 'obstacle') { checks.splice(6, 1); bom.splice(6, 1); }
      out = { ...s, checks, bom, intro: `Everything the ${{ pattern: 'pattern mover', manual: 'manual-drive robot', obstacle: 'obstacle-avoiding robot', line: 'line follower', chassis: 'bare car (no sensor yet)' }[project]} needs, and nothing else, laid out on the parts mat. Tick each item off. Hover anything on the mat for its name, or click it for details.` };
    }
    return [{ ...out, key: CAR_STEPS.includes(out.id) ? `car/${out.id}` : `${project}/${out.id}` }];
  });
}

// --- parts mat layout (parts-mat mm, bbox centre) --------------------------------------------
const MOTORS = ['fl', 'rl', 'fr', 'rr'];
const SPEC = {
  deck_bottom: ['Chassis', [['Plate', 'Clear acrylic, 255 × 148 mm (seller listings), 3 mm thick (TODO: listings say 2–5 mm)'], ['Same part as', 'the top deck'],
    ['Shape', 'curved bumpers front and back, a wheel well each side of each axle, a tab mid-side'], ['Motor cut-outs', '8 slots + 8 well-edge notches, 10.6 × 3.4 mm (either motor direction)'],
    ['Holes', '6 standoff · 4 base board · 4 cross cut-outs · 2 × Ø12 · 4 curved slots · wire slot · spares'], ['Holds', '4 TT motors on top, 6 standoff studs']]],
  deck_top: ['Chassis', [['Plate', 'Clear acrylic, 255 × 148 mm, 3 mm thick (TODO confirm)'], ['Same part as', 'the bottom deck'], ['Holds', 'base board (on 10 mm standoffs), battery pack, HC-SR04'],
    ['Base board holes', '4 × Ø3.2 at 81.4 × 92.4 mm']]],
  motor: ['Drive', [['Voltage', '3–6 V'], ['Gearbox', '1:48'], ['Shaft', 'double flat, both sides'], ['Wired to', 'CN6 / CN19 (left) · CN7 / CN8 (right)']]],
  wheel: ['Drive', [['Diameter', '65 mm (assumed)'], ['Width', '26 mm'], ['Fits', 'TT motor shaft']]],
  bracket: ['Chassis', [['Material', 'Clear acrylic, 3 mm'], ['Shape', 'T, 30 × 32 mm: crossbar 30 × 5, stem 10 wide with a round top'], ['Holes', '2 × Ø3.2, 17.5 mm apart (match the TT gearbox)'],
    ['Per motor', '2 brackets · 2 × M3 × 30 bolts + nuts'], ['Fitted', 'pushed up from under the deck: crossbar stays underneath, upright plate beside the gearbox']]],
  standoff: ['Chassis', [['30 mm × 6', 'M3 male–female: stud through the bottom deck + nut, top deck screwed on'], ['10 mm × 4', 'M3 female–female: top deck → base board, a screw at each end'], ['Body', 'hexagonal brass, 5.5 mm across flats']]],
  bolt: ['Hardware', [['Thread', 'M3 (3 mm)'], ['Length', '30 mm'], ['Count', '8 · two per motor'], ['Goes with', 'an M3 hex nut']]],
  nut: ['Hardware', [['Thread', 'M3'], ['Across flats', '5.5 mm'], ['Count', '14 · 8 on the motor bolts, 6 under the standoffs']]],
  screw: ['Hardware', [['Thread', 'M3'], ['Length', '6 mm'], ['Count', '14 · 6 on the top deck, 8 for the base board standoffs']]],
  base: ['Electronics', [['Controller', 'ESP32 DevKit V1 (30-pin), fitted'], ['Motor driver', 'TB6612FNG, fitted'], ['Power', 'BAT + SW1, CA-1235 5 V module'], ['Mounting', '4 × M3 holes on 10 mm standoffs']]],
  ultrasonic: ['Sensors', [['Range', '2–400 cm'], ['Supply', '5 V'], ['Pins', 'TRIG D19 · ECHO D18'], ['Port', 'ULTRASONIC (4-pin)']]],
  battery: ['Power', [['Cells', '2, in series'], ['Plug', '2-pin JST-XH → BAT'], ['Switch', 'SW1 on the base board']]],
  usb: ['Cables', [['Plug', 'micro-USB'], ['Used for', 'upload + serial monitor']]],
  button: ['Sensors', [['Type', 'Momentary push button'], ['Reads', '1 while pressed, 0 released'], ['Port', 'D35 (3-pin)']]],
  ir: ['Sensors', [['Sees', 'black tape vs light floor, by reflected infrared'], ['Reads', '1 over the black tape'], ['Ports', 'left D36 · right D35 (3-pin)']]],
};
const R90X = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2); // lie a vertical part flat
const PART_DEFS = [
  { id: 'deck_bottom', label: 'Bottom deck', step: 1, delay: 0, nodes: ['chassis_plate_bottom'], bench: [-360, 220], spec: 'deck_bottom', info: 'The lower acrylic plate. The four motors hang underneath it.' },
  ...MOTORS.map((m, i) => ({ id: `motor_${m}`, label: 'TT motor', group: '4× TT motor', step: 1, delay: 1.2 + i * 0.25, touch: ['deck_bottom'],
    motor: m, spec: 'motor',
    bench: [-440, [125, 90, 55, 20][i]], approach: [0, 0, 40], info: 'DC motor with a 1:48 gearbox. It stands on the bottom deck, gearbox at the corner, and its shaft turns the wheel.' })),
  ...MOTORS.flatMap((m, i) => ['out', 'in'].map((side, k) => { const sy = m[1] === 'l' ? 1 : -1; return { id: `bracket_${m}_${side}`, label: 'Motor bracket', group: '8× motor bracket', step: 1,
    delay: 3.9 + (i * 2 + k) * 0.12, touch: ['deck_bottom', `motor_${m}`], nodes: [`chassis_bracket_${m}_${side}`], benchQ: R90X, bench: [[-372, -334][k], [128, 92, 56, 20][i]],
    approach: [0, 0, -40], hover: [0, sy * 75, -12], explode: [0, side === 'out' ? sy * 30 : -sy * 15, 0], spec: 'bracket',
    info: 'A T-shaped piece of acrylic, used upside down. It is pushed up from under the deck: the upright plate comes through a slot (inside the motor) or a notch (deck edge) and stands against the gearbox, while the crossbar stays underneath so it can’t pull through. Two M3 × 30 bolts pass through both brackets and the gearbox.' }; })),
  ...MOTORS.map((m, i) => ({ id: `wheel_${m}`, label: 'Wheel', group: '4× wheel, 65 mm', step: 1, delay: 10.6 + i * 0.3, wheel: m, spec: 'wheel', touch: [`motor_${m}`],
    bench: [[-255, 100], [-180, 100], [-255, 28], [-180, 28]][i], approach: [0, m[1] === 'l' ? 45 : -45, 0], info: '65 mm rubber tyre on a 5-spoke rim; pushes onto the TT shaft.' })),
  ...[1, 2, 3, 4, 5, 6].map((n, i) => ({ id: `standoff_${n}`, label: 'Brass standoff, M3 × 30', group: '6× standoff 30', step: 2, delay: i * 0.18, spin: 'y', spec: 'standoff', touch: ['deck_bottom'],
    nodes: [`chassis_standoff_${n}`], benchQ: R90X, tray: true, bench: [42.5 + i * 6.2, 220], approach: [0, 0, 45],
    info: 'Hexagonal brass spacer, male–female: a threaded stud at the bottom and a threaded hole at the top. The stud goes down through the bottom deck and takes a nut; the top deck is screwed onto it. Six of them hold the decks 30 mm apart, clear of the motors.' })),
  { id: 'deck_top', label: 'Top deck', step: 2, delay: 2.6, touch: [1, 2, 3, 4, 5, 6].map((n) => `standoff_${n}`), nodes: ['chassis_plate_top'], bench: [-100, 220], approach: [0, 0, 70], spec: 'deck_top', info: 'The upper acrylic plate. The base board sits on it.' },
  { id: 'base', label: 'Base board + ESP32 + TB6612', step: 3, delay: 1.6, touch: ['bstand_1', 'bstand_2', 'bstand_3', 'bstand_4'], model: 'base', bench: [-40, 65], approach: [0, 0, 70], spec: 'base', info: 'Robo Coders base board with the ESP32 DevKit and the TB6612 motor driver fitted in their sockets.' },
  { id: 'ultrasonic', label: 'HC-SR04 sensor', step: 4, touch: ['deck_top'], model: 'ultrasonic', bench: [245, 65], approach: [40, 0, 30], spec: 'ultrasonic', info: 'Ultrasonic distance sensor: the robot’s eye.' },
  { id: 'battery', label: 'Battery pack', step: 5, touch: ['deck_top'], model: 'battery', bench: [115, 65], approach: [0, 0, 60], spec: 'battery', info: '2-cell battery pack with a 2-pin plug for BAT.' },
  { id: 'usb', label: 'USB cable', step: 7, usb: true, bench: [340, 65], spec: 'usb', info: 'Uploads the sketch and powers the ESP32 while programming.' },
];
// kit modules: [id, tint, label], one row per kind (outputs, digital inputs, servo + analog sensors) across the lower part of the parts mat
const MODULE_ROWS = [
  [['led', 'red', 'LED · red'], ['led', 'yellow', 'LED · yellow'], ['led', 'green', 'LED · green'], ['buzzer'], ['traffic'], ['oled']],
  [['button'], ['touch'], ['ir'], ['mic'], ['ldr'], ['dht11']],
  [['gas'], ['servo'], ['soil'], ['rain']],
];
const MODULE_ROW_Y = [-60, -165, -270]; // mm on the parts mat
const MODULE_SCALE = 2;                 // ponytail: drawn 2x so 30 mm boards read on a 1 m mat; real sizes are in each card
const MODULE_GAP = 50;                  // mm between modules in a row (at mat scale)
const MOD_LABEL = { buzzer: 'Buzzer', button: 'Push button', touch: 'Touch sensor', ir: 'IR sensor', mic: 'Mic sensor', ldr: 'LDR sensor', dht11: 'DHT11',
  traffic: 'Traffic light', oled: 'OLED display', gas: 'Gas sensor', servo: 'Servo', soil: 'Soil moisture', rain: 'Rain sensor' };
const LED_BODY = { red: 0xd42a1a, yellow: 0xe8b818, green: 0x1fae44 };
// cable stock bundles: [pins, count, x on the parts mat, used by step, how many it uses]
const CABLE_STOCK = [[2, 5, 320, 6, 4], [3, 4, 395, null, 0], [4, 3, 460, 4, 1]];
const WIRE_COLORS = { 2: [0xd63a1f, 0x1c1c1c], 3: [0x1c1c1c, 0xd63a1f, 0xe8781c], 4: [0x1c1c1c, 0xd63a1f, 0xe8781c, 0xe9b81c] };

// ---------------------------------------------------------------------------------------------
export async function createBuild({ stage, getModel, url, project = null }) {
  const STEPS = stepsFor(project), hasUs = !project || project === 'obstacle';
  const sx = (n) => STEPS.findIndex((s) => (s.base || s.id) === STEP_IDS[n]); // full-guide step number → this build's (-1: not in it)
  const world = new THREE.Group(), robot = new THREE.Group(), desk = new THREE.Group(), deco = new THREE.Group();
  world.add(makeDesk(), makeMat(PM, 'PARTS MAT', true), makeMat(AM, 'ASSEMBLY MAT', false), desk, deco, robot);
  const wp = (o) => o.getWorldPosition(new THREE.Vector3());
  const A = (root, n) => wp(root.getObjectByName(n));
  const load = async (id) => (await getModel(url(id))).clone(true);
  const [chassis, base, esp, tb, us, bat, wheelSrc, motorSrc] = await Promise.all(['chassis', 'base', 'esp32', 'tb6612', 'ultrasonic', 'battery', 'wheel', 'tt_motor'].map(load));
  { const gone = []; bat.traverse((o) => { if (/^battery_(lead|plug)/.test(o.name)) gone.push(o); }); gone.forEach((o) => o.removeFromParent()); } // the guide draws the cable to BAT itself

  // --- the assembled robot, built at the world origin (robot frame); moved to the assembly mat at the end ---
  robot.add(chassis);
  robot.updateMatrixWorld(true);
  const top = wp(chassis.getObjectByName('anchor_chassis_mount'));
  base.rotation.y = -Math.PI / 2; base.position.copy(top).add(new THREE.Vector3(0, 10 * MM, 0)); robot.add(base); // on 10 mm standoffs
  robot.updateMatrixWorld(true);
  const lift = new THREE.Vector3(0, 2.5 * MM, 0);
  for (const [m, a] of [[esp, 'anchor_base_esp32_socket'], [tb, 'anchor_base_tb6612_socket']]) {
    m.rotation.y = -Math.PI / 2; m.position.copy(wp(base.getObjectByName(a))).add(lift); robot.add(m);
  }
  // HC-SR04 stands at the front edge, transducers forward, pins down (model X→-Z, Y→X, Z→-Y in three axes)
  us.rotation.y = Math.PI; // carrier flat on the deck, its upright HC-SR04 facing the robot's front (+X), transducers just inside the deck edge
  us.position.set(98 * MM, top.y, 0); if (hasUs) robot.add(us);
  bat.rotation.y = Math.PI; bat.position.set(-92 * MM, top.y, -24.5 * MM); robot.add(bat); // plug toward BAT
  robot.updateMatrixWorld(true);
  const motorNodes = {};
  for (const m of MOTORS) { // tt_motor.glb on each motor mount: gearbox toward the bumper, can toward the middle
    const mo = motorSrc.clone(true);
    mo.position.copy(wp(chassis.getObjectByName(`anchor_chassis_motor_mount_${m}`)));
    mo.rotation.y = m[0] === 'r' ? Math.PI : 0;
    robot.add(mo); motorNodes[m] = mo;
  }
  robot.updateMatrixWorld(true);
  const spinners = {}, wheelNodes = {};
  for (const m of MOTORS) { // pivot → spinner (turns about the axle) → turn (rim outward) → wheel model
    const holder = new THREE.Group(), spinner = new THREE.Group(), turn = new THREE.Group(), w = wheelSrc.clone(true);
    holder.position.copy(wp(chassis.getObjectByName(`anchor_chassis_axle_${m}`)));
    turn.rotation.y = m[1] === 'r' ? Math.PI : 0;
    w.position.y = -32.5 * MM;
    turn.add(w); spinner.add(turn); holder.add(spinner); robot.add(holder);
    spinners[m] = spinner; wheelNodes[m] = holder;
  }
  const usb = makeUsb(), usbAt = wp(esp.getObjectByName('anchor_esp32_usb'));
  usb.position.copy(usbAt); robot.add(usb);
  robot.updateMatrixWorld(true);

  // --- hardware: bolts + nuts (motor clamps), screws at every standoff end, 10 mm standoffs under the board ---
  const hw = [];
  const put = (mesh, at, flip) => { mesh.position.copy(at); if (flip) mesh.quaternion.copy(flip); robot.add(mesh); return mesh; };
  const yawPi = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI), rollPi = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
  const deckUnder = new THREE.Box3().setFromObject(chassis.getObjectByName('chassis_plate_bottom')).min.y;
  let nc = 0, sc = 0; // tray compartments fill row by row
  const nutBench = () => { const n = nc++; return [182.5 + (n % 4) * 9, 205 + Math.floor(n / 4) * 9]; };
  const screwBench = () => { const n = sc++; return [231.5 + (n % 4) * 7, 205 + Math.floor(n / 4) * 9]; };
  MOTORS.forEach((m, i) => [1, 2].forEach((k, j) => { // bolt shaft points inward along the axle line; nut on the inner bracket
    const right = m[1] === 'r', n = i * 2 + j, flip = right ? yawPi : null;
    hw.push({ id: `bolt_${m}_${k}`, label: 'M3 × 30 bolt', group: '8× bolt M3×30', step: 1, delay: 5.9 + n * 0.12, touch: [`bracket_${m}_out`, `motor_${m}`, `bracket_${m}_in`], spin: 'z', spec: 'bolt', tray: true,
      obj: put(makeBolt(), A(chassis, `anchor_chassis_bolt_${m}_${k}`), flip), bench: [136.5 + (n % 4) * 9, n < 4 ? 204 : 236], approach: [0, right ? -35 : 35, 0], info: 'Long machine bolt that clamps a motor between its two brackets.' });
    hw.push({ id: `nut_${m}_${k}`, label: 'M3 hex nut', group: '14× nut M3', step: 1, delay: 7.9 + n * 0.1, touch: [`bolt_${m}_${k}`, `bracket_${m}_in`], spin: 'z', spec: 'nut', tray: true, benchQ: R90X,
      obj: put(makeNut(), A(chassis, `anchor_chassis_nut_${m}_${k}`), flip), bench: nutBench(), approach: [0, right ? 20 : -20, 0], info: 'Threads onto an M3 × 30 bolt on the inside of the motor.' });
  }));
  const screwInfo = 'Short screw that fixes the top deck or the base board to the end of a standoff.';
  [1, 2, 3, 4, 5, 6].forEach((n, i) => {
    const c = new THREE.Box3().setFromObject(chassis.getObjectByName(`chassis_standoff_${n}`)).getCenter(new THREE.Vector3());
    hw.push({ id: `stnut_${n}`, label: 'M3 hex nut', group: '14× nut M3', step: 2, delay: 1.4 + i * 0.12, touch: ['deck_bottom', `standoff_${n}`], spin: 'y', spec: 'nut', tray: true, stageUp: 0, info: 'Threads onto the stud of a standoff, under the bottom deck.',
      obj: put(makeNutY(), new THREE.Vector3(c.x, deckUnder - 2.4 * MM, c.z)), bench: nutBench(), approach: [0, 0, -18] });
    hw.push({ id: `screw_t_${n}`, label: 'M3 × 6 screw', group: '14× screw M3×6', step: 2, delay: 3.6 + i * 0.12, touch: ['deck_top', `standoff_${n}`], spin: 'y', spec: 'screw', tray: true, benchQ: R90X, info: screwInfo,
      obj: put(makeScrew(), new THREE.Vector3(c.x, top.y, c.z), rollPi), bench: screwBench(), approach: [0, 0, 20] });
  });
  robot.updateMatrixWorld(true);
  [1, 2, 3, 4].forEach((n, i) => {
    const h = A(base, `base_hole_${n}`), boardTop = base.position.y + 1.6 * MM;
    hw.push({ id: `bstand_${n}`, label: 'Brass standoff, M3 × 10', group: '4× standoff 10', step: 3, delay: 0.6 + i * 0.2, touch: ['deck_top', `bscrew_b_${n}`], spin: 'y', spec: 'standoff', tray: true, benchQ: R90X,
      obj: put(makeStandoff(10), new THREE.Vector3(h.x, top.y, h.z)), bench: [93.5 + i * 7, 220], approach: [0, 0, 30], info: 'Short hexagonal spacer that lifts the base board off the acrylic.' });
    hw.push({ id: `bscrew_b_${n}`, label: 'M3 × 6 screw', group: '14× screw M3×6', step: 3, delay: i * 0.12, touch: ['deck_top'], spin: 'y', spec: 'screw', tray: true, benchQ: R90X, stageUp: 0, info: screwInfo,
      obj: put(makeScrew(), new THREE.Vector3(h.x, top.y - 3 * MM, h.z)), bench: screwBench(), approach: [0, 0, -15] });
    hw.push({ id: `bscrew_t_${n}`, label: 'M3 × 6 screw', group: '14× screw M3×6', step: 3, delay: 2.8 + i * 0.12, touch: ['base', `bstand_${n}`], spin: 'y', spec: 'screw', tray: true, benchQ: R90X, info: screwInfo,
      obj: put(makeScrew(), new THREE.Vector3(h.x, boardTop, h.z), rollPi), bench: screwBench(), approach: [0, 0, 20] });
  });
  robot.updateMatrixWorld(true);

  // --- this project's sensor modules: the button flat on the top deck, or two IR modules hanging under the front bumper ---
  const sensorDefs = [];
  if (SENSOR_MODEL[project]) {
    const id = SENSOR_MODEL[project], line = project === 'line', spots = line ? [-28, 28] : [48], src = await load(id);
    const models = spots.map(() => src.clone(true)); // clone before any of them is turned or moved
    spots.forEach((z, k) => {
      const m = models[k], c0 = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3());
      const toward = line ? wp(m.getObjectByName('anchor_ir_ir_led')) // IR LED end → forward, out past the bumper
        : [1, 2, 3].map((n) => wp(m.getObjectByName(`anchor_${id}_pin${n}`))).reduce((a, b) => a.add(b)).divideScalar(3); // pins → toward the board
      m.quaternion.setFromUnitVectors(toward.sub(c0).setY(0).normalize(), new THREE.Vector3(1, 0, 0));
      robot.add(m); m.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(m), c = b.getCenter(new THREE.Vector3());
      // line: flat under the bottom deck, LEDs 12 mm past the front edge; button: flat on the top deck's free rear corner, beside the battery
      m.position.set(line ? 140 * MM - b.max.x : -95 * MM - c.x, line ? deckUnder - b.max.y : top.y - b.min.y, z * MM - c.z);
      sensorDefs.push({ id: `sensor_${k + 1}`, label: line ? `IR sensor · ${k ? 'right (D35)' : 'left (D36)'}` : 'Push button', group: line ? '2× IR sensor' : undefined, step: 4, delay: k * 0.35,
        touch: [line ? 'deck_bottom' : 'deck_top'], obj: m, benchQ: m.quaternion.clone().invert(), bench: line ? [[228, 65], [268, 65]][k] : [245, 65], approach: line ? [0, 0, -40] : [0, 0, 40],
        spec: id, info: line ? 'Looks down at the floor: reads 1 over the black tape.' : 'Hold it to drive forward; let go to stop.', port: line ? ['d36', 'd35'][k] : 'd35' });
    });
  }

  // --- parts: pivot groups; home = in the robot, bench = on the parts mat (robot-frame coords) ---
  const onPM = (x, y) => B(PM.cx + x, y).sub(ROBOT_AT); // parts-mat mm → robot frame
  const parts = [...PART_DEFS.filter((d) => hasUs || d.id !== 'ultrasonic'), ...sensorDefs, ...hw].map((d) => ({ ...d, step: d.usb && sx(d.step) < 0 ? STEPS.length : sx(d.step) })).filter((d) => d.step >= 0) /* no Code step: the USB cable stays on the desk */.map((d) => {
    let objs, pivotAt;
    if (d.obj) { objs = [d.obj]; pivotAt = d.obj.position.clone(); }
    else if (d.nodes) objs = d.nodes.map((n) => chassis.getObjectByName(n)).filter(Boolean);
    else if (d.model) objs = d.model === 'base' ? [base, esp, tb] : [{ ultrasonic: us, battery: bat }[d.model]];
    else if (d.wheel) { objs = [wheelNodes[d.wheel]]; pivotAt = wheelNodes[d.wheel].position.clone(); }
    else if (d.motor) objs = [motorNodes[d.motor]];
    else objs = [usb];
    pivotAt ||= boxOf(objs).getCenter(new THREE.Vector3());
    const pivot = new THREE.Group();
    pivot.position.copy(pivotAt); robot.add(pivot); robot.updateMatrixWorld(true);
    objs.forEach((o) => pivot.attach(o));
    pivot.traverse((o) => { if (o.isMesh) o.userData.part = d.id; });
    const home = { p: pivot.position.clone(), q: pivot.quaternion.clone() };
    const benchQ = d.benchQ ? d.benchQ.clone().multiply(home.q) : d.wheel ? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), d.wheel[1] === 'l' ? Math.PI / 2 : -Math.PI / 2)
      : d.id === 'battery' ? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2).multiply(home.q) : home.q.clone();
    pivot.quaternion.copy(benchQ); pivot.position.set(0, 0, 0); robot.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(pivot), c = bb.getCenter(new THREE.Vector3());
    const benchP = onPM(...d.bench).sub(new THREE.Vector3(c.x, 0, c.z)).setY(-bb.min.y + (d.tray ? 2.4 : 0.4) * MM); // tray items rest on its floor
    pivot.quaternion.copy(home.q); pivot.position.copy(home.p);
    const approach = d.usb ? B(60, 0, 0) : B(...(d.approach || [0, 0, 60]));
    return { ...d, obj: undefined, pivot, home, bench: { p: benchP, q: benchQ }, approach, hover: d.hover && B(...d.hover), explode: d.explode ? B(...d.explode) : approach, delay: d.delay || 0 };
  });
  const partById = Object.fromEntries(parts.map((p) => [p.id, p]));
  parts.forEach((p) => { p.order = parts.filter((q) => q.step === p.step).indexOf(p); });

  // --- cables on the robot (static tubes in the robot frame, grown with drawRange) ---
  robot.updateMatrixWorld(true);
  const cables = [];
  const cable = (step, delay, pts, colors) => pts.forEach(([a, b], i) => {
    const mid = a.clone().lerp(b, 0.5); mid.y = Math.max(a.y, b.y) + 22 * MM;
    const curve = new THREE.CatmullRomCurve3([a, a.clone().add(new THREE.Vector3(0, 8 * MM, 0)), mid, b.clone().add(new THREE.Vector3(0, 12 * MM, 0)), b], false, 'centripetal');
    const geo = new THREE.TubeGeometry(curve, 64, 0.55 * MM, 6);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.45 }));
    mesh.castShadow = true; mesh.raycast = () => {};
    robot.add(mesh);
    cables.push({ step: sx(step), delay: delay + i * 0.08, mesh, count: geo.index.count });
  });
  const pair = (from, to, off = 1.3) => [[from.clone().add(new THREE.Vector3(0, 0, -off * MM)), to[0]], [from.clone().add(new THREE.Vector3(0, 0, off * MM)), to[1]]];
  sensorDefs.forEach((d, k) => cable(4, 1.3 + k * 0.4, [1, 2, 3].map((n) => [A(d.obj, `anchor_${d.spec}_pin${n}`), A(base, `anchor_base_${d.port}_pin${n}`)]), WIRE_COLORS[3]));
  if (hasUs) cable(4, 1.3, ['pin4', 'pin3', 'pin2', 'pin1'].map((n, i) => [A(us, `anchor_ultrasonic_${n}`), A(base, `anchor_base_ultrasonic_pin${4 - i}`)]), [0xd63a1f, 0xe8781c, 0xe9b81c, 0x1c1c1c]); // carrier XH: VCC, TRIG, ECHO, GND
  cable(5, 1.3, [[A(bat, 'anchor_battery_positive'), A(base, 'anchor_base_bat_pin1')], [A(bat, 'anchor_battery_negative'), A(base, 'anchor_base_bat_pin2')]], [0xd63a1f, 0x1c1c1c]);
  [['fl', 'motor_l1'], ['rl', 'motor_l2'], ['fr', 'motor_r1'], ['rr', 'motor_r2']].forEach(([m, port], i) =>
    cable(6, i * 0.5, pair(A(chassis, `anchor_chassis_motor_${m}`), [A(base, `anchor_base_${port}_pin1`), A(base, `anchor_base_${port}_pin2`)]), [0xd63a1f, 0x1c1c1c]));
  robot.position.copy(ROBOT_AT);

  // --- the rest of the parts mat: module grid, cable stock, parts tray ---
  const extras = [];
  const lay = (obj, x, y) => { // obj on the parts mat, bbox centre at (x, y) mm
    desk.add(obj); obj.position.set(0, 0, 0); obj.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(obj), c = b.getCenter(new THREE.Vector3());
    obj.position.copy(B(PM.cx + x, y)).sub(new THREE.Vector3(c.x, 0, c.z)).setY(-b.min.y + 0.4 * MM);
  };
  const extra = (obj, label, info, kind, use) => { obj.traverse((o) => { if (o.isMesh) o.userData.extra = extras.length; }); extras.push({ obj, label, info, kind, use, home: null }); };
  const rows = project ? [] : await Promise.all(MODULE_ROWS.map((row) => Promise.all(row.map(async ([id, tint, label]) => {
    const m = await load(id);
    if (tint) m.traverse((o) => { if (o.name === 'led_lens') { o.material = o.material.clone(); o.material.color.set(LED_BODY[tint]); } });
    m.scale.multiplyScalar(MODULE_SCALE); m.updateMatrixWorld(true);
    const w = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3()).x / MM;
    return { m, w, id, label: label || MOD_LABEL[id], info: `${KIT_PARTS[id]?.blurb || ''} (Shown 2× on the parts mat.)` };
  }))));
  rows.forEach((row, r) => { // each row centred on the mat, modules packed left to right with a fixed gap
    let x = -(row.reduce((t, it) => t + it.w, 0) + MODULE_GAP * (row.length - 1)) / 2;
    for (const it of row) {
      lay(it.m, x + it.w / 2, MODULE_ROW_Y[r]); x += it.w + MODULE_GAP;
      extra(it.m, it.label, it.info, `module_${it.label.toLowerCase().replace(/\W+/g, '_')}`); Object.assign(extras.at(-1), { cat: 'Modules', features: KIT_PARTS[it.id]?.features, part: it.id }); // own id per module (the BOM matches the 'module' prefix)
    }
  });
  const stock = !project ? CABLE_STOCK // a project's mat: just the cables it plugs in (4 motors, plus its sensor's)
    : [[2, 4, 320, 6, 4], ...(sensorDefs.length ? [[3, sensorDefs.length, 395, 4, sensorDefs.length]] : []), ...(hasUs ? [[4, 1, 460, 4, 1]] : [])];
  for (const [n, count, x, useStep0, used] of stock) {
    const useStep = useStep0 == null ? null : sx(useStep0);
    for (let k = 0; k < count; k++) {
      const c = makeJst(n, 150);
      c.rotation.y = Math.PI / 2; // runs front-to-back on the mat
      lay(c, x + (k - (count - 1) / 2) * 11, 220);
      extra(c, `${n}-pin JST-XH cable`, `15 cm cable with a ${n}-pin plug on each end.`, `cable${n}`, k < used ? useStep : null);
      Object.assign(extras.at(-1), { part: `jst${n}`, cat: 'Cables', specs: [['Connector', `JST-XH style, ${n}-pin, 2.54 mm pitch`], ['Length', '15 cm'], ['In the kit', `${count}`]] });
    }
  }
  const tray = makeTray();
  lay(tray, 150, 220);
  extra(tray, 'Hardware tray', 'Five compartments: 30 mm standoffs, 10 mm standoffs, M3 × 30 bolts, M3 nuts and M3 × 6 screws.', 'tray'); extras.at(-1).part = 'chassis';
  extras.forEach((e) => { e.home = e.obj.position.clone(); });
  extras.filter((e) => e.part === SENSOR_MODEL[project]).forEach((e) => { e.obj.visible = false; e.obj.traverse((o) => { o.raycast = () => {}; }); }); // it is on the robot instead

  // name labels under every item on the parts mat (anchors sit at the item's front edge)
  let anchors = [];
  const labelAt = (objs, inTray) => {
    const b = boxOf(objs), a = new THREE.Object3D();
    a.position.set((b.min.x + b.max.x) / 2, b.max.y, inTray ? boxOf([tray]).max.z + 3 * MM : b.max.z + 5 * MM);
    deco.add(a); anchors.push(a);
    return a;
  };
  const groupsOf = (s) => { // robot parts still on the desk, grouped by label
    const g = new Map();
    parts.filter((p) => p.step >= s && !p.usb).forEach((p) => { const k = p.group || p.label; if (!g.has(k)) g.set(k, []); g.get(k).push(p); });
    if (s <= partById.usb.step) g.set('USB cable', [partById.usb]);
    return g;
  };

  // highlight rings on the mat around the step's parts
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xf2c230, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  let rings = [];
  function makeRings(boxes) {
    rings.forEach((r) => deco.remove(r));
    rings = boxes.map((b) => {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 72), ringMat);
      const c = b.getCenter(new THREE.Vector3()), size = b.getSize(new THREE.Vector3());
      m.rotation.x = -Math.PI / 2; m.position.set(c.x, 1.2 * MM, c.z);
      m.userData.r = [size.x * 0.62 + 14 * MM, size.z * 0.62 + 14 * MM];
      deco.add(m);
      return m;
    });
  }

  // --- state, timeline ---
  const st = { step: 0, t: 0, playing: true, speed: 1, exploded: false, upload: 0, phase: null, onUpdate: null };
  const usbP = partById.usb;
  const settle0 = (p) => GATHER + 1.7 + p.delay;
  const dur = (s) => {
    if (s === 0 || STEPS[s].drive) return 0.01;
    if (s === usbP.step) return GATHER + 8.2;
    return Math.max(GATHER + 2.2, ...parts.filter((p) => p.step === s).map((p) => settle0(p) + 1.1), ...cables.filter((c) => c.step === s).map((c) => GATHER + 1.7 + c.delay + 1.1)) + 0.3;
  };
  const tmp = new THREE.Vector3(), UP = (mm) => new THREE.Vector3(0, mm * MM, 0);

  const liftAt = (s, t) => { // the assembly on the mat is picked up (45 mm) for work from underneath
    const L = STEPS[s].lift;
    return L ? 45 * MM * ease(seg(t, GATHER + L[0], GATHER + L[0] + 0.7)) * (1 - ease(seg(t, GATHER + L[1], GATHER + L[1] + 0.7))) : 0;
  };
  function poseAt(p, t, up = 0) { // full journey of a robot part in its own step
    const hp = p.home.p.clone().add(UP(up / MM));
    const lift = GATHER - 0.35 + Math.min(p.order, 12) * 0.03, b1 = p.bench.p.clone().add(UP(70)), stage1 = p.hover ? hp.clone().add(p.hover) : hp.clone().add(p.approach).add(UP(p.stageUp ?? 45));
    const s0 = settle0(p);
    if (t < lift) { p.pivot.position.copy(p.bench.p); p.pivot.quaternion.copy(p.bench.q); return; }
    if (t < GATHER + 0.35) { p.pivot.position.lerpVectors(p.bench.p, b1, ease(seg(t, lift, lift + 0.45))); p.pivot.quaternion.copy(p.bench.q); return; }
    if (t < GATHER + 1.45) { // arc across the desk to the assembly mat
      const e = ease(seg(t, GATHER + 0.35, GATHER + 1.45));
      p.pivot.position.lerpVectors(b1, stage1, e).add(UP(Math.sin(Math.PI * e) * 110));
      p.pivot.quaternion.slerpQuaternions(p.bench.q, p.home.q, e); return;
    }
    p.pivot.quaternion.copy(p.home.q);
    if (t < s0) { p.pivot.position.copy(stage1).add(UP(Math.sin(t * 3 + p.order) * 2)); return; } // hover, waiting its turn
    const k = seg(t, s0, s0 + 1.0), h1 = hp.clone().add(p.approach);
    if (k < 0.35) p.pivot.position.lerpVectors(stage1, h1, ease(k / 0.35));
    else { // final approach; threaded parts spin in about their own axis
      const e = ease((k - 0.35) / 0.65); p.pivot.position.lerpVectors(h1, hp, e);
      if (p.spin === 'y') p.pivot.rotateY((1 - e) * Math.PI * 8); else if (p.spin === 'z') p.pivot.rotateZ((1 - e) * Math.PI * 8);
    }
  }
  function usbAtT(t) { // desk → plug in → upload → unplug → back to the desk
    const p = usbP, b1 = p.bench.p.clone().add(UP(70)), out = p.home.p.clone().add(p.approach), hi = out.clone().add(UP(45));
    const G = GATHER, path = [[G - 0.35, p.bench.p, b1], [G + 0.35, b1, hi, true], [G + 1.6, hi, out], [G + 2.0, out, p.home.p], [G + 5.2, p.home.p, out], [G + 5.8, out, hi], [G + 6.2, hi, b1, true], [G + 7.4, b1, p.bench.p]];
    const lens = [0.45, 1.1, 0.4, 0.7, 0.7, 0.4, 1.1, 0.45];
    let pos = p.bench.p, q = p.bench.q;
    path.forEach(([t0, a, b, arc], i) => {
      if (t < t0) return;
      const e = ease(seg(t, t0, t0 + lens[i]));
      pos = a.clone().lerp(b, e);
      if (arc) pos.add(UP(Math.sin(Math.PI * e) * 110));
      q = i >= 1 && i <= 5 ? p.home.q : p.bench.q;
      if (i === 1 || i === 6) q = new THREE.Quaternion().slerpQuaternions(i === 1 ? p.bench.q : p.home.q, i === 1 ? p.home.q : p.bench.q, e);
    });
    p.pivot.position.copy(pos); p.pivot.quaternion.copy(q);
  }

  // a part resting on the desk while it lives in the robot's frame (the USB cable): undo the robot's drive offset so it stays put.
  // robot frame = ROBOT_AT + yaw; at home (driving not started) this is the plain bench pose.
  const yawQ = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  function onDesk(pivot, bench) {
    yawQ.setFromAxisAngle(Y, -robot.rotation.y);
    pivot.position.copy(bench.p).add(ROBOT_AT).sub(robot.position).applyQuaternion(yawQ);
    pivot.quaternion.copy(yawQ).multiply(bench.q);
  }

  function apply() {
    const s = st.step, t = st.t, drive = STEPS[s].drive, up = liftAt(s, t);
    for (const p of parts) {
      if (p.usb) { if (s === p.step) usbAtT(t); else onDesk(p.pivot, p.bench); continue; }
      if (p.step < s || (p.step === s && drive)) {
        p.pivot.quaternion.copy(p.home.q); p.pivot.position.copy(p.home.p);
        if (st.exploded && !drive) p.pivot.position.add(tmp.copy(p.explode).multiplyScalar(1.2));
      } else if (p.step > s) { p.pivot.position.copy(p.bench.p); p.pivot.quaternion.copy(p.bench.q); }
      else poseAt(p, t, up);
    }
    for (const e of extras) { // stock cables used by a step: lift off and shrink away toward the robot
      if (e.use == null) continue;
      e.obj.visible = e.use > s || (e.use === s && t < GATHER + 1.4);
      if (e.use === s && e.obj.visible) {
        const k = ease(seg(t, GATHER - 0.3, GATHER + 1.4));
        e.obj.position.copy(e.home).add(UP(70 * Math.min(1, k * 3)));
        e.obj.scale.setScalar(1 - k * 0.95);
      } else { e.obj.position.copy(e.home); e.obj.scale.setScalar(1); }
    }
    for (const c of cables) {
      const k = c.step < s ? 1 : c.step > s ? 0 : clamp01((t - GATHER - 1.7 - c.delay) / 1.0);
      c.mesh.visible = k > 0 && !(st.exploded && c.step < s);
      c.mesh.geometry.setDrawRange(0, Math.floor((c.count / 6) * ease(k)) * 6);
    }
    rings.forEach((r) => { // pop in, pulse, fade as the parts lift off
      const k = ease(seg(t, 0.15, 0.7)) * (1 - seg(t, GATHER - 0.4, GATHER + 0.1)), pulse = 1 + Math.sin(performance.now() / 260) * 0.025;
      r.visible = k > 0.01; r.material.opacity = 0.95 * k;
      r.scale.set(r.userData.r[0] * (0.8 + 0.2 * k) * pulse, r.userData.r[1] * (0.8 + 0.2 * k) * pulse, 1);
    });
    const code = STEPS.findIndex((x) => x.id === 'code');
    st.upload = code < 0 ? 0 : s === code ? seg(t, GATHER + 2.2, GATHER + 5.0) : s > code ? 1 : 0;
    stage.glow(esp, 'esp32_led_power', code >= 0 && (s > code || (s === code && t > GATHER + 5.4)), 0xff3020, 'anchor_esp32_led_power', 6);
    // phase switch: desk view while gathering, then over to the assembly mat
    const phase = s === 0 ? 'desk' : drive ? 'robot' : t < GATHER + 0.25 ? 'desk' : 'robot';
    if (phase !== st.phase) { st.phase = phase; view(phase); }
    paint();
  }

  // --- highlights: the part going in (amber) and every part it touches (teal); BOM hover ghosts the rest; detail page = gold ---
  let isoSel = null, selIds = null;
  const HI = new Map(), TOUCH = new Map(), SEL = new Map();
  const tint = (cache, m, color, k) => {
    if (!cache.has(m)) {
      const c = m.clone();
      c.color = c.color.clone().lerp(new THREE.Color(color), 0.6); // shift the colour itself, then glow a little
      if (c.emissive) { c.emissive = new THREE.Color(color); c.emissiveIntensity = k; }
      if (c.transparent) c.opacity = Math.max(c.opacity, 0.75);
      cache.set(m, c);
    }
    return cache.get(m);
  };
  function setLook(root, mode) {
    if (root.userData.look === mode) return;
    root.userData.look = mode;
    root.traverse((o) => {
      if (o.isLineSegments) { o.visible = mode !== 'ghost'; return; }
      if (!o.isMesh || Array.isArray(o.material) || (o.userData.mat0 ?? o.material).visible === false) return; // skip hit boxes
      const m0 = (o.userData.mat0 ??= o.material);
      o.material = mode === 'ghost' ? GHOST : mode === 'hi' ? tint(HI, m0, 0xff7a00, 0.5) : mode === 'touch' ? tint(TOUCH, m0, 0x10b894, 0.3) : mode === 'sel' ? tint(SEL, m0, 0xd99a00, 0.4) : m0;
    });
  }
  const has = (list, id) => !!list && list.some((x) => id.startsWith(x));
  function paint() {
    const s = st.step, t = st.t, moving = new Set(), touched = new Set();
    if (!STEPS[s].drive && st.t < dur(s) - 0.05) for (const p of parts) {
      if (p.step !== s || p.usb) continue;
      const s0 = settle0(p);
      if (t >= s0 - 0.15 && t <= s0 + 1.35) { moving.add(p.id); (p.touch || []).forEach((id) => touched.add(id)); }
    }
    for (const p of parts) setLook(p.pivot, isoSel ? (has(isoSel, p.id) ? 'normal' : 'ghost') : has(selIds, p.id) ? 'sel' : moving.has(p.id) ? 'hi' : touched.has(p.id) ? 'touch' : 'normal');
    for (const e of extras) setLook(e.obj, isoSel ? (has(isoSel, e.kind) ? 'normal' : 'ghost') : has(selIds, e.kind) ? 'sel' : 'normal');
  }
  // sub-steps: each tick-list line of a step ↔ a stretch of its timeline (contiguous, first starts at 0)
  function subTimes(s) {
    const S = STEPS[s].subs;
    if (!S) return null;
    let t0 = 0;
    return S.map((sel) => {
      const ends = sel.includes('cables') ? cables.filter((c) => c.step === s).map((c) => GATHER + 1.7 + c.delay + 1.0)
        : parts.filter((p) => p.step === s && has(sel, p.id)).map((p) => settle0(p) + 1.0);
      const w = [t0, Math.max(t0 + 0.5, ...ends)]; t0 = w[1];
      return w;
    });
  }

  // --- camera + labels per phase ---
  const DESK_T = B(PM.cx, 0).add(new THREE.Vector3(0, 0, 0.02)), DESK_P = DESK_T.clone().add(new THREE.Vector3(0, 1.3, 0.62));
  function view(phase) {
    const s = st.step;
    anchors.forEach((o) => deco.remove(o)); anchors = [];
    if (phase === 'desk') {
      stage.look(DESK_T, DESK_P, 1100);
      const hot = new Set(parts.filter((p) => p.step === s).map((p) => p.group || p.label));
      if (s === usbP.step) hot.add('USB cable');
      const labels = [...groupsOf(s)].map(([k, list]) => ({ obj: labelAt(list.map((p) => p.pivot), list[0].tray), title: k, part: `build:${list[0].id}`, below: true, hot: hot.has(k) }));
      const seen = new Map();
      extras.filter((e) => e.use == null || e.use >= s).forEach((e) => {
        if (e.kind.startsWith('cable')) { if (!seen.has(e.kind)) seen.set(e.kind, []); seen.get(e.kind).push(e); return; }
        if (e.kind !== 'tray') labels.push({ obj: labelAt([e.obj]), title: e.label, part: `build:x${extras.indexOf(e)}`, below: true });
      });
      seen.forEach((list, kind) => labels.push({ obj: labelAt(list.map((e) => e.obj)), title: `${kind.slice(5)}-pin ×${list.length}`, part: `build:x${extras.indexOf(list[0])}`, below: true, hot: list.some((e) => e.use === s) }));
      stage.setCallouts(labels);
    } else {
      const c = robot.position.clone();
      stage.look(c.clone().add(new THREE.Vector3(0, 0.045, 0)), c.clone().add(new THREE.Vector3(0.34, 0.36, 0.42)), 1300);
      const groups = new Map(); // one label per group, each on a different member so they spread round the robot
      parts.filter((p) => p.step === s && !p.usb && !STEPS[s].drive).forEach((p) => { const k = p.group || p.label; groups.set(k, [...(groups.get(k) || []), p]); });
      stage.setCallouts([...groups].map(([k, list], gi) => { const p = list[(gi * 3) % list.length]; return { obj: p.pivot, title: k, part: `build:${p.id}` }; }));
    }
    stage.setPills(true);
  }

  // --- drive (last step, on the assembly mat) ---
  const drv = { L: 0, R: 0, speed: 0.7, mode: 'manual', chase: false, dist: 0, auto: { phase: 'go', until: 0, turn: 1 } };
  const lim = [(AM.w / 2) * MM, (AM.d / 2) * MM], box = [lim[0] - 0.125, lim[1] - 0.1];
  function distanceAhead() { // ray from the sensor to the assembly mat's edge (the "walls")
    const th = robot.rotation.y, dx = Math.cos(th), dz = -Math.sin(th);
    const o = robot.position.clone().sub(ROBOT_AT).add(new THREE.Vector3(dx, 0, dz).multiplyScalar(0.115));
    const tx = dx > 0 ? (lim[0] - o.x) / dx : dx < 0 ? (-lim[0] - o.x) / dx : Infinity;
    const tz = dz > 0 ? (lim[1] - o.z) / dz : dz < 0 ? (-lim[1] - o.z) / dz : Infinity;
    return Math.max(0, Math.min(tx, tz)) * 100;
  }
  function driveTick(dt, now) {
    drv.dist = distanceAhead();
    if (drv.mode === 'auto') {
      const a = drv.auto;
      if (a.phase === 'go' && drv.dist < 12) { a.phase = 'back'; a.until = now + 550; a.turn = Math.random() < 0.5 ? 1 : -1; }
      if (a.phase === 'back' && now > a.until) { a.phase = 'turn'; a.until = now + 650; }
      if (a.phase === 'turn' && now > a.until) a.phase = 'go';
      [drv.L, drv.R] = a.phase === 'go' ? [1, 1] : a.phase === 'back' ? [-1, -1] : [a.turn, -a.turn];
    }
    const v = ((drv.L + drv.R) / 2) * drv.speed * 0.14, w = ((drv.R - drv.L) / 2) * drv.speed * 2.4;
    robot.rotation.y += w * dt;
    const th = robot.rotation.y, nx = robot.position.x + Math.cos(th) * v * dt, nz = robot.position.z - Math.sin(th) * v * dt;
    if (Math.abs(nx - ROBOT_AT.x) < box[0] && Math.abs(nz - ROBOT_AT.z) < box[1]) { robot.position.x = nx; robot.position.z = nz; }
    const sl = drv.L * drv.speed * 9 * dt, sr = drv.R * drv.speed * 9 * dt;
    spinners.fl.rotation.z -= sl; spinners.rl.rotation.z -= sl; spinners.fr.rotation.z -= sr; spinners.rr.rotation.z -= sr;
    if (drv.chase) {
      const h = new THREE.Vector3(Math.cos(th), 0, -Math.sin(th)), c = robot.position.clone().add(new THREE.Vector3(0, 0.06, 0));
      stage.controls.target.lerp(c.clone().addScaledVector(h, 0.12), 0.15);
      stage.camera.position.lerp(c.clone().addScaledVector(h, -0.42).add(new THREE.Vector3(0, 0.2, 0)), 0.15);
    }
  }

  let last = performance.now();
  function frame() {
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (STEPS[st.step].drive) { driveTick(dt, now); onDesk(usbP.pivot, usbP.bench); } // the unplugged USB cable stays on the desk
    else if (st.playing) {
      const end = dur(st.step);
      st.t = Math.min(end, st.t + dt * st.speed);
      if (st.t >= end) st.playing = false;
      apply();
    }
    st.onUpdate?.(st, drv);
  }

  function setStep(i) {
    st.step = Math.max(0, Math.min(STEPS.length - 1, i));
    st.t = 0; st.playing = true; st.exploded = false; st.phase = null;
    robot.position.copy(ROBOT_AT); robot.rotation.set(0, 0, 0);
    Object.assign(drv, { L: 0, R: 0, mode: 'manual', chase: false });
    const s = st.step;
    rings.forEach((r) => deco.remove(r)); rings = [];
    apply(); // parts at their start poses, so the rings can be fitted around them
    if (s > 0 && !STEPS[s].drive) {
      const groups = new Map(), boxes = [];
      parts.filter((p) => p.step === s).forEach((p) => { const k = p.group || p.label; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p.pivot); });
      groups.forEach((objs) => boxes.push(boxOf(objs)));
      const used = extras.filter((e) => e.use === s);
      if (used.length) boxes.push(boxOf(used.map((e) => e.obj)));
      makeRings(boxes);
    }
    apply();
  }

  // --- Explore your kit: the workbench starts packed in a kit box on the assembly mat; the lid opens and every item flies out
  // to its spot on the parts mat (hardware rides inside its tray). Then the usual parts-mat labels appear.
  const kitIdOf = (p) => (p.usb ? null : p.model || (p.motor ? 'tt_motor' : p.wheel ? 'wheel' : 'chassis')); // decks, brackets, standoffs, screws: the chassis kit
  let kit = null;
  // A kit-box insert: every item (or set of alike items) has its own pocket cut to its size, the pockets packed in rows.
  // slots: [{ w, d, h }] in metres → { g, lid, H, at(i): pocket i's bottom-left-back corner in world }
  function makeKitBox(slots) {
    const wall = 0.008, f = 0.004, rib = 0.002, gapS = 0.004;
    const order = slots.map((s, i) => i).sort((a, b) => slots[b].d - slots[a].d);
    const pack = (maxW) => { // shelf packing, deepest pockets first
      const at = [], shelves = [];
      let x = 0, z = 0, rowD = 0, W = 0;
      for (const i of order) {
        const s = slots[i];
        if (x > 0 && x + s.w > maxW) { shelves.push({ z, d: rowD, end: x - gapS }); z += rowD + gapS; x = 0; rowD = 0; }
        at[i] = [x, z, shelves.length]; x += s.w + gapS; rowD = Math.max(rowD, s.d); W = Math.max(W, x - gapS);
      }
      shelves.push({ z, d: rowD, end: x - gapS });
      return { at, shelves, W, D: z + rowD };
    };
    // try a range of widths; keep the least wasted box that is roughly 3:2 (no big empty strips at the right or bottom)
    const widest = Math.max(...slots.map((s) => s.w)), sumW = slots.reduce((n, s) => n + s.w + gapS, 0);
    let best = null;
    for (let k = 0; k <= 60; k++) {
      const p = pack(widest + (sumW - widest) * (k / 60)), score = p.W * p.D * (1 + 0.6 * Math.abs(Math.log(p.W / p.D / 1.5)));
      if (!best || score < best.score) best = { ...p, score };
    }
    const { at, shelves, W } = best;
    const D = best.D, H = Math.max(...slots.map((s) => s.h)) + 0.008;
    const g = new THREE.Group(), lid = new THREE.Group();
    const yellow = new THREE.MeshStandardMaterial({ color: 0xf2c21b, roughness: 0.5 }), white = new THREE.MeshStandardMaterial({ color: 0xf3f0e8, roughness: 0.75 }),
      well = new THREE.MeshStandardMaterial({ color: 0xd9d3c6, roughness: 0.9 }), dark = new THREE.MeshStandardMaterial({ color: 0x24324a, roughness: 0.9 });
    // ponytail: only the outer rim casts shadows; the thin, flush insert pieces don't (they gave striped shadow acne)
    const slab = (w, h, d, m, px, py, pz, parent = g, shade = false) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(px, py, pz); b.castShadow = shade; b.receiveShadow = false; b.name = 'kitbox_box'; parent.add(b); return b; };
    slab(W + 2 * wall, f, D + 2 * wall, white, 0, f / 2, 0).receiveShadow = true;                // floor
    for (const sx of [-1, 1]) slab(wall, H, D + 2 * wall, yellow, sx * (W / 2 + wall / 2), H / 2, 0, g, true);
    for (const sz of [-1, 1]) slab(W, H, wall, yellow, 0, H / 2, sz * (D / 2 + wall / 2), g, true);
    const rh = H * 0.7, fh = rh - 0.0006; // fillers sit a hair below the ribs so their tops never share a plane
    const fill = (x0, z0, w, d) => { // clipped to the inside of the rim, so nothing pokes into the yellow walls
      const a = Math.max(0, x0), b = Math.min(W, x0 + w), c = Math.max(0, z0), e = Math.min(D, z0 + d);
      if (b - a > 0.001 && e - c > 0.001) slab(b - a, fh, e - c, white, -W / 2 + (a + b) / 2, f + fh / 2, -D / 2 + (c + e) / 2);
    };
    shelves.forEach((sh) => fill(sh.end + rib, sh.z - rib, W - sh.end - rib, sh.d + 2 * rib)); // solid insert past the last pocket of a row
    const pockets = slots.map((s, i) => { // each pocket: a darker well and a white rim of ribs around it; solid insert fills the rest of its row
      const cx = -W / 2 + at[i][0] + s.w / 2, cz = -D / 2 + at[i][1] + s.d / 2, sh = shelves[at[i][2]];
      fill(at[i][0] - rib, at[i][1] + s.d + rib, s.w + 2 * rib, sh.d - s.d - rib);
      slab(s.w, 0.001, s.d, s.dark ? dark : well, cx, f + 0.0005, cz); // clear acrylic (decks, brackets) needs a dark well to show
      for (const sx of [-1, 1]) slab(rib, rh, s.d + rib, white, cx + sx * (s.w / 2 + rib / 2), f + rh / 2, cz);
      for (const sz of [-1, 1]) slab(s.w + 2 * rib, rh, rib, white, cx, f + rh / 2, cz + sz * (s.d / 2 + rib / 2));
      return new THREE.Vector3(-W / 2 + at[i][0], f + 0.001, -D / 2 + at[i][1]).add(ROBOT_AT);
    });
    lid.position.set(0, H, -D / 2 - wall); g.add(lid);
    slab(W + 2 * wall + 0.004, 0.003, D + 2 * wall + 0.004, new THREE.MeshStandardMaterial({ color: 0xdfe8f2, roughness: 0.15, transparent: true, opacity: 0.3, name: 'acrylic_lid' }), 0, 0.0015, D / 2 + wall, lid);
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
    const cx = cv.getContext('2d'); cx.fillStyle = '#3a2c72'; cx.fillRect(0, 0, 512, 256); cx.fillStyle = '#f2c21b'; cx.fillRect(0, 214, 512, 42);
    cx.fillStyle = '#fff'; cx.textAlign = 'center'; cx.font = '800 64px sans-serif'; cx.fillText('ROBO CODERS', 256, 112);
    cx.font = '600 28px sans-serif'; cx.fillText('ESP32 robotics kit', 256, 166);
    cx.fillStyle = '#3a2c72'; cx.font = '700 22px sans-serif'; cx.fillText('Tech Explorers · Levels 1–3', 256, 243);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const cw = Math.min(W * 0.6, D * 1.1);
    for (const side of [1, -1]) { // on top while shut, underneath (facing the camera) once open
      const card = new THREE.Mesh(new THREE.PlaneGeometry(cw, cw / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
      card.rotation.x = -side * Math.PI / 2; card.position.set(0, side > 0 ? 0.0032 : -0.0002, D / 2 + wall); card.name = 'kitbox_box'; lid.add(card);
    }
    g.position.copy(ROBOT_AT);
    return { g, lid, H, pockets, W: W + 2 * wall, D: D + 2 * wall };
  }
  const KIT_SIZE = { battery: 1.8, base: 1.4, servo: 0.8, gas: 0.75 }; // in-box scale vs the workbench
  const KIT_TURN = { servo: Math.PI / 2 }; // in-box turn about the vertical (servo: lead runs the other way)
  // which pocket an item goes in: alike items share one (laid side by side; the two decks stacked; wheels and motors 2 × 2)
  const slotKey = (m) => (/^deck_/.test(m.key) ? 'decks' : /^motor_/.test(m.key) ? 'motors' : /^bracket_/.test(m.key) ? 'brackets' : /^wheel_/.test(m.key) ? 'wheels' : /^cable/.test(m.key) ? 'cables' : m.key);
  function kitSetup() { // once, with everything at its parts-mat spot
    const tray = extras.find((e) => e.kind === 'tray'), wpos = (o) => o.parent.localToWorld(o.position.clone());
    const solo = [...parts.filter((p) => !p.tray).map((p) => ({ obj: p.pivot, id: kitIdOf(p), key: p.id })), ...extras.map((e, i) => ({ obj: e.obj, id: e.part, key: e.kind.startsWith('cable') ? e.kind : `x${i}` }))];
    world.updateMatrixWorld(true);
    const movers = solo.map((m) => {
      const qTo = m.obj.quaternion.clone(); let qBox = qTo;
      if (/^bracket_/.test(m.key)) { // packed lying flat: try the quarter turns, keep the lowest
        let best = Infinity;
        for (const [ax, an] of [[[1, 0, 0], Math.PI / 2], [[1, 0, 0], -Math.PI / 2], [[0, 0, 1], Math.PI / 2]]) {
          const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...ax), an).multiply(qTo);
          m.obj.quaternion.copy(q); m.obj.updateMatrixWorld(true);
          const hgt = new THREE.Box3().setFromObject(m.obj).getSize(new THREE.Vector3()).y;
          if (hgt < best) { best = hgt; qBox = q; }
        }
        m.obj.quaternion.copy(qBox); m.obj.updateMatrixWorld(true);
      } else if (KIT_TURN[m.id]) {
        qBox = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), KIT_TURN[m.id]).multiply(qTo);
        m.obj.quaternion.copy(qBox); m.obj.updateMatrixWorld(true);
      }
      const b = new THREE.Box3().setFromObject(m.obj), sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3()), to = wpos(m.obj), s0 = m.obj.scale.x;
      const k = KIT_SIZE[m.id] ?? 1; // in the box at the workbench's size (modules drawn 2×), a few tuned to read well
      m.obj.quaternion.copy(qTo); m.obj.updateMatrixWorld(true);
      return { ...m, to, s0, k, qTo, qBox, off: to.clone().sub(new THREE.Vector3(c.x, b.min.y, c.z)), size: sz.clone().multiplyScalar(k) };
    });
    // group into pockets and lay each group out inside its pocket (local x, y, z of each item's bottom centre)
    const M = 0.004, G = 0.003, groups = new Map();
    movers.forEach((m) => { const k = slotKey(m); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m); });
    const slots = [...groups.values()].map((list) => {
      const key = slotKey(list[0]);
      if (key === 'decks') { // stacked like in a real box: the top deck shifted a little so the bottom one peeks out
        const sh = 0.008, w = Math.max(...list.map((m) => m.size.x)) + sh, d = Math.max(...list.map((m) => m.size.z)) + sh;
        let y = 0;
        list.forEach((m, j) => { m.local = [M + m.size.x / 2 + j * sh, y, M + m.size.z / 2 + j * sh]; y += m.size.y; });
        return { list, w: w + 2 * M, d: d + 2 * M, h: y, dark: true };
      }
      if (key === 'cables') { // one stacked bundle per kind (2-, 3-, 4-pin), side by side
        const kinds = [...new Set(list.map((m) => m.key))], cw = Math.max(...list.map((m) => m.size.x)), cd = Math.max(...list.map((m) => m.size.z)), ch = Math.max(...list.map((m) => m.size.y));
        let h = 0;
        kinds.forEach((kd, c) => list.filter((m) => m.key === kd).forEach((m, j) => { m.local = [M + c * (cw + G * 2) + cw / 2, j * ch * 0.85, M + cd / 2]; h = Math.max(h, (j + 1) * ch); }));
        return { list, w: kinds.length * cw + (kinds.length - 1) * G * 2 + 2 * M, d: cd + 2 * M, h };
      }
      const cols = key === 'wheels' || key === 'motors' ? 2 : key === 'brackets' ? 4 : list.length, cw = Math.max(...list.map((m) => m.size.x)), cd = Math.max(...list.map((m) => m.size.z));
      const rows = Math.ceil(list.length / cols), w = cols * cw + (cols - 1) * G, d = rows * cd + (rows - 1) * G;
      list.forEach((m, i) => { m.local = [M + (i % cols) * (cw + G) + cw / 2, 0, M + Math.floor(i / cols) * (cd + G) + cd / 2]; });
      return { list, w: w + 2 * M, d: d + 2 * M, h: Math.max(...list.map((m) => m.size.y)), dark: key === 'brackets' || key === 'decks' }; // clear acrylic: dark well
    });
    kit = makeKitBox(slots);
    world.add(kit.g);
    slots.forEach((s, i) => s.list.forEach((m) => { m.pocket = kit.pockets[i].clone().add(new THREE.Vector3(...m.local)); }));
    kit.movers = slots.flatMap((s) => s.list).sort((a, b) => movers.indexOf(a) - movers.indexOf(b)); // fly out in workbench order
    kit.tray = kit.movers.find((m) => m.obj === tray.obj);
    kit.riders = parts.filter((p) => p.tray).map((p) => ({ obj: p.pivot, to: wpos(p.pivot), s0: 1 })); // hardware inside the tray
  }
  const KT = { LID: [600, 900], START: 1500, STEP: 45, LIFT: 300, ARC: 750 };
  function kitPlace(t) {
    const clamp = (k) => Math.min(1, Math.max(0, k)), out3 = (k) => 1 - (1 - k) ** 3, back = (k) => 1 + 2.4 * (k - 1) ** 3 + 1.4 * (k - 1) ** 2;
    kit.lid.rotation.x = -1.95 * back(clamp((t - KT.LID[0]) / KT.LID[1]));
    const v = new THREE.Vector3();
    kit.movers.forEach((m, i) => {
      const t0 = KT.START + i * KT.STEP, up = out3(clamp((t - t0) / KT.LIFT)), u = clamp((t - t0 - KT.LIFT) / KT.ARC), e = out3(u), k = m.k + (1 - m.k) * e;
      v.copy(m.pocket).addScaledVector(m.off, m.k).lerp(m.to, e);
      v.y += up * (kit.H + 0.02) * (1 - e) + Math.sin(Math.PI * u) * 0.08;
      m.obj.position.copy(m.obj.parent.worldToLocal(v.clone())); m.obj.scale.setScalar(m.s0 * k); m.cur = v.clone(); m.ks = k;
      if (m.qBox !== m.qTo) m.obj.quaternion.slerpQuaternions(m.qBox, m.qTo, e); // flat in the box, upright on the mat
    });
    const tr = kit.tray; // hardware keeps its place in the tray, scaled with it
    kit.riders.forEach((r) => { v.copy(tr.cur).addScaledVector(r.to.clone().sub(tr.to), tr.ks); r.obj.position.copy(r.obj.parent.worldToLocal(v.clone())); r.obj.scale.setScalar(tr.ks); });
  }
  function unbox(animate) {
    st.step = 0; st.t = dur(0); st.playing = false; st.exploded = false; st.phase = 'desk';
    robot.position.copy(ROBOT_AT); robot.rotation.set(0, 0, 0);
    rings.forEach((r) => deco.remove(r)); rings = [];
    stage.show(world, 1.0);
    if (kit) kitPlace(Infinity); // back to the mat before measuring anything
    apply();
    if (!kit) kitSetup();
    kit.g.visible = true;
    if (!animate) { kitPlace(Infinity); view('desk'); stage.look(DESK_T, DESK_P, 1); return; }
    kitPlace(0);
    stage.setCallouts([]);
    const bc = ROBOT_AT.clone().add(new THREE.Vector3(0, 0.03, 0));
    stage.look(bc, bc.clone().add(new THREE.Vector3(0, 0.36, 0.42)), 1);
    const t0 = performance.now(), end = KT.START + kit.movers.length * KT.STEP + KT.LIFT + KT.ARC;
    let flew = false;
    stage.tick('build', () => {
      const t = performance.now() - t0;
      kitPlace(t);
      if (!flew && t > KT.START - 200) { flew = true; stage.look(DESK_T.clone().add(new THREE.Vector3(0.18, 0, 0)), DESK_P.clone().add(new THREE.Vector3(0.3, 0.15, 0.2)), 2600); }
      if (t > end) { stage.untick('build'); kitPlace(Infinity); view('desk'); }
    });
  }
  /** Look inside the box: every part back in its pocket, lid open, camera straight down. false: back on the workbench. */
  function kitInside(on) {
    if (!kit) return;
    stage.untick('build');
    if (!on) { kitPlace(Infinity); view('desk'); return; }
    kitPlace(KT.START - 1); // lid fully open, nothing lifted yet
    stage.setCallouts([]);
    const d = Math.max(kit.W, kit.D * 1.6) / 2 / Math.tan(THREE.MathUtils.degToRad(stage.camera.fov / 2)) * 1.1;
    stage.look(ROBOT_AT.clone(), ROBOT_AT.clone().add(new THREE.Vector3(0, d, 0.02)), 1200);
  }
  /** level filter: ghost everything that isn't one of these kit part ids (null = show all) */
  function kitFilter(ids) {
    if (!kit) return;
    kit.movers.forEach((m) => setLook(m.obj, ids && !ids.includes(m.id) ? 'ghost' : 'normal'));
    kit.riders.forEach((r) => setLook(r.obj, ids && !ids.includes('chassis') ? 'ghost' : 'normal'));
  }

  function show() {
    if (kit) { kitPlace(Infinity); kit.g.visible = false; kitFilter(null); } // the build guide has no kit box
    stage.show(world, 1.0);
    stage.tick('build', frame);
    setStep(st.step);
  }

  return {
    st, drv, parts, partById, show, steps: STEPS, project, setStep, unbox, kitFilter, kitInside,
    kitAt: (t) => { stage.untick('build'); kitPlace(t); }, // dev checks: freeze the unboxing at t ms
    play: () => { if (st.t >= dur(st.step) - 0.01) { st.t = 0; st.phase = null; st.playing = true; } else st.playing = !st.playing; return st.playing; },
    cycleSpeed: () => { st.speed = st.speed === 1 ? 2 : st.speed === 2 ? 0.5 : 1; return st.speed; },
    explode: () => { st.exploded = !st.exploded; apply(); return st.exploded; },
    /** BOM / need-list hover: ghost everything except parts whose id (or extra kind) starts with one of `sel` */
    isolate(sel) { isoSel = sel; paint(); },
    /** detail page: tint these parts gold */
    select(ids) { selIds = ids; paint(); },
    /** sub-step k of this step: its [t0, t1] on the timeline, the one playing now, and replay from it */
    subTimes: () => subTimes(st.step),
    subNow() { const w = subTimes(st.step); return w && st.t < dur(st.step) - 0.05 ? w.findIndex(([a, b]) => st.t >= a && st.t < b) : -1; },
    seek(k) { const w = subTimes(st.step); if (!w) return; st.t = w[k][0]; st.playing = true; st.exploded = false; apply(); },
    /** hover/click info for anything on the desk: { label, info, obj, step?, cat, specs, features } */
    infoFor(key) {
      const fromPart = (p) => p && { part: kitIdOf(p), label: p.label, info: p.info, step: p.step, cat: SPEC[p.spec]?.[0], specs: SPEC[p.spec]?.[1],
        ids: p.group ? parts.filter((q) => q.group === p.group).map((q) => q.id) : [p.id], obj: p.group ? parts.filter((q) => q.group === p.group).map((q) => q.pivot) : p.pivot };
      const fromExtra = (e) => e && { ...e, step: e.use ?? null, ids: [e.kind] };
      if (key.startsWith('build:x')) return fromExtra(extras[+key.slice(7)]);
      if (key.startsWith('build:')) return fromPart(partById[key.slice(6)]);
      const p = parts.find((q) => q.pivot.getObjectByName(key));
      if (p) return fromPart(p);
      return fromExtra(extras.find((x) => x.obj.getObjectByName(key)));
    },
  };
}

function boxOf(objs) { const b = new THREE.Box3(); objs.forEach((o) => b.expandByObject(o)); return b; }

// cutting mat: 1 cm grid, 5 cm major lines, ruler numbers, a title in the corner
function makeMat(M, title, green) {
  const px = 3, c = document.createElement('canvas');
  c.width = M.w * px; c.height = M.d * px;
  const g = c.getContext('2d');
  g.fillStyle = green ? '#2f6b59' : '#2b5f74'; g.fillRect(0, 0, c.width, c.height);
  for (let x = 0; x <= M.w; x += 10) { g.fillStyle = x % 50 ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.3)'; g.fillRect(x * px - 1, 0, x % 50 ? 2 : 3, c.height); }
  for (let y = 0; y <= M.d; y += 10) { g.fillStyle = y % 50 ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.3)'; g.fillRect(0, y * px - 1, c.width, y % 50 ? 2 : 3); }
  g.fillStyle = 'rgba(255,255,255,.55)'; g.font = `600 ${6 * px}px "Barlow Condensed", sans-serif`; g.textBaseline = 'top';
  for (let x = 50; x < M.w; x += 50) g.fillText(String(x / 10), x * px + 4, c.height - 9 * px);
  for (let y = 50; y < M.d; y += 50) g.fillText(String(y / 10), 4, c.height - y * px + 4);
  g.fillStyle = 'rgba(255,255,255,.8)'; g.font = `700 ${11 * px}px "Barlow Condensed", sans-serif`; g.fillText(title, 10 * px, 6 * px);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const side = new THREE.MeshStandardMaterial({ color: green ? 0x24564a : 0x214a5b, roughness: 0.9 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(M.w * MM, 1.5 * MM, M.d * MM), [side, side, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }), side, side, side]);
  m.position.set(M.cx * MM, -0.75 * MM, 0); m.receiveShadow = true; m.raycast = () => {}; m.name = 'mat';
  return m;
}

// wooden work desk under both mats
function makeDesk() {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 960;
  const g = c.getContext('2d');
  g.fillStyle = '#c8955e'; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 220; i++) {
    g.strokeStyle = `rgba(${90 + Math.random() * 40},${50 + Math.random() * 25},20,${0.06 + Math.random() * 0.1})`;
    g.lineWidth = 1 + Math.random() * 3; g.beginPath();
    const y = Math.random() * c.height;
    g.moveTo(0, y); g.bezierCurveTo(600, y + Math.random() * 20 - 10, 1400, y + Math.random() * 20 - 10, c.width, y + Math.random() * 16 - 8); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const top = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }), edge = new THREE.MeshStandardMaterial({ color: 0xa8744a, roughness: 0.75 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.03, 0.95), [edge, edge, top, edge, edge, edge]);
  m.position.set(0.1, -0.0015 - 0.015, 0); m.receiveShadow = true; m.raycast = () => {}; m.name = 'desk';
  return m;
}

// parts tray: open box with compartments for the standoffs and screws
function makeTray() { // 230 × 70 mm, five compartments
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: 0x3a4049, roughness: 0.6 });
  const box = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w * MM, h * MM, d * MM), mat); m.position.set(x * MM, y * MM, z * MM); m.castShadow = m.receiveShadow = true; g.add(m); };
  box(230, 2, 70, 0, 1, 0); box(230, 12, 2, 0, 6, 34); box(230, 12, 2, 0, 6, -34); box(2, 12, 70, 114, 6, 0); box(2, 12, 70, -114, 6, 0);
  for (const x of [-69, -23, 23, 69]) box(1.5, 10, 66, x, 5, 0);
  return g;
}

const STEEL = new THREE.MeshStandardMaterial({ color: 0xb9bdc4, metalness: 1, roughness: 0.32 });
const BRASS = new THREE.MeshStandardMaterial({ color: 0xd2a94e, metalness: 1, roughness: 0.3 });
const GHOST = new THREE.MeshBasicMaterial({ color: 0x9fc7b8, transparent: true, opacity: 0.14, depthWrite: false });
const cylZ = (r, len, seg, z0) => { const g = new THREE.CylinderGeometry(r * MM, r * MM, len * MM, seg); g.rotateX(Math.PI / 2); g.translate(0, 0, (z0 + len / 2) * MM); return g; };
const cylY = (r, len, seg, y0) => { const g = new THREE.CylinderGeometry(r * MM, r * MM, len * MM, seg); g.translate(0, (y0 + len / 2) * MM, 0); return g; };
function group(...meshes) { const g = new THREE.Group(); meshes.forEach((m) => { m.castShadow = true; g.add(m); }); return g; }
// M3 × 30 bolt along +Z: hex head behind z = 0, shaft 0..30
function makeBolt() { return group(new THREE.Mesh(cylZ(2.75, 2, 6, -2), STEEL), new THREE.Mesh(cylZ(1.5, 30, 10, 0), STEEL)); }
// M3 hex nut along +Z
function makeNut() { return group(new THREE.Mesh(cylZ(3.2, 2.4, 6, 0), STEEL)); }
// M3 hex nut lying flat (axis +Y)
function makeNutY() { return group(new THREE.Mesh(cylY(3.2, 2.4, 6, 0), STEEL)); }
// M3 × 6 pan-head screw along +Y: head below y = 0, shaft 0..6
function makeScrew() { return group(new THREE.Mesh(cylY(2.75, 1.6, 12, -1.6), STEEL), new THREE.Mesh(cylY(1.5, 6, 10, 0), STEEL)); }
// hex brass standoff along +Y
function makeStandoff(len) { return group(new THREE.Mesh(cylY(3.2, len, 6, 0), BRASS)); }

// JST-XH cable: n wires with a plug housing on both ends, lying along X
function makeJst(n, len) {
  const g = new THREE.Group(), plug = new THREE.MeshStandardMaterial({ color: 0xece6d8, roughness: 0.6 });
  const w = ((n - 1) * 2.5 + 3.4) * MM;
  for (const sx of [-1, 1]) { const h = new THREE.Mesh(new THREE.BoxGeometry(7 * MM, 4.6 * MM, w), plug); h.position.set(sx * (len / 2 - 3.5) * MM, 2.3 * MM, 0); h.castShadow = true; g.add(h); }
  WIRE_COLORS[n].forEach((col, i) => {
    const z = (i - (n - 1) / 2) * 2.5 * MM, bow = Math.sin(i + n) * 3 * MM;
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-(len / 2 - 7) * MM, 1.2 * MM, z), new THREE.Vector3(0, 0.6 * MM, z + bow), new THREE.Vector3((len / 2 - 7) * MM, 1.2 * MM, z)]);
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.6 * MM, 6), new THREE.MeshStandardMaterial({ color: col, roughness: 0.45 }));
    m.castShadow = true; g.add(m);
  });
  return g;
}

// micro-USB plug + cable, pointing out of the ESP32's USB port (+X)
function makeUsb() {
  const g = new THREE.Group(), grey = new THREE.MeshStandardMaterial({ color: 0x2a2c31, roughness: 0.6 }), steel = new THREE.MeshStandardMaterial({ color: 0xb8bcc4, metalness: 1, roughness: 0.3 });
  const tip = new THREE.Mesh(new THREE.BoxGeometry(5 * MM, 1.9 * MM, 6.6 * MM), steel); tip.position.x = -1.5 * MM;
  const body = new THREE.Mesh(new THREE.BoxGeometry(14 * MM, 6 * MM, 10.5 * MM), grey); body.position.x = 7 * MM;
  const curve = new THREE.CatmullRomCurve3([[14, 0, 0], [34, 0, 0], [52, -3, 18], [62, -4, 46], [48, -4, 70]].map(([x, y, z]) => new THREE.Vector3(x * MM, y * MM, z * MM)));
  const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 1.6 * MM, 8), grey);
  g.add(tip, body, wire);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
