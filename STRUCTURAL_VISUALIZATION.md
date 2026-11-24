# Structural visualization

The Phase 2 renderer consumes model degrees of freedom in storey order. A bearing occupies index zero in an isolated model. Each storey is transformed by x(y) = u_lower + (u_upper − u_lower) y/h, rotated to the chosen horizontal direction. Adjacent storeys share the same displacement at their common endpoint. Relative response is visually scaled after interpolation. When available, integrated synthetic ground offset is added to the entire assembly, leaving an undeformed frame and ground reference grid available for comparison.

Coloured bands represent absolute magnitude of **floor displacement**, **absolute floor acceleration**, **interstorey drift percentage**, **storey elastic restoring force**, or **normalized modal displacement**. Automatic scaling uses one maximum across the calculated runs. Manual scaling is numeric and clips at the legend maximum. Modal scaling uses the maximum absolute mode-shape component. These legends describe response magnitude without stress, damage, or pass/fail thresholds.

The optional wave ring is illustrative and uses no measured propagation data. The separate damage demo does not supply the numerical results in this lab. The frame is a single-axis elastic shear model, so the representation cannot capture articulated member flexure, torsion, yielding or collapse.
