# Base-isolation model

The isolated building has a base translation connected to the ground by a linear spring and dashpot. The first storey attaches to that base. The base mass is counted once. The rigid-superstructure estimates are `k_b = M (2π/T_b)²` and `c_b = 2 ζ_b √(M k_b)`, where M includes the translating base, floor and optional damper masses. Engineering mode accepts direct stiffness and damping overrides. The modal solver calculates the flexible coupled periods separately.

Bearing displacement is the base coordinate relative to ground. Reference stroke is an educational comparison value. The foundation view shows foundation plates and an amplified displacement across the bearings. Laminated rubber, lead-rubber, high-damping rubber and friction-pendulum selections are illustrations of an equivalent linear model. Yielding, gap closure, travel stops, vertical behaviour and friction hysteresis require separate models.
