export const examples = [
{ id:'lowpass', title:'RC low-pass', subtitle:'Watch a capacitor charge', family:'FILTERS', analysis:'tran', insight:'A capacitor smooths a changing input. Increase R1 or C1, run again, and watch the output respond more slowly.', netlist:`RC low-pass filter
* A 1 kHz pulse through a 1 kohm / 100 nF filter
V1 in 0 DC 0 AC 1 PULSE(0 5 0 1u 1u 500u 1m)
R1 in out 1k
C1 out 0 100n
.op
.tran 2u 3m
.ac dec 40 10 1meg
.dc V1 0 5 0.1
.end
`},
{ id:'divider', title:'Voltage divider', subtitle:'Start with Ohm’s law', family:'FUNDAMENTALS', analysis:'op', insight:'Two equal resistors split the supply in half. Try changing R2 to 2k and inspect the new operating point.', netlist:`Resistive voltage divider
V1 supply 0 DC 5 AC 1
R1 supply out 1k
R2 out 0 1k
.op
.dc V1 0 10 0.1
.ac dec 20 10 100k
.tran 10u 1m
.end
`},
{ id:'highpass', title:'RC high-pass', subtitle:'Let the fast changes through', family:'FILTERS', analysis:'ac', insight:'The capacitor blocks DC and passes higher frequencies. The corner frequency is about 1.59 kHz for these values.', netlist:`RC high-pass filter
V1 in 0 DC 0 AC 1 SIN(0 1 1000)
C1 in out 100n
R1 out 0 1k
.op
.ac dec 40 10 1meg
.tran 2u 3m
.dc V1 0 5 0.1
.end
`},
{ id:'resonance', title:'RLC resonance', subtitle:'Find a resonant peak', family:'RESONANCE', analysis:'ac', insight:'An inductor and capacitor trade stored energy. Sweep frequency to see resonance; raise R1 to add damping.', netlist:`Series RLC resonator
V1 in 0 DC 0 AC 1 PULSE(0 1 0 1u 1u 2m 4m)
R1 in mid 50
L1 mid out 10m
C1 out 0 100n
.op
.ac dec 50 100 100k
.tran 2u 2m
.dc V1 0 5 0.1
.end
`},
{ id:'current', title:'Current source', subtitle:'Follow Kirchhoff’s laws', family:'FUNDAMENTALS', analysis:'dc', insight:'The source injects current into the resistor pair. Parallel resistors share a voltage and divide the current.', netlist:`Parallel current-source network
I1 0 out DC 1m AC 1m
R1 out 0 1k
R2 out 0 2k
.op
.dc I1 0 5m 50u
.ac dec 20 10 100k
.tran 10u 1m
.end
`}
];
