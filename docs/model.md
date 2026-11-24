# Numerical structural model

## Degrees of freedom and units

Each floor has one lateral translational degree of freedom relative to its moving foundation. The solver converts user inputs from metric tonnes and MN/m into kg and N/m. Storey height enters the drift calculation. Plan dimensions, material appearance and member dimensions are visual inputs. Real stiffness and mass depend on structural geometry, connections, materials and loads and must be determined independently.

For a regular fixed-base model, spring k_i connects levels i − 1 and i, with level zero fixed in ground-relative coordinates. Each spring contributes +k to both free diagonal entries and −k to the corresponding symmetric off-diagonal pair. Each lumped mass contributes one positive diagonal entry to M. A flexible foundation reduces the lowest spring to 72% of its nominal value. Braced frames and shear walls apply stiffness multipliers of 1.65 and 2.2. The isolation preset adds one foundation-level mass equal to a typical floor mass and gives its spring 4.5% of the specified stiffness. These are educational parameterizations with arbitrary example multipliers.

## Equation and integration

The equilibrium equation is M·ü + C·u̇ + K·u = −M·1·a_g, where u is displacement relative to the input ground motion. Soil multipliers of 1.00, 1.12 and 1.35 approximate amplitude changes for rock, dense soil and soft soil. Frequency-dependent site response is outside this model.

The solver computes modal frequencies from the eigenvalues of M⁻¹/² K M⁻¹/² using symmetric Jacobi rotations. Mode shapes are transformed back to physical coordinates and scaled to unit maximum component. C = αM + β_R K, with coefficients fit to the first and third available modal frequencies (or the highest available if fewer than three). Supplemental damping adds 12 percentage points to the target damping ratio.

Newmark average acceleration uses γ = 1/2 and β_N = 1/4. At each step form displacement and velocity predictors, solve for acceleration with the prefactored symmetric effective matrix M + Δt C/2 + Δt² K/4, and correct displacement and velocity. This scheme is unconditionally stable for the linear model. Accuracy still depends on adequate sampling relative to the fastest relevant motion and modes. Use a smaller interval for high-frequency inputs or check time-step convergence. The app starts with zero displacement and velocity and computes the initial relative acceleration from equilibrium.

Floor acceleration is absolute (relative acceleration plus site ground acceleration). Velocity and displacement refer to the moving ground. Interstorey drift is the relative displacement between adjacent levels divided by storey height, including the moving isolation level when present. Reported signed base shear is the reaction opposite the summed absolute inertial force of all masses, including the isolation mass. The UI's peak measures are maximum absolute values across time and the relevant floors. Modal frequency uses hertz.

## Graphics, damage and boundaries

The 3D player scales numerical deformation for visibility and rotates the single horizontal axis according to the dashboard direction. A 1× view uses the solver displacement amplitude. Floor connections are visual approximations. Cracking and Rapier debris use illustrative drift triggers. The collapse demo follows a scripted timeline and leaves all solver outputs unchanged. Neither effect predicts damage.

The model omits yielding, masonry failure, torsion, vertical response, strength limits, cyclic degradation, soil–structure interaction beyond a spring multiplier, and collapse mechanics. No output is a safety rating or engineering certification.

## Checks

Automated tests cover SI conversion and stiffness assembly, free and forced analytical SDOF response, signed shear, stability of a 21-degree-of-freedom isolated case and recording validation.

## Elastic response spectrum

The analytics view evaluates a family of independent linear single-degree-of-freedom oscillators with configurable damping. Each point is ω² times peak relative displacement, divided by standard gravity. The graph uses the site-scaled motion for each building. Its shortest plotted period is at least twelve input time steps. Use a time-step convergence study before interpreting short-period demand.
