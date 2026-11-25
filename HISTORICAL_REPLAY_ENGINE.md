# Historical replay engine

The workstation checks file SHA-256, sample count, units and time spacing before replay. A worker parses each selected file into north–south, east–west and vertical acceleration arrays. Playback interpolates the indicator at the current clock. The chart is downsampled for drawing while PGA and solver input use the full array. Frequency analysis uses a mean-removed Hann-windowed FFT. The horizontal orbit plots east–west versus north–south acceleration, with no inferred particle displacement.

Choose a building in **Build & test** and continue to the Earthquake lab to carry that design into the handoff. In the archive, choose NS or EW and press **Simulate on my building**. The selected component keeps its original interval and acceleration amplitude. The lab retains the source path and checksum, and **Compare buildings** applies the same sequence to two models. Vertical acceleration can be viewed in replay. The current structural solver uses one horizontal component per run.

The wave lesson illustrates P, S and surface propagation with constant teaching velocities. Its travel times and attenuation are illustrative. Archive ShakeMap layers represent published regional estimates, while station replay represents acceleration at a single instrument site.
