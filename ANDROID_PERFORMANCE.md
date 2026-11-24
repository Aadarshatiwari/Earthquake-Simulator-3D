# Phase 3 performance and Android status

Run `npm run benchmark:seismic` on the project root. Measurements used Node 24.22.3 on Apple M5 Pro (arm64 Darwin 25.5.0), three warm-ups and nine runs. Times include synthetic input generation, Phase 1 calculations, result allocation and ground integration. They exclude browser worker startup, rendering, plotting and storage.

| Buildings | Steps per model | Packed solver result bytes | Min / median / max |
|---|---:|---:|---|
| One 5-storey | 2,401 | 825,944 | 2.96 / 3.93 / 6.03 ms |
| Two 20-storey | 12,001 | 28,418,368 | 39.62 / 42.41 / 57.48 ms |

The desktop in-app browser reported 121 FPS over one short playback window for the five-storey default. This is a spot reading, with no sustained profiling. Reused component meshes, instancing, bounded shadow maps, adjustable DPR, lazy chart loading, on-demand rendering and optional scene details support lower-end hardware. Playback suspends in the background. WebGL recovery preserves the numerical run. Browser-generated textures and Plotly remain part of the memory budget.

No Android emulator or physical Android device was available for this phase. Touch, audio, vibration, sustained FPS, WebView memory and thermal performance require device verification. Neither the 30 FPS nor the 60 FPS Android target is established by these desktop measurements.
