// Kit content: part blurbs (component pages) and lessons (one record each, one renderer).
// Ports come from the base-board schematic (Schematic_new jst esp32, 2026-06-25).

export const PARTS = {
  esp32: { blurb: 'The brain of the kit: a dual-core 240 MHz microcontroller with Wi-Fi and Bluetooth. It plugs into the socket in the middle of the base board.', features: ['Two cores, up to 240 MHz', 'Wi-Fi and Bluetooth on one chip', 'Every pin works at 3.3 V, not 5 V'] },
  power: { blurb: 'CA-1235 power module on the base board: turns the battery voltage into a steady 5 V rail.', features: ['In+/In− from the battery switch', 'Out+ is the 5 V rail'] },
  tb6612: { blurb: 'Dual H-bridge motor driver. Two channels (A and B) each drive one side of the robot forwards or backwards.', features: ['Drives two DC motors', 'Direction from AIN/BIN pins, speed from PWM', 'STBY pin wakes the chip'] },
  base: { blurb: 'The Robo Coders base board. Every module plugs into it with a JST-XH cable, so there is no breadboard wiring.', features: ['Comes with the ESP32 and the TB6612 motor driver seated', '4 input ports (D34–D39), 4 output ports (D13, D23, D32, D33)', 'Ultrasonic, I2C, UART, traffic-light, servo and motor ports'] },
  ultrasonic: { blurb: 'Measures distance with sound: TRIG sends a 40 kHz ping and ECHO reports how long the echo took.', features: ['Range about 2 cm to 4 m', 'Distance = time × speed of sound ÷ 2', 'Plugs into the ULTRASONIC port (TRIG D19, ECHO D18)'] },
  dht11: { blurb: 'Reads air temperature and humidity and sends both over a single data wire.', features: ['Temperature and humidity in one part', 'One reading per second at most'] },
  ldr: { blurb: 'Light-dependent resistor: its resistance drops as light gets brighter.', features: ['Analog output for light level', 'Trimmer sets the digital threshold'] },
  button: { blurb: 'A push button on its own board, ready to plug in.', features: ['Digital input: pressed or not', 'Resistor on board keeps the input steady'] },
  touch: { blurb: 'Capacitive touch pad: a finger on the pad switches the output, no moving parts.', features: ['Digital output', 'Works through thin plastic'] },
  ir: { blurb: 'Infrared obstacle sensor: an IR LED shines, and a receiver sees the reflection off nearby objects.', features: ['Emitter and receiver side by side', 'Trimmer sets the detection distance'] },
  mic: { blurb: 'Sound sensor with an electret microphone and a comparator that trips on loud sounds.', features: ['Detects claps and loud sounds', 'Trimmer sets the sensitivity'] },
  soil: { blurb: 'Two probes measure how well the soil conducts: wetter soil conducts better.', features: ['Probe plus comparator board', 'Analog and threshold output'] },
  rain: { blurb: 'Rain plate with interleaved tracks: water drops bridge the tracks and the reading changes.', features: ['Plate plus comparator board', 'Detects drops and wetness'] },
  buzzer: { blurb: 'Makes beeps and alarms. A transistor on the board switches the buzzer from a GPIO pin.', features: ['Driven by one output pin', 'Transistor switch on board'] },
  led: { blurb: 'One LED with its current-limiting resistor, ready to plug in (red, yellow or green).', features: ['Digital or PWM output', 'Resistor on board'] },
  traffic: { blurb: 'Red, yellow and green LEDs on one board, for traffic-light projects.', features: ['Three outputs: D23 red, D33 yellow, D32 green', 'Plugs into the RGY port'] },
  oled: { blurb: 'Small OLED screen that talks over I2C (two wires: SDA and SCL).', features: ['Text and graphics', 'I2C port: SDA D21, SCL D22'] },
  gas: { blurb: 'Gas sensor: a heated element changes resistance when it meets smoke or gas.', features: ['Needs a warm-up time', 'Analog and threshold output'] },
  servo: { blurb: 'A small motor that turns to an exact angle between 0° and 180°.', features: ['Angle set by a pulse width', 'Plugs into the SERVO header (signal D33)'] },
  battery: { blurb: 'Two-cell battery pack that powers the robot through the BAT connector and power switch.', features: ['Plugs into BAT', 'Switch SW1 turns the robot on'] },
  jst2: { blurb: 'Two wires with a white JST-XH plug on each end. It carries power: battery to BAT, and each motor to its motor port.', features: ['Black wire = pin 1, red wire = pin 2, straight through', 'Battery pack → BAT', 'TT motor → LEFT MOTOR (CN6, CN19) or RIGHT MOTOR (CN7, CN8)', 'The plug only fits one way round: latch up'] },
  jst3: { blurb: 'Three wires with a white JST-XH plug on each end. It joins a module to a board port: power, ground and one signal.', features: ['Black, red, orange: pins 1, 2, 3, straight through', 'Pin 3 carries the signal on the base board ports', 'LED, buzzer, button, touch, IR, mic, LDR, DHT11, gas, soil and rain modules'] },
  jst4: { blurb: 'Four wires with a white JST-XH plug on each end, for parts that need two signals.', features: ['Black, red, orange, yellow: pins 1 to 4, straight through', 'Ultrasonic sensor → ULTRASONIC (TRIG and ECHO)', 'OLED display → I2C (SDA and SCL)', 'Traffic light → RGY'] },
  wheel: { blurb: 'Rubber tyre on a yellow 5-spoke rim. It pushes onto the TT motor shaft.', features: ['About 65 mm across', 'Tread blocks for grip'] },
  chassis: { blurb: 'Two clear acrylic plates on brass standoffs, with four TT gear motors and wheels. The base board mounts on top.', features: ['4-wheel drive', 'Left wheels = motor A, right wheels = motor B', 'Turns by running the sides in opposite directions'] },
  jr_board: { blurb: 'The Jr. Explorer board needs no code. Plug an input module into an IP port and an output module into the matching OP port: when the input turns on, the output turns on. Two inputs together steer a motor.', features: ['4 inputs, 4 outputs, 4 indicator LEDs', 'Left and right motor connectors (CN2, CN1), forward and backward', 'L293D driver chip, 7805 5 V regulator, DC jack or battery'] },
  tt_motor: { blurb: 'Yellow geared DC motor that turns a wheel. The motor driver sets its direction and speed.', features: ['Gearbox for torque', 'Plugs into a LEFT/RIGHT MOTOR port'] },
};

// Friendly names for inspector clicks (node-name suffix → label)
export const PART_LABELS = {
  module: 'ESP32-WROOM-32 module', module_shield: 'ESP32-WROOM-32 module', antenna: 'PCB antenna', usb: 'USB port',
  btn_boot: 'BOOT button', btn_en: 'EN (reset) button', usb_uart: 'USB-to-serial chip', regulator: '3.3 V regulator',
  led_gpio2: 'Blue LED (GPIO 2)', plug_a: 'JST-XH plug', plug_b: 'JST-XH plug', wires: 'Wires', led_power: 'Power LED', plug: '2-pin JST-XH plug', cells: '2 cells', body: 'Circuit board', pcb: 'Circuit board',
};

// Base-board ports → GPIO, by connector pin (pin 3 = signal on 3-pin ports, from the schematic).
export const PORTS = {
  d13: { pins: { 3: 13 } }, d23: { pins: { 3: 23 } }, d32: { pins: { 3: 32 } }, d33: { pins: { 3: 33 } },
  d34: { pins: { 3: 34 } }, d35: { pins: { 3: 35 } }, d36: { pins: { 3: 36 } }, d39: { pins: { 3: 39 } },
  rgy: { pins: { 3: 23, 2: 33, 1: 32 }, roles: { 23: 'red', 33: 'yellow', 32: 'green' } }, // board silkscreen D23 – R, D33 – Y, D32 – G (Tech Explorers L2, p. 150)
  ultrasonic: { pins: { 3: 19, 2: 18 } }, i2c: { pins: { 1: 21, 2: 22 } }, servo: { pins: { 3: 33 } },
  bat: { pins: {} }, // battery input, switched by SW1
  motor_l1: { pins: {} }, motor_l2: { pins: {} }, motor_r1: { pins: {} }, motor_r2: { pins: {} }, // driven by the TB6612
};
export const PORT_LABEL = { bat: 'BAT', rgy: 'RGY', ultrasonic: 'ULTRASONIC', i2c: 'I2C', servo: 'SERVO', motor_l1: 'LEFT MOTOR (CN6)', motor_l2: 'LEFT MOTOR (CN19)', motor_r1: 'RIGHT MOTOR (CN7)', motor_r2: 'RIGHT MOTOR (CN8)' };
// Components strip order for kids: what thinks, what senses (inputs), what acts (outputs), what powers and moves, the robot body.
export const PART_GROUPS = [
  ['Brain', ['esp32', 'base', 'tb6612']],
  ['Cables', ['jst2', 'jst3', 'jst4']], // right after the brain: learn the connectors before plugging anything in
  ['Input', ['button', 'touch', 'ldr', 'mic', 'ir', 'ultrasonic', 'dht11', 'gas', 'soil', 'rain']],
  ['Output', ['led', 'traffic', 'buzzer', 'oled', 'servo']],
  ['Power & motion', ['battery', 'tt_motor', 'wheel']],
  ['Robot body', ['chassis']],
];
export const partGroup = (id) => { const i = PART_GROUPS.findIndex(([, ids]) => ids.includes(id)); return i < 0 ? [PART_GROUPS.length, 'Other', 0] : [i, PART_GROUPS[i][0], PART_GROUPS[i][1].indexOf(id)]; };
export const ANALOG_PARAM = { ldr: 'light', mic: 'sound', soil: 'moisture', rain: 'rain', gas: 'gas' };
const NAME = { ir: (m) => ({ d36: 'Left IR sensor module', d35: 'Right IR sensor module' }[m.port] || 'IR sensor module'), ldr: () => 'LDR sensor module', led: (m) => `${m.tint ? m.tint[0].toUpperCase() + m.tint.slice(1) : 'Red'} LED module`, buzzer: () => 'Buzzer module', button: () => 'Push button module',
  traffic: () => 'Traffic light module', ldr: () => 'LDR module', ultrasonic: () => 'Ultrasonic sensor', dht11: () => 'DHT11 module', servo: () => 'Servo', oled: () => 'OLED display', battery: () => '2-cell battery pack', tt_motor: (m) => `${/1$/.test(m.port) ? 'Front' : 'Rear'}-${/_l/.test(m.port) ? 'left' : 'right'} motor` };
export const moduleName = (m) => (NAME[m.id] || (() => m.id))(m);
export const portName = (p) => PORT_LABEL[p] || p.toUpperCase();

// Workbook routine (Robo Coders): wire → battery off → blocks → upload → battery on → observe
/** pins on the JST cable a module needs (jst2/jst3/jst4 in Components); 0 = it has its own lead (servo) */
export const cablePins = (m) => ({ battery: 2, servo: 0, tt_motor: 2, ultrasonic: 4, oled: 4, traffic: 4 }[m.id] ?? 3);
const withCable = (m) => (cablePins(m) ? `with a ${cablePins(m)}-pin JST cable` : 'with its own 3-wire lead');
export const steps = (l) => [
  ...(l.chassis ? ['Connect the 4 BO motors with 2-pin JST cables: left front → LEFT MOTOR slot 1, left back → LEFT MOTOR slot 2, right front → RIGHT MOTOR slot 1, right back → RIGHT MOTOR slot 2.'] : []),
  ...(l.kit.length || l.chassis ? withBattery(l.kit) : l.kit).map((m) => `Connect the ${moduleName(m)} to the ${portName(m.port)} port ${withCable(m)}.`),
  'Make sure the battery pack is unplugged from BAT (or SW1 is off) before uploading.',
  'Drag and drop the blocks in RC Studio (or use the C++ tab).',
  'Connect the ESP32 to the computer and upload the code.',
  'Disconnect the ESP32 from the computer, plug the battery pack into BAT and press SW1 on.',
  'Observe the output. Press ▶ to try it here first.',
];


/** Every kit project runs from the battery pack on the BAT connector. */
export const withBattery = (kit) => [...kit, { id: 'battery', port: 'bat' }];

// ================= JR. EXPLORER KIT (no code: L293D board, IPn → OPn) — workbook pp. 51–65 =================
// Parts that work on the board: anything that gives or takes a plain on/off 5 V signal. Comparator sensors (IR, LDR, mic,
// gas, soil, rain) pull DO LOW when they detect something, so on this board their output is ON until they detect it.
export const JR_PART_GROUPS = [
  ['Brain', ['jr_board']],
  ['Cables', ['jst2', 'jst3']], // the Jr board has no 4-pin port
  ['Input', ['button', 'touch', 'ldr', 'ir', 'mic', 'soil', 'rain', 'gas']],
  ['Output', ['led', 'buzzer']],
  ['Power & motion', ['battery', 'tt_motor']],
];
export const JR_PARTS = JR_PART_GROUPS.flatMap(([, ids]) => ids);
/** input modules whose DO is LOW when they detect something (the Jr output is on until then) */
export const JR_INVERTED = new Set(['ldr', 'ir', 'mic', 'soil', 'rain', 'gas']);
// how each part is used on the Jr board (shown on its component page in the Jr kit)
export const JR_NOTE = {
  button: 'Plug it into any IP socket with a 3-pin JST. While you hold it, the matching OP socket (and LED) is on.',
  touch: 'Works like the push button: touch the pad and the matching OP socket switches on.',
  ldr: 'Its signal is HIGH in the dark, so on this board the matching output is ON in the dark and OFF in bright light: a night light.',
  ir: 'Its signal goes LOW when something is close, so the matching output is ON until a hand comes near.',
  mic: 'Its signal goes LOW on a loud sound, so the matching output is ON while it is quiet and blinks OFF when you clap.',
  soil: 'Its signal is HIGH while the soil is dry, so the matching output is ON until you water the plant.',
  rain: 'Its signal is HIGH while the plate is dry, so the matching output is ON until rain drops land on it.',
  gas: 'Its signal is HIGH in clean air, so the matching output is ON until it smells gas or smoke.',
  led: 'Plug it into an OP socket with a 3-pin JST. It lights when that socket switches on.',
  buzzer: 'Plug it into an OP socket. The kit buzzer is active, so it beeps whenever that socket is on.',
  battery: 'Powers the board through a 2-pin JST cable into BAT (CN3). Switch SW1 off before plugging it in.',
  tt_motor: 'Plugs into LEFT MOTOR (CN2) or RIGHT MOTOR (CN1) with a 2-pin JST. IP1 turns the left motor one way, IP2 the other way (IP3 and IP4 for the right motor).',
  jst2: 'Battery → BAT (CN3), and each BO motor → LEFT MOTOR (CN2) or RIGHT MOTOR (CN1).',
  jst3: 'Every module on this kit: inputs into IP1–IP4, outputs into OP1–OP4. Pin 1 5 V, pin 2 GND, pin 3 signal.',
  jr_board: 'The robot\'s brain on this kit, with no code: input socket IPn switches output socket OPn.',
};
const JR_PORT = { ip1: 'IP1', ip2: 'IP2', ip3: 'IP3', ip4: 'IP4', op1: 'OP1', op2: 'OP2', op3: 'OP3', op4: 'OP4', cn2: 'LEFT MOTOR (CN2)', cn1: 'RIGHT MOTOR (CN1)', cn3: 'BAT (CN3)' };
const JR_NAME = { button: 'Push Button', touch: 'Touch sensor', ldr: 'LDR sensor', ir: 'IR sensor', mic: 'Mic sensor', soil: 'Soil sensor', rain: 'Rain sensor', gas: 'Gas sensor',
  buzzer: 'Buzzer', battery: 'battery', tt_motor: 'BO motor' };
export const jrName = (m) => (m.id === 'led' ? `${m.tint ? m.tint[0].toUpperCase() + m.tint.slice(1) : 'Red'} LED` : JR_NAME[m.id] || m.id);
export const jrWithBattery = (kit) => [{ id: 'battery', port: 'cn3' }, ...kit];
/** Workbook routine: SW1 off → battery → modules → SW1 on → press. Matches the lesson assembly (modules, then power-on, then observe). */
export const jrSteps = (l) => [
  ...jrWithBattery(l.kit).map((m) => (m.id === 'battery' ? 'Switch OFF the board (SW1 = OFF). Plug the battery into BAT (CN3) with a 2-pin JST cable.'
    : `Plug the ${jrName(m)} into ${JR_PORT[m.port]} ${withCable(m)}.`)),
  'Switch ON the board (SW1 = ON). The PLED glows: the board is awake.',
  l.try || 'Press the button and watch.',
];
const jl = (o) => ({ jr: true, blocks: { setup: [], loop: [] }, ...o });
/** Jr build guide: the circuit grows one part per step (each step's scene shows everything so far), workbook routine each time */
const BTN = { id: 'button', port: 'ip1' }, LED1 = { id: 'led', port: 'op1', tint: 'red' };
export const JR_BUILD = [
  jl({ id: 'jb-power', cardTitle: 'Power', thumb: 'battery', kit: [],
    heading: 'Power up the board', lede: 'Lay the board flat, printed side up: inputs IP1 to IP4 along the bottom edge, outputs OP1 to OP4 along the top, LEFT MOTOR (CN2) and RIGHT MOTOR (CN1) on the right, BAT (CN3) and SW1 on the left.',
    features: ['Battery: 2-pin JST into BAT (CN3)', 'Or a 7–12 V adapter in the DC jack (U3)', 'SW1 switches the board on: the PLED glows'],
    try: 'Switch SW1 off and on again and watch the PLED.', observation: 'The PLED glows whenever the board has power.' }),
  jl({ id: 'jb-input', cardTitle: 'Input', thumb: 'button', kit: [BTN],
    heading: 'Plug in an input', lede: 'Inputs go in the bottom row. The push button sends a signal to IP1 while you hold it, and LED1 on the board shows it even with nothing in OP1.',
    features: ['3-pin JST cable: button → IP1', 'Switch SW1 off before you plug anything in', 'LED1 on the board follows IP1'],
    try: 'Press and hold the button: LED1 on the board lights.', observation: 'LED1 lights only while you hold the button.' }),
  jl({ id: 'jb-output', cardTitle: 'Output', thumb: 'led', kit: [BTN, LED1],
    heading: 'Plug in an output', lede: 'Outputs go in the top row, above their inputs. An LED module in OP1 follows IP1, the matching rule: IP1 only ever switches OP1.',
    features: ['3-pin JST cable: LED module → OP1', 'IP1 → OP1, IP2 → OP2, and so on', 'Swap in the buzzer to make a horn'],
    try: 'Press the button: LED1 and the LED module light together.', observation: 'The LED module and LED1 turn on and off together.' }),
  jl({ id: 'jb-motors', cardTitle: 'Motors', thumb: 'tt_motor', kit: [BTN, { id: 'touch', port: 'ip2' }, { id: 'tt_motor', port: 'cn2' }, { id: 'tt_motor', port: 'cn1' }],
    heading: 'Add the motors', lede: 'Two BO motors, one on each motor connector. LEFT MOTOR (CN2) turns one way with IP1 and the other way with IP2; RIGHT MOTOR (CN1) the same with IP3 and IP4.',
    features: ['2-pin JST: left motor → LEFT MOTOR (CN2)', '2-pin JST: right motor → RIGHT MOTOR (CN1)', 'Button on IP1, touch sensor on IP2', 'Both inputs on: the motor brakes'],
    try: 'Hold the button, then touch the pad instead, then try both. The right motor waits for IP3 and IP4.', observation: 'The left motor turns one way, then the other, and stops when both are on.' }),
];
export const JR_LESSONS = [
  jl({ id: 'jr-meet', cardTitle: 'Meet the Jr. board', kit: [],
    heading: 'Meet the Junior Robotics kit', lede: 'The board is the robot\'s brain. Input sockets (IP1 to IP4) listen, output sockets (OP1 to OP4) act, and four built-in LEDs show every output.',
    features: ['Switch SW1 on: the PLED glows', 'Switch an input on below: its LED lights', 'IP1 lights only LED1, IP2 only LED2: the matching rule'],
    try: 'Switch an input on in the Try it panel and watch the matching LED.', observation: 'Each input lights only its own LED.' }),
  jl({ id: 'jr-glow-lamp', cardTitle: 'Project 1 · My Glow Lamp', kit: [{ id: 'button', port: 'ip1' }, { id: 'led', port: 'op1', tint: 'red' }],
    heading: 'Project 1: My Glow Lamp', lede: 'Make a glowing lamp by pressing and holding the button.',
    features: ['Circuit: Button (IP1) → LED (OP1)', 'Parts: Push Button, 1 LED (any colour)', 'Craft: paper, scissors, crayons, tape'],
    craft: ['Decorate an A4 sheet with colours, stars and patterns.', 'Roll the paper into a cone.', 'Tape the edge to hold the cone shape.', 'Cut a small hole at the tip for the LED to peek through.'],
    try: 'Place the LED inside the cone. Press and HOLD the button.', observation: 'The LED glows while you hold the button and goes dark when you let go.' }),
  jl({ id: 'jr-horn', cardTitle: 'Project 2 · Beep-Beep Horn', kit: [{ id: 'button', port: 'ip1' }, { id: 'buzzer', port: 'op1' }],
    heading: 'Project 2: Beep-Beep Horn', lede: 'Make a car horn that beeps when you press the button.',
    features: ['Circuit: Button (IP1) → Buzzer (OP1)', 'Parts: Push Button, Buzzer', 'Craft: cardboard, scissors, crayons, tape'],
    craft: ['Draw a large circle on cardboard and cut it out: your steering wheel.', 'Draw a smaller circle in the centre for the horn.', 'Decorate the wheel.', 'Tape the Buzzer into the centre circle.'],
    try: 'Hold the steering wheel and press the button.', observation: 'The buzzer beeps for as long as you press.' }),
  jl({ id: 'jr-twinkle', cardTitle: 'Project 3 · Twinkle Star', kit: [{ id: 'button', port: 'ip1' }, { id: 'led', port: 'op1', tint: 'yellow' }],
    heading: 'Project 3: Twinkle Star', lede: 'Make a star that twinkles when you tap the button again and again, or shines steadily when you hold it.',
    features: ['Circuit: Button (IP1) → LED (OP1)', 'Parts: Push Button, 1 LED (yellow recommended)', 'Craft: yellow paper, scissors, tape, pencil'],
    craft: ['Draw a large star on yellow paper.', 'Cut it out carefully.', 'Decorate it with glitter, dots or patterns.', 'Tape the LED behind the star.'],
    try: 'TAP the button quickly, then HOLD it down.', observation: 'Tapping makes the star twinkle; holding keeps it shining.' }),
  jl({ id: 'jr-matching', cardTitle: 'The matching rule', kit: [{ id: 'button', port: 'ip1' }, { id: 'led', port: 'op3', tint: 'red' }],
    heading: 'What happens when the rule is broken?', lede: 'Button in IP1, LED in OP3. IP1 controls only OP1, so the LED in OP3 stays dark.',
    features: ['IP1 → OP1, IP2 → OP2, IP3 → OP3, IP4 → OP4', 'They never mix', 'Fix it: move the LED to OP1'],
    try: 'Press the button. LED1 on the board lights, but the LED module in OP3 stays dark.', observation: 'Mismatch! Only the matching OP socket switches on.' }),
  jl({ id: 'jr-room-sign', cardTitle: 'To-do 1 · My Room Sign', kit: [{ id: 'button', port: 'ip1' }, { id: 'led', port: 'op1', tint: 'green' }],
    heading: 'To-do 1: My Room Sign', lede: 'Decorate a paper name-sign and make it glow with the LED behind it. Same circuit as My Glow Lamp.',
    features: ['Circuit: Button (IP1) → LED (OP1)', 'Write down the steps in your book', 'Draw the circuit diagram'],
    try: 'Press the button to light your sign.', observation: 'The sign glows while you press.' }),
  jl({ id: 'jr-colour-lamp', cardTitle: 'To-do 2 · Colour-Change Lamp', kit: [{ id: 'button', port: 'ip1' }, { id: 'led', port: 'op1', tint: 'green' }], colours: true,
    heading: 'To-do 2: Colour-Change Lamp', lede: 'Rebuild your Glow Lamp three times, swapping the Red, Green and Yellow LED, and pick your favourite colour.',
    features: ['Circuit: Button (IP1) → LED (OP1), same every time', 'Swap the LED with SW1 OFF', 'Try all three colours'],
    try: 'Pick a colour in the Try it panel, then press the button.', observation: 'Same circuit, a different colour each time.' }),
  jl({ id: 'jr-touch-lamp', cardTitle: 'Touch Lamp', kit: [{ id: 'touch', port: 'ip1' }, { id: 'led', port: 'op1', tint: 'red' }],
    heading: 'Touch Lamp', lede: 'Swap the push button for the touch sensor: a gentle touch on the pad lights the lamp.',
    features: ['Circuit: Touch (IP1) → LED (OP1)', 'No moving parts: your finger is the switch', 'Works through thin paper too'],
    try: 'Touch the pad on the touch sensor (press and hold it).', observation: 'The LED glows while your finger is on the pad.' }),
  jl({ id: 'jr-night-light', cardTitle: 'Night Light', kit: [{ id: 'ldr', port: 'ip1' }, { id: 'led', port: 'op1', tint: 'yellow' }],
    heading: 'Night Light', lede: 'The LDR sensor watches the light. In the dark its signal is ON, so the LED in OP1 switches on by itself.',
    features: ['Circuit: LDR (IP1) → LED (OP1)', 'Bright room: LED off', 'Dark room: LED on'],
    try: 'Move the Light slider in the Try it panel down to make the room dark.', observation: 'The LED comes on when it gets dark.' }),
  jl({ id: 'jr-plant', cardTitle: 'Water Me! Plant Alarm', kit: [{ id: 'soil', port: 'ip1' }, { id: 'buzzer', port: 'op1' }],
    heading: 'Water Me! Plant Alarm', lede: 'Push the soil probe into a plant pot. While the soil is dry the buzzer beeps; water the plant and it goes quiet.',
    features: ['Circuit: Soil sensor (IP1) → Buzzer (OP1)', 'Dry soil: beep!', 'Wet soil: quiet'],
    try: 'Move the Soil wetness slider up to water the plant.', observation: 'The buzzer stops once the soil is wet enough.' }),
  jl({ id: 'jr-motor', cardTitle: 'Forward and Back Motor', kit: [{ id: 'button', port: 'ip1' }, { id: 'touch', port: 'ip2' }, { id: 'tt_motor', port: 'cn2' }],
    heading: 'Forward and Back Motor', lede: 'A BO motor on LEFT MOTOR (CN2) listens to two inputs: IP1 turns it one way, IP2 the other way. Press both and it stops.',
    features: ['Circuit: Button (IP1) + Touch (IP2) → BO motor (LEFT MOTOR)', 'IP1 alone: forward', 'IP2 alone: backward', 'Both: brake'],
    try: 'Hold the button, then touch the pad instead, then try both.', observation: 'The wheel shaft turns one way, then the other, and stops when both are on.' }),
];
