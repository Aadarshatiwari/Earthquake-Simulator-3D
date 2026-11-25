# Equivalent reinforced-concrete wall model

For a prismatic cantilever of height H under top load F, the flexural and shear compliances are combined as `δ/F = H³/(3 E I) + H/(κ G A)`. The rectangular section uses `I = t L³/12`, `A = t L`, effective ν=0.2 for `G = E/[2(1+ν)]`, and κ=5/6. The effective factor multiplies the elastic stiffness. The composite wall-group stiffness is divided into series shear springs using `k_i = k_wall H/h_i`. A common top force then recovers the target top deflection before adding the existing frame springs.

Central core, elevator core, external and distributed graphics locate the wall layout. The entered dimensions represent the same equivalent wall group when the layout changes. The model matches one compliance and omits continuous bending shapes, torsion, diaphragm behaviour, interaction with openings and nonlinear cracking. Stiffness changes response demands. Strength and ductility are separate capacity properties.
