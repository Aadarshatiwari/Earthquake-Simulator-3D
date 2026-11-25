# Structural energy analysis

The numerical integration reports kinetic energy `½ vᵀMv`, elastic strain energy `½ uᵀKu`, cumulative dashpot dissipation and accumulated work by the ground forcing term. For an average-acceleration step, a dashpot with relative midpoint velocity `v_mid` dissipates `Δt c v_mid²`. This uses the same midpoint velocity as the Newmark energy accounting. The device calculation partitions the local dashpot contributions into structural, isolation, tuned mass and supplemental viscous groups. The groups sum to the total model dissipation.

The residual is kinetic plus strain plus accumulated dissipation minus input work and initial energy. Elastic strain energy is recoverable. The reported peak absolute residual uses every integration sample. The full-frequency and time-history benchmarks are in the [validation report](PHASE_5_VALIDATION_REPORT.md).
