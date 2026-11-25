# Terrain performance

## Production build

| Asset | Phase 4 gzip | Phase 4.1 gzip |
| --- | ---: | ---: |
| Main JS entry | 82.97 kB | 83.05 kB |
| Archive JS | 8.80 kB | 10.62 kB |
| Leaflet archive map JS | 45.51 kB | 45.62 kB |
| Lazy terrain JS | 1.76 kB | 14.19 kB |
| Shared Three.js/OrbitControls JS | 242.43 kB | 242.45 kB |
| Lazy station replay JS | 3.32 kB | 4.38 kB |
| Recording worker JS | 1.20 kB | 1.39 kB |

Vite continues to warn about large lazy rendering, plotting and legacy debris chunks. The terrain grid is 138,596 bytes uncompressed and 53,048 bytes gzipped. It is only loaded on entering 3D. The regional river asset is 23,451 bytes uncompressed and 7,732 bytes gzipped. The optional geology layer is 17,621 bytes uncompressed and 3,791 bytes gzipped. The 2D catalogue extension is 1,673 bytes uncompressed and 640 bytes gzipped. Browser delivery may use different compression depending on server settings.

## CPU benchmarks

| Operation | Median | Approximate 90th percentile |
| --- | ---: | ---: |
| Decode coarse Phase 4 grid and mesh with the Phase 4.1 builder | 0.24 ms | 0.40 ms |
| Decode fine grid and mesh with the same builder | 4.45 ms | 4.60 ms |
| Parse original Gorkha KTP acceleration text | 2.83 ms | 2.94 ms |
| Solve two buildings with 10,000 Gorkha KTP samples each | 3.87 ms | 4.35 ms |

Node 24.22.3 on macOS arm64, six warmups followed by 21 timed runs per operation. Mesh work includes decoding, normals, bounds and disposal. Record and solver timings exclude file I/O, worker startup, network and browser rendering. For context, Phase 4 measured a different 18,000-sample aftershock at 5.50 ms parse and 7.29 ms two-building solve. See the [Phase 4 validation report](PHASE_4_VALIDATION_REPORT.md).

The refined mesh has 31,122 vertices and 61,500 triangles. The demand-driven terrain runs with a capped device pixel ratio of 1.35. No physical Android GPU frame time, battery drain or sustained thermal performance was measured.
