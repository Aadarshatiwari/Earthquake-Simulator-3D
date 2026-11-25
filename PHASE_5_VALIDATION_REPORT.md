# Phase 5 validation

The Phase 4.1 Git checkpoint is `03d5076`. All 76 baseline tests passed before implementation. The final suite passed **90 automated tests**, including 14 phase-specific tests. The TypeScript and Vite production build succeeded. The legacy large-chunk warning remains.

## Analytical and numerical benchmarks

| Benchmark | Result |
| --- | --- |
| Fixed-base free vibration | Exact `0.04 cos(√80 t)` m reference, with errors decreasing at second order |
| Base-isolated 2-DOF characteristic polynomial | Periods 2.089729419 s and 0.272677348 s, matching analytical roots |
| Coupled tuned-mass modes | Both undamped eigenvalues matched the independent two-by-two polynomial |
| Harmonic response | Matched the closed-form SDOF amplitude and coupled base-excitation cancellation benchmark |
| Brace | 3–4–5 geometry with E=200 GPa and A=0.002 m² gives 51.2 MN/m |
| Wall | A series assembly matches the reference cantilever top-load compliance |
| Inclined dampers | Two 1,000 N·s/m devices at 60° add 500 N·s/m across the intended floor pair |
| Energy | All four localization groups reconcile with the Newmark dissipation history |
| Historical comparison | Four variants used all 10,000 original Gorkha KTP samples and ended at 99.99 s |
| Stability and compatibility | Invalid parameters rejected, zero inputs and zero contributions validated, cancellation and saved project formats checked |

For the fixed-base displacement at 1.2 s, the absolute errors for Δt of 0.040, 0.020, 0.010 and 0.005 s were 4.2651, 1.0960, 0.27582 and 0.06907 mm. The error ratio approached 4 with each halving. In the timing cases, the largest reported absolute energy residual was 2.22 × 10⁻⁹ J. The 20-storey, 22-DOF Dolakha case gave 3.10 × 10⁻¹¹ J. These are numerical model checks. [Performance report](PROTECTION_LAB_PERFORMANCE.md).

## Browser verification

The local browser showed a rendered one-, two- and four-building viewport, the selectable devices and foundation inspection, and a shared Gorkha timer. The default synthetic comparison showed the isolated case’s peak drift falling by 79.6%, while peak roof displacement relative to ground rose by 59.1%. Both quantities refer to that particular model and input. Engineering output showed modal frequencies, stiffness matrices, energy and resonance plots. A scenario was saved and restored locally, and the browser emitted the CSV download. The archive-to-lab handoff was rechecked after simplifying the viewport labels. No new console errors occurred on that repeat. The actual captures are in [docs/screenshots/phase-5](docs/screenshots/phase-5/).

The model omits nonlinear response, hysteresis, member failure, soil–structure interaction and real-building capacity assessment. Phone-sized portrait and landscape layout checks are browser emulation. Physical Android performance and release readiness have not been established. Confirm hardware performance and interaction before Phase 6.
