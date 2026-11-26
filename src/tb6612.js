// TB6612FNG dual H-bridge breakout: pin jobs (Toshiba datasheet), kit wiring (base-board schematic),
// the H-bridge truth table, and the board printing (drawn at runtime).

// pin → [label, group, description]
export const TB_PIN = {
  vm: ['VM', 'power', 'Motor supply, 2.5–13.5 V (15 V max). Comes from the 7V/5V switch on the base board.'],
  vcc: ['VCC', 'power', 'Logic supply, 2.7–5.5 V.'],
  gnd_1: ['GND', 'ground', 'Ground.'], gnd_2: ['GND', 'ground', 'Ground.'], gnd_3: ['GND', 'ground', 'Ground.'],
  ao1: ['AO1', 'motor', 'Motor A output 1 → left motor (CN6 / CN19).'],
  ao2: ['AO2', 'motor', 'Motor A output 2 → left motor.'],
  bo1: ['BO1', 'motor', 'Motor B output 1 → right motor (CN7 / CN8).'],
  bo2: ['BO2', 'motor', 'Motor B output 2 → right motor.'],
  pwma: ['PWMA', 'speed', 'Speed of motor A (PWM up to 100 kHz). On the kit: pulled to 3.3 V by R1, so motor A runs at full speed.'],
  ain1: ['AIN1', 'direction', 'Direction input 1 for motor A. Kit: D27.'],
  ain2: ['AIN2', 'direction', 'Direction input 2 for motor A. Kit: D14.'],
  stby: ['STBY', 'standby', 'LOW puts both channels in standby (motors off). On the kit: tied to the R1 pull-up, so always HIGH (awake).'],
  bin1: ['BIN1', 'direction', 'Direction input 1 for motor B. Kit: D26.'],
  bin2: ['BIN2', 'direction', 'Direction input 2 for motor B. Kit: D25.'],
  pwmb: ['PWMB', 'speed', 'Speed of motor B. On the kit: tied to the R1 pull-up, so motor B runs at full speed.'],
};
export const TB_GPIO = { ain1: 27, ain2: 14, bin1: 26, bin2: 25 }; // base-board schematic reading
export const GPIO_TB = Object.fromEntries(Object.entries(TB_GPIO).map(([k, v]) => [v, k]));

/** H-bridge: IN1, IN2 (and STBY, PWM) → -1 reverse, 0 stop, 1 forward, 'brake' short brake. */
export function bridge(in1, in2, stby = 1, pwm = 1) {
  if (!stby) return 0;
  if (in1 && in2) return 'brake';
  if (!pwm) return 'brake';
  return in1 ? 1 : in2 ? -1 : 0;
}
export const bridgeText = (s) => ({ 1: 'turning forward (CW)', '-1': 'turning backward (CCW)', 0: 'stopped (coasting)', brake: 'short brake' })[s];

const L = [['VM', 'vm'], ['VCC', 'vcc'], ['GND', 'gnd_1'], ['AO1', 'ao1'], ['AO2', 'ao2'], ['BO2', 'bo2'], ['BO1', 'bo1'], ['GND', 'gnd_2']];
const R = [['PWMA', 'pwma'], ['AIN2', 'ain2'], ['AIN1', 'ain1'], ['STBY', 'stby'], ['BIN1', 'bin1'], ['BIN2', 'bin2'], ['PWMB', 'pwmb'], ['GND', 'gnd_3']];

export const TB_DECALS = [
  { // silkscreen: pin names inside each row, title along the bottom
    at: [0, 0, 1.605], size: [20.32, 20.32], px: 48,
    draw(g, w) {
      const mm = w / 20.32, X = (x) => w / 2 + x * mm, Y = (y) => w / 2 - y * mm;
      g.fillStyle = g.strokeStyle = '#fff3ee'; g.textBaseline = 'middle';
      g.font = `700 ${0.95 * mm}px "Barlow Condensed", sans-serif`;
      L.forEach(([t], i) => { g.textAlign = 'left'; g.fillText(t, X(-6.5), Y(8.89 - i * 2.54)); });
      R.forEach(([t], i) => { g.textAlign = 'right'; g.fillText(t, X(6.5), Y(8.89 - i * 2.54)); });
      g.textAlign = 'center'; g.font = `800 ${1.25 * mm}px "Barlow Condensed", sans-serif`;
      g.fillText('MOTOR', X(0), Y(-7.0)); g.fillText('DRIVER', X(0), Y(-8.4));
    },
  },
  { // laser marking on the chip
    at: [0, -1.5, 1.6 + 1.405], size: [5.6, 7.8], px: 80,
    draw(g, w, h) {
      const mm = w / 5.6;
      g.fillStyle = 'rgba(210,210,215,.75)'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.save(); g.translate(w / 2, h / 2); g.rotate(-Math.PI / 2);
      g.font = `600 ${0.85 * mm}px "JetBrains Mono", monospace`; g.fillText('TB6612', 0, -0.6 * mm);
      g.font = `600 ${0.75 * mm}px "JetBrains Mono", monospace`; g.fillText('FNG', 0, 0.5 * mm);
      g.restore();
      g.beginPath(); g.arc(1 * mm, h - 1 * mm, 0.3 * mm, 0, 7); g.fill(); // pin-1 dot
    },
  },
];
