# Earthquake laboratory

Open **Earthquake lab**, or select **Continue to simulation** in **Build & test** to transfer the current building, including every storey's analytical inputs.

1. Select a scenario or configure a waveform under **Motion**. **Calculate response** runs the Phase 1 engine in a worker. The calculation can be cancelled independently of playback.
2. Select **Start playback**. Use the slider, waveform, single-sample steps, or peak buttons to move to a numerical sample. **Restart** plays from zero and **Stop** returns to the initial state. Loop and playback speed affect only the playhead.
3. Use the heatmap and camera controls to inspect floor-level response. A **1×** deformation setting shows the native model scale. Select a storey with the live controls or by clicking a component. Open **Results** to see histories, peaks, and CSV export.
4. Enable **Compare buildings**, edit A or B in **Building**, and calculate again. Both structures receive identical input. **Resonance** plots steady-state amplification with the same analytical parameters.
5. Use **Saved** to manage simulation scenarios. Saving can include the calculated result arrays in local IndexedDB. JSON exports include versioned configuration and imported motion provenance. CSV exports SI histories and energy terms.

The default input is a deterministic, 24 s, 0.28 g synthetic broadband waveform. The lab runs offline once app assets are available. Audio, optional haptic cues, and illustrative rings are presentation effects. The separate legacy demo handles illustrative cracking, cosmetic debris, and scripted collapse with a persistent label.
