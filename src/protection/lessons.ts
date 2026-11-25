export const lessons=[
  ['Mass and inertia','Ground acceleration produces an inertial load proportional to mass. Change floor mass and compare roof response under the same motion.','F = −m aᵍ','baseline'],
  ['Natural period and resonance','A harmonic input near a natural frequency can produce a large response. View the resonance chart, then change stiffness.','ω = √(k/m) for one degree of freedom','baseline'],
  ['Damping','Viscous forces oppose relative velocity. Compare the damping energy history with supplemental devices on and off.','P = c v²','viscous'],
  ['Stiffness, strength and ductility','Stiffness is the elastic force–deformation slope. Strength and ductility describe capacity and inelastic deformation. Add a wall and compare drift with floor acceleration.','F = k u in the elastic model','wall'],
  ['Soft storey','A lower first-storey stiffness can concentrate deformation there. Select a soft-storey building, then try the simplified strengthening experiment.','Drift = interstorey displacement / height','retrofit'],
  ['Base isolation','Isolation lengthens the global period and can increase bearing displacement. Compare isolated and fixed-base cases against the same motion.','T ≈ 2π √(M/kᵦ)','isolation'],
  ['Cross-bracing','An axial force has a horizontal component. Compare two active elastic braces with an idealized one-active-brace stiffness.','k = EA cos²θ / L','brace'],
  ['Shear walls','A continuous wall bends and shears. This experiment matches a cantilever’s top-load compliance with simplified shear springs.','Δ = F(H³/3EI + H/κGA)','wall'],
  ['Tuned mass damping','An attached mass has its own motion. Compare tuned and mistuned settings on the same frequency-response graph.','k𝒹 = m𝒹(2πf𝒹)²','tmd'],
  ['Hydraulic dampers','Inclined linear viscous devices dissipate energy from relative motion. Compare energy and peak per-device axial force.','F𝒹 = cᵈ vᵣₑₗ','viscous'],
  ['Retrofitting in Nepal','Continuous load paths, horizontal seismic bands, vertical reinforcement, reliable roof-to-wall connections and workmanship affect behaviour. Apply a conceptual retrofit and inspect what the model represents.','Load path: roof → walls and frames → foundations','retrofit'],
] as const;
