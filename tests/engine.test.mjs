import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNetlist, simulate } from '../src/engine.js';
import { examples } from '../src/examples.js';
const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const values = (r, name) => r.series.find(s => s.name === name).values;
test('every shipped example runs every declared analysis', () => {
  for (const example of examples) {
    const parsed = parseNetlist(example.netlist);
    assert.equal(parsed.title, example.netlist.split('\n')[0]);
    for (const analysis of Object.keys(parsed.analyses)) {
      const result = simulate(example.netlist, analysis);
      assert.ok(result.x.length > 0 && result.x.length <= 2500);
      assert.ok(result.series.every(s => s.values.length === result.x.length && s.values.every(Number.isFinite)));
    }
  }
  assert.equal(parseNetlist('RC 2-pole filter\nR1 x 0 1k').title, 'RC 2-pole filter');
  assert.equal(parseNetlist('* RC 2 pole filter\nR1 x 0 1k').title, 'RC 2 pole filter');
});
test('voltage divider operating point and descending DC sweep', () => {
  const net = '* Divider\nV1 in 0 DC 12\nR1 in out 2k\nR2 out 0 1k\n.op\n.dc V1 12 0 -3\n.end';
  near(simulate(net, 'op').operatingPoint.out, 4);
  const r = simulate(net, 'dc'); assert.deepEqual(r.x, [12, 9, 6, 3, 0]);
  values(r, 'V(out)').forEach((v, i) => near(v, 4 - i));
});
test('current divider and current-source DC sweep sign', () => {
  const net = 'I1 0 out 3m\nR1 out 0 1k\nR2 out 0 2k\n.dc I1 0 3m 1m';
  const r = simulate(net, 'dc'); near(r.operatingPoint.out, 2); near(values(r, 'V(out)')[3], 2); assert.equal(r.xUnit, 'A');
});
test('floating voltage source MNA and case insensitive nodes', () => {
  const r = simulate('V1 A b 5\nR1 a 0 1k\nR2 B 0 1k\n.op', 'op');
  near(r.operatingPoint.a, 2.5); near(r.operatingPoint.b, -2.5);
});
test('suffixes are strict and M means milli, MEG means mega', () => {
  const p = parseNetlist('V1 x 0 1\nR1 x 0 2M\nR2 x 0 3MEG\nC1 x 0 4u\nL1 x z 5n\nR3 z 0 1e3');
  near(p.components[1].value, .002); near(p.components[2].value, 3e6); near(p.components[3].value, 4e-6);
  assert.throws(() => parseNetlist('V1 x 0 1\nR1 x 0 1kohm'), /Line 2.*Invalid numeric/);
});
test('RC transient charging and decay use DC initial state', () => {
  const charge = simulate('V1 in 0 PULSE(0 1 0 0 0 10 20)\nR1 in out 1k\nC1 out 0 1u\n.tran 5u 5m');
  near(values(charge, 'V(out)')[200], 1 - Math.exp(-1), .001);
  near(values(charge, 'V(out)').at(-1), 1 - Math.exp(-5), .0001);
  const decay = simulate('V1 in 0 DC 1 PULSE(0 0 0 0 0 10 20)\nR1 in out 1k\nC1 out 0 1u\n.tran 5u 5m');
  near(values(decay, 'V(out)')[0], 1); near(values(decay, 'V(out)')[200], Math.exp(-1), .001);
});
test('AC lowpass and highpass cutoff gain and phase', () => {
  const f = 1 / (2 * Math.PI * 1000 * 1e-6);
  const low = simulate(`V1 in 0 DC 0 AC 1\nR1 in out 1k\nC1 out 0 1u\n.ac dec 10 ${f} ${f}`, 'ac');
  near(values(low, 'V(out)')[0], Math.SQRT1_2); near(values(low, 'Phase(out)')[0], -45);
  const high = simulate(`V1 in 0 AC 1\nC1 in out 1u\nR1 out 0 1k\n.ac dec 10 ${f} ${f}`, 'ac');
  near(values(high, 'V(out)')[0], Math.SQRT1_2); near(values(high, 'Phase(out)')[0], 45);
});
test('AC current source amplitude and phase', () => {
  const r = simulate('I1 0 x AC 2m 90\nR1 x 0 1k\n.ac dec 5 1 10', 'ac');
  near(values(r, 'V(x)')[0], 2); near(values(r, 'Phase(x)')[0], 90);
});
test('series RLC resonance and RL transient', () => {
  const f = 1 / (2 * Math.PI * Math.sqrt(.01 * 1e-6));
  const r = simulate(`V1 in 0 AC 1\nL1 in mid 10m\nC1 mid out 1u\nR1 out 0 100\n.ac dec 10 ${f} ${f}`, 'ac');
  near(values(r, 'V(out)')[0], 1); near(values(r, 'Phase(out)')[0], 0);
  const rl = simulate('V1 in 0 PULSE(0 1 0 0 0 1 2)\nL1 in out 1\nR1 out 0 1k\n.tran 5u 1m');
  near(values(rl, 'V(out)').at(-1), 1 - Math.exp(-1), .001);
});
test('underdamped RLC step follows analytic response', () => {
  const r = simulate('V1 in 0 PULSE(0 1 0 0 0 1 2)\nR1 in mid 10\nL1 mid out 10m\nC1 out 0 1u\n.tran 200n 300u');
  const time = r.x.at(-1), alpha = 10 / (2 * .01), omega = Math.sqrt(1 / (.01 * 1e-6) - alpha ** 2);
  const expected = 1 - Math.exp(-alpha * time) * (Math.cos(omega * time) + alpha / omega * Math.sin(omega * time));
  near(values(r, 'V(out)').at(-1), expected, .003);
});
test('SIN sampling and pulse rise/fall evaluation', () => {
  const sine = simulate('V1 out 0 SIN(2 3 1k)\nR1 out 0 1k\n.tran 250u 1m');
  [2, 5, 2, -1, 2].forEach((v, i) => near(values(sine, 'V(out)')[i], v));
  const pulse = simulate('V1 out 0 PULSE(0 10 1 2 2 2 10)\nR1 out 0 1k\n.tran 1 8');
  assert.deepEqual(values(pulse, 'V(out)'), [0, 0, 5, 10, 10, 10, 5, 0, 0]);
});
test('unsupported syntax and malformed content return line errors', () => {
  for (const s of ['.param r=1k', '.model D D', '.subckt x a b', 'Q1 a b 0 model', 'D1 a 0 diode', 'R1 a 0 -1', 'R1 a 0 1 extra', 'V1 a 0 SIN(0 1)', 'V1 a 0 AC', 'V1 a 0 1 FOO', 'V1 a 0 PULSE(0 1 0 -1 0 1 2)', '.ac lin 10 1 100', '.tran 0 1', '.dc V1 0 1 -1']) {
    assert.throws(() => parseNetlist(`* test\n${s}`), /Line 2:/, s);
  }
  assert.throws(() => parseNetlist('V1 x 0 1\nv1 x 0 2'), /Duplicate/);
  assert.throws(() => parseNetlist('V1 x 0 1\n.end\nR1 x 0 1'), /after .end/);
});
test('degenerate topology is rejected', () => {
  for (const s of ['R1 a b 1k', 'V1 a 0 1\nR1 x y 1k', 'V1 a 0 1\nV2 a 0 2', 'I1 0 a 1\nC1 a 0 1u', 'V1 a 0 1\nL1 a 0 1']) assert.throws(() => simulate(s, 'op'), /ground|Singular/);
});
test('floating resistor islands cannot pass due to roundoff', () => {
  assert.throws(() => simulate('V1 in 0 1\nR1 a b 3k\nR2 b c 7k\nR3 c a 5k', 'op'), /floating nodes a, b, c/);
});
test('first-line invalid devices and source clauses are not mistaken for titles', () => {
  for (const source of ['Rfoo x 0 bad', 'Xfoo a 0 model', 'V1 x 0 AC 1 AC 2', 'V1 x 0 SIN(0 1 1k) PULSE(0 1 0 0 0 1 2)', 'V1 x 0 DC 1 DC 2', 'V1 x 0 AC 1 90 extra', 'V1 x 0 SIN(0 1 0)', 'V1 x 0 PULSE(0 1 0 1 1 1 2)', 'V1 x 0 1e309']) {
    assert.throws(() => parseNetlist(`${source}\nR2 x 0 1k`), /Line 1:/, source);
  }
});
test('limits and analysis validation', () => {
  for (const directive of ['.tran 1u 5m', '.dc V1 0 10000 1', '.ac dec 1000 1 1meg']) assert.throws(() => parseNetlist(`V1 x 0 1\n${directive}`), /2500/);
  assert.throws(() => parseNetlist(Array.from({ length: 31 }, (_, i) => `R${i} n${i} 0 1k`).join('\n')), /30 non-ground/);
  assert.throws(() => parseNetlist(Array.from({ length: 81 }, (_, i) => `R${i} x 0 1k`).join('\n')), /80 components/);
  assert.throws(() => simulate('R1 x 0 1k', 'tran'), /Add a .tran/);
  assert.throws(() => parseNetlist('R1 x 0 1k\n.dc nope 0 1 1'), /target/);
  assert.throws(() => simulate('R1 x 0 1k', 'noise'), /Unknown analysis/);
});
test('non-integral stop includes exact final transient and AC points', () => {
  const r = simulate('V1 x 0 1\nR1 x 0 1k\n.tran .3 1'); assert.deepEqual(r.x, [0, .3, .6, .8999999999999999, 1]);
  const ac = simulate('V1 x 0 AC 1\nR1 x 0 1k\n.ac dec 2 1 7', 'ac'); near(ac.x.at(-1), 7);
});
