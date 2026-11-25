# Phase 4.1 validation

Verified on 25 November 2026. Phase 4 was saved as local Git checkpoint `4d1f5d1`. The baseline passed 68 automated tests and the production build. The final build passed 76 automated tests, including eight new Phase 4.1 tests. TypeScript and Vite production build succeeded. Existing large lazy-chunk warnings remain.

| Area | Evidence |
| --- | --- |
| Blank viewport | The supplied capture was blank. The same build produced a visible settled render. The new readiness signal awaits a terrain draw and the following animation frame. |
| Terrain and navigation | Verified the full terrain, close epicentre view, underground marker, depth profile and repeated 2D/3D switches. |
| Geographic overlays | Visually inspected boundaries, cities, rivers and mapped active-fault traces in 3D and official Gorkha MMI contours in 2D and 3D. |
| Catalogue | 293 entries including 18 additional ComCat entries and two older noninstrumental entries. Both snapshots remain bundled. |
| Historical replay | Gorkha raw waveform passed SHA-256 and played at the original 100 Hz interval. Verified simultaneous KTP/PTN chart and illustrated wave replay. |
| Structural handoff | Calculated a full 99.99-second KTP NS solve, checked the earthquake name, station, component and source checksum, and returned to the selected Gorkha event. |
| Responsive layout | No horizontal overflow at 360 × 800, 390 × 844, 412 × 915, 768 × 1024, 844 × 390 and 1280 × 900. Landscape fullscreen showed the rendered terrain. These are desktop browser viewport tests. |

The test suite covers grid validation and interpolation, projected signs, mesh winding and normals, high-resolution assets, responsive camera fit, focal depth and magnitude encodings, district boundaries, catalogue merge, replay clock endpoints, comparison timestamps, all four Gorkha source hashes and an original-sample structural solve. Existing physics tolerances remain unchanged.

Screenshots are actual browser captures in [docs/screenshots/phase-4.1](docs/screenshots/phase-4.1/). The original blank image is preserved alongside the final overview, plus map, depth, waveform, station comparison, solver and representative mobile captures. No video was captured. [Terrain engine](NEPAL_TERRAIN_ENGINE.md), [performance report](TERRAIN_PERFORMANCE_REPORT.md), [recording datasets](STRONG_MOTION_DATASETS.md).

Known limits include the coarse resolution at individual summits, illustrative terrain styling, limited regional fault coverage and no subsurface fault model, no bundled velocity/displacement, and the current one-axis educational solver. Before proceeding to Phase 5, validate terrain and playback on a physical Android device and confirm that the performance is acceptable.
