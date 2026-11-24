# Phase 1 validation report

Measured on Apple Silicon with Node 24.22.3 and Vitest 5.1.1. Reproduce with `npm ci`, then `npm test`. To print the analytical metrics, run:

```sh
npx vitest run tests/engine --reporter=verbose --disableConsoleIntercept
```

**Result:** 20 Phase 1 tests and 7 simulator adapter regressions passed.

| Check | Measured maximum error | Acceptance threshold |
|---|---:|---:|
| Undamped SDOF free vibration, Δt 0.002 s | 2.6200 × 10⁻⁵ m | 3 × 10⁻⁵ m |
| Damped SDOF free vibration, Δt 0.002 s | 7.9841 × 10⁻⁶ m | 1.5 × 10⁻⁵ m |
| SDOF harmonic base excitation, Δt 0.001 s | 2.2563 × 10⁻⁶ m | 4 × 10⁻⁶ m |
| Two-storey eigenvalues | 0 rad²/s² at displayed precision | 1 × 10⁻¹⁰ rad²/s² |
| Undamped discrete energy residual | 4.6896 × 10⁻¹³ J | 1 × 10⁻⁹ J |
| Forced, damped discrete energy residual | 6.5370 × 10⁻¹³ J | 1 × 10⁻⁸ J |

Time-step refinement from 0.02 to 0.01 to 0.005 s reduced maximum displacement error from 2.3824 to 0.60543 to 0.15196 mm. Successive ratios were about 3.94 and 3.98, consistent with second-order integration.

## Independently expanded two-storey benchmark

For M = diag(1000, 2000) kg and K = [[160000, −60000], [−60000, 60000]] N/m, expansion of det(K − λM) and division by det(M) gives λ² − 190λ + 3000 = 0. Thus λ = (190 ± √24100)/2. The test compares both roots to the squared computed frequencies, confirms unit generalized mass, and verifies that modal effective mass sums to the total participating mass.

## Coverage

The suite checks known scalar frequency, harmonic and free response, zero-state behaviour, mass and stiffness assembly, symmetry and positivity, modal values, three proportional damping choices, convergence, drift, restoring force, absolute acceleration, signed support reaction, energy, invalid inputs, CSV, g conversion, seeding, resampling, integration cancellation and packed 20-storey runs. The regressions cover the earlier simulator's fixed and isolated systems and response spectrum.

## Production browser checks

The built application completed a worker-backed default run, rendered the energy plot, displayed the stiffness matrix and downloaded its CSV. A 20-storey run was cancelled from the UI and the default model ran successfully after Reset. A 390 px viewport had no document-level horizontal overflow after the chart resize fix. The existing 3D base-isolation comparison loaded with the new engine adapter. The browser reported no console errors during the final checks.
