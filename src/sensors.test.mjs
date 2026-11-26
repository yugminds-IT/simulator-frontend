// Run: node src/sensors.test.mjs — sensor curves and node-name mapping for the gas and mic pages.
import assert from 'node:assert/strict';
import { SENSORS, sensorKey, mq2, probe, ttp223, ldrVolts, irVolts, dht11Frame, echoUs, usToCm, servoPulseMs, jrBoard } from './sensors.js';

assert.ok(mq2(0) < 0.6 && mq2(100) > 3.5 && mq2(60) > mq2(40));   // more gas, more volts
assert.equal(SENSORS.mic.read(50), 2.5);
assert.equal(SENSORS.mic.read(120), 5);
assert.ok(probe(0) > 4.9 && Math.abs(probe(50) - 2.5) < 1e-9 && probe(100) < 0.1); // wetter → lower H1 voltage
assert.ok(ldrVolts(0) > 4.8 && ldrVolts(100) < 0.1 && ldrVolts(40) > ldrVolts(60)); // brighter → lower H1 voltage
assert.ok(irVolts(3) < 1 && irVolts(20) > 3.5 && irVolts(10) < 2.5 && irVolts(12) > 2.5); // white paper trips at ~11 cm (R6 2.5 V)
assert.ok(irVolts(3, false) > irVolts(3) && irVolts(10, false) > 2.5);                 // black is seen only up close
assert.deepEqual(dht11Frame(26, 55), [55, 0, 26, 0, 81]);                       // checksum = sum of the four bytes
assert.equal(dht11Frame(50, 90)[4], 140); assert.equal(dht11Frame(130, 200)[4], (200 + 130) & 0xff); // wraps at 8 bits
assert.ok(Math.abs(echoUs(100) - 5831) < 1 && Math.abs(usToCm(echoUs(37)) - 37) < 1e-9); // 1 m → ~5.8 ms there and back
assert.deepEqual([0, 90, 180, 270].map(servoPulseMs), [1, 1.5, 2, 2]);            // 1–2 ms, clamped
{ // Jr. Explorer: IPn -> OPn while powered; motors from output pairs
  assert.deepEqual(jrBoard([1, 0, 0, 1], true), { op: [1, 0, 0, 1], motorA: 1, motorB: -1 });
  assert.deepEqual(jrBoard([1, 1, 0, 0], true).motorA, 'brake');
  assert.deepEqual(jrBoard([1, 1, 1, 1], false), { op: [0, 0, 0, 0], motorA: 0, motorB: 0 }); // SW1 off: nothing moves
}
const t = { q: 0, last: false, tog: 0, ahlb: 0 };
assert.equal(ttp223(t, true), 1); assert.equal(ttp223(t, false), 0);              // momentary, active HIGH
t.ahlb = 1; assert.equal(ttp223(t, false), 1); assert.equal(ttp223(t, true), 0);    // J2: active LOW
Object.assign(t, { ahlb: 0, tog: 1, last: false, q: 0 });
assert.equal(ttp223(t, true), 1); assert.equal(ttp223(t, true), 1); assert.equal(ttp223(t, false), 1); assert.equal(ttp223(t, true), 0); // J1: toggle on each new touch
const cases = { gas: [['gas_xh_pin_1', 'pin3'], ['gas_xh_pin_3', 'pin1'], ['gas_mq_cap', 'mq'], ['gas_pot_screw', 'pot'], ['gas_element', 'heater'], ['gas_led_signal_ends', 'led_signal'], ['gas_smd_4', 'lm393']],
  mic: [['mic_mic_felt', 'mic'], ['mic_mic_legs', 'mic'], ['mic_mic', 'mic'], ['mic_lm393_legs', 'lm393'], ['mic_xh_pin_2', 'pin2'], ['mic_pot', 'pot']],
  soil: [['soil_probe_b', 'probe'], ['soil_wire_red', 'jumper'], ['soil_h1_holes', 'h1'], ['soil_probe_header', 'probe_header'], ['soil_xh_pin_3', 'pin1']],
  rain: [['rain_comb', 'plate'], ['rain_plate_h1', 'plate_h1'], ['rain_jumper_b', 'jumper'], ['rain_led_power_ends', 'led_power']],
  ir: [['ir_ir_led_legs', 'ir_led'], ['ir_ir_led_frame', 'ir_led'], ['ir_receiver_die', 'receiver'], ['ir_receiver', 'receiver'], ['ir_xh_pin_2', 'pin2']],
  ldr: [['ldr_ldr_comb', 'ldr'], ['ldr_ldr_legs', 'ldr'], ['ldr_xh_pin_1', 'pin3'], ['ldr_pot_screw', 'pot']],
  servo: [['servo_tabs', 'body'], ['servo_horn_holes', 'horn'], ['servo_plug_holes', 'lead'], ['servo_wire_signal', 'lead'], ['servo_gears', 'gears']],
  jr_board: [['jr_board_ip3_pin_2', 'ip3'], ['jr_board_op1', 'op1'], ['jr_board_led4_frame', 'led4'], ['jr_board_u1_legs', 'u1'], ['jr_board_c5', 'caps'], ['jr_board_cn2_pin_1', 'cn2'], ['jr_board_sw1_cap', 'sw1'], ['jr_board_u3_hole', 'u3'], ['jr_board_c3_top', 'c3']],
  ultrasonic: [['ultrasonic_transmitter_mesh', 'transmitter'], ['ultrasonic_crystal', 'us_pcb'], ['ultrasonic_us_spacer', 'header'], ['ultrasonic_xh_pin_2', 'pin2']],
  button: [['button_plate', 'cap'], ['button_legs', 'cap'], ['button_r_1_ends', 'r_1'], ['button_xh_pin_1', 'pin3']],
  dht11: [['dht11_grille', 'sensor'], ['dht11_sensor_legs', 'sensor'], ['dht11_r_3_ends', 'r_3'], ['dht11_led_power', 'led_power'], ['dht11_xh_pin_3', 'pin1']],
  led: [['led_legs', 'lens'], ['led_lens_frame', 'lens'], ['led_lens', 'lens'], ['led_r_1_ends', 'r_1'], ['led_xh_pin_1', 'pin3']],
  buzzer: [['buzzer_mark', 'body'], ['buzzer_transistor_legs', 'transistor'], ['buzzer_r_1_ends', 'r_1'], ['buzzer_xh_pin_1', 'pin3']],
  traffic: [['traffic_led_red_legs', 'led_red'], ['traffic_led_green_die', 'led_green'], ['traffic_led_green', 'led_green'], ['traffic_xh_pin_4', 'pin4']],
  oled: [['oled_glass', 'module'], ['oled_header_pins', 'header'], ['oled_xh_pin_1', 'pin1'], ['oled_xh_pin_4', 'pin4'], ['oled_flex', 'flex']],
  touch: [['touch_pad', 'pad'], ['touch_ttp223_legs', 'ttp223'], ['touch_j1_solder', 'j1'], ['touch_c2_ends', 'caps'], ['touch_xh_pin_3', 'pin3'], ['touch_xh_pin_1', 'pin1'], ['touch_led', 'led']] };
for (const [id, list] of Object.entries(cases)) for (const [n, k] of list) { assert.equal(sensorKey(id, n), k, n); assert.ok(SENSORS[id].part[k], k); }
assert.equal(SENSORS.led.decals('green'), SENSORS.led.decals('green'));            // memoised: same colour, same artwork
assert.notEqual(SENSORS.led.decals('red'), SENSORS.led.decals('green'));
console.log('sensors: all checks passed');
