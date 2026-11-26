// Simulated ESP32 + kit for block programs: GPIO state, wiring (port → GPIO → module effect),
// sound, warnings that teach, and a signal history for the plot.
import { PORTS, ANALOG_PARAM } from './kit.js';
import { GPIO_TB, TB_GPIO, bridge } from './tb6612.js';

const LED_COLOR = { red: 0xff2a1a, yellow: 0xffc21a, green: 0x22ff55 };

/**
 * kit: { esp (root or null for a single-model scene), modules: [{id, port, tint, root, wires}] }
 * io:  { param(key) → number, serial(text, kind?), step(statement), pin(gpio, v) }
 */
export function createHw(stage, kit, io) {
  const pins = new Map(), history = [], wake = new Set(), warned = new Set(), pressed = new Set();
  const t0 = performance.now();
  let stopped = false, audio = null, osc = null;
  const scr = { on: false, rows: [], x: 0, y: 0 }; // OLED buffer for the RC Studio oled blocks
  const now = () => performance.now() - t0;
  const warn = (key, msg) => { if (!warned.has(key)) { warned.add(key); io.serial(msg, 'warn'); } };

  const wired = new Map(); // gpio → [{ m, pin }]
  for (const m of kit.modules) {
    for (const [pin, gpio] of Object.entries(PORTS[m.port]?.pins || {})) {
      if (!wired.has(gpio)) wired.set(gpio, []);
      wired.get(gpio).push({ m, pin });
    }
  }
  const on = (gpio) => wired.get(gpio) || [];

  function level(gpio, v) {
    const p = pins.get(gpio) || {};
    if (p.v === v) return;
    pins.set(gpio, { ...p, v });
    history.push([now(), gpio, v]);
    io.pin?.(gpio, v);
  }

  function sound(freq) {
    try {
      audio ||= new AudioContext();
      osc?.stop();
      osc = null;
      if (!freq) return;
      osc = audio.createOscillator();
      const g = audio.createGain();
      osc.type = 'square'; osc.frequency.value = freq; g.gain.value = 0.025;
      osc.connect(g).connect(audio.destination);
      osc.start();
    } catch { /* audio blocked: the simulation still runs silently */ }
  }

  // TB6612: AIN1/AIN2 → motor A (left ports), BIN1/BIN2 → motor B (right ports); STBY and PWM simulated HIGH
  const motor = { a: 0, b: 0 };
  function motors() {
    const v = (k) => pins.get(TB_GPIO[k])?.v || 0;
    motor.a = bridge(v('ain1'), v('ain2'));
    motor.b = bridge(v('bin1'), v('bin2'));
    for (const m of kit.modules.filter((x) => x.id === 'tt_motor')) {
      const s = /^motor_l/.test(m.port) ? motor.a : motor.b, dir = typeof s === 'number' ? s * (/^motor_l/.test(m.port) ? 1 : -1) : 0;
      stage.spin(m.root, 'tt_motor_shaft', dir);
      Object.values(m.wires || {}).forEach((w) => stage.pulse(w, !!dir, 0xffe08a, 1));
    }
    if (kit.chassis) {
      const n = (x) => (typeof x === 'number' ? x : 0);
      ['fl', 'rl'].forEach((w) => stage.spin(kit.chassis, `chassis_wheel_${w}`, -n(motor.a)));
      ['fr', 'rr'].forEach((w) => stage.spin(kit.chassis, `chassis_wheel_${w}`, -n(motor.b)));
      if (!kit.noDrive) stage.drive(kit.group, motor.a, motor.b); // line follower: wheels spin, the tape moves instead
    }
    io.motor?.(motor);
  }

  function effect(gpio, v) {
    if (GPIO_TB[gpio]) motors();
    if (gpio === 2) stage.glow(kit.esp, 'esp32_led_gpio2', v, 0x3b7bff, 'anchor_esp32_led_gpio2');
    for (const { m, pin } of on(gpio)) {
      stage.pulse(m.wires?.[`pin${pin}`], !!v);
      if (m.id === 'led') stage.glow(m.root, 'led_lens', v, LED_COLOR[m.tint || 'red'], 'anchor_led_led');
      if (m.id === 'traffic') { const c = PORTS.rgy.roles[gpio]; stage.glow(m.root, `traffic_led_${c}`, v, LED_COLOR[c], `anchor_traffic_${c}`); }
      if (m.id === 'buzzer') { stage.vibrate(m.root, 'buzzer_body', !!v, 'anchor_buzzer_buzzer'); sound(v ? 2300 : 0); }
    }
    if (v && gpio !== 2 && !on(gpio).length && !GPIO_TB[gpio]) warn(`nc${gpio}`, `IO${gpio} is HIGH, but nothing is plugged into that port.`);
  }

  const sense = (g) => hw.sense(g);
  const hw = {
    history, pins, now,
    stopped: () => stopped,
    step: io.step,
    sleep: (ms) => new Promise((res) => {
      if (kit.chassis) stage.leash?.(ms + 50); // the car drives while its program is awake: this wait, plus a little for the next line
      const done = () => { clearTimeout(t); wake.delete(done); res(); };
      const t = setTimeout(done, ms);
      wake.add(done);
    }),
    mode(gpio, m) {
      if (m === 'output' && gpio >= 34) warn(`in${gpio}`, `IO${gpio} is input-only: it can't drive an output.`);
      pins.set(gpio, { ...(pins.get(gpio) || {}), mode: m });
      level(gpio, m === 'input' ? hw.read(gpio) : 0);
    },
    write(gpio, v) {
      if (pins.get(gpio)?.mode !== 'output') warn(`mode${gpio}`, `IO${gpio} isn't set as an output yet: add "set pin IO${gpio} mode output" at the start.`);
      if (gpio >= 34) return;
      level(gpio, v);
      effect(gpio, v);
    },
    read(gpio) { // an input pin's chip and plot follow what the program reads
      const v = sense(gpio);
      if (pins.get(gpio)?.mode === 'input') level(gpio, v);
      return v;
    },
    sense(gpio) {
      const m = on(gpio)[0]?.m;
      if (!m) return 0;
      const own = io.digital?.(m); if (own != null) return own; // lessons with a light source supply the LDR's DO
      if (m.id === 'button' || m.id === 'touch') return pressed.has(gpio) ? 1 : 0; // touch: default jumpers, OUT HIGH while touched
      return ANALOG_PARAM[m.id] ? +(io.param(ANALOG_PARAM[m.id]) > 50) : 0;
    },
    analog(gpio) {
      const m = on(gpio)[0]?.m;
      if (!m || !ANALOG_PARAM[m.id]) { warn(`an${gpio}`, `Nothing analog is plugged into IO${gpio}, so it reads 0.`); return 0; }
      const own = io.analog?.(m); if (own != null) return own; // lessons with a light source supply the real reading
      return Math.round((io.param(ANALOG_PARAM[m.id]) / 100) * 4095 + (Math.random() - 0.5) * 20);
    },
    tone(gpio, freq, ms) {
      const bz = on(gpio).find((x) => x.m.id === 'buzzer');
      if (!bz) warn(`tone${gpio}`, `Playing a tone on IO${gpio}, but the buzzer isn't on that port.`);
      level(gpio, 1);
      if (bz) { stage.vibrate(bz.m.root, 'buzzer_body', true, 'anchor_buzzer_buzzer'); stage.pulse(bz.m.wires?.[`pin${bz.pin}`], true); sound(freq); }
      setTimeout(() => {
        if (stopped) return;
        level(gpio, 0);
        if (bz) { stage.vibrate(bz.m.root, 'buzzer_body', false); stage.pulse(bz.m.wires?.[`pin${bz.pin}`], false); sound(0); }
      }, Math.max(ms - 15, 0));
    },
    serial: (s) => io.serial(s),
    servo(gpio, deg) {
      const s = on(gpio).find((x) => x.m.id === 'servo');
      if (!s) { warn(`sv${gpio}`, `No servo on IO${gpio}.`); return; }
      stage.rotate(s.m.root, 'servo_horn', Math.max(0, Math.min(180, deg)) - 90);
      level(gpio, 1); setTimeout(() => level(gpio, 0), 20);
    },
    distance: () => (io.distance ? io.distance() : io.param('cm') + (Math.random() - 0.5) * 0.6), // lessons with an obstacle supply their own echo
    temperature: () => Math.round(io.param('t') + (Math.random() - 0.5) * 0.8), // DHT11 reports whole degrees (decimal byte is 0)
    oledInit() { scr.on = true; scr.rows = []; },
    oledClear() { scr.rows = []; },
    oledCursor(x, y) { scr.x = x; scr.y = y; },
    oledPrint(t) { // 6 x 8 font: 21 columns, 8 rows; the cursor moves on like Adafruit print()
      const r = Math.floor(scr.y / 8), c = Math.floor(scr.x / 6), row = (scr.rows[r] || '').padEnd(c);
      scr.rows[r] = row.slice(0, c) + t + row.slice(c + t.length); scr.x += t.length * 6;
    },
    oledShow() {
      if (!scr.on) return warn('oledinit', 'The OLED stays dark: add "init oled" at the start of the program.');
      hw.oled(Array.from({ length: 8 }, (_, i) => scr.rows[i] || '').join('\n').trimEnd() || ' ');
    },
    oled(text) {
      const o = kit.modules.find((m) => m.id === 'oled');
      if (o) stage.oled(o.root, text);
      stage.setCalloutText('anchor_oled_screen', text);
      io.serial(`[OLED] ${text}`);
    },
    press(root, down) { // a button module was pressed in 3D
      const m = kit.modules.find((x) => x.root === root || x.root === root.parent);
      if (!m) return;
      if (m.id === 'touch') stage.glow(m.root, 'touch_led', down, 0xffd21a, 'anchor_touch_led', 6);
      else stage.press(m.root, 'button_cap', down);
      for (const [pin, gpio] of Object.entries(PORTS[m.port]?.pins || {})) {
        down ? pressed.add(gpio) : pressed.delete(gpio);
        level(gpio, down ? 1 : 0);
        stage.pulse(m.wires?.[`pin${pin}`], down, 0x9be7ff, -1);
      }
    },
    stop() {
      stopped = true;
      wake.forEach((f) => f());
      sound(0);
      for (const gpio of pins.keys()) if (gpio < 34) effect(gpio, 0);
      if (kit.chassis) { stage.leash?.(0); ['fl', 'fr', 'rl', 'rr'].forEach((w) => stage.spin(kit.chassis, `chassis_wheel_${w}`, 0)); stage.drive(kit.group, 0, 0); }
      kit.modules.forEach((m) => {
        if (m.id === 'tt_motor') stage.spin(m.root, 'tt_motor_shaft', 0);
        if (m.id === 'buzzer') stage.vibrate(m.root, 'buzzer_body', false);
        if (m.id === 'oled') stage.oled(m.root, '');
        Object.values(m.wires || {}).forEach((w) => stage.pulse(w, false));
      });
    },
  };
  return hw;
}
