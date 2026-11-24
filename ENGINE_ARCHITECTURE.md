# Engine architecture

The Phase 1 public entry point is `src/engine/index.ts`. The numerical modules use standard TypeScript, typed arrays and the runtime's monotonic clock. They run in Node and the browser worker without React, DOM, Three.js or network dependencies.

| Module | Responsibility |
|---|---|
| `types.ts` | SI model and motion contracts, per-storey properties and run controls |
| `matrix.ts` | Row-major dense matrices, spring-chain assembly, matrix-vector operations and Cholesky |
| `structure.ts` | Structural validation, M/K/C assembly, boundary topology and damping |
| `modal.ts` | Symmetric, mass-weighted eigensolution and participation measures |
| `groundMotion.ts` | Waveforms, units, provenance-labelled CSV and resampling |
| `newmark.ts` | Integration, sampled histories, all-step peaks, energy and diagnostics |
| `workerProtocol.ts`, `worker.ts` | Worker job and result contracts, input preparation and transfer |
| `presets.ts` | Educational Nepal-inspired parameter sets |
| `Diagnostics.tsx`, `DiagnosticChart.tsx` | Job lifecycle, editable inputs, inspection, plots and CSV |
| `solver.ts` | Compatibility adapter for the existing 3D simulator and its analytics |

## Public API

Construct a `Model` with one to twenty ordered storeys and a damping strategy. Each storey needs mass in kg, height in m and lateral stiffness in N/m. It may supply a dashpot, initial state and SI beam or column section metadata. For horizontal translation the default influence vector is ones. A custom vector must have one finite entry per active DOF and at least one nonzero entry. The default fixed support sets ground-relative displacement below the bottom spring to zero. An optional linear bearing adds an active foundation coordinate for the earlier simulator.

`assembleModel(model)` returns row-major M, K and C, the mass vector, modal results and damping coefficients. `runSimulation(model, motion, controls)` requires uniformly sampled SI acceleration with a fixed interval. Motion length and interval define integration duration. `waveform`, `importCsv` and `resample` produce compatible records.

The time and scalar channels contain one entry per saved frame. Each response channel is sample-major. Read DOF j at sample i as `trace[i * numberOfDofs + j]`. The packed slab backs all time and response channel views. Output stride skips storage only. Final samples and peak calculations include the final integration step, and peaks use every step.

## Runtime and deployment

The diagnostics UI starts one module worker per job. That worker prepares the waveform or resamples the recording, reuses numerical buffers and sends progress during integration. The packed output buffer transfers ownership to the UI. Cancel terminates the worker immediately, including during input preparation. The core's cancellation callback supports headless clients. Closing the diagnostics view terminates an active job. The legacy visual simulation uses the same core synchronously through its compatibility adapter for its existing animation data format.

Default safeguards cap source synthesis and integration near 200,000 samples, enforce a 32 MiB packed output budget and report a clear error for over-budget jobs. The output budget can be configured through the public engine API and excludes input records, charts and small matrix/state buffers.

The engine and diagnostics work offline after app assets are available. Vite emits all engine and UI bundles, including the module worker. Future Capacitor packaging can point its asset directory at `dist`. Android packaging, WebView testing and store release are later phases.
