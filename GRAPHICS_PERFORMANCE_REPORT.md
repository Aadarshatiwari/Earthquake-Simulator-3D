# Phase 7 performance

The production build reports the following compressed JavaScript chunk sizes. The home dashboard also requests the shared 3D runtime when it loads the interactive preview. The main chunk alone therefore describes only part of the home transfer.

| Chunk (gzip) | Phase 6 | Phase 7 |
| --- | ---: | ---: |
| Main | 83.76 kB | 89.89 kB |
| Viewport | 7.33 kB | 7.69 kB |
| PDF | 2.29 kB | 3.41 kB |

Run `node --import tsx scripts/benchmark-research.ts` to repeat the 10,000-sample Gorkha workload. Phase 6 to Phase 7 medians in milliseconds were 66.95 to 71.04 for two-case analysis, 43.48 to 44.55 for five spectra, 0.97 to 1.02 for FFT, 0.77 to 0.82 for STFT, 18.20 to 18.69 for the one-axis sweep, 130.57 to 127.00 for the two-axis sweep, and 78.34 to 80.06 for CSV serialization. These are desktop compute measurements. Device FPS, GPU memory, thermals and comparable first-render timings remain unmeasured.
