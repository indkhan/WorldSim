"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, RotateCcw, RotateCw } from "lucide-react";
import { Color, Mesh, MeshPhongMaterial, SphereGeometry, SRGBColorSpace, TextureLoader } from "three";
import type { GlobeMethods } from "react-globe.gl";
import type { CountryState, Flow } from "@/lib/simulation/types";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });
type CountryShape = {
  properties: { ISO_A3: string; ADM0_A3: string; ADMIN: string };
  geometry: object;
};
const shapeCode = (shape: CountryShape) =>
  shape.properties.ISO_A3 === "-99" ? shape.properties.ADM0_A3 : shape.properties.ISO_A3;
const pressureColor = (pressure: number, alpha: number) =>
  `rgba(255,${Math.round(193 - pressure * 112)},${Math.round(92 - pressure * 42)},${alpha})`;

export default function WorldMap({ countries, flows, selectedCode, playing, week, onSelect }: {
  countries: CountryState[];
  flows: Flow[];
  selectedCode: string | null;
  playing: boolean;
  week: number;
  onSelect: (country: CountryState) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const globe = useRef<GlobeMethods | undefined>(undefined);
  const clouds = useRef<Mesh<SphereGeometry, MeshPhongMaterial> | null>(null);
  const [size, setSize] = useState({ width: 800, height: 570 });
  const [shapes, setShapes] = useState<CountryShape[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [rotating, setRotating] = useState(true);
  const [mapError, setMapError] = useState(false);
  const material = useMemo(() => new MeshPhongMaterial({
    bumpScale: .2, shininess: 18, specular: new Color("#5b6b80"),
  }), []);
  const by = useMemo(() => Object.fromEntries(countries.map(c => [c.code, c])), [countries]);
  const selected = selectedCode ? by[selectedCode] : null;
  const selectedLat = selected?.lat, selectedLng = selected?.lng;

  useEffect(() => {
    const resize = new ResizeObserver(([entry]) => setSize({
      width: Math.round(entry.contentRect.width),
      height: Math.round(entry.contentRect.height),
    }));
    if (wrap.current) resize.observe(wrap.current);
    return () => resize.disconnect();
  }, []);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { setReducedMotion(query.matches); if (query.matches) setRotating(false); };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/earth/countries.geojson", { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error("Country map unavailable"); return r.json(); })
      .then(data => setShapes(data.features))
      .catch(error => { if (error.name !== "AbortError") setMapError(true); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!ready || !globe.current) return;
    const controls = globe.current.controls();
    controls.autoRotate = rotating && !hovered;
    controls.autoRotateSpeed = .35;
  }, [ready, rotating, hovered]);
  useEffect(() => {
    if (!ready || selectedLat == null || selectedLng == null || !globe.current) return;
    setRotating(false);
    globe.current.pointOfView({ lat: selectedLat, lng: selectedLng, altitude: 1.8 }, reducedMotion ? 0 : 900);
  }, [ready, selectedCode, selectedLat, selectedLng, reducedMotion]);
  useEffect(() => {
    if (!ready || !globe.current) return;
    const earth = globe.current;
    const loader = new TextureLoader();
    let disposed = false;
    const water = loader.load("/earth/earth-water.jpg", texture => {
      if (disposed) { texture.dispose(); return; }
      material.specularMap = texture;
      material.needsUpdate = true;
    });
    const cloudMaterial = new MeshPhongMaterial({ transparent: true, opacity: .65, depthWrite: false });
    const cloudMesh = new Mesh(new SphereGeometry(earth.getGlobeRadius() * 1.004, 64, 32), cloudMaterial);
    cloudMesh.rotation.y = -Math.PI / 2;
    cloudMesh.name = "earth-clouds";
    const cloudTexture = loader.load("/earth/earth-clouds.png", texture => {
      if (disposed) { texture.dispose(); return; }
      texture.colorSpace = SRGBColorSpace;
      cloudMaterial.map = texture;
      cloudMaterial.needsUpdate = true;
      earth.scene().add(cloudMesh);
    });
    clouds.current = cloudMesh;
    return () => {
      disposed = true;
      earth.scene().remove(cloudMesh);
      cloudMesh.geometry.dispose();
      cloudMaterial.dispose();
      cloudTexture.dispose();
      water.dispose();
      material.specularMap = null;
      clouds.current = null;
    };
  }, [ready, material]);
  useEffect(() => {
    if (!ready || reducedMotion || (!playing && !rotating)) return;
    let animation: number;
    let previous = performance.now();
    const animate = (now: number) => {
      if (clouds.current) clouds.current.rotation.y += Math.min(now - previous, 100) * .000008;
      previous = now;
      animation = requestAnimationFrame(animate);
    };
    animation = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animation);
  }, [ready, playing, rotating, reducedMotion]);

  const shapeCodes = useMemo(() => new Set(shapes.map(shapeCode)), [shapes]);
  // The globe attaches mesh objects; keep those out of simulation checkpoints.
  const markers = useMemo(() => countries.filter(c => !shapeCodes.has(c.code))
    .map(c => ({ ...c })), [countries, shapeCodes]);
  const arcs = useMemo(() => flows.flatMap(flow => {
    const from = by[flow.from], to = by[flow.to];
    if (!from || !to) return [];
    const strength = flow.strength * from.pressure;
    if (strength <= .003 || (selectedCode && flow.from !== selectedCode && flow.to !== selectedCode)) return [];
    return [{ ...flow, startLat: from.lat, startLng: from.lng, endLat: to.lat, endLng: to.lng, strength,
      label: `${from.name} → ${to.name} · ${flow.kind}` }];
  }), [by, flows, selectedCode]);
  const impacts = useMemo(() => countries.filter(c => c.pressure > .35)
    .sort((a, b) => b.pressure - a.pressure).slice(0, 6)
    .map(c => ({ ...c })), [countries]);
  const state = (data: object) => by[shapeCode(data as CountryShape)];
  const active = (data: object) => shapeCode(data as CountryShape) === (hovered || selectedCode);
  const moving = playing && !reducedMotion;
  const reset = () => {
    setRotating(false);
    globe.current?.pointOfView({ lat: 18, lng: 12, altitude: 2.1 }, reducedMotion ? 0 : 900);
  };

  return <div ref={wrap} className="globe-wrap" role="region" aria-label="Interactive Earth"
    data-ready={ready} data-country={selectedCode || ""} data-week={week}>
    <Globe ref={globe} width={size.width} height={size.height} globeMaterial={material}
      onGlobeReady={() => {
        const earth = globe.current;
        if (!earth) return;
        earth.pointOfView({ lat: 18, lng: 12, altitude: 2.1 });
        earth.renderer().setPixelRatio(Math.min(devicePixelRatio, 2));
        const controls = earth.controls();
        controls.enableDamping = true;
        controls.dampingFactor = .08;
        controls.minDistance = earth.getGlobeRadius() * 1.25;
        controls.maxDistance = earth.getGlobeRadius() * 5;
        earth.lights().forEach(light => {
          light.intensity = light.type === "AmbientLight" ? 1.5 : 2.8;
          if (light.type === "DirectionalLight") light.position.set(-1, 1.5, 2);
        });
        setReady(true);
      }}
      backgroundColor="#070b14"
      globeImageUrl="/earth/earth-blue-marble.jpg" bumpImageUrl="/earth/earth-topology.png"
      showAtmosphere atmosphereColor="#83bfff" atmosphereAltitude={.12} globeCurvatureResolution={2}
      polygonsData={shapes} polygonsTransitionDuration={reducedMotion ? 0 : 650}
      polygonAltitude={data => active(data) ? .006 : .0015}
      polygonCapColor={data => { const c = state(data); return c ? pressureColor(c.pressure, c.pressure * (active(data) ? .38 : .28)) : "rgba(0,0,0,0)"; }}
      polygonSideColor={() => "rgba(0,0,0,0)"}
      polygonStrokeColor={data => active(data) ? "#ffffff" : "rgba(255,255,255,.12)"}
      polygonLabel={data => { const c = state(data); return c ? `${c.name} · Pressure ${(c.pressure * 100).toFixed(0)}%` : (data as CountryShape).properties.ADMIN; }}
      onPolygonHover={data => setHovered(data ? shapeCode(data as CountryShape) : null)}
      onPolygonClick={data => { const c = state(data); if (c) onSelect(c); }}
      pointsData={markers} pointLat="lat" pointLng="lng" pointAltitude={.008}
      pointRadius={.16} pointColor={data => pressureColor((data as CountryState).pressure, .9)}
      pointLabel={data => `${(data as CountryState).name} · Pressure ${Math.round((data as CountryState).pressure * 100)}%`}
      onPointClick={data => onSelect(data as CountryState)}
      arcsData={arcs} arcStartLat="startLat" arcStartLng="startLng" arcEndLat="endLat" arcEndLng="endLng"
      arcAltitudeAutoScale={.25} arcColor={() => ["rgba(255,193,92,.1)", "rgba(255,120,80,.85)"]}
      arcStroke={null} arcDashLength={moving ? .35 : 1} arcDashGap={moving ? 1.1 : 0}
      arcDashAnimateTime={moving ? 2600 : 0} arcsTransitionDuration={reducedMotion ? 0 : 650}
      arcLabel="label"
      ringsData={moving ? impacts : []} ringLat="lat" ringLng="lng" ringAltitude={.008}
      ringColor={(data: object) => (t: number) => pressureColor((data as CountryState).pressure, 1 - t)}
      ringMaxRadius={data => 1 + (data as CountryState).pressure * 3} ringPropagationSpeed={1.2} ringRepeatPeriod={1800}
    />
    {!ready && <div className="earth-loading" role="status">Loading Earth…</div>}
    <div className="map-toolbar">
      <button aria-label={rotating ? "Pause rotation" : "Rotate Earth"} aria-pressed={rotating}
        disabled={!ready} onClick={() => setRotating(!rotating)}>
        {rotating ? <Pause size={15} /> : <RotateCw size={15} />}
      </button>
      <button aria-label="Reset view" disabled={!ready} onClick={reset}><RotateCcw size={15} /></button>
    </div>
    <div className="map-hint">{selected ? `${selected.name} · ${Math.round(selected.pressure * 100)}% pressure` : "Drag to rotate · scroll to zoom"}</div>
    <div className="map-legend"><span>Low</span><i /><span>High pressure</span></div>
    {mapError && <div className="map-error" role="status">Borders unavailable. Use the country list to inspect.</div>}
  </div>;
}
