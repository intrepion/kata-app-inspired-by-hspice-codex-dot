// Original educational linear-circuit solver. SI suffixes follow SPICE: M is milli.
const LIMIT = 2500;
function fail(line, message) { throw new Error(`${line ? `Line ${line}: ` : ''}${message}`); }
function number(token, line) {
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(meg|[tgkmunpf])?$/i.exec(token || '');
  if (!m) fail(line, `Invalid numeric value “${token}”. Use a number with an optional SI suffix.`);
  const scales = { t: 1e12, g: 1e9, meg: 1e6, k: 1e3, m: 1e-3, u: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15 };
  const n = Number(m[1]) * (scales[m[2]?.toLowerCase()] ?? 1);
  if (!Number.isFinite(n)) fail(line, 'Numeric value must be finite.');
  return n;
}
export function parseNetlist(text) {
  if (typeof text !== 'string' || text.length > 100000) fail(0, 'Netlist must be text under 100,000 characters.');
  const result = { title: 'Untitled circuit', components: [], nodes: [], analyses: {}, warnings: [] };
  const names = new Set(), nodes = new Set();
  let ended = false;
  const node = (s, line) => {
    if (!/^[a-z0-9_.$-]+$/i.test(s)) fail(line, `Invalid node name “${s}”.`);
    s = s.toLowerCase(); if (s === 'gnd') s = '0'; if (s !== '0') nodes.add(s); return s;
  };
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1;
    let s = raw.trim();
    if (!s || s.startsWith('*')) { if (index === 0 && s.startsWith('*')) result.title = s.slice(1).trim() || result.title; return; }
    s = s.split(/[;$]/)[0].trim(); if (!s) return;
    if (ended) fail(line, 'Content after .end is not supported.');
    const t = s.split(/\s+/), key = t[0].toLowerCase();
    if (key.startsWith('.')) {
      if (key === '.end' && t.length === 1) { ended = true; return; }
      if (!['.op', '.dc', '.ac', '.tran'].includes(key)) fail(line, `Unsupported directive ${t[0]}. Supported: .op, .dc, .ac, .tran, .end.`);
      const kind = key.slice(1); if (result.analyses[kind]) fail(line, `Duplicate ${key} analysis.`);
      let a = { type: kind, line };
      if (kind === 'op') { if (t.length !== 1) fail(line, '.op takes no arguments.'); }
      if (kind === 'dc') {
        if (t.length !== 5) fail(line, 'Use .dc source start stop step.');
        const [start, stop, step] = t.slice(2).map(x => number(x, line));
        if (!step || (stop - start) * step < 0) fail(line, 'DC step must be nonzero and point toward stop.');
        if (Math.floor((stop - start) / step + 1e-9) + 1 > LIMIT) fail(line, `DC sweep exceeds ${LIMIT} points.`);
        a = { ...a, source: t[1].toLowerCase(), start, stop, step };
      }
      if (kind === 'ac') {
        if (t.length !== 5 || t[1].toLowerCase() !== 'dec') fail(line, 'Use .ac dec pointsPerDecade start stop.');
        const [pointsPerDecade, start, stop] = t.slice(2).map(x => number(x, line));
        if (!Number.isInteger(pointsPerDecade) || pointsPerDecade < 1 || start <= 0 || stop < start) fail(line, 'AC requires a positive integer density and 0 < start <= stop.');
        if (Math.ceil(Math.log10(stop / start) * pointsPerDecade) + 1 > LIMIT) fail(line, `AC sweep exceeds ${LIMIT} points.`);
        a = { ...a, pointsPerDecade, start, stop };
      }
      if (kind === 'tran') {
        if (t.length !== 3) fail(line, 'Use .tran step stop.');
        const [step, stop] = t.slice(1).map(x => number(x, line));
        if (step <= 0 || stop <= 0) fail(line, 'Transient step and stop must be positive.');
        if (Math.ceil(stop / step - 1e-10) + 1 > LIMIT) fail(line, `Transient analysis exceeds ${LIMIT} points.`);
        a = { ...a, step, stop };
      }
      result.analyses[kind] = a; return;
    }
    // Short human-readable first-line titles are convenient for examples.
    // Four-token lines are always device statements, never swallowed as titles.
    // Prefix longer or ambiguous titles with '*'.
    if (index === 0 && /^[a-z]{2,}$/i.test(t[0]) && t.length > 1 && t.length < 4 &&
      !t.some(token => /^(?:0|gnd)$/i.test(token))) {
      result.title = s; return;
    }
    const type = key[0].toUpperCase();
    if (!['R', 'C', 'L', 'V', 'I'].includes(type)) fail(line, `Unsupported device ${t[0]}. Only R, C, L, V and I are supported.`);
    if (t.length < 4) fail(line, `${t[0]} needs two nodes and a value.`);
    if (names.has(key)) fail(line, `Duplicate component ${t[0]}.`); names.add(key);
    const c = { name: t[0], type, n1: node(t[1], line), n2: node(t[2], line), line, value: 0 };
    if (c.n1 === c.n2) fail(line, `${c.name} must connect two different nodes.`);
    if ('RCL'.includes(type)) {
      if (t.length !== 4) fail(line, `${c.name} accepts exactly one value.`);
      c.value = number(t[3], line); if (c.value <= 0) fail(line, `${type} value must be positive.`);
    } else {
      let rest = t.slice(3).join(' '); c.dc = 0; c.ac = 0; c.phase = 0;
      const wave = /\b(SIN|PULSE)\s*\(([^()]*)\)/i.exec(rest);
      if (wave) {
        const args = wave[2].trim().split(/[\s,]+/).map(x => number(x, line));
        const kind = wave[1].toUpperCase();
        if (args.length !== (kind === 'SIN' ? 3 : 7)) fail(line, `${kind} requires ${kind === 'SIN' ? 'offset amplitude frequency' : 'v1 v2 delay rise fall width period'}.`);
        if (kind === 'SIN' && args[2] <= 0) fail(line, 'SIN frequency must be positive.');
        if (kind === 'PULSE' && (args.slice(2, 6).some(x => x < 0) || args[6] <= 0 || args[3] + args[4] + args[5] > args[6])) fail(line, 'PULSE timing must be nonnegative and rise + width + fall <= period.');
        c.waveform = { type: kind, args }; rest = rest.replace(wave[0], '').trim();
      }
      const tokens = rest ? rest.split(/\s+/) : []; let p = 0;
      if (tokens[p]?.toUpperCase() === 'DC') { p++; c.dc = number(tokens[p++], line); c.hasDC = true; }
      else if (tokens[p] && tokens[p].toUpperCase() !== 'AC') { c.dc = number(tokens[p++], line); c.hasDC = true; }
      if (tokens[p]?.toUpperCase() === 'AC') {
        p++; c.ac = number(tokens[p++], line);
        if (tokens[p] !== undefined) c.phase = number(tokens[p++], line);
        if (c.ac < 0) fail(line, 'AC amplitude must be nonnegative.');
      }
      if (p !== tokens.length || (!tokens.length && !c.waveform)) fail(line, `Malformed source ${c.name}.`);
      if (!c.hasDC && c.waveform) c.dc = c.waveform.args[0]; c.value = c.dc;
    }
    result.components.push(c);
  });
  result.nodes = [...nodes];
  if (!result.components.length) fail(0, 'Add at least one component.');
  if (nodes.size > 30 || result.components.length > 80) fail(0, 'Circuit limit: 30 non-ground nodes and 80 components.');
  if (!result.components.some(c => c.n1 === '0' || c.n2 === '0')) fail(0, 'Circuit requires a ground node (0 or gnd).');
  if (result.analyses.dc && !result.components.some(c => c.name.toLowerCase() === result.analyses.dc.source && 'VI'.includes(c.type))) fail(result.analyses.dc.line, 'DC sweep target must name an independent voltage or current source.');
  if (!Object.keys(result.analyses).length) result.analyses.op = { type: 'op' };
  return result;
}
function waveform(c, t) {
  if (!c.waveform) return c.dc;
  const a = c.waveform.args;
  if (c.waveform.type === 'SIN') return a[0] + a[1] * Math.sin(2 * Math.PI * a[2] * t);
  const [lo, hi, delay, rise, fall, width, period] = a;
  if (t < delay) return lo;
  const q = (t - delay) % period;
  if (q < rise) return lo + (hi - lo) * q / rise;
  if (q < rise + width) return hi;
  if (q < rise + width + fall) return hi + (lo - hi) * (q - rise - width) / fall;
  return lo;
}
// Complex Gaussian elimination with partial pivoting. Real analyses use zero imaginary entries.
function solve(ar, ai, br, bi) {
  const n = br.length;
  for (let k = 0; k < n; k++) {
    let pivot = k, best = 0;
    for (let j = k; j < n; j++) { const mag = Math.hypot(ar[j][k], ai[j][k]); if (mag > best) { best = mag; pivot = j; } }
    if (!best || !Number.isFinite(best)) fail(0, 'Singular circuit: check floating nodes, ideal source/inductor loops, and DC paths to ground.');
    for (const a of [ar, ai]) [a[k], a[pivot]] = [a[pivot], a[k]];
    for (const b of [br, bi]) [b[k], b[pivot]] = [b[pivot], b[k]];
    const pr = ar[k][k], pi = ai[k][k], den = pr * pr + pi * pi;
    for (let j = k + 1; j < n; j++) {
      if (!ar[j][k] && !ai[j][k]) continue;
      const r = (ar[j][k] * pr + ai[j][k] * pi) / den, im = (ai[j][k] * pr - ar[j][k] * pi) / den;
      for (let z = k + 1; z < n; z++) { ar[j][z] -= r * ar[k][z] - im * ai[k][z]; ai[j][z] -= r * ai[k][z] + im * ar[k][z]; }
      br[j] -= r * br[k] - im * bi[k]; bi[j] -= r * bi[k] + im * br[k]; ar[j][k] = ai[j][k] = 0;
    }
  }
  const xr = Array(n).fill(0), xi = Array(n).fill(0);
  for (let j = n - 1; j >= 0; j--) {
    let r = br[j], im = bi[j];
    for (let z = j + 1; z < n; z++) { r -= ar[j][z] * xr[z] - ai[j][z] * xi[z]; im -= ar[j][z] * xi[z] + ai[j][z] * xr[z]; }
    const den = ar[j][j] ** 2 + ai[j][j] ** 2;
    xr[j] = (r * ar[j][j] + im * ai[j][j]) / den; xi[j] = (im * ar[j][j] - r * ai[j][j]) / den;
  }
  if ([...xr, ...xi].some(v => !Number.isFinite(v) || Math.abs(v) > 1e100)) fail(0, 'Circuit produced non-finite or extreme results; check values and topology.');
  return { real: xr, imag: xi };
}
export function simulate(text, analysisName = 'tran') {
  const circuit = parseNetlist(text), { nodes, components } = circuit;
  const analysis = analysisName.toLowerCase();
  if (!['op', 'dc', 'ac', 'tran'].includes(analysis)) fail(0, `Unknown analysis “${analysisName}”.`);
  const a = circuit.analyses[analysis];
  if (!a && analysis !== 'op') fail(0, `Add a .${analysis} directive to run this analysis.`);
  const branches = components.filter(c => c.type === 'V' || c.type === 'L');
  const idx = new Map(nodes.map((n, i) => [n, i])), branchIdx = new Map(branches.map((c, i) => [c.name, nodes.length + i]));
  const size = nodes.length + branches.length;
  // In the DC initial state capacitors are open and current sources provide no
  // voltage constraint. Catch floating islands structurally, before roundoff
  // can make a singular conductance matrix appear barely invertible.
  const adjacency = new Map(['0', ...nodes].map(n => [n, []]));
  for (const c of components) if ('RLV'.includes(c.type)) {
    adjacency.get(c.n1).push(c.n2); adjacency.get(c.n2).push(c.n1);
  }
  const grounded = new Set(['0']), pending = ['0'];
  while (pending.length) for (const n of adjacency.get(pending.pop())) if (!grounded.has(n)) { grounded.add(n); pending.push(n); }
  const floating = nodes.filter(n => !grounded.has(n));
  if (floating.length) fail(0, `Singular DC operating point: floating node${floating.length === 1 ? '' : 's'} ${floating.join(', ')}. Each node needs a DC path to ground through R, L or V; capacitors are open at DC.`);
  function run(mode, x = 0, previous = null, dt = 0) {
    const ar = Array.from({ length: size }, () => Array(size).fill(0)), ai = ar.map(r => [...r]);
    const br = Array(size).fill(0), bi = [...br];
    const stamp = (i, j, r, im = 0) => { if (i !== undefined && j !== undefined) { ar[i][j] += r; ai[i][j] += im; } };
    const current = (p, n, r, im = 0) => { if (p !== undefined) { br[p] -= r; bi[p] -= im; } if (n !== undefined) { br[n] += r; bi[n] += im; } };
    const admittance = (p, n, r, im = 0) => { stamp(p, p, r, im); stamp(n, n, r, im); stamp(p, n, -r, -im); stamp(n, p, -r, -im); };
    for (const c of components) {
      const p = idx.get(c.n1), n = idx.get(c.n2), b = branchIdx.get(c.name);
      if (c.type === 'R') admittance(p, n, 1 / c.value);
      if (c.type === 'C') {
        if (mode === 'ac') admittance(p, n, 0, 2 * Math.PI * x * c.value);
        if (mode === 'tran') { const g = c.value / dt; admittance(p, n, g); current(p, n, -g * ((previous.real[p] || 0) - (previous.real[n] || 0))); }
      }
      if (b !== undefined) { stamp(p, b, 1); stamp(n, b, -1); stamp(b, p, 1); stamp(b, n, -1); }
      if (c.type === 'L') {
        if (mode === 'ac') stamp(b, b, 0, -2 * Math.PI * x * c.value);
        if (mode === 'tran') { stamp(b, b, -c.value / dt); br[b] = -c.value / dt * previous.real[b]; }
      }
      if ('VI'.includes(c.type)) {
        let r = c.dc, im = 0;
        if (mode === 'ac') { r = c.ac * Math.cos(c.phase * Math.PI / 180); im = c.ac * Math.sin(c.phase * Math.PI / 180); }
        if (mode === 'dc' && c.name.toLowerCase() === a.source) r = x;
        if (mode === 'tran') r = waveform(c, x);
        if (c.type === 'I') current(p, n, r, im); else { br[b] = r; bi[b] = im; }
      }
    }
    return solve(ar, ai, br, bi);
  }
  const op = run('op'), operatingPoint = Object.fromEntries(nodes.map((n, i) => [n, op.real[i]]));
  let x = [0], xLabel = 'Operating point', xUnit = '';
  if (analysis === 'dc') { const count = Math.floor((a.stop - a.start) / a.step + 1e-9) + 1; x = Array.from({ length: count }, (_, i) => a.start + i * a.step); xLabel = a.source; xUnit = components.find(c => c.name.toLowerCase() === a.source).type === 'V' ? 'V' : 'A'; }
  if (analysis === 'ac') { const count = Math.floor(Math.log10(a.stop / a.start) * a.pointsPerDecade + 1e-9); x = Array.from({ length: count + 1 }, (_, i) => a.start * 10 ** (i / a.pointsPerDecade)); if (x.at(-1) < a.stop * (1 - 1e-10)) x.push(a.stop); xLabel = 'Frequency'; xUnit = 'Hz'; }
  if (analysis === 'tran') { const count = Math.max(1, Math.ceil(a.stop / a.step - 1e-10)); x = Array.from({ length: count + 1 }, (_, i) => i === count ? a.stop : i * a.step); xLabel = 'Time'; xUnit = 's'; }
  const series = nodes.map(n => ({ name: `V(${n})`, unit: 'V', values: [] }));
  if (analysis === 'ac') series.push(...nodes.map(n => ({ name: `Phase(${n})`, unit: '°', values: [] })));
  let previous = op;
  x.forEach((point, i) => {
    const solution = analysis === 'op' || (analysis === 'tran' && i === 0) ? op : run(analysis, point, previous, point - x[i - 1]);
    nodes.forEach((n, j) => { series[j].values.push(analysis === 'ac' ? Math.hypot(solution.real[j], solution.imag[j]) : solution.real[j]); if (analysis === 'ac') series[j + nodes.length].values.push(Math.atan2(solution.imag[j], solution.real[j]) * 180 / Math.PI); });
    previous = solution;
  });
  const log = [`Parsed ${components.length} components and ${nodes.length} non-ground nodes.`, 'DC operating point solved: capacitors open, inductors short.', `${analysis.toUpperCase()} completed: ${x.length} points.`];
  if (analysis === 'tran') log.push('Backward Euler integration; initial state is the DC operating point. Source DC values override waveform offsets for initialization. Choose a step much smaller than circuit time constants and pulse edges; features between sample points can be missed.');
  return { analysis, xLabel, xUnit, series, x, operatingPoint, log, summary: `${analysis.toUpperCase()} · ${x.length} ${x.length === 1 ? 'point' : 'points'} · ${nodes.length} nodes` };
}
