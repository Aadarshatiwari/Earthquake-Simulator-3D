# Phase 3.5 performance optimization

Baseline is local checkpoint `bc182b4`. Both builds used the same Apple M5 Pro, Node 24.22.3, Vite 7.3.8 and existing production build command. Sizes use decimal units. Gzip and Brotli totals are sums of independently compressed JavaScript files. They represent deployable chunks, not a single initial page transfer. Reproduce with `node scripts/report-bundles.mjs <baseline-dist> dist`.

| Production output | Baseline | Phase 3.5 |
|---|---:|---:|
| Total JavaScript | 8,595,656 B | 4,887,223 B |
| JavaScript gzip | 2,747,912 B | 1,658,711 B |
| JavaScript Brotli | 2,078,355 B | 1,308,240 B |
| Entire output including styles and assets | Approx. 8.64 MB | 4,936,459 B |
| Vite build stage | 5.88 s | 2.93 s on the initial optimized pass; 8.14 s on the final validation pass |

### Largest and affected chunks

| Chunk or feature | Baseline raw / gzip / Brotli | Phase 3.5 raw / gzip / Brotli |
|---|---:|---:|
| Plotly | 4,840,857 / 1,467,849 / 1,082,822 B | 1,129,521 / 377,214 / 310,702 B |
| Legacy scene | 2,283,719 / 846,546 / 629,104 B | 20,416 / 7,212 / 6,464 B |
| Illustrative debris | Included in legacy scene | 2,263,697 / 839,516 / 623,228 B, loaded on demand |
| Valley and shared 3D code | 903,256 / 244,335 / 201,130 B | Valley 1,588 B, shared 3D bundle 901,768 / 243,589 / 200,655 B |
| Main application | 258,551 / 82,759 / 71,482 B | 258,779 / 82,873 / 71,665 B |
| Earthquake lab | 37,867 / 13,042 / 11,708 B | 37,959 / 13,084 / 11,727 B |
| Constructor viewport | 18,941 / 7,423 / 6,644 B | 20,087 / 7,909 / 7,090 B |
| Earthquake explorer | 154,973 / 45,777 / 39,697 B | 154,973 / 45,778 / 39,694 B |

The table records the optimization build used for the bundle comparison. After the final roof and number-formatting fixes, the release preview contained 4,887,326 B raw JavaScript, 1,658,776 B gzip, and 4,936,562 B total output.

The Valley split defers the procedural landscape for views without context. Shared Three.js code remains necessary for a 3D viewport. The Plotly Basic build preserves line and bar traces, log axes, zoom, hover, legends, and image download. Seismic, diagnostics and legacy analytics plots retain bucket extrema for long traces. The solver and CSV continue to use full-resolution arrays. Direct Earthquake Lab entry now defers the constructor until requested. Comparison buildings share generated texture assets, which are disposed when the viewport changes. Low graphics generates 64×64 textures.

### Measured runtime spot checks

Same 1280 × 950 in-app desktop browser with default five-storey run, same renderer settings, local production previews, and identical temporary browser probes. Timing is from one run per browser metric and includes scheduler or automation variation. The optimized browser sample preceded the final fullscreen fallback, which does not change the measured execution paths. JavaScript heap is Chromium's reported sample, not process RSS or GPU memory.

| Metric | Baseline | Optimized sample |
|---|---:|---:|
| DOM interactive | 24 ms | 18 ms |
| Navigation to first lab canvas | 336 ms | 347 ms |
| Decoded JS before opening Results | 1,265,260 B | 1,248,106 B |
| Decoded JS after first chart | 6,111,143 B | 2,382,663 B |
| JS heap before opening Results | 32,976,682 B | 31,312,484 B |
| JS heap after first chart | 47,661,594 B | 32,797,903 B |
| First chart visible after opening Results | 421 ms | 446 ms |
| Playback counter, one short sample | 32 FPS | 32 FPS |
| WebGL draw calls / submitted triangles in sampled frame | 149 / 29,058 | 149 / 29,058 |
| Median solver job, 5 storeys × 2,401 steps | 3.02 ms | 2.98 ms |
| Median solver job, two 20-storey models × 12,001 steps each | 42.57 ms | 40.40 ms |

The strongest measured differences are chart payload and chart-open heap. Canvas and chart-ready latency and the rendering spot sample did not establish a meaningful speedup. High-level draw counts were retained for the same scene. The probe counts WebGL calls and submitted triangles including shadow work; it does not measure GPU timing, memory, or thermal load. Numerical benchmark uses three warm-ups and nine runs per case. The packed result sizes and final corrected ground offsets were unchanged.
