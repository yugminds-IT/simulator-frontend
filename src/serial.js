// Serial monitor, Arduino-IDE style: a status light, baud rate (a wrong one garbles the text like real hardware),
// timestamps, auto-scroll, clear, and a plotter that graphs the numbers the sketch prints.

const GARBLE = '⸮�xÞÿ¿ø~Ãþ';
/** What a monitor at the wrong baud rate shows: the same number of bytes, but nonsense. Deterministic per character. */
export const garble = (s) => [...s].map((c) => GARBLE[(c.charCodeAt(0) * 7) % GARBLE.length]).join('');
/** First number in a line ("12.5 cm" → 12.5), or null. The plotter graphs these. */
export const firstNumber = (s) => { const m = String(s).match(/-?\d+(?:\.\d+)?/); return m ? +m[0] : null; };
const stamp = (ms) => new Date(ms).toTimeString().slice(0, 8) + '.' + String(Math.floor(ms % 1000)).padStart(3, '0');

/**
 * root: the .monitor element (contains .serial log, canvas.plot, header controls).
 * Program output lines (kind '') are what the sketch printed; 'sys' lines are the IDE talking (upload log),
 * 'boot' is the ESP32 ROM, 'warn' are hints. Only program lines are affected by baud and fed to the plotter.
 */
export function createMonitor(root, store) {
  const log = root.querySelector('.serial'), plot = root.querySelector('.plot');
  const opt = { time: store.get('monTime', false), scroll: true, baud: store.get('monBaud', 115200), tab: 'text' };
  let lines = [], values = [], sketchBaud = 115200;

  const text = (l) => (l.kind === '' && opt.baud !== sketchBaud ? garble(l.text) : l.text);
  const row = (l) => {
    const d = document.createElement('div');
    if (l.kind) d.className = l.kind;
    if (opt.time) { const t = document.createElement('time'); t.textContent = `${stamp(l.t)} → `; d.append(t); }
    d.append(text(l));
    return d;
  };
  const redraw = () => { log.replaceChildren(...lines.map(row)); if (opt.scroll) log.scrollTop = log.scrollHeight; drawPlot(); };

  function drawPlot() {
    if (opt.tab !== 'plot') return;
    const dpr = devicePixelRatio || 1, W = plot.clientWidth, H = plot.clientHeight || 120;
    plot.width = W * dpr; plot.height = H * dpr;
    const g = plot.getContext('2d');
    g.scale(dpr, dpr); g.fillStyle = '#081936'; g.fillRect(0, 0, W, H);
    g.font = '11px "JetBrains Mono", monospace'; g.fillStyle = '#8ea3cc';
    if (!values.length) { g.fillText(opt.baud !== sketchBaud ? 'Wrong baud rate: no numbers can be read' : 'Numbers the sketch prints are graphed here', 12, H / 2); return; }
    let lo = Math.min(...values), hi = Math.max(...values);
    if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.1, y = (v) => 8 + (1 - (v - lo + pad) / (hi - lo + 2 * pad)) * (H - 16), x0 = 44, n = 120;
    g.strokeStyle = '#1b3264';
    [lo, (lo + hi) / 2, hi].forEach((v) => { g.beginPath(); g.moveTo(x0, y(v)); g.lineTo(W - 6, y(v)); g.stroke(); g.fillText(+v.toFixed(2), 4, y(v) + 4); });
    g.strokeStyle = '#f2a33a'; g.lineWidth = 2; g.beginPath();
    values.slice(-n).forEach((v, i, a) => { const px = x0 + (i / Math.max(1, n - 1)) * (W - x0 - 6); i ? g.lineTo(px, y(v)) : g.moveTo(px, y(v)); });
    g.stroke(); g.lineWidth = 1;
  }

  const api = {
    /** add a line; kind: '' program output · 'sys' IDE · 'boot' ROM log · 'warn' hint */
    line(t, kind = '') {
      const l = { t: Date.now(), text: String(t), kind };
      lines.push(l);
      if (lines.length > 400) lines = lines.slice(-300);
      if (kind === '' && opt.baud === sketchBaud) { const v = firstNumber(l.text); if (v != null) { values.push(v); if (values.length > 600) values = values.slice(-400); } }
      log.append(row(l));
      while (log.childElementCount > 400) log.firstChild.remove();
      if (opt.scroll) log.scrollTop = log.scrollHeight;
      if (kind === '') drawPlot();
    },
    clear() { lines = []; values = []; log.replaceChildren(); drawPlot(); },
    /** idle · compiling · uploading · running · stopped · off */
    status(s) { root.dataset.state = s; root.querySelector('.mon-state').textContent = s; },
    set sketchBaud(b) { sketchBaud = b; redraw(); },
    get opt() { return opt; },
  };

  root.querySelector('.mon-baud').value = String(opt.baud);
  root.querySelector('.mon-baud').addEventListener('change', (e) => { opt.baud = +e.target.value; store.set('monBaud', opt.baud); values = []; redraw(); });
  root.querySelectorAll('[data-mon]').forEach((b) => b.addEventListener('click', () => {
    opt.tab = b.dataset.mon;
    root.querySelectorAll('[data-mon]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    log.hidden = opt.tab !== 'text'; plot.hidden = opt.tab !== 'plot';
    drawPlot();
  }));
  root.querySelectorAll('[data-mon-act]').forEach((b) => b.addEventListener('click', () => {
    const a = b.dataset.monAct;
    if (a === 'time') { opt.time = !opt.time; store.set('monTime', opt.time); redraw(); }
    if (a === 'scroll') { opt.scroll = !opt.scroll; if (opt.scroll) log.scrollTop = log.scrollHeight; }
    if (a === 'clear') api.clear();
    if (a === 'fold') root.classList.toggle('folded');
    if (a !== 'clear' && a !== 'fold') b.setAttribute('aria-pressed', String(a === 'time' ? opt.time : opt.scroll));
    if (a === 'fold') b.setAttribute('aria-expanded', String(!root.classList.contains('folded')));
  }));
  root.querySelector('[data-mon-act="time"]').setAttribute('aria-pressed', String(opt.time));
  root.querySelector('[data-mon-act="scroll"]').setAttribute('aria-pressed', 'true');
  api.status('idle');
  return api;
}
