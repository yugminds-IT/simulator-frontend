// Robo Coders base board (SMART INNOVATOR KIT programmable board): what each part and port does, the silkscreen (drawn at
// runtime from the model's own anchors, so labels follow the 3D layout) and a port map. Silkscreen text and port wiring from
// the EasyEDA board view + schematic (2026-11-21).
import { LOGO } from './sensors.js';

// [title, description]
export const BASE_PART = {
  pcb: ['Robo Coders base board', 'Every module plugs into this board with a JST-XH cable — no breadboard wiring.'],
  esp32_socket: ['ESP32 socket (U1 + U2)', 'The two 15-pin female headers U1 and U2. The ESP32 DevKit\'s male pins push into them, USB toward the top edge.'],
  u1: ['U1 · ESP32 header (right)', '15-pin female header: the ESP32\'s right-hand pins (VIN … EN) push in here.'],
  u2: ['U2 · ESP32 header (left)', '15-pin female header: the ESP32\'s left-hand pins (3V3 … D23) push in here.'],
  tb6612_socket: ['Motor driver socket (U6)', 'The TB6612FNG breakout plugs in here. It drives the left and right motors.'],
  power_module: ['CA-1235 power module (U3)', 'Turns the battery voltage into the 5 V rail: IN from the battery through SW1, OUT to 5 V. It sits under the ESP32.'],
  sw1: ['SW1 power switch (ON/OFF)', 'KFC5858 self-locking push switch between BAT and the power module. Click it to switch the kit on or off.'],
  switch_motor_v: ['7V/5V switch', 'Chooses the motor supply (VMOT): battery voltage (7 V) or the 5 V rail. Click to flip it.'],
  switch_i2c_v: ['3V/5V switch', 'Chooses the VCC on the I2C port: 3.3 V or 5 V. Click to flip it.'],
  smd: ['R1 · C1 · C3', 'R1 (1 kΩ) pulls PWMA, PWMB and STBY of the motor driver to 3.3 V, so both motors run at full speed whenever the driver is on. C1 and C3 (1206) across the motor outputs soak up brush noise.'],
  hole: ['Mounting hole', 'Bolts the board to the robot chassis.'],
};

// port → [title, kind, description]; kind: out | in | bus | power | motor
export const PORT_DOC = {
  d13: ['D13 port', 'out', 'Output port on GPIO13 — LEDs, buzzer, DHT11.'],
  d23: ['D23 port', 'out', 'Output port on GPIO23.'],
  d32: ['D32 port', 'out', 'Output port on GPIO32.'],
  d33: ['D33 port', 'out', 'Output port on GPIO33.'],
  d34: ['D34 port', 'in', 'Input port on GPIO34 (input only) — buttons and sensors.'],
  d35: ['D35 port', 'in', 'Input port on GPIO35 (input only, analog ADC1).'],
  d36: ['D36 port', 'in', 'Input port on GPIO36 / VP (input only, analog ADC1).'],
  d39: ['D39 port', 'in', 'Input port on GPIO39 / VN (input only, analog ADC1).'],
  ultrasonic: ['ULTRASONIC port', 'bus', '4-pin: VCC, TRIG on D19, ECHO on D18, GND.'],
  rxtx: ['RX/TX port', 'bus', 'UART0: pin 1 TX0, 2 RX0, 3 GND, 4 VCC — the same pins as the USB serial.'],
  rx2tx2: ['CN2 · RX2/TX2 port', 'bus', 'UART2: pin 1 D17 (TX2), 2 D16 (RX2), 3 GND, 4 VCC.'],
  i2c: ['I2C port', 'bus', 'Pin 1 SDA (D21), 2 SCL (D22), 3 VCC from the 3V/5V switch, 4 GND.'],
  rgy: ['TRAFFIC LIGHT port', 'out', 'Traffic-light module: D23 red, D33 yellow, D32 green, pin 4 GND.'],
  servo: ['SERVO header', 'out', '3 male pins for a hobby servo plug: 1 GND, 2 5 V, 3 signal (D33).'],
  motor_l1: ['Left motor · CN6', 'motor', 'Motor driver output A (AO1/AO2). CN6 and CN19 are in parallel: front and back motor.'],
  motor_l2: ['Left motor · CN19', 'motor', 'Motor driver output A, in parallel with CN6.'],
  motor_r1: ['Right motor · CN7', 'motor', 'Motor driver output B (BO1/BO2). CN7 and CN8 are in parallel.'],
  motor_r2: ['Right motor · CN8', 'motor', 'Motor driver output B, in parallel with CN7.'],
  bat: ['BAT connector', 'power', 'Battery input. SW1 switches it on and off.'],
};
export const PORT_PIN_ROLE = { 1: 'VCC', 2: 'GND', 3: 'signal' }; // 3-pin ports (schematic, 2026-11-21)

const U2 = ['3v3', 'gnd', 'd15', 'd2', 'd4', 'rx2', 'tx2', 'd5', 'd18', 'd19', 'd21', 'rx0', 'tx0', 'd22', 'd23'];
const U1 = ['vin', 'gnd', 'd13', 'd12', 'd14', 'd27', 'd26', 'd25', 'd33', 'd32', 'd35', 'd34', 'vn', 'vp', 'en'];
const TBL = [['vm', 'VMOT'], ['vcc', 'VCC'], ['gnd_1', 'GND'], ['ao1', 'AO1'], ['ao2', 'AO2'], ['bo2', 'BO2'], ['bo1', 'BO1'], ['gnd_2', 'GND']];
const TBR = [['pwma', 'PWMA'], ['ain2', 'AIN2'], ['ain1', 'AIN1'], ['stby', 'STBY'], ['bin1', 'BIN1'], ['bin2', 'BIN2'], ['pwmb', 'PWMB'], ['gnd_3', 'GND']];
const up = (s) => (s === 'vin' ? 'Vin' : s.toUpperCase());

// decals: at/size in model mm (Blender axes); `A(name)` gives an anchor's [x, y]
export const BASE_DECALS = [
  {
    at: [0, 0, 1.605], size: [100, 90], px: 12,
    draw(g, w, h, A) {
      const mm = w / 100, X = (x) => w / 2 + x * mm, Y = (y) => h / 2 - y * mm;
      const a = (n) => A(`anchor_base_${n}`);
      const mid = (port, n) => { const p = [...Array(n)].map((_, i) => a(`${port}_pin${i + 1}`)).filter(Boolean); return p.length ? [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length] : null; };
      g.fillStyle = g.strokeStyle = '#eef0f6';
      g.lineWidth = 0.22 * mm; g.textBaseline = 'middle';
      const text = (t, x, y, size, o = {}) => {
        g.save(); g.translate(X(x), Y(y)); g.rotate(o.rot || 0); g.textAlign = o.align || 'center';
        g.font = `${o.weight || 600} ${size * mm}px ${o.serif ? 'Georgia, serif' : '"Barlow Condensed", sans-serif'}`;
        g.fillText(t, 0, 0); g.restore();
      };
      const box = (x0, y0, x1, y1) => g.strokeRect(X(Math.min(x0, x1)), Y(Math.max(y0, y1)), Math.abs(x1 - x0) * mm, Math.abs(y1 - y0) * mm);
      // GPIO breakouts
      U2.forEach((n) => { const p = a(`u2_${n}`); if (p) text(up(n), p[0] - 3.8, p[1], 1.75, { align: 'right' }); });
      U1.forEach((n) => { const p = a(`u1_${n}`); if (p) text(up(n), p[0] + 3.8, p[1], 1.75, { align: 'left' }); });
      const u2 = a('u2_d4'), u1 = a('u1_d14');
      if (u2) text('U2', u2[0] + 2.4, u2[1] - 6, 1.4, { rot: Math.PI / 2 });
      if (u1) text('U1', u1[0] - 2.4, u1[1] - 6, 1.4, { rot: -Math.PI / 2 });
      // ESP32 footprint outline, USB end at the top
      const tl = a('u2_3v3'), br = a('u1_en');
      if (tl && br) {
        box(tl[0] - 3.2, tl[1] + 8.5, br[0] + 3.2, br[1] - 8.2);
        box((tl[0] + br[0]) / 2 - 4.5, tl[1] + 8.5, (tl[0] + br[0]) / 2 + 4.5, tl[1] + 5);
        text('USB', (tl[0] + br[0]) / 2, tl[1] + 6.75, 1.6);
        text('1', br[0] + 2.2, tl[1] + 6.5, 1.3);
        text('ESP32', (tl[0] + br[0]) / 2, br[1] - 4.3, 2.4, { weight: 700 });
        text('30 pin', (tl[0] + br[0]) / 2, br[1] - 6.6, 1.4);
      }
      // TB6612 footprint + pin names
      const t1 = a('tb6612_vm'), t2 = a('tb6612_gnd_3');
      if (t1 && t2) {
        box(t1[0] - 2.2, t1[1] + 2.4, t2[0] + 2.2, t2[1] - 2.2);
        text('U6', (t1[0] + t2[0]) / 2, t1[1] + 3.6, 1.4);
        text('TB6612FNG', (t1[0] + t2[0]) / 2, (t1[1] + t2[1]) / 2 + 3, 1.6);
      }
      TBL.forEach(([n, l]) => { const p = a(`tb6612_${n}`); if (p) text(l, p[0] - 2.4, p[1], 1.6, { align: 'right' }); });
      TBR.forEach(([n, l]) => { const p = a(`tb6612_${n}`); if (p) text(l, p[0] + 2.4, p[1], 1.6, { align: 'left' }); });
      // ports
      [['d23', 'D23'], ['d32', 'D32'], ['d13', 'D13'], ['d33', 'D33']].forEach(([p, l]) => { const c = mid(p, 3); if (c) text(l, c[0] + 4.6, c[1], 1.9, { rot: Math.PI / 2 }); });
      [['ultrasonic', 'ULTRASONIC'], ['rxtx', 'RX/TX'], ['i2c', 'I2C']].forEach(([p, l]) => { const c = mid(p, 4); if (c) text(l, c[0] + 4.4, c[1], 1.7, { rot: Math.PI / 2 }); });
      [['d36', 'D36'], ['d35', 'D35'], ['d39', 'D39'], ['d34', 'D34'], ['rgy', 'TRAFFIC LIGHT'], ['rx2tx2', 'CN2']].forEach(([p, l]) => { const c = mid(p, p === 'rgy' || p === 'rx2tx2' ? 4 : 3); if (c) text(l, c[0] - 4.4, c[1], p === 'rgy' ? 1.6 : 1.9, { rot: -Math.PI / 2 }); });
      const rgy = mid('rgy', 4);
      if (rgy) ['D23 – R', 'D33 – Y', 'D32 – G'].forEach((l, i) => text(l, rgy[0] - 15, rgy[1] + 5.4 - i * 2.4, 1.8, { align: 'left' }));
      [['motor_l1', 'CN6'], ['motor_l2', 'CN19'], ['motor_r1', 'CN7'], ['motor_r2', 'CN8']].forEach(([p, l]) => { const c = mid(p, 2); if (c) text(l, c[0], c[1] + 4.6, 1.5); });
      const ml = mid('motor_l2', 2), mr = mid('motor_r2', 2);
      if (ml) text('LEFT MOTOR', ml[0] - 9, ml[1] - 3.6, 1.7);
      if (mr) text('RIGHT MOTOR', mr[0] + 7, mr[1] - 3.6, 1.7);
      // headers, switches and notes
      const sv = a('servo'), sw = a('sw1'), bat = a('bat'), m = a('switch_motor_v'), i2 = a('switch_i2c_v');
      if (sv) text('SERVO', sv[0], sv[1] + 3, 1.7);
      if (sw) { text('SW1', sw[0], sw[1] + 4.6, 1.6); text('ON/OFF', sw[0], sw[1] - 4.6, 1.5); box(sw[0] - 3.4, sw[1] + 3.4, sw[0] + 3.4, sw[1] - 3.4); }
      if (bat) { text('BAT', bat[0], bat[1] + 5.4, 1.6); box(bat[0] - 3.4, bat[1] + 4.4, bat[0] + 3.4, bat[1] - 4.4); }
      if (m) text('7V/5V', m[0], m[1] + 3.6, 1.6);
      if (i2) text('3V/5V', i2[0] + 3.6, i2[1], 1.6, { rot: -Math.PI / 2 });
      // power module outline + labels (the module itself sits under the ESP32)
      const pm = a('power_module');
      if (pm) { g.lineWidth = 0.45 * mm; box(pm[0] - 10.1, pm[1] + 15.2, pm[0] + 10.1, pm[1] - 15.2); g.lineWidth = 0.22 * mm;
        text('NI', pm[0], pm[1] + 12.4, 1.6); text('OUT', pm[0], pm[1] - 9.4, 1.6); text('CA-1235', pm[0], pm[1] + 1.5, 2.6, { rot: -Math.PI / 2 }); text('U3', pm[0] + 7.4, pm[1] - 6.8, 1.3); }
      // titles and company marks
      text('SMART INNOVATOR KIT', 29.9, 41.2, 2.0, { weight: 700 });
      text('PROGRAMMABLE BOARD', 29.9, 39.0, 1.3, { weight: 700 });
      text('ROBOCODERS | YUGMINDS PRIVATE LIMITED', -2.1, -41.9, 2.0, { weight: 700 });
      if (LOGO.naturalWidth) g.drawImage(LOGO, X(42 - 6.5), Y(-33 + 6.5), 13 * mm, 13 * mm); // YUGMINDS logo (white)
    },
  },
  { // label on the CA-1235 module (under the ESP32)
    at: (A) => [...A('anchor_base_power_module'), 3.405], size: [19.6, 30], px: 18,
    draw(g, w, h) {
      const mm = w / 19.6;
      g.fillStyle = g.strokeStyle = '#eef0f6'; g.lineWidth = 0.2 * mm; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `700 ${2.6 * mm}px "Barlow Condensed", sans-serif`;
      g.save(); g.translate(w / 2, h / 2); g.rotate(-Math.PI / 2); g.fillText('CA-1235', 0, 0); g.restore();
      g.font = `600 ${1.6 * mm}px "Barlow Condensed", sans-serif`;
      g.fillText('IN  +       −', w / 2, 4 * mm); g.fillText('OUT  +      −', w / 2, h - 4 * mm);
      g.fillText('U3', w - 3 * mm, h / 2);
    },
  },
];

/** Port map HTML: ports and their GPIOs; `used` = Set of port ids in the current lesson. */
export function portMap(PORTS, used = new Set()) {
  const rows = Object.entries(PORT_DOC).filter(([p]) => !p.startsWith('motor') && p !== 'bat').map(([p, [title, kind]]) => {
    const g = PORTS[p] ? Object.values(PORTS[p].pins).map((n) => `IO${n}`).join(' · ') : { rxtx: 'IO3 · IO1', rx2tx2: 'IO16 · IO17' }[p] || '—';
    return `<tr class="${used.has(p) ? 'used' : ''}"><td>${title.replace(/ port| header/i, '')}</td><td>${g}</td><td><i class="chip ${kind === 'in' ? 'input' : kind === 'out' ? 'digital' : 'uart'}">${kind}</i></td></tr>`;
  });
  return `<table class="pmap">${rows.join('')}</table>`;
}
