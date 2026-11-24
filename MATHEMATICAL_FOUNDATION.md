# Mathematical foundation

## Model and units

Each level has one horizontal translation relative to its moving reference base. The columns of the fixed-base model are ordered from the first storey to the roof. Mass is diagonal, with one positive lump per level. A spring at storey i contributes +kᵢ to both active diagonal terms and −kᵢ to the two cross terms. The lowest spring connects to a prescribed zero relative displacement and contributes to the first diagonal only. Independent dashpots assemble by the same rule. Positive springs with a fixed reference make K symmetric positive definite. The engine checks positivity with Cholesky before solving.

Beam, column, elastic modulus, area and second moment are stored as validated metadata. The independent SI spring value is authoritative. This phase makes no geometry-derived stiffness estimate.

The excitation equation is M ü + C u̇ + K u = −M r a_g. The influence vector r is one at each active coordinate by default. The absolute acceleration at coordinate i is üᵢ + rᵢ a_g. Reported signed base shear is the reaction opposite the sum of all masses times their absolute accelerations. Storey restoring force is the elastic spring term kᵢ(uᵢ − uᵢ₋₁). Drift ratio divides that storey displacement difference by its height. All physical calculations use SI and Float64Array storage.

## Modes and damping

The Jacobi eigensolver diagonalizes M⁻¹ᐟ² K M⁻¹ᐟ². It converts the eigenvectors back with M⁻¹ᐟ² and sorts results by ascending ω. Each mode has unit generalized mass, φᵀMφ = 1, and its roof component is chosen nonnegative. Frequency is ω/(2π) and period is 2π/ω. Participation Γ = φᵀMr and effective modal mass Γ² with this normalization. Effective mass ratio divides by rᵀMr.

Proportional damping uses C = α M + β K plus optional localized dashpots. Target modal ratios apply to the proportional component before dashpots. For Rayleigh damping, solve ζᵢ = α/(2ωᵢ) + βωᵢ/2 at two distinct frequencies and reject negative coefficients. Mass-only and stiffness-only use one target. SDOF viscous damping uses c = 2ζmω. Ratios vary with frequency away from the fitted modes.

## Integration and energy

Newmark average acceleration fixes β_N = 1/4 and γ = 1/2. With step h, predictors are u* = u_n + hv_n + h²a_n/4 and v* = v_n + ha_n/2. Factor M + hC/2 + h²K/4 once with Cholesky. Solve for aₙ₊₁ from −Mr a_g,n+1 − Ku* − Cv*. Correct uₙ₊₁ = u* + h²aₙ₊₁/4 and vₙ₊₁ = v* + haₙ₊₁/2. Initial acceleration follows the original equilibrium equation with the specified initial displacement, initial velocity and initial acceleration input.

For these linear systems, average acceleration is unconditionally stable and second order. Long steps can still miss excitation, distort amplitudes and accumulate phase error. A diagnostic warns below 20 integration steps per period at the highest mode carrying at least 2% effective mass, the fundamental, or the known synthetic carrier frequency, whichever governs. This is a screening heuristic. Imported bandwidth is unknown. Halve the time step and compare peaks and traces.

Kinetic energy is vᵀMv/2. Elastic energy is uᵀKu/2. With average step velocity v̄, damping adds h v̄ᵀC v̄. Input work adds the average step excitation force dotted with the displacement increment. The residual is kinetic + strain + cumulative damping dissipation − cumulative input work − initial energy. Undamped free-vibration total energy should remain constant to roundoff. Damped unforced motion transfers mechanical energy into the nondecreasing dissipation term. A small residual checks discrete energy consistency. Time-step convergence and reference responses independently assess accuracy.

## Time histories

Synthetic signals include sinusoidal, tapered two-frequency and deterministic seeded multisine motions. Synthetic pulse PGA is normalized from the samples. CSV imports require explicit acceleration units and provenance supplied by the user. Upsampling uses linear interpolation. Downsampling applies a finite Hann-windowed sinc low-pass filter. Input after the end of an extended recording is zero. Simulation duration snaps to the nearest full time step. Resampling cannot restore missing high-frequency content.

## References

- Nathan M. Newmark, *A Method of Computation for Structural Dynamics*, 1959. [Original paper](https://doi.org/10.1061/JMCEA3.0000098)
- OpenSees, [Newmark integrator](https://opensees.github.io/OpenSeesDocumentation/user/manual/analysis/integrator/Newmark.html) and [Rayleigh damping](https://opensees.github.io/OpenSeesDocumentation/user/manual/model/damping/rayleigh.html)
