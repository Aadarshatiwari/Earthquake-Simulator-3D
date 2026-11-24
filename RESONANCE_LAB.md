# Resonance lab

For each plotted frequency f, solve the complex linear system

```text
(K − ω² M + i ω C) U = −M r
ω = 2π f
```

The right-hand side is the equivalent load from 1 m/s² harmonic base acceleration. Divide the absolute harmonic roof amplitude by the magnitude of the static solution for the same load. The solver uses partial pivoting and reports an unresolved exact singularity as a gap. The analytical SDOF reference is 1 / sqrt((1−q²)² + (2ζq)²), with q = f/f_n.

The laboratory displays modal periods and the chosen excitation frequency. Changing the building mass, stiffness and damping updates the same analytical model used for time integration. The Resonance scenario sets a flat sinusoid near the first natural frequency, subject to input limits. Time-domain finite-duration response includes startup transients and need not equal the steady-state curve.
