import {useEffect,useRef} from 'react';
import L from 'leaflet';
import type {GeoJsonObject} from 'geojson';
import 'leaflet/dist/leaflet.css';
import {cities,nepalBounds,type Bounds} from './geography';
import {archiveAsset,type Event,type RecordingMeta} from './catalog';

export const mapModes=['Offline','Standard','Terrain tiles','Dark','Satellite'] as const;
export type MapMode=typeof mapModes[number];
const tileSpecs:Partial<Record<MapMode,{url:string;attribution:string;maxZoom?:number}>>={
  Standard:{url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'},
  'Terrain tiles':{url:'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',attribution:'© OpenStreetMap, SRTM | © <a href="https://opentopomap.org/about">OpenTopoMap</a> (CC BY-SA)',maxZoom:17},
  Dark:{url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',attribution:'© OpenStreetMap · © <a href="https://carto.com/attributions">CARTO</a>'},
  Satellite:{url:'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2024-10-24/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',attribution:'<a href="https://www.earthdata.nasa.gov/data/tools/gibs">NASA EOSDIS GIBS</a> · Terra MODIS · 24 Oct 2024',maxZoom:9},
};
type Props={events:Event[];event:Event|null;provinces:Bounds|null;districts:Bounds|null;stations:RecordingMeta[];mode:MapMode;fit:number;showDistricts:boolean;showStations:boolean;shake:string|null;chronology:number|null;onSelect:(event:Event)=>void;onDistrict:(district:string)=>void;onNotice:(value:string)=>void};
const textNode=(str:string)=>{const node=document.createElement('span');node.textContent=str;return node;};
export default function ArchiveMap(props:Props){
  const div=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null);
  const points=useRef<L.LayerGroup|null>(null);
  const {events,event,provinces,districts,stations,mode,fit,showDistricts,showStations,shake,chronology,onSelect,onDistrict,onNotice}=props;
  const callbacks=useRef({onSelect,onDistrict,onNotice});
  callbacks.current={onSelect,onDistrict,onNotice};
  useEffect(()=>{
    if(!div.current)return;
    const instance=L.map(div.current,{scrollWheelZoom:false,zoomControl:true,preferCanvas:true,minZoom:4}).fitBounds(nepalBounds,{padding:[18,20]});
    map.current=instance;
    L.control.scale({imperial:false}).addTo(instance);
    instance.attributionControl.addAttribution('Boundaries © <a href="https://localboundries.oknp.org/">Open Knowledge Nepal</a> · CC BY 4.0');
    points.current=L.layerGroup().addTo(instance);
    const resize=new ResizeObserver(()=>instance.invalidateSize({pan:false}));resize.observe(div.current);
    return ()=>{resize.disconnect();instance.remove();map.current=null;points.current=null;};
  },[]);
  useEffect(()=>{
    const instance=map.current,spec=tileSpecs[mode];if(!instance||!spec)return;
    const layer=L.tileLayer(spec.url,{attribution:spec.attribution,maxNativeZoom:spec.maxZoom??19,maxZoom:19});
    let warned=false;
    layer.on('tileerror',()=>{if(!warned){warned=true;callbacks.current.onNotice('Basemap tiles are unavailable. Offline boundaries remain visible.');}});
    layer.addTo(instance);return ()=>{layer.remove();};
  },[mode]);
  useEffect(()=>{
    const instance=map.current;if(!instance)return;
    const geometry=L.layerGroup().addTo(instance);
    if(provinces)L.geoJSON(provinces,{
      style:{color:'#79dce7',weight:1.6,fillColor:mode==='Offline'?'#204559':'#133548',fillOpacity:mode==='Offline'?.64:.14},
      onEachFeature:(feature,layer)=>layer.bindTooltip(textNode(feature.properties.name),{sticky:true}),
    }).addTo(geometry);
    if(showDistricts&&districts)L.geoJSON(districts,{
      style:{color:'#5d9cae',weight:.7,fillOpacity:0},
      onEachFeature:(feature,layer)=>{layer.bindTooltip(textNode(feature.properties.name),{sticky:true});layer.on('click',()=>callbacks.current.onDistrict(feature.properties.name));},
    }).addTo(geometry);
    for(const [name,lat,lon] of cities)L.circleMarker([lat,lon],{radius:2.8,fillOpacity:1,fillColor:'#c9e4e9',color:'#25394a',weight:1}).bindTooltip(textNode(name),{direction:'right'}).addTo(geometry);
    if(showStations)for(const station of stations)L.circleMarker([station.latitude,station.longitude],{radius:4,weight:1.3,color:'#f5faff',fillColor:'#ac88ff',fillOpacity:.85}).bindTooltip(textNode('Station '+station.station)).addTo(geometry);
    return ()=>{geometry.remove();};
  },[provinces,districts,showDistricts,showStations,stations,mode]);
  useEffect(()=>{
    const instance=map.current,layer=points.current;if(!instance||!layer)return;
    function render(){
      if(!instance||!layer)return;
      layer.clearLayers();
      const groups=new Map<string,Event[]>();
      for(const item of events){
        if(item.id===event?.id||item.lat===null||item.lon===null||chronology!==null&&item.year>chronology)continue;
        const point=instance.project([item.lat,item.lon],instance.getZoom());
        const key=instance.getZoom()>=9?item.id:Math.floor(point.x/29)+':'+Math.floor(point.y/29);
        const bucket=groups.get(key)??[];bucket.push(item);groups.set(key,bucket);
      }
      for(const group of groups.values()){
        const item=group[0],position:[number,number]=[item.lat!,item.lon!];
        if(group.length>1){
          L.circleMarker(position,{radius:Math.min(15,7+Math.sqrt(group.length)),color:'#95dde1',weight:1,fillColor:'#234e61',fillOpacity:.95})
            .bindTooltip(textNode(group.length+' catalogued events')).on('click',()=>instance.setView(position,instance.getZoom()+1)).addTo(layer);
        }else L.circleMarker(position,{radius:Math.max(4,(item.mag??4)*1.02),color:item.featured?'#ffcf8e':'#8ee6ef',weight:item.featured?1.6:1,fillColor:item.featured?'#dc935e':'#39b3ce',fillOpacity:.67})
          .bindTooltip(textNode(item.name)).on('click',()=>callbacks.current.onSelect(item)).addTo(layer);
      }
      if(event&&event.lat!==null&&event.lon!==null&&(chronology===null||event.year<=chronology))L.circleMarker([event.lat,event.lon],{radius:11,color:'#fff2cf',weight:2,fillColor:'#ef9966',fillOpacity:.87}).bindTooltip(textNode(event.name)).addTo(layer);
    }
    render();instance.on('zoomend',render);return ()=>{instance.off('zoomend',render);};
  },[events,event,chronology]);
  useEffect(()=>{map.current?.fitBounds(nepalBounds,{padding:[18,20]});},[fit]);
  useEffect(()=>{
    if(event?.lat!=null&&event.lon!=null)map.current?.panInside([event.lat,event.lon],{padding:[45,45]});
  },[event]);
  useEffect(()=>{
    if(!shake)return;
    const instance=map.current;
    if(!instance)return;
    const controller=new AbortController();
    const layer=L.layerGroup().addTo(instance);
    fetch(archiveAsset('shakemap/'+shake+'.json'),{signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json();})
      .then((geo:GeoJsonObject)=>{
        if(controller.signal.aborted)return;
        L.geoJSON(geo,{style:feature=>({weight:2,color:typeof feature?.properties?.color==='string'?feature.properties.color:'#ffc779',opacity:.91}),
          onEachFeature:(feature,featureLayer)=>featureLayer.bindTooltip(textNode(String(feature.properties.value??'')+' '+String(feature.properties.units??''))),
        }).addTo(layer);
      }).catch(()=>{if(!controller.signal.aborted)callbacks.current.onNotice('This contour layer could not be loaded.');});
    return ()=>{controller.abort();layer.remove();};
  },[shake]);
  return <div className="archive-map" aria-label="Interactive Nepal earthquake map" ref={div}/>;
}
