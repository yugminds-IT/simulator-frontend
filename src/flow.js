// The "Program flow" card in the drive arena: the book's program for each course as a small flowchart.
// While the program drives, the step the car is doing right now lights up (read from the car's sensors and wheels).
const box = (id, x, y, w, t, cls = 'n') => `<g class="${cls}" data-n="${id}"><rect x="${x}" y="${y}" width="${w}" height="24" rx="${cls === 'pill' ? 12 : 6}"/><text x="${x + w / 2}" y="${y + 15.5}">${t}</text></g>`;
const dia = (id, cx, cy, t, hw = 30) => `<g class="d" data-n="${id}"><path d="M${cx - hw} ${cy}L${cx} ${cy - 19}L${cx + hw} ${cy}L${cx} ${cy + 19}Z"/><text x="${cx}" y="${cy + 3.5}">${t}</text></g>`;
const ln = (d) => `<path class="e" d="${d}"/>`, lab = (x, y, t) => `<text class="l" x="${x}" y="${y}">${t}</text>`;

/** read → question → yes / no, then round again (obstacle avoidance, manual drive) */
const decide = (read, q, yes, no) => ln('M44 62H58M134 62H150M180 43V26H222M180 81V98H222M350 26H356V114H96V74M350 98H356')
  + lab(186, 38, 'yes') + lab(186, 92, 'no') + box('start', 4, 50, 40, 'Start', 'pill') + box('read', 58, 50, 76, read) + dia('q', 180, 62, q) + box('yes', 222, 14, 128, yes) + box('no', 222, 86, 128, no);

const FLOWS = {
  obstacle: decide('Read distance', '&lt; 20 cm?', 'Stop · turn right', 'Drive forward'),
  manual: decide('Read D35', 'Pressed?', 'Drive forward', 'Stop'),
  line: ln('M40 62H52M116 62H122M170 62H184M232 62H246M294 62H304M146 43V34M208 43V34M270 43V34M146 10V4H354V114H84V74M208 10V4M270 10V4M328 74V114')
    + lab(297, 57, 'no')
    + box('start', 2, 50, 38, 'Start', 'pill') + box('read', 52, 50, 64, 'Read L · R')
    + dia('d1', 146, 62, 'L0 R0?', 24) + dia('d2', 208, 62, 'L1 R0?', 24) + dia('d3', 270, 62, 'L0 R1?', 24)
    + box('s', 116, 10, 60, 'Straight') + box('l', 178, 10, 60, 'Steer left') + box('r', 240, 10, 60, 'Steer right') + box('lost', 304, 50, 50, 'Stop'),
  pattern: ln('M42 62H52M126 62H136M200 62H212M286 62H296M354 62H357V108H89V74')
    + box('start', 2, 50, 40, 'Start', 'pill') + box('fwd', 52, 50, 74, 'Forward 1 s') + box('p1', 136, 50, 64, 'Pause') + box('turn', 212, 50, 74, 'Turn 0.5 s') + box('p2', 296, 50, 58, 'Pause'),
};
export const flowSvg = (course) => `<svg viewBox="0 0 360 120" role="img" aria-label="Flowchart of the program">${FLOWS[course] || ''}</svg>`;

/** the steps lit right now; `s` = { L, R, near, lineL, lineR, pressed, last } (`last`: the pattern's last move, so a pause knows which side it is on) */
export function flowActive(course, s) {
  const moving = s.L || s.R;
  if (course === 'obstacle') return ['read', 'q', s.near || !moving || s.L !== s.R ? 'yes' : 'no'];
  if (course === 'manual') return ['read', 'q', s.pressed ? 'yes' : 'no'];
  if (course === 'line') {
    const [l, r] = [+!!s.lineL, +!!s.lineR];
    return ['read', 'd1', ...(!l && !r ? ['s'] : ['d2', ...(l && !r ? ['l'] : ['d3', !l && r ? 'r' : 'lost'])])];
  }
  if (course === 'pattern') return [s.L * s.R < 0 ? 'turn' : moving ? 'fwd' : s.last === 'turn' ? 'p2' : 'p1'];
  return [];
}
