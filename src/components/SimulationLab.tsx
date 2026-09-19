"use client";
import{Activity,GitBranch,Globe2,Info,Users}from"lucide-react";
import{useEffect,useMemo,useState}from"react";
import type{EventFamily,SimulationResult}from"@/lib/simulation/types";
import WorldMap from"./WorldMap";
import ProviderGate,{type ProviderKeys}from"./ProviderGate";
import{ScenarioControls}from"./simulation/ScenarioControls";
import{CountryInspector}from"./simulation/CountryInspector";
import{ComparisonPanel,WorldSummary}from"./simulation/AnalysisPanels";

type Tab="world"|"country"|"compare";

export default function SimulationLab({initial}:{initial:SimulationResult}){
  const[result,setResult]=useState(initial),[baseline,setBaseline]=useState<SimulationResult|null>(null),[week,setWeek]=useState(0),[playing,setPlaying]=useState(false),[code,setCode]=useState<string|null>(null),[tab,setTab]=useState<Tab>("world"),[description,setDescription]=useState(initial.scenario.description),[family,setFamily]=useState<EventFamily>("energy"),[severity,setSeverity]=useState(65),[duration,setDuration]=useState(12),[loading,setLoading]=useState(false),[error,setError]=useState<string|null>(null),[keys,setKeys]=useState<ProviderKeys|null>(null);
  const frame=result.frames[Math.min(week,result.frames.length-1)],selected=frame.countries.find(c=>c.code===code)||null,top=useMemo(()=>[...frame.countries].sort((a,b)=>b.pressure-a.pressure).slice(0,10),[frame]);
  useEffect(()=>{if(!playing)return;const timer=setInterval(()=>setWeek(current=>{if(current>=result.frames.length-1){setPlaying(false);return current}return current+1}),700);return()=>clearInterval(timer)},[playing,result.frames.length]);
  async function request(sev:number,title:string,desc:string){
    const headers:Record<string,string>={"content-type":"application/json"};
    if(keys?.jev){headers["x-jev-api-key"]=keys.jev;headers["x-openrouter-api-key"]=keys.openrouter!}else headers["x-provider-mode"]="deterministic";
    const r=await fetch("/api/simulations",{method:"POST",headers,body:JSON.stringify({title,description:desc,family,severity:sev,durationWeeks:duration,seed:42})});
    if(!r.ok){const body=await r.json().catch(()=>null);throw new Error(body?.error||`Simulation request failed (${r.status})`)}
    return r.json() as Promise<SimulationResult>;
  }
  async function execute(task:()=>Promise<void>){setLoading(true);setError(null);try{await task()}catch(e){const message=e instanceof Error?e.message:"Something went wrong";setError(message==="Failed to fetch"?"WorldSim could not reach the simulation server. Check the deployment and try again.":message)}finally{setLoading(false)}}
  const run=()=>execute(async()=>{setResult(await request(severity,"Custom world event",description));setWeek(0);setPlaying(true);setCode(null);setTab("world")}),compare=()=>execute(async()=>{setBaseline(await request(0,"No-shock baseline","Baseline continuation without introduced shock."));setTab("compare")}),branch=()=>execute(async()=>{if(!result.id)throw new Error("Configure DATABASE_URL and run a persisted simulation before branching.");const r=await fetch(`/api/simulations/${result.id}/branch`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({description,severity,branchWeek:week,family,durationWeeks:duration})});if(!r.ok)throw new Error((await r.json()).error);setResult(await r.json());setTab("world")});
  const select=(c:{code:string})=>{setCode(c.code);setTab("country")};
  return <main className="shell">{!keys&&<ProviderGate onConnect={setKeys}/>}<header className="topbar"><div className="brand"><span className="brandmark"><Globe2/></span><div><b>WORLDSIM</b><small>GLOBAL DECISION SIMULATOR · V1</small></div></div><nav><a href="/methodology" style={{display:"flex",alignItems:"center",gap:4,fontSize:14}}><Info size={14}/>Methodology</a></nav></header>{error&&<div className="error-banner" role="alert">{error}</div>}<div className="layout"><ScenarioControls description={description} family={family} severity={severity} duration={duration} week={week} loading={loading} onDescription={setDescription} onFamily={setFamily} onSeverity={setSeverity} onDuration={setDuration} onRun={run} onCompare={compare} onBranch={branch}/><section className="center"><div className="metricstrip"><Metric n="Global pressure" v={frame.globalPressure}/><Metric n="Household strain" v={frame.globalHouseholdStrain}/><Metric n="Production" v={frame.globalProductionPressure}/><div><small>ACTIVE LINKS</small><strong>{frame.flows.length}</strong></div></div><WorldMap countries={frame.countries} flows={frame.flows} onSelect={select}/><div className="timeline panel"><div><b>WEEK {week}</b><span>{result.scenario.title||"Describe an event to begin"}</span></div><input aria-label="Simulation week" type="range" min="0" max={result.frames.length-1} value={week} onChange={e=>{setPlaying(false);setWeek(+e.target.value)}}/><div className="ticks"><span>EVENT</span><span>PROPAGATION</span><span>ADAPTATION</span></div></div></section><aside className="panel analysis"><div className="tabs"><button className={tab==="world"?"active":""} onClick={()=>setTab("world")}><Activity/>World</button><button className={tab==="country"?"active":""} onClick={()=>setTab("country")}><Users/>Country</button><button className={tab==="compare"?"active":""} onClick={()=>setTab("compare")}><GitBranch/>Compare</button></div>{tab==="country"&&selected?<CountryInspector country={selected}/>:tab==="compare"?<ComparisonPanel current={result} baseline={baseline}/>:result.scenario.title?<WorldSummary top={top} analysis={result.analysis} providerMode={result.providerMode} warnings={result.warnings} select={select}/>:<div className="empty"><Activity/><h3>No simulation yet</h3><p>Describe a world event and run it to create the weekly timeline.</p></div>}</aside></div></main>;
}

function Metric({n,v}:{n:string;v:number}){return <div><small>{n}</small><strong>{(v*100).toFixed(1)}%</strong></div>}
