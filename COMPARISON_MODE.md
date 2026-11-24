# Comparison mode

Building A and Building B may have different storey counts, masses, stiffness distributions, damping and bearing choices. Both receive the same acceleration samples, time step and input direction. A single viewport camera, playhead and colour scale apply to both models. Their summary compares peak relative roof displacement, maximum building-storey drift, peak floor acceleration, base shear, natural period and dissipated energy.

The Soft storey scenario copies A and reduces B's first-storey spring to 30% of the original. The High damping scenario copies A and increases B's target damping. These are parameter experiments. For unequal numbers of storeys the chart labels each actual displayed storey, clamping an unavailable storey to that building's roof. Bearing drift and acceleration are exported separately with bearing labels. No single scenario establishes which building is safer in general.
