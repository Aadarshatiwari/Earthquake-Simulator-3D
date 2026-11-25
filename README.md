# SeismoNepal 3D

SeismoNepal 3D is an educational earthquake and structural dynamics lab for exploring how buildings respond to horizontal ground motion. It combines an interactive Three.js model with a linear shear-building solver, Plotly analytics and a Leaflet explorer for Nepal-region earthquakes.

## Run locally

Install Node.js 22.12+ or 24 and open this folder in VS Code or Terminal on Apple Silicon macOS.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite in a browser with WebGL support.

```sh
npm test
npm run build
npm run preview
```

## Phase 3.5 quality and performance

See [quality report](PHASE_3_5_QUALITY_REPORT.md), [before-and-after performance](PERFORMANCE_OPTIMIZATION.md), [visual design](VISUAL_DESIGN_SYSTEM.md), [Android readiness](ANDROID_READINESS_REPORT.md), [accessibility](ACCESSIBILITY_REPORT.md), and [actual application captures](docs/screenshots/phase-3.5).

## Phase 3 earthquake laboratory

Choose **Earthquake lab** or use **Continue to simulation** from a constructed building. Select a motion and **Calculate response**, then start playback. Try the Soft storey comparison or the Resonance tab to compare configurations. Sourced acceleration CSV, browser-local run storage and numerical CSV export are available from the lab.

See [lab guide](EARTHQUAKE_SIMULATION.md), [ground motion](GROUND_MOTION_ENGINE.md), [controller](SIMULATION_CONTROLLER.md), [visualization](STRUCTURAL_VISUALIZATION.md), [resonance](RESONANCE_LAB.md), [comparison](COMPARISON_MODE.md), [Android performance](ANDROID_PERFORMANCE.md) and [validation](PHASE_3_VALIDATION_REPORT.md).

## Phase 2 building constructor

The app opens on **Build & test**. Choose an architectural preset, edit the building dimensions and independent analytical inputs, and use **Continue to simulation** to run a synthetic earthquake. Use **Projects** to save, load or export your configuration.

See [constructor guide](BUILDING_CONSTRUCTOR.md), [rendering architecture](RENDERING_ARCHITECTURE.md), [structural model mapping](STRUCTURAL_MODEL_MAPPING.md), [materials](MATERIAL_LIBRARY.md), [asset licenses](ASSET_LICENSES.md), [performance](MOBILE_PERFORMANCE.md) and [Phase 2 validation](PHASE_2_VALIDATION_REPORT.md).

## Phase 1 diagnostics

Choose **Diagnostics** in the main navigation. Pick a model, edit independent storey values, and select **Run simulation**. Inspect the actual matrices and modes, switch between response and energy charts, and export the retained samples. **Simulation** opens the existing interactive 3D workspace.

```sh
npm test
npm run benchmark
```

See [architecture](ENGINE_ARCHITECTURE.md), [mathematical foundation](MATHEMATICAL_FOUNDATION.md), [validation](VALIDATION_REPORT.md), [performance](PERFORMANCE_REPORT.md), [limitations](MODEL_LIMITATIONS.md), [third-party notices](THIRD_PARTY_NOTICES.md), and the [changelog](CHANGELOG.md). Capacitor integration is planned. The new engine has been tested on Apple Silicon and in the desktop browser.

## Start an experiment

Choose a quick experiment to load a building and start playback. Open **Configuration** to edit dimensions, structural inputs, and the ground motion. Use the **Camera** menu to switch between perspective, front, and overhead views. Click a floor slab or choose a floor from **Live floor response** to see its displacement, acceleration, and drift at the current timeline position. Press Space to pause or resume while focus is outside a control.

## Try the included scenarios

| Scenario | Input PGA | Dominant input | Duration | Exercise |
|---|---:|---:|---:|---|
| Valley benchmark | 0.28 g | 1.25 Hz | 22 s | Compare an ordinary frame and an isolated frame using the default A/B models. |
| Resonance study | 0.15 g | 1.85 Hz | 26 s | Inspect the first natural frequency and adjust the input frequency around it. |
| Short strong pulse | 0.55 g | 2.6 Hz | 12 s | Inspect drift and floor acceleration under a shorter motion. |

These signals are synthetic. The earthquake explorer displays catalog metadata and does not convert magnitude into a ground acceleration input.

For an observed input, supply a station or archive reference and a uniformly sampled, two-column CSV. Accepted headers are `time_s,accel_m_s2` and `time_s,accel_g`. Each row contains elapsed seconds and one signed horizontal acceleration component. Use a uniform interval of 0.001–0.2 s and supply between 2 and 30,001 finite samples. The importer checks format and requires provenance text. Authenticate the recording and select the appropriate component and units at its source before importing.

Use **Analytics** for traces, modal results, a full per-floor CSV and a printable summary. Both buildings receive the same input history. Selecting different soil assumptions scales the motion independently at each site.

## Deploy to GitHub Pages

Push this project folder as the root of a GitHub repository on `main`. Set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. The included workflow installs locked dependencies, runs the numerical tests, builds `dist/` and deploys the artifact to Pages. It can also be started manually from the Actions tab.

## Source layout

- `src/engine/` implements the platform-independent solver. `src/solver.ts` adapts it to the existing simulator.
- `src/Scene.tsx` draws the building and plays optional illustrative damage effects.
- `src/Analytics.tsx` and `src/Explorer.tsx` implement the engineering charts and map.
- `tests/solver.test.ts` contains automated numerical and import checks.
- [Mathematical model](docs/model.md) and [data sources](docs/sources.md) document the assumptions and references.

The scene is an original stylized Nepal-inspired town. Presets are parameter sets for learning. The app cannot certify whether a real building is earthquake-safe. See the model documentation for assumptions and accuracy limits.
