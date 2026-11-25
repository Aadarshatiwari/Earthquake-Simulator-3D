# Model limitations

SeismoNepal 3D is an educational simulator. Real-building earthquake safety requires assessment by qualified engineers with site and building information. The app provides no safety certification or verified Nepal National Building Code compliance.

- Each storey translates along one horizontal axis. The model omits torsion, vertical excitation, frame redistribution, diaphragm flexibility and multi-component input.
- Springs and dashpots are linear. Results cannot predict actual cracking, yielding, failure, collapse or damage probability.
- The freely editable mass, height, stiffness and damping of the example presets are educational idealizations. Stone and brick presets do not model brittle masonry failure. The soft-storey preset reduces the first spring and the reinforced preset demonstrates increased user-specified elastic stiffness.
- A model may store member geometry and modulus. These fields do not determine stiffness in this phase.
- The Phase 1 diagnostics use a fixed base. The older simulator additionally demonstrates a single linear bearing and illustrative soil and reinforcement settings whose factors are documented in [the visual simulator model notes](docs/model.md).
- No verified acceleration records are bundled. Catalog events, source magnitude and locally recorded time histories are distinct. CSV provenance identifies the user's supplied source and the engine validates format and units.
- The engine fits Rayleigh ratios at selected modes. Local dashpots can create nonproportional damping. The published mode shapes and frequencies describe the corresponding undamped eigenproblem.
- Energy balance verifies the discrete update. A coarse but energy-consistent solution can still have large phase error.
- The diagnostics engine requires no network after the app is loaded. Offline Android packaging and device testing remain future work.

## Phase 3 playback

The new laboratory plots linear floor-level quantities and contains no member stress or failure criterion. Ground movement is available for supported synthetic inputs through baseline correction and numerical integration. Imported acceleration is used without inferring ground displacement. Waves, rumble, haptic cues, and the separately accessible damage demonstration are illustrative. See [ground motion](GROUND_MOTION_ENGINE.md) and [structural visualization](STRUCTURAL_VISUALIZATION.md).


## Historical archive and terrain

The Phase 4.1 terrain uses kilometre-scale elevation sampling and an approximate local projection. The relief palette and snow tint are illustrative. Catalogue depth is drawn from a modelled surface reference. Static ShakeMap contours are published shaking estimates, while station samples are local measurements. The expanding wave diagrams use illustrative velocities and are independent of the historical event clock.

The Gorkha supplements contain raw acceleration and the publisher recommends sensor-response correction for engineering use. The application preserves sample values after unit conversion and does not infer velocity or position. The building response uses one horizontal axis and remains educational. Browser viewport emulation does not establish Android hardware performance.
