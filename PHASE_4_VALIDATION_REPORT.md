# Phase 4 validation

Verified 25 November 2026 on the local macOS arm64 environment. The pre-change checkpoint is `07a22ce`. All 62 prior tests and six archive tests passed. The production TypeScript and Vite build succeeded. Vite reported its large-chunk warning for the lazy-loaded rendering and plotting bundles.

| Browser path | Observed result |
| --- | --- |
| Archive on desktop | 275 events, default interactive map, selected Dolakha and MMI overlay with a USGS product link |
| Three-dimensional terrain | 3D stage and depth section switch, with 15.00 km in selected Dolakha details |
| Station replay | Dolakha KTP EW passed SHA-256, displayed 0.0689 g and showed playback advancing |
| Structural analysis | Loaded the original KTP EW recording with checksum provenance and completed the 179.99-second run |
| Browser emulation at 390 × 844 | No horizontal overflow, historical search returned the 1255 entry, station replay opened and started |

The six archive tests cover catalogue and source fidelity, historical missing values, Kathmandu time, geographic filtering, all 16 recording hashes and unit conversion, two-building solver handoff and FFT frequency. Desktop and phone-width captures are in [docs/screenshots/phase-4](docs/screenshots/phase-4/). Phone-width verification used a desktop browser viewport. Physical phone GPU performance was not measured.

| Operation | Median | Approximate 90th percentile |
| --- | ---: | ---: |
| Parse 273 catalogue rows, including JSON decode | 0.19 ms | 0.21 ms |
| Parse KTP station text into three channels | 5.50 ms | 6.67 ms |
| Solve two buildings with 18,000 samples each | 7.29 ms | 9.27 ms |

Measurements used Node 24.22.3, four warmups and 15 timed iterations per operation. These isolate CPU work and exclude I/O, worker startup and rendering. The catalogue, two boundary files and terrain total 252,946 uncompressed bytes. Station assets load individually.

Critical data boundaries are documented in [provenance](SEISMIC_DATA_PROVENANCE.md) and [station data](STRONG_MOTION_DATASETS.md).
