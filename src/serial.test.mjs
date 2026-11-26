// Run: node src/serial.test.mjs — serial monitor helpers (wrong-baud garbling, plotter number parsing).
import assert from 'node:assert/strict';
import { garble, firstNumber } from './serial.js';

assert.equal([...garble('Hello')].length, 5);            // same number of characters...
assert.notEqual(garble('Hello'), 'Hello');                // ...but nonsense
assert.equal(garble('Hello'), garble('Hello'));           // and the same nonsense every time
assert.equal(firstNumber('30.1 cm'), 30.1);
assert.equal(firstNumber('Temp: -4 C'), -4);
assert.equal(firstNumber('light 2048'), 2048);
assert.equal(firstNumber('Hello, Robo Coders!'), null);
console.log('serial: all checks passed');
