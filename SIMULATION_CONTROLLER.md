# Simulation controller

`src/seismic/jobs.ts` prepares shared input, invokes Phase 1 per building, and packages results and optional ground kinematics. `worker.ts` transfers packed buffers and sends throttled progress messages. `WorkerSlot` clears worker ownership before termination. This prevents replaced or cancelled workers from publishing stale results. The controller terminates workers on completion, cancellation and unmount.

`controller.ts` holds a pure playback state transition function. The rendering loop reads a continuously advancing time ref while React metrics and chart cursors publish about 14 times per second. Scrubbing, peak seeking and frame stepping use the same time basis. Pause and stop silence rumble. Hidden tabs pause active playback, and the viewport draws on demand when stopped. Structural inputs invalidate previous results. Graphics settings and playback speed do not trigger numerical recomputation.

The limit is 12,001 samples per building and two buildings per job. The solver's packed numerical buffers use Float64. The optional ground kinematics buffer is shared across the input. The charts display a decimated trace for responsiveness, while peak calculations and CSV exports retain all time steps. During a severe frame drop the playhead caps a single elapsed frame to avoid a large visual jump. This affects wall-clock animation timing only.
