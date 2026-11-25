import {useEffect,useState} from 'react';
export default function Waves(){
  const [distance,setDistance]=useState(90);
  const [animate,setAnimate]=useState(false);
  const [time,setTime]=useState(0);
  useEffect(()=>{
    if(!animate)return;
    let handle=0;const started=performance.now();
    const tick=(now:number)=>{const t=(now-started)/180;setTime(t);if(t<distance/2.9+6)handle=requestAnimationFrame(tick);else setAnimate(false);};
    handle=requestAnimationFrame(tick);return ()=>cancelAnimationFrame(handle);
  },[animate,distance]);
  return <details className="archive-card archive-waves"><summary>Learn how seismic waves travel</summary>
    <p className="archive-note">Illustrative travel times in a uniform medium. The hypocentre is the underground source; the epicentre is its surface projection. P waves compress material, S waves shear it, and surface waves travel near the surface. Real speed and attenuation vary with depth, rock, soil, and frequency.</p>
    <div className="archive-tools"><label>Illustrative path distance ({distance} km)<input type="range" min={10} max={300} value={distance} onChange={e=>{setAnimate(false);setTime(0);setDistance(+e.target.value);}}/></label>
      <button onClick={()=>{if(animate)setAnimate(false);else{setTime(0);if(!matchMedia('(prefers-reduced-motion: reduce)').matches)setAnimate(true);else setTime(distance/2.9);}}}>{animate?'Stop illustration':'Play illustrative waves'}</button></div>
    {([['P wave',6],['S wave',3.5],['Surface wave',2.9]] as const).map(([label,speed])=><div className="archive-wave-row" key={label}><span>{label}</span><progress max={1} value={Math.min(1,time*speed/distance)}/><strong>{(distance/speed).toFixed(1)} s</strong></div>)}
    <p className="archive-note">Fixed example speeds of 6, 3.5, and 2.9 km/s. The bars show illustrative propagation, independent of station replay or historical arrival observations.</p>
  </details>;
}
