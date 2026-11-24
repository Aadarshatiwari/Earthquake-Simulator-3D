const topics=[
  ['Earthquake formation','Stress accumulates on faults as tectonic plates move. Sudden slip releases seismic energy. In Nepal, convergence between the Indian and Eurasian plates loads the Main Himalayan Thrust.'],
  ['Seismic waves','Compressional P waves usually arrive first, followed by shear S waves. Surface waves propagate near the surface and can contribute to prolonged shaking. Local shaking also varies with distance, rupture and ground conditions.'],
  ['Magnitude and ground acceleration','Magnitude describes earthquake source size. Peak ground acceleration (PGA) measures the strongest acceleration at a site. Two stations can record different PGA from the same earthquake.'],
  ['Resonance','Response can grow when shaking contains energy near a natural frequency. Compare the frequency chart with the synthetic input frequency, then adjust storey stiffness or floor mass.'],
  ['Structural damping','Damping dissipates vibrational energy. Compare an ordinary frame with supplemental damping using the same input, and inspect the drift and acceleration traces.'],
  ['Soil amplification','Near-surface materials can alter amplitude and frequency content. The simulator uses simple constant amplification factors for illustration. A site-response study needs geotechnical data and frequency-dependent analysis.'],
  ['Base isolation','Flexible bearings can lengthen the fundamental period and reduce some transmitted acceleration while increasing movement at the base. Observe the isolation displacement in the CSV and compare floor acceleration.'],
  ['Earthquake-resistant construction','Engineered load paths carry inertia forces to the foundation. Braces and shear walls can add lateral stiffness. Connections, detailing, material quality and ductility affect actual performance.']
];
export default function Learn(){return <>
  <div className="heading"><div><h1>Earthquake engineering guide</h1><p>Use the lab to connect seismic concepts with measurable structural response.</p></div></div>
  <div className="learning-grid">{topics.map(([title,body])=><article className="panel learning" key={title}><h2>{title}</h2><p>{body}</p></article>)}</div>
  <section className="panel learning preparedness"><h2>Earthquake preparedness in Nepal</h2><p>Before shaking, secure tall furniture and heavy objects, prepare essential supplies and practice your household plan. During shaking indoors, drop, cover and hold on. Protect your head and neck, and shelter under sturdy furniture if it is nearby. After shaking, expect aftershocks and follow official local instructions.</p><p><a href="https://www.ready.gov/earthquakes" target="_blank" rel="noreferrer">Ready.gov earthquake guidance</a> · <a href="https://bipad.gov.np/" target="_blank" rel="noreferrer">Nepal disaster information portal</a></p></section>
</>;}
