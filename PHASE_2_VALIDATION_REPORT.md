# Phase 2 validation report

Phase 1 baseline: **27 tests passed** and the production build succeeded before editing. Local Git checkpoint: `0f08d55`.

Phase 2 adds 13 automated cases covering 1-, 5-, 10- and 20-storey geometry, stable IDs, component dimensions and materials, every preset, rejected geometry, DOF ordering and bearing offset, actual eigenvectors, response interpolation, ground displacement, versioned JSON and undo/redo. Run `npm test` and `npm run build`.

Refer to [mobile performance](MOBILE_PERFORMANCE.md) for the measured generation and solver times, environments, and Android verification limits. Refer to [model mapping](STRUCTURAL_MODEL_MAPPING.md) for the scientific scope and limits.

## Final verification

- All 40 tests passed, including all 27 Phase 1 baseline cases. Strict TypeScript checking and the Vite production build succeeded.
- The in-app desktop browser rendered the default residence, Newari preset, and 20-storey frame. Direct raycast selection identified a balcony, and material inspection selected a column by ID. The camera and view selectors switched through all available options. Phase 1 Diagnostics completed a run after returning from the constructor.
- The constructor's worker drove synthetic playback and actual modal display. A local project was duplicated, reopened, and deleted with confirmation. Undo and redo restored the 5- and 20-storey configurations.
- Verified 1280 × 900 desktop, 390 × 844 portrait, and 844 × 390 landscape. The landscape test exposed a navigation overflow, which was fixed and rechecked. No browser console errors were reported in the final interaction checks.
- A physical touchscreen or Android WebView, repeated context-loss cycles, and sustained GPU/memory profiling were outside this verification run.
