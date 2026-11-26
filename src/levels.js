// Tech Explorers books (Robo Coders kit): each level introduces a few components, and its projects use only those.
// A project with `lesson` reuses a Classic lesson for now; without one it shows "Coming soon" until that level is built.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const W = (pin, v) => ['write', pin, v], WAIT = (s) => ['wait', s], OUT = (pin) => ['mode', pin, 'output'];
const RED = { id: 'led', port: 'd23', tint: 'red' };

/** Level 1 lessons, written for the book. Record: { id, kit, chassis?, params?, heading, lede, features, observation, pinout, specs, blocks }. */
const L1_LESSONS = [
  { id: 'l1-blink', kit: [{ id: 'led', port: 'd13', tint: 'red' }],
    heading: 'LED blinking', lede: 'Your first project: plug one LED module into the D13 port and make it blink. The program turns pin 13 on, waits, turns it off, waits, and repeats for ever.',
    features: ['New part: the LED module. Its resistor (R1) keeps the LED safe', '"set digital pin high" turns the LED on, "low" turns it off', '"wait" pauses the program in seconds'],
    observation: 'The red LED is on for 1 second and off for 1 second, again and again.',
    pinout: [['D13 port', 'Red LED (GPIO 13)'], ['Cable', '3-pin: black GND · red 5 V · orange signal']], specs: [['Output', 'GPIO 13'], ['On time', '1 s'], ['Off time', '1 s']],
    blocks: { setup: [OUT(13)], loop: [W(13, 1), WAIT(1), W(13, 0), WAIT(1)] } },
  { id: 'l1-chase', kit: [{ id: 'led', port: 'd23', tint: 'red' }, { id: 'led', port: 'd32', tint: 'yellow' }, { id: 'led', port: 'd13', tint: 'green' }],
    heading: 'LED chase pattern', lede: 'Plug in all three LED modules: red on D23, yellow on D32, green on D13. Light them one after another so the light seems to run along the row.',
    features: ['Three outputs, only one on at a time', 'Each LED stays on for half a second', 'Make the waits shorter and the light runs faster'],
    observation: 'Red, then yellow, then green light up one after another, each for half a second, and the pattern repeats.',
    pinout: [['D23', 'Red LED'], ['D32', 'Yellow LED'], ['D13', 'Green LED']], specs: [['Outputs', '3'], ['Step time', '0.5 s']],
    blocks: { setup: [OUT(23), OUT(32), OUT(13)], loop: [W(23, 1), WAIT(0.5), W(23, 0), W(32, 1), WAIT(0.5), W(32, 0), W(13, 1), WAIT(0.5), W(13, 0)] } },
  { id: 'l1-doorbell', kit: [RED, { id: 'buzzer', port: 'd13' }],
    heading: 'Simple door bell', lede: 'A door bell that goes ding-dong. The buzzer on D13 plays a high note and then a low note, and the red LED on D23 flashes with it so you can see the bell too.',
    features: ['New part: the buzzer module. A transistor on it switches the buzzer', '"play tone" sets the note and how long it plays', 'Ding = C5 (523 Hz), dong = G4 (392 Hz)'],
    observation: 'Every 3 seconds the LED lights and the buzzer plays ding-dong, then the LED goes off.',
    pinout: [['D13', 'Buzzer'], ['D23', 'Red LED']], specs: [['Ding', 'C5 · 523 Hz · 0.5 s'], ['Dong', 'G4 · 392 Hz · 0.8 s'], ['Gap', '3 s']],
    blocks: { setup: [OUT(23), OUT(13)], loop: [W(23, 1), ['tone', 13, 'C5', 0.5], ['tone', 13, 'G4', 0.8], W(23, 0), WAIT(3)] } },
  { id: 'l1-button-led', kit: [RED, { id: 'button', port: 'd34' }],
    heading: 'Button-controlled LED', lede: 'Read the push button on the D34 input port and light the red LED on D23 only while the button is held down. Press and hold the button in the 3D view.',
    features: ['New part: the push button module, an input', '"read digital pin" gives 1 while the button is pressed', '"if … then … else" picks what to do', 'Try it: swap the button for the touch sensor on D34. Same program, touch instead of press'],
    observation: 'The red LED turns on while the button is pressed and turns off when you let go.',
    pinout: [['D34', 'Push button (input)'], ['D23', 'Red LED']], specs: [['Input', 'GPIO 34 (input only)'], ['Checks', 'every 0.1 s']],
    blocks: { setup: [OUT(23), ['mode', 34, 'input']], loop: [['if', ['read', 34, 1], [W(23, 1)], [W(23, 0)]], WAIT(0.1)] } },
];

// Level 2: from the Tech Explorers Level 2 book, pp. 126–151 (wiring, blocks and observations as printed)
const IN34 = ['mode', 34, 'input'], LED23 = { id: 'led', port: 'd23', tint: 'red' }, OLED = { id: 'oled', port: 'i2c' };
const TXT = (x, y, t) => [['oledCursor', x, y], ['oledPrint', t, 'warp']];
const OLED_ON = [['oledInit', 128, 64, '0x3C'], ['oledSize', '6x8', 'white', 'black']];
const SHOW = (lines) => [['oledClear'], ...lines.flatMap((t, i) => TXT(0, i * 16, t)), ['oledShow']];
const ROOM = { key: 'light', label: 'Room light', min: 0, max: 100, step: 1, unit: '%', value: 20 }; // + the desk lamp to drag
const L2_LESSONS = [
  { id: 'l2-night-light', kit: [{ id: 'ldr', port: 'd34' }, LED23], params: [ROOM],
    heading: 'Simple night light', lede: 'A night light that switches itself on. The LDR sensor module on D34 tells the ESP32 whether it is bright or dark, and the red LED on D23 glows in the dark. Drag the desk lamp, switch it off, or dim the room.',
    features: ['New part: the LDR sensor module. Its digital output reads 1 in bright light and 0 in the dark', 'Calibrate first: find YOUR bright, indoor, dim and dark values before writing the program', '"if read digital pin IO34 = 0" means "if it is dark"'],
    observation: 'The red LED module glows when the LDR sensor module detects darkness in the surroundings.',
    pinout: [['D34', 'LDR sensor module (input)'], ['D23', 'Red LED module']], specs: [['Input', 'GPIO 34, digital'], ['Dark', 'reads 0'], ['Bright', 'reads 1']],
    blocks: { setup: [IN34, OUT(23)], loop: [['if', ['read', 34, 0], [W(23, 1)], [W(23, 0)]]] } },
  { id: 'l2-light-display', kit: [{ id: 'ldr', port: 'd34' }, LED23, OLED], params: [ROOM],
    heading: 'Light level display', lede: 'The night light gets a screen. The OLED on the I2C port shows whether the light is on, and whether the LED is on, every second.',
    features: ['New part: the OLED display, 128 × 64 pixels, on the I2C port', 'Draw first, then show: "oled print" writes into memory and "refresh oled display" puts it on the screen', 'Each line is 16 pixels lower: y = 0, 16, 32'],
    observation: 'In bright light the OLED shows "Light: ON" and "LED: OFF". In the dark it shows "Light: OFF" and "LED: ON", and the red LED glows.',
    pinout: [['D34', 'LDR sensor module'], ['D23', 'Red LED module'], ['I2C', 'OLED: SDA D21, SCL D22']], specs: [['Screen', '128 × 64, I2C 0x3C'], ['Text size', '6 × 8 pixels'], ['Updates', 'every 1 s']],
    blocks: { setup: [OUT(23), IN34, ...OLED_ON, ...SHOW(['Light Level', 'Display', 'Starting...']), WAIT(1)],
      loop: [['oledClear'], ...TXT(0, 0, 'Light Level'), ['if', ['read', 34, 1],
        [W(23, 0), ...TXT(0, 16, 'Light: ON'), ...TXT(0, 32, 'LED: OFF'), ['oledShow'], WAIT(1)],
        [W(23, 1), ...TXT(0, 16, 'Light: OFF'), ...TXT(0, 32, 'LED: ON'), ['oledShow'], WAIT(1)]]] } },
  { id: 'l2-hand-wave', kit: [{ id: 'ir', port: 'd34' }, LED23], params: [{ key: 'ircm', label: 'Hand distance', min: 1, max: 30, step: 1, unit: 'cm', value: 20 }],
    heading: 'Hand-wave detector', lede: 'Wave your hand in front of the IR sensor module on D34 and the red LED on D23 lights up. Drag the hand closer or further, or click it to try a white or a black card.',
    features: ['New part: the IR sensor module. Its IR LED shines invisible infrared light (drawn purple, the way a phone camera shows it); the dark receiver next to it catches what bounces back',
      'It only answers yes or no: D34 reads 1 while it sees something, 0 when it does not',
      'White bounces back the most infrared, so it is seen from far away; black soaks it up and is seen only up close',
      'Turn the R6 trimmer to change how far it can see. The program checks once a second'],
    observation: 'The red LED glows while the hand is close enough for the IR sensor to see it, and goes off when you move it away.',
    pinout: [['D34', 'IR sensor module (input)'], ['D23', 'Red LED module']], specs: [['Input', 'GPIO 34, digital'], ['Something seen', 'reads 1'], ['Range', 'about 2–30 cm, set by R6'], ['Checks', 'every 1 s']],
    blocks: { setup: [OUT(23), IN34], loop: [['if', ['read', 34, 1], [W(23, 1)], [W(23, 0)]], WAIT(1)] } },
  { id: 'l2-smart-traffic', kit: [{ id: 'traffic', port: 'rgy' }, OLED],
    heading: 'Smart traffic light', lede: 'A real traffic light sequence on the traffic light module, with the OLED showing the current phase and what cars should do.',
    features: ['New part: the traffic light module on the RGY port: D23 red, D33 yellow, D32 green', 'Green 5 s, yellow 2 s, red 5 s', 'Switch one light off before the next one comes on'],
    observation: 'The OLED display module shows the traffic signal while the green, yellow and red LEDs cycle for 5 s, 2 s and 5 s, repeating continuously.',
    pinout: [['D23', 'Red'], ['D33', 'Yellow'], ['D32', 'Green'], ['I2C', 'OLED']], specs: [['Green', '5 s · Cars GO!'], ['Yellow', '2 s · Slow Down!'], ['Red', '5 s · Cars STOP!']],
    blocks: { setup: [OUT(23), OUT(33), OUT(32), ...OLED_ON, W(23, 0), W(33, 0), W(32, 0), ...SHOW(['Smart Traffic', 'Light', 'Starting...']), WAIT(1)],
      loop: [W(32, 1), ...SHOW(['Phase:', 'GREEN', 'Cars GO!']), WAIT(5), W(32, 0),
        W(33, 1), ...SHOW(['Phase:', 'YELLOW', 'Slow Down!']), WAIT(2), W(33, 0),
        W(23, 1), ...SHOW(['Phase:', 'RED', 'Cars STOP!']), WAIT(5), W(23, 0)] } },
];

// Level 3: Tech Explorers Level 3, pp. 144–175. Motor A (left wheels) = IO27/IO14, motor B (right wheels) = IO26/IO25.
const M = (a1, a2, b1, b2) => [W(27, a1), W(14, a2), W(26, b1), W(25, b2)];
const MOTORS_OUT = [OUT(27), OUT(14), OUT(26), OUT(25)], FWD = () => M(1, 0, 1, 0), STOP = () => M(0, 0, 0, 0); // fresh tuples each time: the editor edits blocks in place
const OBJ = { key: 'cm', label: 'Object at', min: 2, max: 200, step: 1, unit: 'cm', value: 40 }, US = { id: 'ultrasonic', port: 'ultrasonic' };
const ALERT = (word) => [...TXT(0, 32, 'Alert:'), ...TXT(0, 48, word), ['oledShow']];
const L3_LESSONS = [
  { id: 'l3-pattern', kit: [], chassis: true,
    heading: 'Pattern mover', lede: 'Your first program on wheels: drive forward, stop, turn 90°, forever, so the robot keeps tracing a square and coming back to where it started.',
    features: ['New: the motor driver. IO27/IO14 drive the left wheels, IO26/IO25 the right wheels', 'Forward: both sides forward. Spin clockwise: left forward, right backward', 'The forever loop runs one side and one corner each time round, so the robot keeps tracing squares', 'Adjust the 0.5 s turn wait until each corner is 90°'],
    observation: 'The robot moves forward for 1 second, stops briefly, turns approximately 90°, and repeats this forever, tracing the same square again and again. Press Stop to end it.',
    pinout: [['IO27 / IO14', 'Left motors (A)'], ['IO26 / IO25', 'Right motors (B)']], specs: [['Side', '1 s forward'], ['Corner', '0.5 s spin (tune it)'], ['Pauses', '0.2 s']],
    blocks: { setup: [...MOTORS_OUT], loop: [...FWD(), WAIT(1), ...STOP(), WAIT(0.2), ...M(1, 0, 0, 1), WAIT(0.5), ...STOP(), WAIT(0.2)] } }, // forever: one side and one corner per pass
  { id: 'l3-manual', kit: [{ id: 'button', port: 'd35' }], chassis: true,
    heading: 'Manual drive robot', lede: 'Momentary control: hold the push button and the robot drives forward, let go and it stops at once. Press and hold the button in the 3D view.',
    features: ['Momentary control: moves only while the button is held, so there is no runaway robot', 'The forever loop checks the button many times a second, so it feels instant', '"if … else" maps it exactly: pressed → forward, else → stop', 'The button goes on the D35 port: the program reads IO35'],
    observation: 'The robot moves forward continuously while the push button module is pressed. As soon as the button is released, the robot stops immediately.',
    pinout: [['D35', 'Push button module'], ['IO27 / IO14', 'Left motors'], ['IO26 / IO25', 'Right motors']], specs: [['Control', 'Momentary (hold to move)']],
    blocks: { setup: [['mode', 35, 'input'], ...MOTORS_OUT], loop: [['if', ['read', 35, 1], FWD(), STOP()]] } },
  { id: 'l3-distance-alarm', kit: [US, { id: 'traffic', port: 'rgy' }, { id: 'buzzer', port: 'd13' }, OLED], params: [OBJ],
    heading: 'Distance alarm', lede: 'Measure distance with the ultrasonic sensor and give alerts that get stronger as an object comes closer: lights, beeps and a live reading on the OLED. Drag the object or use the slider.',
    features: ['New part: the ultrasonic sensor on the ULTRASONIC port (TRIG D19, ECHO D18)', 'Store the reading in a variable, "distance", then use it everywhere: one reading per loop', 'Within 30 cm: green and a slow beep. Within 15 cm: yellow and fast beeps. Within 5 cm: red and a constant buzz', 'Real readings wobble a little: use 32 cm instead of 30 to stop flickering at the edge'],
    observation: 'The OLED shows the live distance. With nothing near it shows "Alert: NONE" and the lights and buzzer are off. Within 30 cm the green LED turns on with a slow beep ("Alert: WARN"), within 15 cm the yellow LED and fast beeps ("Alert: DANGER"), and within 5 cm the red LED and a constant buzz ("Alert: CRITICAL").',
    pinout: [['ULTRASONIC', 'TRIG D19, ECHO D18'], ['RGY', 'D23 red, D33 yellow, D32 green'], ['D13', 'Buzzer'], ['I2C', 'OLED']], specs: [['WARN', 'under 30 cm · beep every 1 s'], ['DANGER', 'under 15 cm · 3 beeps a second'], ['CRITICAL', 'under 5 cm · constant']],
    blocks: { setup: [OUT(23), OUT(33), OUT(32), OUT(13), ...OLED_ON, W(23, 0), W(33, 0), W(32, 0), W(13, 0), ...SHOW(['Distance Alarm', 'Starting...']), WAIT(1)],
      loop: [['setDist', 'distance', 19, 18], ['oledClear'], ...TXT(0, 0, 'Distance:'), ['oledPrintVar', 'distance', 'warp'], ...TXT(0, 8, 'cm'),
        ['if', ['var', 'distance', '<', 5], [W(23, 1), W(33, 0), W(32, 0), W(13, 1), ...ALERT('CRITICAL')],
          [['if', ['var', 'distance', '<', 15], [W(23, 0), W(33, 1), W(32, 0), ...ALERT('DANGER'), W(13, 1), WAIT(0.17), W(13, 0), WAIT(0.17)],
            [['if', ['var', 'distance', '<', 30], [W(23, 0), W(33, 0), W(32, 1), ...ALERT('WARN'), W(13, 1), WAIT(0.5), W(13, 0), WAIT(0.5)],
              [W(23, 0), W(33, 0), W(32, 0), W(13, 0), ...ALERT('NONE')]]]]]]] } },
  { id: 'l3-obstacle', kit: [US], chassis: true, params: [OBJ],
    heading: 'Obstacle avoidance', lede: 'The robot drives forward on its own. When the ultrasonic sensor sees something closer than 20 cm it stops, turns right and carries on. Drag the obstacle in front of it.',
    features: ['Custom blocks: drive_forward, turn_right and stop_robot each hold the 4 motor pins, so the main program reads like a story', 'One distance reading per loop, stored in the "distance" variable', 'Turn right: left wheels forward, right wheels stopped'],
    observation: 'The robot drives forward. When an object comes within 20 cm it stops, turns right for half a second, stops, and then drives on.',
    pinout: [['ULTRASONIC', 'TRIG D19, ECHO D18'], ['IO27 / IO14', 'Left motors'], ['IO26 / IO25', 'Right motors']], specs: [['Too close', 'under 20 cm'], ['Turn', '0.5 s right']],
    blocks: { funcs: { drive_forward: FWD(), turn_right: M(1, 0, 0, 0), stop_robot: STOP() }, setup: [...MOTORS_OUT],
      loop: [['setDist', 'distance', 19, 18], ['if', ['var', 'distance', '<', 20], [['call', 'stop_robot'], WAIT(0.3), ['call', 'turn_right'], WAIT(0.5), ['call', 'stop_robot']], [['call', 'drive_forward']]]] } },
  { id: 'l3-line', kit: [{ id: 'ir', port: 'd36' }, { id: 'ir', port: 'd35' }], chassis: true, params: [{ key: 'drift', label: 'Car position on the tape', min: -100, max: 100, step: 1, unit: '', value: 0 }],
    heading: 'Line following robot', lede: 'Two IR sensors look down at a black tape track. The robot drives straight while the tape is between them and steers back when one sensor lands on the tape. Push the car off the line with the slider and watch it correct.',
    features: ['Left IR sensor on D36, right IR sensor on D35, both pointing down', 'Over the black tape a sensor reads 1; over the white floor it reads 0', '"and" checks both sensors at once: 0 and 0 → go straight', 'Calibrate both sensor trimmers over the white floor and the black tape first'],
    observation: 'With both sensors either side of the tape, the robot drives forward. When it drifts right, the left sensor goes onto the tape and the robot steers left; when it drifts left, it steers right. If it loses the tape completely, both sensors read high and the robot stops.',
    pinout: [['D36', 'Left IR sensor'], ['D35', 'Right IR sensor'], ['IO27 / IO14', 'Left motors'], ['IO26 / IO25', 'Right motors']], specs: [['Track', 'black electrical tape on a light floor'], ['Custom blocks', 'go_straight, steer_left, steer_right, lost_line']],
    blocks: { funcs: { steer_left: M(0, 0, 1, 0), go_straight: FWD(), steer_right: M(1, 0, 0, 0), lost_line: STOP() },
      setup: [...MOTORS_OUT, ['mode', 36, 'input'], ['mode', 35, 'input']],
      loop: [['setRead', 'leftVal', 36], ['setRead', 'rightVal', 35],
        ['if', ['and', ['var', 'leftVal', '=', 0], ['var', 'rightVal', '=', 0]], [['call', 'go_straight']],
          [['if', ['and', ['var', 'leftVal', '=', 1], ['var', 'rightVal', '=', 0]], [['call', 'steer_left']],
            [['if', ['and', ['var', 'leftVal', '=', 0], ['var', 'rightVal', '=', 1]], [['call', 'steer_right']], [['call', 'lost_line']]]]]]]] } },
];
const BOOK_LESSONS = [...L1_LESSONS, ...L2_LESSONS, ...L3_LESSONS];

const CORE = ['esp32', 'base', 'jst2', 'jst3', 'jst4', 'battery']; // every book: the brain, the cables, power

export const LEVELS = [
  { n: 1, theme: 'Lights, sounds and buttons', blurb: 'Make LEDs blink and chase, ring a door bell and switch a light with a button.',
    parts: ['led', 'buzzer', 'button', 'touch'],
    projects: [
      { title: 'LED blinking', uses: ['led'], lesson: 'l1-blink' },
      { title: 'LED chase pattern', uses: ['led'], lesson: 'l1-chase' },
      { title: 'Simple door bell', uses: ['buzzer', 'led'], lesson: 'l1-doorbell' },
      { title: 'Button-controlled LED', uses: ['button', 'led'], lesson: 'l1-button-led' },
    ] },
  { n: 2, theme: 'Sense the world', blurb: 'Read light and movement with sensors, then show the result on a screen and a traffic light.',
    parts: ['ldr', 'ir', 'oled', 'traffic'],
    projects: [
      { title: 'Simple night light', uses: ['ldr', 'led'], lesson: 'l2-night-light' },
      { title: 'Light level display', uses: ['ldr', 'led', 'oled'], lesson: 'l2-light-display' },
      { title: 'Hand-wave detector', uses: ['ir', 'led'], lesson: 'l2-hand-wave' },
      { title: 'Smart traffic light', uses: ['traffic', 'oled'], lesson: 'l2-smart-traffic' },
    ] },
  { n: 3, theme: 'Build a robot car', blurb: 'Assemble the chassis, learn how the motor driver turns the wheels, then make the car drive itself.',
    parts: ['tt_motor', 'tb6612', 'ultrasonic', 'wheel', 'chassis'],
    projects: [
      { title: 'Chassis assembly', uses: ['chassis', 'tt_motor', 'wheel'], build: true },
      { title: 'Pattern mover', uses: ['chassis', 'tt_motor'], lesson: 'l3-pattern' },
      { title: 'Manual drive robot', uses: ['button', 'chassis', 'tt_motor'], lesson: 'l3-manual' },
      { title: 'Distance alarm', uses: ['ultrasonic', 'traffic', 'buzzer', 'oled'], lesson: 'l3-distance-alarm' },
      { title: 'Obstacle avoidance', uses: ['ultrasonic', 'chassis', 'tt_motor'], lesson: 'l3-obstacle' },
      { title: 'Line follower', uses: ['ir', 'chassis', 'tt_motor'], lesson: 'l3-line' },
    ] },
];
export const bookOf = (n) => LEVELS.find((l) => l.n === n);

/** Components the workspace shows for level n: core + this book + earlier books. */
export const levelParts = (n) => [...CORE, ...LEVELS.filter((l) => l.n <= n).flatMap((l) => l.parts)];

/** Ready projects of level n as lesson records, titled as in the book. */
export const levelLessons = (n) => bookOf(n).projects.filter((p) => p.lesson)
  .map((p) => ({ ...BOOK_LESSONS.find((l) => l.id === p.lesson), cardTitle: p.title }));
/** Every book's lessons, each with its level. */
export const allLessons = () => LEVELS.flatMap((l) => levelLessons(l.n).map((x) => ({ ...x, level: l.n })));
/** When a part is first used: 0 = every book, 1–3 = that level, -1 = in the box but in no book yet. */
export const partLevel = (id) => (CORE.includes(id) ? 0 : LEVELS.find((l) => l.parts.includes(id))?.n ?? -1);
export const BADGE = { 0: 'Every book', 1: 'Level 1', 2: 'Level 2', 3: 'Level 3', '-1': 'Extra' };

const cover = (l, tag = 'div') => `<${tag} class="book b${l.n}"${tag === 'a' ? ` href="#/level/${l.n}" aria-label="Level ${l.n}: ${esc(l.theme)}"` : ' aria-hidden="true"'}>
  <span class="bk-brand">Robo Coders</span><b class="bk-title">Tech Explorers</b><span class="bk-sub">Coding, AI and robotics</span>
  <span class="bk-level">Level ${l.n}</span><span class="bk-theme">${esc(l.theme)}</span></${tag}>`;

export const head = (back) => `<header class="hhead hwrap">
  <a class="hmark" href="#/" aria-label="Robo Coders home"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 20a22 22 0 0 1 32 0M14 26a13 13 0 0 1 20 0M20 32a5 5 0 0 1 8 0"/><circle cx="24" cy="38" r="3"/></svg><span>Robo Coders</span></a>
  ${back}</header>`;

/** p: { done: Set, name(id) } — the shelf of three books */
export function renderShelf(el, p) {
  const count = (l) => { const ready = l.projects.filter((x) => x.lesson); return `${ready.filter((x) => p.done.has(x.lesson)).length} of ${l.projects.length} projects done`; };
  el.innerHTML = `<div class="hwash">${head('<a class="pill ghost" href="#/">All kits</a>')}
    <section class="hhero hwrap"><h1>Choose your book</h1>
      <p class="lede">Each Tech Explorers book adds a few new parts. Its projects use only the parts you have met so far.</p></section>
    <section class="shelf hwrap" aria-label="Books">${LEVELS.map((l) => `<article class="shelf-item">${cover(l, 'a')}
      <div><h2><a href="#/level/${l.n}">Level ${l.n}: ${esc(l.theme)}</a></h2><p>${esc(l.blurb)}</p>
      <p class="new">New parts: ${l.parts.map((id) => esc(p.name(id))).join(', ')}</p><small>${count(l)}</small></div></article>`).join('')}</section></div>`;
  return [];
}

/** n: level. p: { done: Set, name(id) } → img placeholders that want a 3D thumbnail: [{ el, model }] */
export function renderBook(el, n, p) {
  const l = bookOf(n);
  const ready = l.projects.filter((x) => x.lesson), finished = ready.filter((x) => p.done.has(x.lesson)).length;
  const kitDone = p.done.has('kit'), kitHref = `#/l${n}/lesson/kit`;
  const href = (x) => (x.build ? `#/l${n}/build/parts` : x.lesson ? `#/l${n}/lesson/${x.lesson}` : null);
  const proj = (x, i) => { const h = href(x), got = x.lesson && p.done.has(x.lesson);
    return `<li class="proj${h ? '' : ' soon'}"><${h ? `a href="${h}"` : 'div'} class="proj-in">
      <span class="proj-shot" data-thumb="${x.uses[0]}"></span>
      <span class="proj-txt"><i class="proj-n">Project ${i + 1}</i><b>${esc(x.title)}</b><small>${x.uses.map((id) => esc(p.name(id))).join(' + ')}</small></span>
      <span class="proj-st">${got ? 'Done' : h ? (x.build ? 'Build it' : 'Start') : 'Coming soon'}</span></${h ? 'a' : 'div'}></li>`; };
  el.innerHTML = `<div class="hwash lv${n}">${head('<a class="pill ghost" href="#/levels">All books</a>')}
    <section class="bhero hwrap">${cover(l)}
      <div><h1>Level ${n}: ${esc(l.theme)}</h1><p class="lede">${esc(l.blurb)}</p>
        <dl class="meters"><div><dt>Projects done</dt><dd>${finished} of ${l.projects.length}</dd><span class="m"><i style="width:${(finished / l.projects.length) * 100}%"></i></span></div></dl>
        <div class="acts">${(() => { if (!kitDone) return `<a class="pill amber big" href="${kitHref}">Start: Explore your kit</a>`; const next = l.projects.find((x) => href(x) && !(x.lesson && p.done.has(x.lesson))); return next ? `<a class="pill amber big" href="${href(next)}">${finished ? 'Continue' : 'Start'}: ${esc(next.title)}</a>` : ''; })()}
          <a class="pill ghost" href="#/l${n}/part/${l.parts[0]}">Explore the parts</a></div></div></section>
    <section class="hwrap bsec" aria-labelledby="lv-parts"><h2 id="lv-parts">New parts in this book</h2>
      <ul class="lv-parts">${l.parts.map((id) => `<li><a href="#/l${n}/part/${id}"><span class="proj-shot" data-thumb="${id}"></span><b>${esc(p.name(id))}</b></a></li>`).join('')}</ul></section>
    <section class="hwrap bsec" aria-labelledby="lv-proj"><h2 id="lv-proj">Projects</h2><ol class="projs"><li class="proj"><a href="${kitHref}" class="proj-in"><span class="proj-shot" data-thumb="base"></span><span class="proj-txt"><i class="proj-n">Chapter 1 · start here</i><b>Explore your kit</b><small>Every part in your kit box, in 3D</small></span><span class="proj-st">${kitDone ? 'Done' : 'Start'}</span></a></li>${l.projects.map(proj).join('')}</ol></section></div>`;
  return [...el.querySelectorAll('[data-thumb]')].map((d) => ({ el: d, model: d.dataset.thumb }));
}
