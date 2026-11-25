# Protection Lab performance

Benchmarked with Node 24.22.3 on an arm64 Apple M5 Pro. The benchmark uses three warmups followed by nine runs. Timings below cover model assembly, time integration, response extraction and the harmonic sweep. They exclude worker startup, browser rendering and data retrieval. Run `node --import tsx scripts/benchmark-protection.ts` to reproduce.

| Case | Input samples | DOFs | Median | Approx. 89th percentile |
| --- | ---: | --- | ---: | ---: |
| One baseline | 2,401 | 5 | 2.79 ms | 3.08 ms |
| Two-building isolation comparison | 2,401 | 5, 6 | 3.14 ms | 6.21 ms |
| Four Gorkha cases | 10,000 | 5, 6, 5, 6 | 15.40 ms | 25.96 ms |
| 20 storeys + isolation + tuned mass, Dolakha | 18,000 | 22 | 47.21 ms | 49.18 ms |

The pre-change Phase 3 benchmark on the same host measured 3.11 ms for one 5-storey model and 42.18 ms for two 20-storey models. The post-change runs measured 3.18 and 44.63 ms. These measurements vary with host load. Phase 3 retains its full result arrays.

| Production output | Phase 4.1 gzip | Phase 5 gzip |
| --- | ---: | ---: |
| Main entry | 83.05 kB | 83.56 kB |
| Shared Three.js / orbit controls | 242.45 kB | 242.46 kB |
| Protection Lab interface | — | 14.67 kB |
| Protection Lab 3D scene | — | 4.38 kB |
| Protection Lab stylesheet | — | 1.97 kB |

The dedicated calculation worker chunk is 24.65 kB minified. Existing large lazy chunks continue to produce the Vite warning. Four-case comparison uses one demand-driven canvas, shared mesh geometry, capped balanced DPR and a lower-resolution viewing option. Integration and resonance run in a cancellable worker. The worker extracts at most about 1,401 time samples per case for visual playback and CSV. The single full-resolution calculation working set is released after extraction. Structural peaks and device energy use the full-resolution samples. Playback advances at up to roughly 30 UI updates per second.

Desktop browser rendering, portrait and landscape fullscreen were visually verified. GPU frame-time profiling and physical Android testing remain outstanding.
