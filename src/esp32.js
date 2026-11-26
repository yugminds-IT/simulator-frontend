// ESP32 DevKit V1 (30-pin) reference data: what each part and pin does, the printed artwork
// (silkscreen + module label, drawn at runtime so the .glb stays texture-free) and a small schematic.
// Pin functions: Espressif ESP32 datasheet (ADC/touch/DAC/strapping/input-only).

export const PIN_GPIO = { d15: 15, d2: 2, d4: 4, rx2: 16, tx2: 17, d5: 5, d18: 18, d19: 19, d21: 21, rx0: 3, tx0: 1, d22: 22, d23: 23,
  d13: 13, d12: 12, d14: 14, d27: 27, d26: 26, d25: 25, d33: 33, d32: 32, d35: 35, d34: 34, vn: 39, vp: 36 };
export const GPIO_PIN = Object.fromEntries(Object.entries(PIN_GPIO).map(([k, v]) => [v, k]));

// [label, tags, note]
export const PIN_INFO = {
  '3v3': ['3V3', ['power'], '3.3 V out from the on-board regulator. Power for sensors — never feed 5 V into a GPIO.'],
  gnd_1: ['GND', ['ground'], 'Ground (0 V). Every circuit needs a path back to GND.'],
  gnd_2: ['GND', ['ground'], 'Ground (0 V).'],
  vin: ['VIN', ['power'], '5 V in: from USB, or feed 5 V here to power the board.'],
  en: ['EN', ['reset'], 'Chip enable. Pulled HIGH; pulling it LOW resets the ESP32 (that is what the EN button does).'],
  d15: ['GPIO15', ['digital', 'pwm', 'adc2', 'touch', 'strap'], 'ADC2_CH3, TOUCH3. Strapping pin: keep HIGH at boot to see boot messages.'],
  d2: ['GPIO2', ['digital', 'pwm', 'adc2', 'touch', 'strap'], 'ADC2_CH2, TOUCH2. Drives the blue on-board LED. Must be LOW or floating to upload.'],
  d4: ['GPIO4', ['digital', 'pwm', 'adc2', 'touch'], 'ADC2_CH0, TOUCH0.'],
  rx2: ['GPIO16 · RX2', ['digital', 'pwm', 'uart'], 'UART2 receive.'],
  tx2: ['GPIO17 · TX2', ['digital', 'pwm', 'uart'], 'UART2 transmit.'],
  d5: ['GPIO5', ['digital', 'pwm', 'spi', 'strap'], 'VSPI CS. Strapping pin (outputs a PWM signal at boot).'],
  d18: ['GPIO18', ['digital', 'pwm', 'spi'], 'VSPI clock (SCK).'],
  d19: ['GPIO19', ['digital', 'pwm', 'spi'], 'VSPI MISO.'],
  d21: ['GPIO21 · SDA', ['digital', 'pwm', 'i2c'], 'Default I2C data (SDA) — the kit\'s I2C port.'],
  rx0: ['GPIO3 · RX0', ['uart'], 'UART0 receive, wired to the USB serial chip. Avoid using it in projects.'],
  tx0: ['GPIO1 · TX0', ['uart'], 'UART0 transmit, wired to the USB serial chip: the serial monitor and boot log.'],
  d22: ['GPIO22 · SCL', ['digital', 'pwm', 'i2c'], 'Default I2C clock (SCL) — the kit\'s I2C port.'],
  d23: ['GPIO23', ['digital', 'pwm', 'spi'], 'VSPI MOSI.'],
  d13: ['GPIO13', ['digital', 'pwm', 'adc2', 'touch'], 'ADC2_CH4, TOUCH4.'],
  d12: ['GPIO12', ['digital', 'pwm', 'adc2', 'touch', 'strap'], 'ADC2_CH5, TOUCH5. Strapping pin: must be LOW at boot (sets flash voltage).'],
  d14: ['GPIO14', ['digital', 'pwm', 'adc2', 'touch'], 'ADC2_CH6, TOUCH6.'],
  d27: ['GPIO27', ['digital', 'pwm', 'adc2', 'touch'], 'ADC2_CH7, TOUCH7.'],
  d26: ['GPIO26', ['digital', 'pwm', 'adc2', 'dac'], 'ADC2_CH9, DAC2 (true analog output).'],
  d25: ['GPIO25', ['digital', 'pwm', 'adc2', 'dac'], 'ADC2_CH8, DAC1 (true analog output).'],
  d33: ['GPIO33', ['digital', 'pwm', 'adc1', 'touch'], 'ADC1_CH5, TOUCH8.'],
  d32: ['GPIO32', ['digital', 'pwm', 'adc1', 'touch'], 'ADC1_CH4, TOUCH9.'],
  d35: ['GPIO35', ['input', 'adc1'], 'ADC1_CH7. Input only: no output, no internal pull-up.'],
  d34: ['GPIO34', ['input', 'adc1'], 'ADC1_CH6. Input only: no output, no internal pull-up.'],
  vn: ['GPIO39 · VN', ['input', 'adc1'], 'ADC1_CH3. Input only.'],
  vp: ['GPIO36 · VP', ['input', 'adc1'], 'ADC1_CH0. Input only.'],
};
export const TAG_NOTE = { adc2: 'ADC2 stops working while Wi-Fi is on — use ADC1 pins (32–39) for analog with Wi-Fi.' };

export const PART_INFO = {
  module: ['ESP32-WROOM-32', 'Two 240 MHz cores, 520 KB RAM, 4 MB flash, Wi-Fi and Bluetooth under one metal shield.'],
  module_shield: ['ESP32-WROOM-32', 'Two 240 MHz cores, 520 KB RAM, 4 MB flash, Wi-Fi and Bluetooth under one metal shield.'],
  module_pads: ['Module pads', 'Castellated pads solder the module to the DevKit board.'],
  antenna: ['PCB antenna', 'A copper zig-zag that sends and hears 2.4 GHz Wi-Fi and Bluetooth. Keep metal away from it.'],
  usb: ['Micro-USB port', 'Powers the board, uploads sketches and carries the serial monitor. Click it to plug or unplug the cable.'],
  usb_port: ['Micro-USB port', 'Powers the board, uploads sketches and carries the serial monitor. Click it to plug or unplug the cable.'],
  btn_boot: ['BOOT button', 'Connected to GPIO0. Hold BOOT and tap EN to put the ESP32 into upload (download) mode.'],
  btn_en: ['EN button', 'Resets the ESP32: your program starts again from setup(). Click it to try.'],
  usb_uart: ['USB-to-serial chip', 'Turns USB into the UART the ESP32 understands (TX0/RX0) for uploads and Serial.print.'],
  regulator: ['3.3 V regulator', 'Turns the 5 V from USB or VIN into the 3.3 V the ESP32 needs.'],
  led_gpio2: ['Blue LED', 'Wired to GPIO 2 through a resistor: HIGH turns it on.'],
  led_power: ['Power LED', 'Lights whenever the board has power.'],
  header_l: ['Left pins', '3V3, GND, GPIOs 15 → 23 and the UART pins.'],
  header_r: ['Right pins', 'VIN, GND, GPIOs 13 → 39, and EN.'],
  passives: ['Resistors and capacitors', 'Smooth the power and set the LED currents.'],
  passive_ends: ['Resistors and capacitors', 'Smooth the power and set the LED currents.'],
  body: ['DevKit board', 'Carries the module, USB, regulator and the two 15-pin headers.'],
};

const LEFT = ['3V3', 'GND', 'D15', 'D2', 'D4', 'RX2', 'TX2', 'D5', 'D18', 'D19', 'D21', 'RX0', 'TX0', 'D22', 'D23'];
const RIGHT = ['VIN', 'GND', 'D13', 'D12', 'D14', 'D27', 'D26', 'D25', 'D33', 'D32', 'D35', 'D34', 'VN', 'VP', 'EN'];

// Decals in model millimetres (Blender axes: +Y = USB end). Each: { at:[x,y,z], size:[w,d], px, draw(ctx, w, h) }
export const ESP32_DECALS = [
  { // silkscreen over the whole board top
    at: [0, 0, 1.605], size: [28.2, 51.8], px: 40,
    draw(g, w, h) {
      const mm = w / 28.2, X = (x) => w / 2 + x * mm, Y = (y) => h / 2 - y * mm;
      g.fillStyle = g.strokeStyle = '#f2efe6';
      g.lineWidth = 0.14 * mm;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const label = (t, x, y, size, rot = 0, weight = 700) => {
        g.save(); g.translate(X(x), Y(y)); g.rotate(rot); g.font = `${weight} ${size * mm}px "Barlow Condensed", sans-serif`; g.fillText(t, 0, 0); g.restore();
      };
      LEFT.forEach((t, i) => label(t, -9.95, 17.78 - i * 2.54, 1.05, -Math.PI / 2));
      RIGHT.forEach((t, i) => label(t, 9.95, 17.78 - i * 2.54, 1.05, Math.PI / 2));
      label('ESP32 DEVKIT V1', 0, 1.7, 1.7, 0, 700);
      label('BOOT', -7.8, 18.6, 1.05); label('EN', 7.8, 18.6, 1.05);
      label('PWR', 4, 6.4, 0.9); label('IO2', -4, 6.4, 0.9);
      g.strokeRect(X(-10.3), Y(22.9), 5 * mm, 3.4 * mm); g.strokeRect(X(5.3), Y(22.9), 5 * mm, 3.4 * mm);
      [[-11.43, 17.78], [11.43, 17.78]].forEach(([x, y]) => g.strokeRect(X(x) - 1.05 * mm, Y(y) - 1.05 * mm, 2.1 * mm, 2.1 * mm)); // pin-1 squares
    },
  },
  { // laser marking on the WROOM-32 shield
    at: [0, -9.8, 4.705], size: [16, 17.6], px: 36,
    draw(g, w, h) {
      const mm = w / 16;
      g.fillStyle = g.strokeStyle = 'rgba(60,62,68,.85)';
      g.lineWidth = 0.32 * mm; g.lineCap = 'round';
      const cx = 4 * mm, cy = 4.2 * mm; // wifi mark
      for (let r = 1; r <= 3; r++) { g.beginPath(); g.arc(cx, cy + 1.6 * mm, r * 1.1 * mm, -Math.PI * 0.78, -Math.PI * 0.22); g.stroke(); }
      g.beginPath(); g.arc(cx, cy + 1.6 * mm, 0.35 * mm, 0, Math.PI * 2); g.fill();
      g.textBaseline = 'alphabetic';
      g.font = `800 ${2.6 * mm}px "Barlow Condensed", sans-serif`; g.fillText('ESP32', 7 * mm, 6 * mm);
      g.font = `600 ${1.25 * mm}px "Barlow Condensed", sans-serif`; g.fillText('WROOM-32', 7.2 * mm, 7.7 * mm);
      g.font = `500 ${0.95 * mm}px "JetBrains Mono", monospace`;
      ['Wi-Fi · BT · BLE', 'FCC ID: 2AC7Z-ESPWROOM32', 'R 211-161007'].forEach((t, i) => g.fillText(t, 1.6 * mm, (10.4 + i * 1.35) * mm));
      g.lineWidth = 0.2 * mm; g.strokeRect(1.6 * mm, 14.4 * mm, 3 * mm, 1.9 * mm);
      g.font = `700 ${1.3 * mm}px "Barlow Condensed", sans-serif`; g.fillText('CE', 2.3 * mm, 15.85 * mm);
    },
  },
];

// Tiny schematic of what is on the DevKit around the module (SVG, 240 × 190)
export const ESP32_SCHEMATIC = `<svg viewBox="0 0 240 190" class="sch" aria-label="ESP32 DevKit schematic">
<rect x="8" y="10" width="46" height="172" rx="3"/><text x="13" y="22" class="b">ESP32</text>
<text x="50" y="40" class="r">GPIO2</text><path d="M54 37h28l4-5 5 10 5-10 5 10 4-5h12"/><path d="M119 31l10 6-10 6zM129 31v12M137 37h14v8M146 45h10M148 48h6"/><text x="114" y="27">blue LED</text>
<text x="50" y="72" class="r">GPIO0</text><path d="M54 69h70M124 63l14 6M138 69h13v8M146 77h10M148 80h6"/><text x="120" y="60">BOOT</text>
<text x="50" y="102" class="r">EN</text><path d="M54 99h70M124 93l14 6M138 99h13v8M146 107h10M148 110h6"/><text x="124" y="90">EN</text>
<text x="50" y="138" class="r">3V3</text><path d="M54 135h120"/><rect x="174" y="120" width="44" height="34"/><text x="178" y="116" class="b">Regulator</text><text x="180" y="134">IN</text><text x="180" y="146">OUT</text>
<path d="M200 128h28M200 140h-26"/><text x="214" y="124" class="red">5 V</text>
<text x="50" y="168" class="r">VIN</text><path d="M54 165h40"/><text x="98" y="168" class="red">5 V</text>
</svg>`;
