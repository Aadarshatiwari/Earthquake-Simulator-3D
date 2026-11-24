# Phase 2 performance and Android readiness

Run `npm run benchmark:constructor` for reproducible CPU measurements. Recorded on Apple M5 Pro, arm64 Darwin 25.5.0, Node 24.22.3. Each modern-apartment case had three warm-ups and eleven measurements. The solver runs 3,201 steps of the prescribed synthetic motion. Timing excludes the browser, scene traversal, GPU, and worker startup.

| Storeys | Generated parts | Median generator time | Median solver time |
|---:|---:|---:|---:|
| 1 | 127 | 0.029 ms | 0.474 ms |
| 5 | 743 | 0.073 ms | 2.300 ms |
| 10 | 1,513 | 0.111 ms | 1.671 ms |
| 20 | 3,053 | 0.198 ms | 5.085 ms |

A desktop in-app-browser spot check at 1280 × 900 reported 121 FPS over the first one-second playback window for the five-storey residence at Medium. This is an in-app frame counter under one configuration, not a sustained performance benchmark.

Low uses DPR 1 and no directional shadows. Medium, High and Ultra increase DPR bounds and shadow texture sizes. High adds environment lighting. Ultra adds a contact-shadow pass. Automatic chooses a device heuristic and can reduce pixel ratio during interaction. The user can also disable context geometry. Repeated parts are instanced by floor/material. Pixel data are generated locally and use uncompressed canvas uploads; no compressed textures or separate model LOD assets are bundled.

Android hardware, emulator, WebView back handling, thermal stability and device memory were not tested in this environment. The module consumes locally packaged Vite assets and standard WebGL 2, Worker and pointer APIs. Physical-device touch and FPS targets remain verification criteria for a later phase.

The 20-storey residential skeleton produced a separate one-second spot reading of 122 FPS at Low on the same desktop browser. Graphics settings and geometry differed from the five-storey case, so the figures should not be compared as scaling benchmarks.
