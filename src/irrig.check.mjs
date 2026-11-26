// node src/irrig.check.mjs — the IR module's yes/no follows the surface and the trimmer
import assert from 'node:assert/strict';
import { irVolts, irRange, IR_THINGS } from './irrig.js';
const [white, hand, black] = ['white', 'hand', 'black'].map((k) => IR_THINGS[k][2]);
assert.ok(irRange(white, 2.5) > irRange(hand, 2.5) && irRange(hand, 2.5) > irRange(black, 2.5), 'white seen farthest, black closest');
assert.ok(Math.abs(irVolts(irRange(hand, 2.5), hand) - 2.5) < 1e-9, 'range is where the node crosses the trimmer');
assert.ok(irRange(white, 4) > irRange(white, 2.5), 'turning R6 up makes it more sensitive');
assert.ok(irVolts(5, white) < irVolts(20, white), 'closer = more light back = lower voltage');
console.log('irrig ok · ranges at 2.5 V:', ['white', 'hand', 'black'].map((k) => `${k} ${irRange(IR_THINGS[k][2], 2.5).toFixed(1)} cm`).join(', '));
