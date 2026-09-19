"use client";
import dynamic from "next/dynamic";
import {useEffect,useMemo,useRef,useState} from "react";
import type{GlobeMethods}from"react-globe.gl";
import type{CountryState,Flow}from"@/lib/simulation/types";

const Globe=dynamic(()=>import("react-globe.gl"),{ssr:false});
type Arc={startLat:number;startLng:number;endLat:number;endLng:number;strength:number;kind:Flow["kind"]};
type CountryShape={properties:{ISO_A3:string;ADM0_A3:string;ADMIN:string};geometry:object};

export default function WorldMap({countries,flows,onSelect}:{countries:CountryState[];flows:Flow[];onSelect:(c:CountryState)=>void}){
  const wrap=useRef<HTMLDivElement>(null),globe=useRef<GlobeMethods|undefined>(undefined),[width,setWidth]=useState(900),[shapes,setShapes]=useState<CountryShape[]>([]),[hovered,setHovered]=useState<string|null>(null),[selected,setSelected]=useState<string|null>(null);
  useEffect(()=>{const resize=new ResizeObserver(([entry])=>setWidth(Math.round(entry.contentRect.width)));if(wrap.current)resize.observe(wrap.current);return()=>resize.disconnect()},[]);
  useEffect(()=>{fetch("/earth/countries.geojson").then(r=>r.json()).then(x=>setShapes(x.features)).catch(()=>setShapes([]))},[]);
  const by=useMemo(()=>Object.fromEntries(countries.map(c=>[c.code,c])),[countries]);
  const code=(shape:CountryShape)=>shape.properties.ISO_A3==="-99"?shape.properties.ADM0_A3:shape.properties.ISO_A3;
  const state=(shape:CountryShape)=>by[code(shape)];
  const shapeCodes=useMemo(()=>new Set(shapes.map(code)),[shapes]);
  const markers=useMemo(()=>countries.filter(c=>!shapeCodes.has(c.code)),[countries,shapeCodes]);
  const arcs=useMemo(()=>flows.map(f=>({startLat:by[f.from]?.lat,startLng:by[f.from]?.lng,endLat:by[f.to]?.lat,endLng:by[f.to]?.lng,strength:f.strength*(by[f.from]?.pressure||0),kind:f.kind})).filter((x):x is Arc=>x.startLat!=null&&x.startLng!=null&&x.endLat!=null&&x.endLng!=null&&x.strength>.003),[by,flows]);
  const country=(d:object)=>d as CountryState,shape=(d:object)=>d as CountryShape,arc=(d:object)=>d as Arc;
  const color=(pressure:number,alpha:number)=>pressure>.7?`rgba(255,91,82,${alpha})`:pressure>.4?`rgba(255,190,71,${alpha})`:`rgba(49,214,164,${alpha})`;
  const choose=(c:CountryState)=>{setSelected(c.code);onSelect(c)};
  return <div ref={wrap} className="globe-wrap glass">
    <Globe ref={globe} onGlobeReady={()=>globe.current?.pointOfView({lat:12,lng:-18,altitude:1.65})} width={width} height={610} backgroundColor="#020609" backgroundImageUrl="/earth/night-sky.png" globeImageUrl="/earth/earth-blue-marble.jpg" bumpImageUrl="/earth/earth-topology.png" showAtmosphere atmosphereColor="#72c7ff" atmosphereAltitude={.16}
      polygonsData={shapes} polygonAltitude={(d:object)=>code(shape(d))===(hovered||selected)?.0015:.0005} polygonCapColor={(d:object)=>{const c=state(shape(d));return c?color(c.pressure,code(shape(d))===(hovered||selected)?.46:.15):"rgba(255,255,255,.015)"}} polygonSideColor={()=>"rgba(25,93,124,.14)"} polygonStrokeColor={(d:object)=>code(shape(d))===(hovered||selected)?"rgba(255,255,255,.9)":"rgba(185,224,255,.28)"} polygonLabel={(d:object)=>{const s=shape(d),c=state(s);return c?`<b>${c.name}</b><br/>Pressure ${(c.pressure*100).toFixed(0)}% · ${c.population.toLocaleString()} people<br/><span>Click to inspect country</span>`:`<b>${s.properties.ADMIN}</b>`}} onPolygonHover={(d:object|null)=>setHovered(d?code(shape(d)):null)} onPolygonClick={(d:object)=>{const c=state(shape(d));if(c)choose(c)}}
      pointsData={markers} pointLat="lat" pointLng="lng" pointAltitude={.012} pointRadius={(d:object)=>Math.max(.11,Math.sqrt(country(d).population/1e9)*.34)} pointColor={(d:object)=>color(country(d).pressure,.95)} pointLabel={(d:object)=>{const c=country(d);return `<b>${c.name}</b><br/>Pressure ${(c.pressure*100).toFixed(0)}% · ${c.cohorts.length} cohorts<br/><span>Click to inspect country</span>`}} onPointClick={(d:object)=>choose(country(d))}
      arcsData={arcs} arcStartLat="startLat" arcStartLng="startLng" arcEndLat="endLat" arcEndLng="endLng" arcAltitude={.1} arcColor={()=>["rgba(125,232,255,.08)","rgba(125,232,255,.62)"]} arcStroke={(d:object)=>.12+arc(d).strength*.32} arcDashLength={.38} arcDashGap={1.4} arcDashAnimateTime={5200}/>
    <div className="map-hint"><b>EXPLORE EARTH</b><span>Drag to rotate · scroll to zoom · select any country</span></div>
    <div className="map-legend"><span>LOW</span><i/><span>HIGH PRESSURE · LINKS SHOW PROPAGATION</span></div>
  </div>
}
