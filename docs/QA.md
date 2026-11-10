# Voltbench v0.1 verification

Tested 2026-11-10 on macOS Chrome through **http://127.0.0.1:5193/**. No file:// app launch was used. These checks were completed locally before the user authorized publication. The public release is deployed through the repository’s check-and-deploy workflow.

## Automated checks

`npm run check`: 18 passing tests plus JavaScript syntax checks. The numerical suite includes all 20 example/analysis combinations, resistor/current dividers, source polarity, floating voltage source, strict SI suffixes, RC charge/decay, RC low/high-pass cutoff gain and phase, current-source AC phase, RL step, RLC resonance and underdamped step, SIN/PULSE behavior, fractional final steps, invalid sources/directives/devices, singular and floating topology, and point/node/component bounds.

`npm run build`: passed, static dist output, no external dependencies.

HTTP checks cover index, modules (including the simulation worker), CSS and manifest; hidden paths, missing files, non-GET/HEAD requests, and HEAD handling.

The engine was independently reviewed. Review found and fixed floating-island roundoff acceptance and ambiguous malformed first-line devices. UI review found and fixed stale component-edit indexes and overlapping reversed parallel branches. Simulations use a Web Worker with a 12-second deadline; edits/new analyses cancel stale work.

## Browser interactions exercised

- All five examples and all four analysis modes.
- Passive-value keyboard editing, recalculation and local-save reload persistence.
- Invalid netlist diagnostics with line number, cleared results and disabled CSV. An unfinished invalid draft was reloaded, preserved exactly in the editor, and repaired successfully without data loss.
- Stale component inputs are disabled after text edits until successful parse.
- Trace toggling, AC magnitude/phase selection, repeated analysis switching.
- Modified-example replacement confirmation: Cancel preserves the circuit; confirmation loads the new example.
- In-app guide open and close.
- Native Save dialog for editable project JSON and transient CSV.
- Exported JSON verified: format kata-voltbench, version 1, transient analysis and full netlist.
- After the user enabled Chrome extension file URL access, the original exported JSON was re-imported through the localhost app. Its complete 195-character netlist was preserved, the saved transient analysis restored after switching to AC, and 1,501 transient samples solved successfully.
- Plain `.sp` netlist import also succeeded, automatically selected its transient directive, and solved 1,501 samples.
- An unsupported-version JSON file was rejected with a clear diagnostic without replacing the existing circuit or AC analysis. A subsequent valid JSON import cleared the error and solved successfully.
- Exported CSV verified: 1,502 rows including header, 1,501 samples from 0 to 0.003 seconds, V(in) and V(out) columns.
- Narrow responsive layout at 390×844 CSS pixels and desktop default viewport. No document horizontal overflow observed. Viewport override reset after testing.
- No solver/UI failure remained in the exercised flows. Chrome logged installed-extension warnings and asynchronous extension-messaging errors tagged with the localhost page URL after reload. The app does not use browser-extension messaging; these messages were not reproduced as an app interaction failure. A clean-profile browser check has not been run.

## Screenshots

Genuine, unedited full-page Chrome captures from the localhost server. JPEG capture dimensions differ from CSS viewport because browser capture omits the scrollbar area.

- `screenshots/desktop.jpg`: 1133×1005, default 1148×623 viewport, RC low-pass transient response.
- `screenshots/narrow.jpg`: 375×1805, 390×844 viewport, RLC resonance AC response with input trace hidden.

Hashes and capture provenance for the original two listing captures are recorded in app.json and the local Tool Shed listing. `screenshots/import-verified.jpg` is an additional genuine full-page Chrome capture of the imported netlist and solved transient response, recorded after the import retest on 2026-11-10.

## Explicitly not verified

Physical touch devices, Safari/Firefox and assistive-technology screen-reader behavior remain untested. Browser file selection was initially blocked by the Chrome extension setting, then successfully retested after the user enabled it. No browser permissions were changed by the app or agent. The browser file-chooser API was used for import tests; native-picker manual navigation was not separately tested.

No HSPICE binary or external signoff engine comparison was run. Analytical equations are the numerical test oracle. Fixed-step transient damping/edge aliasing and the limited linear device model are intentional limitations, not production signoff coverage. The local Tool Shed production build was browser-checked at http://127.0.0.1:5194/apps/kata-app-inspired-by-hspice-codex-dot/ and both screenshot image dimensions were verified. Its 74 tests, strict checks, and build passed. Publication was subsequently authorized. Repository and live app links are recorded in the README and app.json; the GitHub Actions workflow records checks and deployment for each published commit.
