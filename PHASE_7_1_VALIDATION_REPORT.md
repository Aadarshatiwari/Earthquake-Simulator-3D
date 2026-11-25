# Phase 7.1 validation

**Partial pass.** Baseline checkpoint: `0ff9ae4`. The production build passed in 3.00 seconds with Vite's large-chunk notice. All 106 automated checks passed (7 Node and 99 Vitest), including the original 104 checks. The new checks cover mobile route mapping and separation of architectural details from analysis. The existing report regression now checks the executive summary, result table and disclaimer as well as the five comparative plots.

## Verified work

- A live building was observed on Home and after navigation into the constructor and earthquake simulator. The Phase 7 blank capture does not establish its exact root cause. [Rendering readiness](RENDERING_READINESS_REPORT.md)
- The five-item mobile navigation and More disclosure were exercised at 390 CSS pixels. The constructor passed document width checks at ten viewport sizes. The earlier mobile screenshot had a 390 × 274 raster rather than the intended 390 × 844 capture. The observed document width is independent of that image crop. [Responsive matrix](MOBILE_RESPONSIVE_TEST_REPORT.md)
- Analytics groups and compact provenance, balcony and parapet changes, and reduced-motion camera behavior are implemented. [Analytics](ANALYTICS_UI_REFINEMENT.md) · [Architecture](ARCHITECTURAL_VISUALIZATION.md) · [Camera](CAMERA_SYSTEM.md)
- The five-page A4 report was rendered page by page and inspected. It retained reference Gorkha results. [Report](output/pdf/gorkha-phase-7.1-final.pdf) · [Rendered pages](docs/screenshots/phase-7.1/pdf-contact-sheet.png) · [Scientific regression](SCIENTIFIC_REGRESSION_REPORT.md)

## Bundle comparison

| JavaScript chunk | Phase 7 gzip | Phase 7.1 gzip |
| --- | ---: | ---: |
| Main | 89.89 kB | 90.06 kB |
| Viewport | 7.69 kB | 7.99 kB |
| PDF | 3.41 kB | 3.80 kB |

## Open scope

Higher-fidelity architecture and illustrative terrain, adaptive frame-time policy, Protection Lab and archive refinements, research chart overhaul, full translations, an accessibility audit, sustained rendering benchmarks, device testing, and the complete screenshot matrix still need work. Automatic rotation and the separate immersive workspace also remain open. [Issue tracker](PHASE_7_1_ISSUE_TRACKER.md) · [Localization](LOCALIZATION_COVERAGE.md) · [Benchmark status](GRAPHICS_BENCHMARK_REPORT.md) · [Android readiness](ANDROID_READINESS_AUDIT.md)

## Changed destinations

Application changes are in `src/shell`, `src/constructor`, and `src/research`. Regression tests are in `tests/engine`. Browser and report captures are in `docs/screenshots/phase-7.1`. The output PDF is in `output/pdf`, with a serving copy under `public/reports`.
