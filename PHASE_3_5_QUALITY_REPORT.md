# Phase 3.5 quality report

Phase 3 checkpoint: `bc182b4`. Baseline: 59 tests, passed build. Final: 62 tests, passed strict TypeScript and Vite build. The three added tests cover extrema-preserving chart downsampling, short input, and pitched panels meeting at a shared ridge. Phase 1 solver code and acceptance tolerances were unchanged. Playback speed, identical comparison input, project serialization, cancellation and material mapping remain covered by regression tests.

The in-app browser was used to inspect Diagnostics, Build & test, Earthquake Lab, legacy Simulation, Analytics, Nepal Explorer and Learn. All eight constructor presets were selected. Browser interactions exercised view and heatmap selectors, camera fit, solver calculation, active playback, pause, peak seeking, comparison, Results, resonance, all five graphics modes, saved results reopen, and reversible in-app fullscreen. Console inspection returned no errors during the interaction checks. Final screenshot review found a misoriented pitched roof and loss of precision for small table readings; both were corrected and visually rechecked.

File parsing and CSV output structure were checked by automated tests. Native CSV/JSON picker and download handoff were not verified end-to-end in this browser environment. Phase 3's native file-picker attempt timed out, and physical Android content-provider testing remains open. No claim is made that every combination of imported file, project format, graphics context and Android device has been manually tested.

See [before-and-after measurements](PERFORMANCE_OPTIMIZATION.md), [visual design](VISUAL_DESIGN_SYSTEM.md), [accessibility](ACCESSIBILITY_REPORT.md), and [Android readiness](ANDROID_READINESS_REPORT.md). No Phase 4 features were added.

## Screenshot index

Actual browser captures are in [the Phase 3.5 screenshot folder](docs/screenshots/phase-3.5). The index includes the baseline lab and results, a matched after lab, diagnostics dashboard, constructor, traditional Newari and concrete presets, skeleton, active run, drift heatmap, engineering results, comparison, resonance, and the two mobile-sized layouts.
