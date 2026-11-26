// Robo Coders comparator sensor boards (gas, mic): part notes, silkscreen artwork and sensor behaviour.
// Layouts from the boards' EasyEDA top views; circuits from their schematics (LM393, R6 trimmer, S/P LEDs, U13 XH: VCC, GND, DO).

/** YUGMINDS logo as white silkscreen; wait for LOGO.decode() before drawing the decals */
export const LOGO = typeof Image === 'undefined' ? {} : Object.assign(new Image(), { src: '/logos/yugminds_white.png' });

// parts every comparator board has
const COMMON = (what) => ({
  pot: ['R6 threshold trimmer', 'Turn the screw to set the trip level. The LM393 compares the sensor voltage with this level and switches DO.'],
  led_signal: ['S · signal LED', `Lights when DO goes LOW, that is when ${what} is above the threshold.`],
  led_power: ['P · power LED', 'On whenever the module has power.'],
  lm393: ['LM393 comparator (underside)', `Compares the sensor voltage with the trimmer voltage and drives DO: LOW = ${what}, HIGH = nothing.`],
  pin1: ['VCC', '5 V supply.'],
  pin2: ['GND', 'Ground.'],
  pin3: ['DO', `Digital out: LOW when ${what} is above the threshold, HIGH otherwise. This is the only signal on the connector.`],
  xh: ['U13 · JST-XH connector', 'Pin 1 VCC, pin 2 GND, pin 3 DO (top to bottom on the silkscreen). The kit cable plugs in from the board edge.'],
});

/** MQ-2 with load resistor = R0: Rs/R0 runs from ~9.8 (clean air) down to ~0.3 (dense smoke), log scale.
 *  gas 0..100 % → AO volts. Simplified from the MQ-2 datasheet curves. */
export function mq2(gas, vcc = 5) {
  const ratio = 9.8 * (0.3 / 9.8) ** (Math.min(100, Math.max(0, gas)) / 100);
  return vcc / (1 + ratio);
}

// silkscreen + traces as one canvas decal over the board top; art(h) gets drawing helpers in board mm
const TR = 'rgba(70,120,230,.45)', SILK = '#f4f6ff';
function decal(cx, cy, W, D, art, z = 1.605) { // canvas centred on (cx, cy) model mm; art draws in coordinates relative to that centre
  return {
    at: [cx, cy, z], size: [W, D], px: 40,
    draw(g, w, h) {
      const mm = w / W, X = (x) => w / 2 + x * mm, Y = (y) => h / 2 - y * mm;
      const line = (pts, width = 0.5, c = TR) => { g.strokeStyle = c; g.lineWidth = width * mm; g.lineCap = g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.stroke(); };
      const ring = (x, y, r, width = 0.18, c = SILK) => { g.strokeStyle = c; g.lineWidth = width * mm; g.beginPath(); g.arc(X(x), Y(y), r * mm, 0, 7); g.stroke(); };
      const text = (t, x, y, size, rot = 0, weight = 700, align = 'center', c = SILK) => { g.save(); g.fillStyle = c; g.textAlign = align; g.textBaseline = 'middle'; g.translate(X(x), Y(y)); g.rotate(rot); g.font = `${weight} ${size * mm}px "Barlow Condensed", sans-serif`; g.fillText(t, 0, 0); g.restore(); };
      const rect = (x, y, rw, rh) => { g.strokeStyle = SILK; g.lineWidth = 0.18 * mm; g.strokeRect(X(x), Y(y), rw * mm, rh * mm); }; // top-left corner
      const pad = (x, y, r, square) => { g.fillStyle = '#c9a046'; g.beginPath(); square ? g.rect(X(x - r), Y(y + r), 2 * r * mm, 2 * r * mm) : g.arc(X(x), Y(y), r * mm, 0, 7); g.fill(); g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(X(x), Y(y), r * 0.45 * mm, 0, 7); g.fill(); };
      const logo = (x, y, s, rot = 0) => { if (!LOGO.naturalWidth) return; g.save(); g.translate(X(x), Y(y)); g.rotate(rot); g.drawImage(LOGO, -s / 2 * mm, -s / 2 * mm, s * mm, s * mm); g.restore(); };
      const fill = (x, y, rw, rh, c, r = 0) => { g.fillStyle = c; g.beginPath(); g.roundRect(X(x), Y(y), rw * mm, rh * mm, r * mm); g.fill(); };
      const mark = (x, y, s, rot = 0) => { if (!LOGO.naturalWidth) return; const k = LOGO.naturalWidth / 351; g.save(); g.translate(X(x), Y(y)); g.rotate(rot); g.drawImage(LOGO, 42 * k, 0, 264 * k, 259 * k, -s / 2 * mm, -s / 2 * mm, s * mm, s * mm); g.restore(); }; // the circle emblem only (rows 0-259 of the logo; the word is below)
      art({ line, ring, text, rect, pad, logo, fill, mark });
    },
  };
}
const board = (W, D, art) => [decal(0, 0, W, D, art)];

// Robo Coders A-D board (mic, soil, rain share it; only the title changes). Positions from its EasyEDA top view, 22.1 px/mm.
const adBoard = (title) => board(30.4, 20.2, ({ line, ring, text, rect, pad, logo }) => {
  line([[-10.7, 0.1], [-5.3, 0.1], [-2.4, 2.8], [-0.8, 4.2]]); line([[-10.7, -0.5], [-5.0, -0.5], [-2.0, 2.3], [-0.3, 2.3]]);
  line([[9.3, 7.0], [8.8, 6.2], [9.0, 5.4]]); line([[9.3, -6.1], [8.8, -5.3], [9.0, -4.7]]);
  ring(4.2, -0.1, 0.35, 0.3, 'rgba(120,150,210,.9)');
  pad(-12.2, 8.4, 0.85); pad(-12.2, -7.6, 0.75, true);               // unlabelled pads (net unknown)
  rect(-13.3, 3.7, 2.6, 5.0);                                         // H1
  logo(-5.9, 4.0, 4.6);
  text('ROBOCODERS', 0.05, -3.4, 1.2, 0, 800);
  text(title, 0, -8.6, 1.35);
  [['VCC', 2.8], ['GND', 0.2], ['DO', -2.5]].forEach(([t, y]) => text(t, 8.2, y, 0.75, 0, 600, 'right'));
  rect(9.3, 8.9, 4.8, 1.9); rect(9.3, -6.1, 4.8, 2.0); rect(8.6, 5.6, 6.2, 10.3);  // S, P LEDs, U13
  text('S', 8.0, 8.0, 1.3); text('P', 8.2, -6.9, 1.3);
  rect(-1.95, 7.9, 7.3, 7.3); text('R6', 3.9, 6.4, 1.2);
});

// resistive probes (soil fork, rain comb) on H1: R4 10 kΩ pull-up to 5 V, probe to GND. Water lowers the probe resistance.
// level 0..100 % wet → H1 volts: dry ≈ 1 MΩ (4.95 V), 50 % ≈ 10 kΩ (2.5 V), soaked ≈ 100 Ω (0.05 V). ponytail: log-linear guess, no datasheet curve.
export function probe(level) {
  const rp = 10e3 * 10 ** ((50 - Math.min(100, Math.max(0, level))) / 25);
  return 5 * rp / (rp + 10e3);
}
/** GL5528-style LDR on H1 (R4 10 kΩ pull-up). light 0..100 % → 0.1..10 000 lux (log), R = 15 kΩ at 10 lux, gamma 0.7.
 *  → H1 volts: dark ≈ 377 kΩ (4.87 V), bright ≈ 120 Ω (0.06 V). ponytail: typical datasheet values, not this part's. */
export function ldrVolts(light) { return ldrAt(roomLux(light)).v; }
/** room light slider 0..100 % → lux on a log scale: 0 % ≈ 0.1 lux (dark room), 60 % = 100 lux (living room), 100 % = 10 000 lux */
export const roomLux = (light) => 0.1 * 10 ** (Math.min(100, Math.max(0, light)) / 20);
/** the LDR module at `lux`: LDR resistance (Ω) and H1/AO volts with R4 (10 kΩ) pulling up to vcc. More light → lower volts. */
export function ldrAt(lux, vcc = 5) {
  const r = 15e3 * (Math.max(0.01, lux) / 10) ** -0.7;
  return { r, v: vcc * r / (r + 10e3) };
}
/** what the ESP32's 12-bit ADC reads for `v` volts (full scale ≈ 3.3 V at 11 dB). ponytail: linear; the real ESP32 ADC bends near 0 V and 3.3 V. */
export const adcCounts = (v) => Math.round(Math.min(1, Math.max(0, v / 3.3)) * 4095);
/** IR obstacle: IR1 shines up, CGQ1 collects the reflection and pulls the R4 node down.
 *  d cm above the LEDs, white surface reflects ~100 %, black ~15 % → node volts. ponytail: 1/d² reflection, gain fitted so
 *  white paper trips at ~11 cm with R6 at 2.5 V; real range depends on the parts and the light around. */
export function irVolts(d, white = true) {
  const r = (white ? 1 : 0.15) * (3 / Math.max(0.5, d)) ** 2;
  return 5 / (1 + 13.4 * r);
}
const WET = (what) => ({
  h1: ['H1 · probe socket', `2-pin female header: pin 2 to the ${what} and the R4 pull-up, pin 1 to GND.`],
  jumper: ['2-wire jumper', `Joins H1 on the board to the ${what}. The two wires carry the probe current; polarity does not matter.`],
});

/** TTP223 output. st = { q, last, tog (J1 closed), ahlb (J2 closed) }; call when the touch state changes.
 *  J1 open: OUT follows the finger; closed: each new touch flips OUT. J2 closed inverts OUT (active LOW). */
export function ttp223(st, touching) {
  if (st.tog && touching && !st.last) st.q ^= 1;
  st.last = touching;
  return (st.tog ? st.q : +touching) ^ st.ahlb;
}

/** DHT11 data frame: 40 bits = humidity int, humidity dec, temperature int, temperature dec, checksum (low 8 bits of the sum).
 *  The DHT11 reports whole numbers (dec bytes 0); ±2 °C and ±5 %RH. */
export function dht11Frame(t, rh) {
  const b = [Math.round(rh), 0, Math.round(t), 0];
  return [...b, (b[0] + b[1] + b[2] + b[3]) & 0xff];
}
/** HC-SR04: echo time for an object d cm away (sound 343 m/s at 20 °C, there and back) and the distance code works out. */
export const echoUs = (cm) => (2 * cm) / 0.0343;
export const usToCm = (us) => (us * 0.0343) / 2;
/** SG90 control: one pulse every 20 ms (50 Hz); 1.0 ms = 0°, 1.5 ms = 90°, 2.0 ms = 180° (datasheet nominal). */
export const servoPulseMs = (deg) => 1 + Math.min(180, Math.max(0, deg)) / 180;
/** JR. EXPLORER board: the L293D copies each input to its output while SW1 is on (ENABLE1/2 tied high).
 *  ip: [IP1..IP4] (1 = the input module is HIGH). Left motor on CN2 = OP1 vs OP2, right motor on CN1 = OP3 vs OP4:
 *  1 forward, -1 backward, 0 off, 'brake' when both sides are HIGH. */
export function jrBoard(ip, power) {
  const op = ip.map((v) => (power && v ? 1 : 0));
  const motor = (a, b) => (a && b ? 'brake' : a ? 1 : b ? -1 : 0);
  return { op, motorA: motor(op[0], op[1]), motorB: motor(op[2], op[3]) };
}
const LED_DECALS = {}; // one artwork per LED colour (the title names it)

const jrPart = {
  u1: ['U1 · L293D motor driver', 'Four half-bridges in one chip. Each input IPn switches its output OPn to 5 V with enough current for a motor, an LED or a buzzer. There is no program: the wiring is the logic.'],
  u2: ['U2 · 7805 regulator', 'Turns the battery or adapter voltage (7–12 V) into a steady 5 V for the whole board. C1 and C2 keep it calm.'],
  sw1: ['SW1 · power switch', 'Push to switch the board on, push again for off. Click it to try.'],
  u3: ['U3 · DC power jack', 'Plug a 9 V adapter or battery clip here. BAT (CN3) is the same input as a 2-pin connector.'],
  cn3: ['BAT (CN3) · battery input', '2-pin connector in parallel with the DC jack.'],
  c3: ['C3 · reservoir capacitor', '100 µF: a small reservoir of charge next to the L293D, so motors starting up do not make the 5 V dip.'],
  pled: ['PLED · power LED', 'Lights through R2 (1 kΩ) whenever the board is on.'],
  r1: ['R1 · 1 kΩ', 'Shared current limiter for LED1 to LED4.'],
  r2: ['R2 · 1 kΩ', 'Current limiter for the power LED.'],
  caps: ['Capacitors', 'C1/C2 smooth the 7805 regulator, C4/C5 sit across the motor connectors to soak up motor noise.'],
  cn1: ['CN1 · right motor', 'A TT motor here spins when OP3 or OP4 is on: IP3 one way, IP4 the other way.'],
  cn2: ['CN2 · left motor', 'A TT motor here spins when OP1 or OP2 is on: IP1 one way, IP2 the other way.'],
  ...Object.fromEntries([1, 2, 3, 4].flatMap((n) => [
    [`ip${n}`, [`IP${n} · input port`, `Plug a button, touch, IR or light sensor here. Pin 1 5 V, pin 2 GND, pin 3 signal to L293D input ${n}. Click to switch it on or off.`]],
    [`op${n}`, [`OP${n} · output port`, `Follows IP${n}: 5 V when IP${n} is HIGH. Plug an LED or buzzer module here. LED${n} on the board shows it too.`]],
    [`led${n}`, [`LED${n}`, `Lights when OP${n} is on, so you can see every output even with nothing plugged in.`]],
  ])),
};
export const SENSORS = {
  gas: {
    input: 'Gas / smoke', signal: 'AO', warm: 3000, // ponytail: 3 s stand-in for the real ~1 min warm-up
    glow: [['heater', 0xff5a1a, 'element', 10]],
    read: (g) => mq2(g),
    say: (hit) => (hit ? 'gas detected, S LED on' : 'clean air'),
    focus: { mq: ['mq_base', 'mq_cap', 'mq_top'] }, anchor: { mq: 'element' }, alias: { element: 'heater' }, group: /^mq_/,
    part: {
      mq: ['MQ-2 gas sensor', 'A tin-oxide bead inside the steel mesh is heated to about 300 °C. Smoke, LPG or other burnable gas lowers its resistance, so the AO voltage goes up. The double mesh stops the hot bead from lighting the gas.'],
      heater: ['Heater and sensing bead', 'The heater needs a warm-up (about a minute on the real part, 24–48 h for a brand-new one) before the readings settle.'],
      ...COMMON('gas'),
    },
    decals: board(44, 33, ({ line, ring, text, rect, logo }) => {
      line([[-6.6, 2.9], [2.0, 2.9]]); line([[9.6, -3.8], [12.6, -3.8], [14.2, -2.4]]); line([[18.6, 9.0], [18.6, 5.2]]);
      line([[18.6, -8.0], [18.6, -4.6]]); line([[8.4, -11.3], [14.8, -9.4]]);
      [[2.0, 2.9], [9.6, -3.8], [3.5, -0.8]].forEach(([x, y]) => ring(x, y, 0.45, 0.3, 'rgba(120,150,210,.9)'));
      ring(-11.6, 0, 10.6, 0.22); ring(-16.9, 9.5, 0.6);                // U1 outline, pin-1 mark
      text('U1', -13.4, 7.4, 1.4, 0, 600);
      text('GAS SENSOR', -10.9, -12.6, 1.7);
      text('ROBOCODERS', 4.8, -1.4, 1.45, 0, 800);
      logo(6.9, 5.7, 6.2);
      [['VCC', 2.6], ['GND', 0.1], ['DO', -2.4]].forEach(([t, y]) => text(t, 15.0, y, 0.85, 0, 600, 'right'));
      rect(14.8, 11.4, 4.2, 2.0); rect(14.8, -8.4, 4.2, 2.0);           // S, P LEDs
      text('S', 16.3, 7.9, 1.3, Math.PI / 2); text('P', 16.4, -11.8, 1.3, Math.PI / 2);
      rect(2.0, -7.4, 7.2, 8.0); text('R6', 3.9, -14.7, 1.2, Math.PI);
    }),
  },
  mic: {
    input: 'Sound level', signal: 'Mic peak', warm: 0, clap: true,
    read: (level) => (Math.min(100, Math.max(0, level)) / 100) * 5, // ponytail: peak volts linear in level; real capsules are logarithmic (dB)
    say: (hit) => (hit ? 'loud sound, S LED on' : 'quiet'),
    focus: { mic: ['mic', 'mic_felt'] }, anchor: {}, alias: { mic_felt: 'mic', mic_legs: 'mic' },
    part: {
      mic: ['Electret microphone', 'Soldered straight onto the board (H1 pads), sound hole facing up. A thin charged film behind the felt moves with the air pressure of sound. R4 (10 kΩ) feeds it from VCC, so sound makes its voltage wobble.'],
      ...COMMON('sound'),
    },
    decals: adBoard('MIC SENSOR'),
  },
  ir: {
    input: 'Obstacle distance', unit: 'cm', range: [1, 20, 0.5], start: 20, signal: 'CGQ1', warm: 0, low: true, surface: true,
    read: (d, st) => irVolts(d, st.white),
    say: (hit) => (hit ? 'obstacle detected, S LED on' : 'nothing in front'),
    wet: ['obstacle', [-23.9, 1.15]],
    glow: [['ir_led', 0x8a5cff, 'ir_led', 8]],
    focus: { ir_led: ['ir_led', 'ir_led_frame'], receiver: ['receiver', 'receiver_frame'] }, anchor: {},
    alias: { ir_led_legs: 'ir_led', ir_led_frame: 'ir_led', ir_led_die: 'ir_led', receiver_legs: 'receiver', receiver_frame: 'receiver', receiver_die: 'receiver' },
    part: {
      ir_led: ['IR1 · infrared LED', 'Bent 90° to shine forward, out of the board edge. Sends invisible infrared light (about 940 nm) through R3 (100 Ω). It is on whenever the board has power; a phone camera shows it as a faint purple glow, drawn here the same way.'],
      receiver: ['CGQ1 · IR phototransistor', 'Bent forward next to IR1. Dark smoky epoxy works as a filter: it blocks most visible light and lets infrared in (the lead frame just shows through). Reflected IR turns it on, pulling the R4 node toward GND. White things reflect a lot, black things very little, so black objects are seen only up close.'],
      ...COMMON('an obstacle'),
    },
    decals: adBoard('IR SENSOR'),
  },
  ldr: {
    input: 'Light', signal: 'H1', warm: 0, low: true, read: ldrVolts,
    say: (hit) => (hit ? 'bright, S LED on' : 'dark'),
    wet: ['light', [-12.1, 1.35, 6.0]],
    focus: { ldr: ['ldr', 'ldr_cds', 'ldr_comb'] }, anchor: {}, alias: { ldr_cds: 'ldr', ldr_comb: 'ldr', ldr_legs: 'ldr' },
    part: {
      ldr: ['LDR (light-dependent resistor)', 'A film of cadmium sulphide between two silver combs. Light frees electrons in the film, so its resistance drops from about 1 MΩ in the dark to a few hundred ohms in sunlight. Soldered straight onto the H1 pads, face up.'],
      ...COMMON('light'),
    },
    decals: adBoard('LDR SENSOR'),
  },
  soil: {
    input: 'Soil moisture', signal: 'H1', warm: 0, low: true, read: probe,
    say: (hit) => (hit ? 'wet soil, S LED on' : 'dry soil'),
    wet: ['soil', [-84, -12, -50, 14]],
    focus: { probe: ['probe', 'probe_a', 'probe_b'], jumper: ['jumper_a', 'jumper_b', 'wire_red', 'wire_black'] }, anchor: { jumper: 'h1' },
    alias: { probe_a: 'probe', probe_b: 'probe', probe_header_holes: 'probe_header', jumper_a: 'jumper', jumper_b: 'jumper', wire_red: 'jumper', wire_black: 'jumper', h1_holes: 'h1' },
    part: {
      probe: ['Soil probe (fork)', 'Two gold-plated prongs go into the soil. Water between them lets current flow, so wetter soil means lower resistance and a lower voltage at H1. Gold plating slows corrosion, but do not leave it powered in wet soil for days.'],
      probe_header: ['Probe socket', 'Right-angle 2-pin header lying flat at the top of the fork, facing the board; the jumper plugs straight in.'],
      ...WET('soil probe'), ...COMMON('wet soil'),
    },
    decals: [...adBoard('A-D SENSOR'), decal(-49, 1.05, 7, 7, ({ logo }) => logo(0, 0, 5, Math.PI / 2))],
  },
  rain: {
    input: 'Rain / wetness', signal: 'H1', warm: 0, low: true, read: probe,
    say: (hit) => (hit ? 'rain drops, S LED on' : 'dry plate'),
    wet: ['drops', [-70.5, -8.9, -45, 12.1]],
    focus: { plate: ['plate', 'comb'], jumper: ['jumper_a', 'jumper_b', 'wire_red', 'wire_black'] }, anchor: { plate: 'comb', jumper: 'h1' },
    alias: { comb: 'plate', jumper_a: 'jumper', jumper_b: 'jumper', wire_red: 'jumper', wire_black: 'jumper', h1_holes: 'h1' },
    part: {
      plate: ['Rain plate', 'Two interleaved combs of copper tracks. A rain drop that lands across two neighbouring fingers joins them, so the more water on the plate, the lower the resistance and the voltage at H1.'],
      plate_h1: ['Plate socket (H1)', '2-pin right-angle header on the plate; the jumper plugs in here.'],
      ...WET('rain plate'), ...COMMON('rain'),
    },
    decals: [...adBoard('A-D SENSOR'), decal(-57.7, 1.1, 33.2, 26.7, ({ text }) => {
      text('ROBOCODERS | YUGMINDS PRIVATE LIMITED', -15.0, 0, 0.85, Math.PI / 2, 700);
      text('H1', 12.9, 0.4, 0.9, -Math.PI / 2, 600);
    })],
  },
  servo: {
    servo: true,
    focus: { body: ['body', 'tabs', 'gears', 'motor'], horn: ['horn', 'shaft'], lead: ['wire_gnd', 'wire_vcc', 'wire_signal', 'plug'] }, anchor: {},
    alias: { tabs: 'body', gears: 'gears', motor: 'motor', shaft: 'horn', horn_holes: 'horn', wire_gnd: 'lead', wire_vcc: 'lead', wire_signal: 'lead', plug: 'lead', plug_holes: 'lead', gnd: 'lead', vcc: 'lead', signal: 'lead' },
    part: {
      body: ['SG90 micro servo', '9 g hobby servo: a small DC motor, a gear train and a position sensor in one blue case. It turns its output to the angle you ask for, 0–180°, and holds it. About 1.8 kg·cm at 4.8 V; 0.1 s per 60°.'],
      horn: ['Horn and output shaft', 'The white horn pushes onto the splined shaft (a small screw holds it). Attach arms, flags or a sensor to it. Click the angle below to turn it.'],
      gears: ['Gear train', 'Nylon gears slow the fast motor down about 300 : 1, trading speed for force. Under the output gear sits a potentiometer that tells the servo chip the current angle.'],
      motor: ['DC motor', 'The tiny motor at the far end. The servo chip runs it forward or backward until the potentiometer reads the angle you asked for, then stops.'],
      lead: ['3-wire lead and plug', 'Brown = GND, red = VCC (4.8–6 V), orange = signal. The black 3-pin plug pushes onto the SERVO header on the base board (signal D33).'],
    },
    decals: [{ ...decal(-1.0, -6.12, 18, 11, ({ fill, text }) => {
      fill(-9, 5.5, 18, 11, '#121212', 0.6); fill(-8.2, 4.7, 16.4, 6.6, '#f2d43a', 0.3);
      text('Micro Servo', 0, 2.8, 2.3, 0, 700, 'center', '#121212'); text('9g', 0, 0.2, 2.3, 0, 700, 'center', '#121212');
      text('SG90', 0, -3.4, 2.4, 0, 700, 'center', '#f2d43a');
    }, 8.5), face: 'front' }],
  },
  jr_board: {
    jr: true,
    callouts: ['u1', 'u2', 'sw1', 'u3', 'c3', 'pled', 'led1'],
    key: (k) => { const m = k.match(/^(op|ip|led|cn)(\d)/); if (m) return m[1] + m[2]; if (/^(c[1245])$/.test(k)) return 'caps'; return k.replace(/_(legs|notch|top|tab|cap|hole|pin|frame|die)$/, ''); },
    focus: {}, anchor: {}, part: jrPart,
    decals: [decal(0, 0, 81.3, 50.7, ({ line, ring, text, rect, mark }) => {
      [[-9.3, 19.7], [3.22, 19.7], [15.35, 19.7], [27.6, 19.7]].forEach(([x, y], i) => { rect(x - 5.2, y + 2.6, 10.4, 5.4); text(`OP${i + 1}`, x, y + 4.3, 1.5, 0, 600); line([[x + 2.54, y], [x + 2.54, 14.6], [[-0.52, 6.69, 14.03, 21.28][i], 13.3]]); });
      [[-10.19, -19.82], [2.05, -19.82], [14.19, -19.82], [26.3, -19.82]].forEach(([x, y], i) => { rect(x - 5.2, y + 2.6, 10.4, 5.4); text(`IP${i + 1}`, x, y + 5.6, 1.5, 0, 600); line([[x + 2.54, y], [x + 2.54, -15.5], [-7.0 + i * 5.1, -12.1]]); });
      [-0.52, 6.69, 14.03, 21.28].forEach((x, i) => { ring(x, 10.64, 2.8, 0.22); text(`LED${i + 1}`, x, 6.4, 1.4, 0, 600); });
      rect(-8.6, -2.2, 21.4, 7.9); text('U1', 2.06, -6.2, 1.3, 0, 600);
      ring(18.03, -6.16, 3.4, 0.22); text('+', 15.4, -2.4, 1.3, 0, 600);
      rect(27.8, 9.6, 6.6, 7.0); text('CN1', 29.0, 6.1, 1.1, Math.PI / 2, 600); text('RIGHT MOTOR', 26.6, 6.1, 1.3, Math.PI / 2, 700);
      rect(27.8, -5.5, 6.6, 7.0); text('CN2', 29.0, -9.0, 1.1, Math.PI / 2, 600); text('LEFT MOTOR', 26.6, -9.0, 1.3, Math.PI / 2, 700);
      rect(-37.6, 2.4, 5.6, 7.0); text('CN3', -36.4, -1.2, 1.1, Math.PI / 2, 600); text('BAT', -39.6, -1.2, 1.3, -Math.PI / 2, 700);
      text('PLED', -9.3, 9.6, 0.9, -Math.PI / 2, 600); text('R2', -28.9, 6.0, 1.0, 0, 600); text('C1', -26.3, 10.0, 1.0, Math.PI / 2, 600); text('C2', -25.8, 21.1, 1.0, Math.PI / 2, 600);
      text('R1', 17.3, -1.4, 1.0, 0, 600); text('U2', -29.5, 15.8, 1.2, Math.PI / 2, 600); text('SW1', -34.4, 4.0, 1.1, 0, 600);
      rect(-40.6, -8.1, 15.1, 9.0); text('U3', -30.0, -9.7, 1.2, 0, 600); text('POWER', -29.7, -19.1, 1.3, 0, 700);
      text('JR. EXPLORER KIT', -21.9, 8.2, 3.0, -Math.PI / 2, 800);
      text('NON-PROGRAMMABLE', -19.3, 12.9, 1.25, -Math.PI / 2, 700); text('BOARD', -17.6, 19.3, 1.25, -Math.PI / 2, 700);
      mark(-20.6, -7.6, 9.1, -Math.PI / 2);                           // turned to read with the vertical text, as in the render                                          // emblem, with the name printed once beside it (as on the layout)
      text('YUGMINDS', -12.6, -8.6, 2.5, -Math.PI / 2, 800);
      text('ROBOCODERS | YUGMINDS PRIVATE LIMITED', 36.0, -0.4, 1.45, -Math.PI / 2, 800);
    })],
  },
  ultrasonic: {
    sonar: true,
    wet: ['obstacle', [-24.6, 0, true, 0.25, 3]], // card x = -24.6 - 3 - 0.25 mm per cm
    focus: { us_pcb: ['us_pcb', 'transmitter', 'receiver', 'crystal', 'chips'], header: ['header', 'header_legs', 'us_spacer'] }, anchor: {},
    alias: { transmitter_mesh: 'transmitter', receiver_mesh: 'receiver', crystal: 'us_pcb', chips: 'us_pcb', header_legs: 'header', us_spacer: 'header' },
    part: {
      us_pcb: ['HC-SR04 module', 'Ultrasonic range finder, 2 cm to 4 m. A 10 µs pulse on TRIG makes it send eight 40 kHz clicks; ECHO then stays HIGH until the echo comes back. Distance = time × 0.0343 cm/µs ÷ 2.'],
      transmitter: ['T · transmitter', 'A piezo disc that clicks eight times at 40 kHz, far too high for people to hear.'],
      receiver: ['R · receiver', 'A piezo microphone tuned to 40 kHz that hears the echo bouncing back.'],
      header: ['4-pin socket', 'The HC-SR04 plugs in here from the top, standing up and facing forward: VCC, TRIG, ECHO, GND.'],
      pin1: ['GND', 'Ground.'], pin2: ['ECHO', 'HIGH for as long as the sound took to go and come back. Base board: D18.'],
      pin3: ['TRIG', 'A 10 µs HIGH pulse starts a measurement. Base board: D19.'], pin4: ['VCC', '5 V supply.'],
      xh: ['CN8 · JST-XH connector', '4-pin side-entry XH: VCC, TRIG, ECHO, GND from top to bottom. Plugs into the ULTRASONIC port.'],
    },
    decals: [decal(0, 0, 30.3, 20.3, ({ line, text, rect, logo }) => {
      [3.88, 1.38, -1.17, -3.75].forEach((y) => line([[-9.05, y], [8.7, y]], 0.9));
      rect(-13.0, 5.2, 2.4, 10.3); line([[-14.7, 10.1], [-14.7, -10.1]], 0.2, SILK);
      logo(-1.3, 5.75, 5.2);
      text('ROBOCODERS', -1.0, 0.1, 1.3, 0, 800);
      text('ULTRASONIC SENSOR', -1.4, -8.4, 1.3, 0, 700);
      [['VCC', 3.88], ['TRIG', 1.38], ['ECHO', -1.17], ['GND', -3.75]].forEach(([t, y]) => text(t, 4.6, y + 0.75, 0.6, 0, 600, 'right'));
      rect(5.0, 5.7, 6.1, 11.4); text('CN8', 9.6, 0.1, 1.1, -Math.PI / 2, 600);
    })],
  },
  button: {
    btn: true,
    focus: { cap: ['cap', 'plate', 'body'] }, anchor: { cap: 'button' }, alias: { button: 'cap', plate: 'cap', body: 'cap', legs: 'cap', r_1_ends: 'r_1' },
    part: {
      cap: ['SW1 · tactile switch', '6 × 6 mm push switch. Pressing the plunger bends a metal dome inside until it touches the contacts and joins VCC to DO. Its four legs are two pairs that are always connected. Press it on the board or with the button below.'],
      r_1: ['R1 · 10 kΩ pull-down', 'Holds DO at 0 V (LOW) while the switch is open, so the input never floats. When pressed, the switch connects DO to VCC and about 0.33 mA flows through R1.'],
      pin1: ['VCC', 'Supply: the switch connects it to DO.'], pin2: ['GND', 'Ground, through R1.'], pin3: ['DO', 'Digital out: HIGH while pressed, LOW when released. Plugs into an input port (D34, D35, D36, D39).'],
      xh: ['JST-XH connector', '3-pin side-entry XH: VCC, GND, DO from top to bottom.'],
    },
    decals: [decal(0, 0, 30.4, 20.3, ({ line, text, rect, logo }) => {
      line([[-11.65, 2.94], [-11.65, 5.4], [-9.0, 7.2], [8.6, 7.2], [11.5, 4.8], [11.5, 2.64]]);
      line([[-7.06, -3.72], [-5.0, -7.2], [4.37, -7.2], [4.37, -6.54]]); line([[4.37, -3.6], [6.0, -2.38], [11.5, -2.38]]);
      line([[4.37, -6.54], [9.6, -6.54], [11.5, 0.13]]);
      rect(-12.9, 3.3, 7.1, 7.4); text('SW1', -9.35, -0.39, 1.1, -Math.PI / 2, 600);
      rect(3.3, -2.7, 2.2, 4.8); text('R1', 4.37, -8.2, 1.0, 0, 600);
      logo(0, 6.06, 4.8);
      text('ROBOCODERS', 0, -0.5, 1.3, 0, 800);
      text('PUSH BUTTON', 0, -8.5, 1.35, 0, 700);
      [['VCC', 2.64], ['GND', 0.13], ['DO', -2.38]].forEach(([t, y]) => text(t, 7.5, y + 0.9, 0.6, 0, 600, 'right'));
      rect(8.1, 5.4, 5.2, 10.8); text('U13', 12.7, 0, 1.0, -Math.PI / 2, 600);
    })],
  },
  dht11: {
    dht: true,
    focus: { sensor: ['sensor', 'grille', 'ribs'] }, anchor: {}, alias: { grille: 'sensor', ribs: 'sensor', sensor_legs: 'sensor', r_1_ends: 'r_1', r_3_ends: 'r_3', led_power_ends: 'led_power' },
    part: {
      sensor: ['DHT11 sensor', 'Inside the blue case: a humidity-sensing film whose resistance changes with moisture, a tiny NTC thermistor for temperature, and a chip that sends both as numbers over one DATA wire. 0–50 °C ±2 °C, 20–90 %RH ±5 %; one reading per second at most.'],
      r_1: ['R1 · 10 kΩ pull-up', 'Holds the DATA line HIGH while nobody is talking. The ESP32 and the DHT11 only ever pull it LOW, so they never fight.'],
      r_3: ['R3 · 1 kΩ', 'Limits the current through LED1.'],
      led_power: ['LED1 · power LED', 'On whenever the module has power (through R3).'],
      pin1: ['VCC', '3.3–5 V supply.'], pin2: ['GND', 'Ground.'], pin3: ['DO', 'The single DATA wire: start pulse from the ESP32, then 40 bits back from the DHT11.'],
      xh: ['JST-XH connector', '3-pin side-entry XH: VCC, GND, DO from top to bottom.'],
    },
    decals: [decal(0, 0, 30.4, 20.3, ({ line, text, rect, logo }) => {
      line([[-8.1, 3.8], [-5.6, 5.6], [8.8, 5.6], [11.3, 2.7]]); line([[-8.1, -1.4], [-3.6, -1.4], [-1.2, 0.0], [11.3, 0.17]]);
      line([[-8.1, 1.2], [-4.8, 3.6], [0.4, 3.6]]); line([[3.6, -0.3], [3.6, -2.0], [9.6, -2.36], [11.3, -2.36]]);
      rect(-10.5, 6.4, 5.9, 12.8); text('S1', -12.3, 0, 1.0, -Math.PI / 2, 600);
      rect(-0.7, 3.0, 2.2, 3.3); rect(2.5, 3.0, 2.2, 3.3); text('R3', 0.4, -0.9, 1.0, 0, 600); text('R1', 3.6, -0.9, 1.0, 0, 600);
      rect(0.0, -3.9, 4.8, 1.9);
      logo(1.0, 6.8, 5.0);
      text('ROBOCODERS', 1.4, -2.4, 1.3, 0, 800);
      text('DHT11-TEMPERATURE SENSOR', -0.3, -8.1, 1.3, 0, 700);
      [['VCC', 2.7], ['GND', 0.17], ['DO', -2.36]].forEach(([t, y]) => text(t, 7.0, y + 0.9, 0.6, 0, 600, 'right'));
      rect(7.8, 5.4, 5.2, 10.8); text('U3', 12.4, 0, 1.0, -Math.PI / 2, 600);
    })],
  },
  led: {
    led: true,
    focus: { lens: ['lens', 'lens_frame'] }, anchor: { lens: 'led' }, alias: { led: 'lens', legs: 'lens', lens_frame: 'lens', lens_die: 'lens', lens_legs: 'lens', r_1_ends: 'r_1' },
    part: {
      lens: ['5 mm LED', 'Fitted upright from the top. Current flows from DI through R1 into the long leg (anode) and out of the short leg (cathode) to GND. Click below to switch it, dim it or change the colour.'],
      r_1: ['R1 · 1 kΩ', 'Limits the LED current to about 1 mA from a 3.3 V pin: (3.3 V − LED voltage) ÷ 1 kΩ. Without it the LED and the pin would be overloaded.'],
      pin1: ['VCC', 'Not used by the LED (the board passes it through).'], pin2: ['GND', 'LED cathode return.'],
      pin3: ['DI', 'Digital in from the ESP32: HIGH = on. analogWrite() (PWM) switches it fast to dim it.'],
      xh: ['JST-XH connector', '3-pin side-entry XH: VCC, GND, DI from top to bottom. Plugs into any output port (D13, D23, D32, D33).'],
    },
    decals: (tint = 'red') => (LED_DECALS[tint] ||= [decal(0, 0, 30, 20, ({ line, ring, text, rect, logo }) => {
      line([[-10.9, 1.85], [-8.6, 2.7], [8.0, 2.7], [10.6, 0.1]]);
      line([[-10.9, -0.7], [-8.3, -3.16], [-2.6, -3.16]]); line([[0.3, -3.16], [8.6, -3.16], [10.6, -2.5]]);
      ring(-10.9, 0.58, 2.6, 0.22); text('LED1', -13.3, 0.58, 0.9, Math.PI / 2, 600);
      rect(-3.4, -2.2, 4.5, 2.0); text('R1', -1.15, -3.16, 0.8, 0, 600);
      logo(0, 6.65, 5.1);
      text('ROBOCODERS', 0.1, -0.35, 1.3, 0, 800);
      text(`${tint.toUpperCase()} LED MODULE`, 0, -8.5, 1.3, 0, 700);
      [['VCC', 2.65], ['GND', 0.1], ['DI', -2.5]].forEach(([t, y]) => text(t, 6.3, y + 0.9, 0.6, 0, 600, 'right'));
      rect(7.8, 5.4, 5.2, 10.8); text('U13', 12.4, 0, 1.0, -Math.PI / 2, 600);
    })]),
  },
  buzzer: {
    buzz: true,
    focus: { body: ['body', 'mark', 'opening'], transistor: ['transistor', 'transistor_legs'] }, anchor: { body: 'buzzer' },
    alias: { buzzer: 'body', mark: 'body', opening: 'body', transistor_legs: 'transistor', r_1_ends: 'r_1' },
    part: {
      body: ['12 mm buzzer', 'A thin metal disc inside is pulled back and forth by a coil (or a piezo crystal). Driving it on and off fast makes a tone: 2 000 switches a second = 2 kHz. + goes to VCC, − to Q2.'],
      transistor: ['Q2 · BC847 NPN transistor', 'A GPIO pin cannot supply the ~30 mA a buzzer wants. DI turns Q2 on through R1, and Q2 connects the buzzer to GND, so the current comes from VCC, not from the pin.'],
      r_1: ['R1 · 1 kΩ', 'Base resistor: limits the current from DI into Q2 to about 3 mA.'],
      pin1: ['VCC', 'Supply for the buzzer.'], pin2: ['GND', 'Ground, through Q2.'], pin3: ['DI', 'Digital in from the ESP32: HIGH = Q2 on, buzzer sounds. tone() switches it fast to play notes.'],
      xh: ['JST-XH connector', '3-pin side-entry XH: VCC, GND, DI from top to bottom. Plugs into any output port (D13, D23, D32, D33).'],
    },
    decals: [decal(0, 0, 30.3, 20.0, ({ line, ring, text, rect, logo }) => {
      line([[-8.3, 3.06], [-3.8, 7.4], [9.0, 7.4], [11.25, 5.2], [11.25, 2.5]]);
      line([[-8.3, -3.1], [-1.6, -3.1], [1.0, -0.1]]);
      line([[11.25, -2.55], [12.6, -4.2], [11.15, -8.1]]); line([[8.05, -8.1], [3.6, -4.2], [1.95, -1.9]]);
      line([[2.9, -0.1], [4.0, 2.6], [9.2, 2.6], [11.25, 0.05]]);
      ring(-8.3, 0, 6.1, 0.22); text('+', -11.3, 2.1, 2.2, 0, 400); text('|', -11.3, -2.9, 2.0, 0, 400);
      logo(1.4, 6.1, 5.0);
      text('ROBOCODERS', 1.8, -4.7, 1.25, 0, 800);
      text('BUZZER MODULE', -0.6, -8.4, 1.35, 0, 700);
      [['VCC', 2.5], ['GND', 0.05], ['DI', -2.55]].forEach(([t, y]) => text(t, 7.2, y, 0.65, 0, 600, 'right'));
      rect(0.3, 0.8, 3.3, 3.6); text('Q2', 1.95, -2.4, 0.8, Math.PI, 600);
      rect(7.4, -7.0, 4.4, 2.2);
      rect(9.4, 6.0, 5.3, 12.0); text('U13', 13.6, 0, 1.0, -Math.PI / 2, 600);
    })],
  },
  traffic: {
    lights: true, xhDirect: true, // XH pins 1..4 run R, Y, G, GND from the bottom
    focus: {}, anchor: { led_red: 'red', led_yellow: 'yellow', led_green: 'green' },
    alias: Object.fromEntries(['red', 'yellow', 'green'].flatMap((c) => ['legs', 'frame', 'die'].map((x) => [`led_${c}_${x}`, `led_${c}`]))),
    part: {
      led_red: ['Red LED', '5 mm red LED on pin R. Base board RGY port: D23. Click it to switch it on or off.'],
      led_yellow: ['Yellow LED', '5 mm yellow LED on pin Y. Base board RGY port: D33. Click it to switch it on or off.'],
      led_green: ['Green LED', '5 mm green LED on pin G. Base board RGY port: D32. Click it to switch it on or off.'],
      pin1: ['R', 'Red LED anode. HIGH = red on.'], pin2: ['Y', 'Yellow LED anode. HIGH = yellow on.'], pin3: ['G', 'Green LED anode. HIGH = green on.'],
      pin4: ['GND', 'Common return for all three LEDs (their cathodes).'],
      xh: ['RYG · JST-XH connector', '4-pin side-entry XH: GND, G, Y, R from top to bottom. Plugs into the RGY port. The board has no resistors: each GPIO drives its LED directly.'],
    },
    decals: [decal(0, 0, 30.3, 20.2, ({ line, ring, text, rect, logo }) => {
      line([[11.1, -4.1], [-7.4, -4.1], [-10.8, -1.35]]); line([[11.1, -1.55], [5.6, -1.55], [4.4, -2.7], [-1.4, -2.7], [-3.9, -1.35]]);
      line([[11.1, 0.95], [6.0, 0.95], [4.6, -0.2], [2.5, -1.35]]);
      line([[11.1, 3.5], [6.2, 3.5], [4.2, 1.25], [2.5, 1.25]]); line([[2.5, 1.25], [0.3, 2.9], [-6.2, 2.9], [-10.8, 1.25]]); line([[-6.2, 2.9], [-3.9, 1.25]]);
      [-10.8, -3.9, 2.5].forEach((x) => ring(x, -0.05, 2.3, 0.2));
      logo(0, 6.6, 5.0);
      text('ROBOCODERS', 0, -4.0, 1.25, 0, 800);
      text('TRAFFIC LIGHT MODULE', 0, -8.1, 1.25, 0, 700);
      [['GND', 3.5], ['G', 0.95], ['Y', -1.55], ['R', -4.1]].forEach(([t, y]) => text(t, 8.9, y, 0.7, 0, 600, 'right'));
      rect(9.4, 6.0, 5.5, 12.6); text('RYG', 9.2, -0.3, 1.0, -Math.PI / 2, 600);
    })],
  },
  oled: {
    screen: true, xhDirect: true, // XH pins 1..4 run SDA, SCL, VCC, GND from the bottom
    focus: { module: ['module', 'glass', 'screen'], header: ['header', 'header_pins'] }, anchor: { module: 'screen' },
    alias: { glass: 'module', screen: 'module', module_pads: 'module', module_holes: 'module', flex: 'flex', header_pins: 'header' },
    part: {
      module: ['0.96" OLED display', 'SSD1306 driver, 128 × 64 pixels, each pixel lights by itself (no backlight), so black is truly off. It talks I2C at address 0x3C. Click below to write on it.'],
      flex: ['Flex cable', 'The thin ribbon that joins the glass to the module board. Bending it sharply breaks the display.'],
      header: ['4-pin header', 'The display module is soldered onto the carrier here: GND, VCC, SCL, SDA.'],
      pin1: ['SDA', 'I2C data, both ways. Base board: D21.'],
      pin2: ['SCL', 'I2C clock from the ESP32. Base board: D22.'],
      pin3: ['VCC', '3.3–5 V, chosen by the 3V/5V switch next to the I2C port.'],
      pin4: ['GND', 'Ground.'],
      xh: ['JST-XH connector', '4-pin side-entry XH: GND, VCC, SCL, SDA from top to bottom on the silkscreen. Plugs into the I2C port.'],
    },
    decals: [decal(0, 0, 30, 20, ({ line, text, rect, mark }) => {
      [3.7, 1.15, -1.4, -3.9].forEach((y, i) => line([[1.8, y + 0.1 * (i - 1.5)], [11.2, y]], 0.9));
      [4.9, 2.35, -0.2, -2.8].forEach((y) => rect(-2.9, y, 6.6, 2.6));
      line([[3.7, 10], [3.7, -10]], 0.2, SILK);
      text("0.96'OLED", -5.9, 0, 1.5, Math.PI / 2, 800); text('IIC-Connector', -8.3, 0, 1.5, Math.PI / 2, 800); text('OLED', -11.5, 0, 1.1, Math.PI / 2, 400);
      [['GND', 3.7], ['VCC', 1.15], ['SCL', -1.4], ['SDA', -3.9]].forEach(([t, y]) => text(t, 6.5, y, 0.65, 0, 600));
      rect(7.6, 6.0, 5.3, 12.0);
      mark(5.9, 7.7, 2.6); text('YUGMINDS', 10.2, 7.7, 1.0, 0, 700);
      text('ROBOCODERS', 9.2, -8.6, 1.3, 0, 800);
    })],
  },
  touch: {
    touch: true, xhDirect: true, // XH pins 1..3 run VCC, GND, DO left to right
    focus: { pad: ['pad'], ttp223: ['ttp223', 'ttp223_legs'] }, anchor: {},
    alias: { pcb: 'pad', ttp223_legs: 'ttp223', j1_solder: 'j1', j2_solder: 'j2', c1: 'caps', c2: 'caps', r1: 'r1', led: 'led' },
    part: {
      pad: ['Touch pad', 'Copper under the solder mask. A finger adds a little capacitance; the TTP223 notices the change and switches OUT. It works through thin plastic or paper too.'],
      ttp223: ['TTP223 touch chip', 'One-key capacitive touch detector (SOT-23-6). Pins: OUT, GND, the pad input, AHLB, VDD, TOG. It calibrates itself at power-up, so do not touch the pad while switching on.'],
      led: ['LED1 · output LED', 'Driven from OUT through R1: on whenever OUT is HIGH.'],
      r1: ['R1 · 1 kΩ', 'Limits the LED current.'],
      caps: ['C1 · C2', 'C1 (22 pF) on the pad input sets the sensitivity: a bigger value makes it less sensitive. C2 (1 µF) steadies the supply.'],
      j1: ['J1 · TOG jumper', 'Open: momentary, OUT follows the finger. Solder it closed for toggle mode: each touch flips OUT. Click to bridge it with solder.'],
      j2: ['J2 · AHLB jumper', 'Open: OUT is HIGH when touched. Solder it closed for active LOW. Click to bridge it with solder.'],
      pin1: ['VCC', '2–5.5 V supply.'],
      pin2: ['GND', 'Ground.'],
      pin3: ['DO', 'OUT of the TTP223: HIGH while touched (default jumpers).'],
      xh: ['CN · JST-XH connector', 'Top-entry 3-pin XH: VCC, GND, DO from left to right. The kit cable plugs in from above.'],
    },
    decals: [decal(0, 0, 20.4, 30.8, ({ line, text, rect, logo, fill }) => {
      line([[-2.8, 10.2], [-2.8, 8.6], [-5.0, 7.3]]); line([[2.3, 10.2], [2.3, 9.0], [4.5, 8.0], [7.0, 8.0]]); line([[-0.3, 10.2], [-0.3, 8.4]]);
      line([[-6.0, 4.2], [-6.0, 3.2]], 0.6);
      fill(-9.6, 3.0, 19.2, 16.3, 'rgba(0,10,60,.22)');                // touch pad (copper under the mask)
      rect(-9.6, 3.0, 19.2, 16.3);
      [['VCC', -2.9], ['GND', -0.3], ['DO', 2.3]].forEach(([t, x]) => text(t, x, 7.9, 0.65, 0, 600));
      text('C1', -8.0, 11.6, 1.0, 0, 600); text('C2', -3.4, 7.3, 1.0, 0, 600); text('R1', 5.3, 3.9, 1.0, 0, 600); text('+', 6.3, 8.7, 1.4, 0, 600);
      logo(0, -0.4, 6.0);
      fill(-4.6, -3.75, 9.2, 2.1, SILK, 1.05);
      text('TOUCH', 0, -4.8, 1.7, 0, 800, 'center', '#0d2a7a');
      text('ROBOCODERS', 0, -9.6, 1.15, 0, 800);
      text('TOUCH SENSOR', 0, -14.1, 1.1, 0, 700);
    }, 1.66)],
  },
};

/** node name (`<id>_…`) → part key in SENSORS[id].part */
export function sensorKey(id, name) {
  const s = SENSORS[id], k = name.replace(`${id}_`, '');
  if (s.key) return s.key(k);
  const pin = k.match(/^xh_pin_(\d)$/);
  if (pin) return s.xhDirect ? `pin${pin[1]}` : `pin${4 - pin[1]}`; // comparator boards: XH pins run DO, GND, VCC from the bottom
  if (s.group?.test(k)) return Object.keys(s.focus)[0];
  const base = k.replace(/_(ends|screw)$/, '').replace(/^lm393_legs$|^smd_\d+$/, 'lm393');
  return s.alias?.[base] || base;
}
