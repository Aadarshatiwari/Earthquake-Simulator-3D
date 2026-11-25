# Tuned mass damper

A separate mass coordinate connects to the chosen floor through a spring and dashpot. For mass m, target frequency f and damping ratio ζ, `ω = 2πf`, `k = mω²` and `c = 2ζmω`. Both the floor and mass experience inertial excitation under base acceleration. The lab reports peak mass travel, displacement relative to its attachment and dashpot force. The displayed calculated mass position uses the attachment coordinate on the same amplified playback clock as every floor. Suspension and mechanical details illustrate the horizontal oscillator.

The tuned/mistuned lesson starts with the reference building’s first frequency and compares it with a 60% higher tuning frequency. The resonance plot is steady state, while the transient recorded response depends on the earthquake spectrum and time history. Some response metrics can increase.

For an undamped 1,000 kg frame with 80,000 N/m stiffness and a 100 kg secondary mass with 8,000 N/m stiffness, the analytical base-excitation cancellation occurs at `ω² = (k_d/m_d)(1 + m_d/m_1) = 88 s⁻²`. A separate benchmark checks the coupled characteristic polynomial.
