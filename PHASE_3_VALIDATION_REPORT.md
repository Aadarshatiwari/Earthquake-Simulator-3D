# Phase 3 validation report

Phases 1 and 2 were checkpointed locally at `d90f03f` after all 40 baseline tests and the production build passed. Phase 3 adds 19 tests for synthetic motion, PGA, units, baseline correction, state transitions, graphical displacement mapping, shared timelines, speed independence, pause/seek/replay, scaling, drift, peaks, comparison determinism, harmonic response, configuration/CSV, invalid input, cancellation and resource cleanup.

| Measured check | Result |
|---|---|
| SDOF harmonic amplification versus the closed-form curve | Maximum absolute error 1.11 × 10⁻¹⁶ |
| Final synthetic ground offset for the 5 s verification case | −6.12 × 10⁻¹⁵ m |
| Identical comparison models | Bitwise-equivalent packed responses |
| Frequency-response tolerance | 1 × 10⁻¹² absolute |
| Final synthetic ground-offset tolerance | 1 × 10⁻¹¹ m |

Reproduce results with `npm test` and `npm run build`. The detailed measured values are emitted by `npx vitest run tests/engine/seismic.test.ts --reporter=verbose --disableConsoleIntercept`. See [performance](ANDROID_PERFORMANCE.md) for benchmark method and results.

## Final browser and build checks

All 59 tests passed, including the 40 Phase 1 and 2 regressions. Strict TypeScript and Vite production build succeeded with chunk-size warnings for large rendering and plotting dependencies.

The desktop browser completed a run, started and paused playback, sought the roof and drift peaks, and rendered both the response and resonance charts. The Soft storey comparison produced about 1.322% maximum storey drift for A and 3.923% for B under identical synthetic acceleration. A simulation was saved with results, reloaded after browser refresh, and deleted after confirmation. The constructor handed off a Himalayan stone building. Responsive layout checks at 390 × 844 and 844 × 390 had no document-level horizontal overflow. Console inspection after the main feature checks returned no errors.

The automated suite validated sourced CSV input and generated CSV content. The browser's native file picker timed out during end-to-end upload automation, leaving that interaction unverified. Android hardware, haptics and sustained rendering performance were outside this test environment.
