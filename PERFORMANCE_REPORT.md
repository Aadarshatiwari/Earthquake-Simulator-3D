# Phase 1 performance report

Measured on an Apple M5 Pro (arm64), Darwin 25.5.0, Node 24.22.3. Run `npm run benchmark` to reproduce. Each case uses a seeded synthetic input at 0.30 g, three warm-ups and nine measured iterations. Times include assembly, modal analysis, integration and packed output creation. They exclude waveform generation, worker startup, transfer, rendering and plotting.

| Storeys | Step (s) | Duration (s) | Steps | Save stride | Stored samples | Packed bytes | Min / median / max (ms) |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 0.005 | 30 | 6,001 | 1 | 6,001 | 720,120 | 0.72 / 0.81 / 1.67 |
| 20 | 0.005 | 30 | 6,001 | 7 | 859 | 1,017,056 | 6.81 / 7.22 / 7.94 |
| 20 | 0.001 | 120 | 120,001 | 20 | 6,001 | 7,105,184 | 132.97 / 133.85 / 145.31 |

The fixed-step engine factors once and uses O(n²) operations per step. The output slab uses 8 × samples × (7 × DOF count + 8) bytes. Actual memory use is higher and includes source motion, other worker state, plot arrays and export buffers. The UI samples long traces for plotting. CSV saves every retained integration output frame. The large Three.js/Rapier and Plotly bundles are loaded on demand and exceed Vite's default chunk warning threshold.

These are desktop Node measurements. Android timing, device thermal behaviour, peak process memory and WebView compatibility remain to be measured.
