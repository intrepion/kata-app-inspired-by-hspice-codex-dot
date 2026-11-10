# Kata Voltbench

**Small circuits. Clear insights.** An original, local-first educational circuit workbench inspired by HSPICE's netlist → analysis → waveform workflow.

[Open Kata Voltbench](https://intrepion.github.io/kata-app-inspired-by-hspice-codex-dot/) · [Kata Tool Shed](https://intrepion.github.io/tools/)

It does not bundle HSPICE, use proprietary model libraries, or claim HSPICE compatibility.

## Run

Node.js 20 or newer. No packages or external runtime assets are required.

```sh
npm run dev
```

Open **http://127.0.0.1:5193/**. Always use the HTTP server, never open `index.html` directly. `PORT=5194 npm run dev` selects a different port. The server binds to loopback by default.

```sh
npm run check
npm run build
```

`dist/` is a self-contained static build suitable for a subdirectory host. The GitHub Actions workflow runs the checks and build before deploying `main` to GitHub Pages. Pull requests run checks without deploying.

## Explore

- Five examples: resistor divider, RC low-pass, RC high-pass, RLC resonance and current-source network.
- Editable component values and SPICE-style text editor with line diagnostics.
- Automatic node connectivity map. This is a net map, not a drag-and-drop schematic editor; larger networks use the netlist rather than an unreadable drawing.
- DC operating point, independent-source DC sweep, logarithmic AC magnitude/phase, fixed-step transient analysis.
- Trace toggles, pointer sample readout, DC bias readings and simulation log.
- Browser-local autosave, JSON project import/export, plain-text netlist import/export and CSV data export.
- Responsive layout, keyboard-accessible controls and an in-app field guide.

Choose an example, change a passive component or edit the netlist, then **Run simulation** (Ctrl/⌘ + Enter). Selecting an analysis runs it. Editing invalidates and clears the previous results, preventing stale CSV export. Switching away from a modified circuit asks first. Export important work before clearing browser data.

## Supported netlist subset

Use `* Your circuit title` on the first line, then component and analysis statements. Short unprefixed titles are accepted, but prefixed titles are unambiguous; this is a limited parser, not full HSPICE syntax. `*` comments, trailing `$`/`;` comments, case-insensitive names, and `0`/`gnd` ground are supported. R/C/L values must be positive. Numeric suffixes: T, G, meg, k, m, u, n, p, f. As in SPICE, **M/m means milli, not mega**. Values with extra unit suffixes are deliberately rejected.

```spice
* RC low-pass filter
V1 in 0 DC 0 AC 1 PULSE(0 5 0 1u 1u 500u 1m)
R1 in out 1k
C1 out 0 100n
.op
.dc V1 0 5 0.1
.ac dec 40 10 1meg
.tran 2u 3m
.end
```

Devices: `Rname node+ node- value`, similarly C/L; `Vname` and `Iname` accept a number or `DC value`, optional `AC amplitude [phase-degrees]`, and optional `SIN(offset amplitude frequency)` or `PULSE(v1 v2 delay rise fall width period)`. Current-source direction is from the first node to the second. Source DC and time-domain definitions are separate; without explicit DC, the waveform's starting level is used for bias.

Directives: `.op`, `.dc source start stop step`, `.ac dec points-per-decade start stop`, `.tran step stop`, `.end`. Select only analyses defined in the netlist. Missing/unsupported directives and devices give errors rather than silently simulating another circuit.

## Numerical model and limitations

The original JavaScript solver uses modified nodal analysis with pivoted linear elimination. DC opens capacitors and shorts inductors. AC solves the complex linear network. Transients start at the DC operating point and use fixed-step backward Euler companion models. Output is node voltage; AC additionally includes node phase. CSV contains all available node series, even when a trace is hidden.

Limits: 30 non-ground nodes, 80 components, 2,500 output samples, 100,000-character netlist. No semiconductor devices, diodes, transistor models, nonlinear iteration, .param, subcircuits, model libraries, controlled sources, noise, process corners, temperature, adaptive stepping or signoff verification. Singular networks and non-finite/ill-conditioned solutions are reported.

Fixed-step integration introduces numerical damping and can miss edges narrower than the step. Reduce the step and compare results. Phase wraps at ±180°, and phase of a zero-magnitude signal has no physical meaning. A DC path is required even for an AC/transient run. Voltbench is a learning aid, **not a replacement for an engineering-grade SPICE simulator**. Do not use it as the only verification for real hardware.

## Privacy and files

There is no account, backend, analytics, dependency CDN or network call for simulation. Project files are read on the device. A single local-storage key keeps the last circuit and analysis when storage is available. Browser/site-data removal deletes it. Export `.voltbench.json` for an editable copy, `.sp` for text or `.csv` for results. Import validates the format before replacing the current project.

## Research and attribution

HSPICE's workflow uses a source netlist containing circuit and analysis statements, then emits listing and graph data. Voltbench adapts that interaction model to a focused browser workbench, with original UI, code and examples.

- [Columbia University: HSPICE files and source-netlist structure](https://cisl.columbia.edu/hspice/Basics/Files/files.htm)
- [Virginia Tech MICS: HSPICE simulation tutorial](https://www.mics.ece.vt.edu/ICDesign/Tutorials/Synopsys/hspice.html)
- [Synopsys HSPICE](https://www.synopsys.com/implementation-and-signoff/ams-simulation/primesim-hspice.html)

HSPICE is a trademark of Synopsys, Inc. This independent project is not affiliated with or endorsed by Synopsys. MIT license; see [LICENSE](LICENSE).

See [QA notes](docs/QA.md) for verification evidence and remaining limitations.
