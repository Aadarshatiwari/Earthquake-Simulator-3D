# Phase 2 rendering architecture

The constructor is a separate, lazy-loaded workspace under `src/constructor`. The parametric model and geometry generator have no browser or Three.js dependency. The renderer consumes an ordered collection of immutable part descriptions in metres. Part IDs use a storey prefix and a component/grid key, such as `L2/column-0-1`. Editing dimensions preserves IDs while their grid positions exist.

- `model.ts` owns preset data, geometry constraints, project compatibility, edit history and Phase 1 model mapping.
- `geometry.ts` assembles storey elevations, bay centers, member extents, openings, infill, roof slopes, bracing, shear walls and presentation parts. Floor displacement interpolation consumes actual sampled solver traces.
- `Viewport.tsx` renders shared primitive geometry with material batches and per-instance transforms. Floor groups maintain one affine transform each. Selection resolves a raycast instance ID to the source part. The selected part is drawn with a highlight material.
- `materials.ts` supplies procedural surface textures and shared physical materials. Canvas textures, materials and the environment render target have explicit lifetimes. Reusable box and gable meshes retain module lifetime.
- `worker.ts` runs a deterministic, labeled synthetic pulse through Phase 1 and transfers its packed results. The viewport has no physics dependency beyond the result arrays.
- `Constructor.tsx` hosts validated edits, local projects, view controls and playback. The active draft is maintained when switching app tabs. The viewport suspends playback when hidden.

The stage uses an ACES filmic output transform, ambient light, directional shadows, optional room-environment lighting and a contact-shadow pass on Ultra. Ground reflections are omitted for the matte scenes. All five context styles are fictional. Orthographic project views and a perspective orbit camera use native pointer/touch support from OrbitControls. Section mode uses a world-space clip plane; exposed cuts are uncapped.

The renderer batches repeated components within each floor and keeps the frame loop on demand outside playback. Low quality removes the directional shadow pass, and Automatic adapts pixel ratio while interacting. WebGL loss is surfaced in the viewport and reinitialization is available without losing the configuration.
