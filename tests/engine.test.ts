import {describe,expect,it} from "vitest";
import {actionEffect,agentCount,continueFromFrame,runSimulation} from "@/lib/simulation/engine";
import type {ScenarioInput} from "@/lib/simulation/types";

const scenario:ScenarioInput={title:"Energy shock",description:"A severe global energy supply disruption changes prices and availability.",family:"energy",severity:70,durationWeeks:8,seed:42};

describe("population representation",()=>{
  it("uses 100 agents per billion at the cap",()=>expect(agentCount(1_000_000_000)).toBe(100));
  it("keeps a minimum representation for small countries",()=>expect(agentCount(100_000)).toBe(3));
  it("covers the world",()=>expect(runSimulation(scenario).frames[0].countries.length).toBeGreaterThan(190));
});

describe("demographic engine",()=>{
  it("creates heterogeneous cohorts inside large countries",()=>{const c=runSimulation(scenario).frames[1].countries.find(x=>x.population>50_000_000)!;expect(c.cohorts.length).toBeGreaterThan(3);expect(new Set(c.cohorts.map(x=>x.income)).size).toBeGreaterThan(1);expect(new Set(c.cohorts.map(x=>x.sector)).size).toBeGreaterThan(1)});
  it("population-weights cohort pressure into the country",()=>{const c=runSimulation(scenario).frames.at(-1)!.countries[0],w=c.cohorts.reduce((a,x)=>a+x.weight,0),p=c.cohorts.reduce((a,x)=>a+x.pressure*x.weight,0)/w;expect(c.pressure).toBeCloseTo(p,8)});
  it("keeps state bounded",()=>{for(const f of runSimulation(scenario).frames)for(const c of f.countries){expect(c.pressure).toBeGreaterThanOrEqual(0);expect(c.pressure).toBeLessThanOrEqual(1);for(const x of c.cohorts){expect(x.pressure).toBeGreaterThanOrEqual(0);expect(x.pressure).toBeLessThanOrEqual(1)}}});
  it("gives stronger adaptive actions larger effects",()=>expect(actionEffect("household","cut discretionary spending")).toBeGreaterThan(actionEffect("household","maintain routine")));
});

describe("world mechanics",()=>{
  it("is deterministic for the same seed without providers",()=>expect(runSimulation(scenario)).toEqual(runSimulation(scenario)));
  it("creates international propagation links",()=>expect(runSimulation(scenario).frames[0].flows.length).toBeGreaterThan(500));
  it("a zero-severity baseline stays below the shock",()=>{const shock=runSimulation(scenario).frames.at(-1)!.globalPressure,base=runSimulation({...scenario,severity:0}).frames.at(-1)!.globalPressure;expect(shock).toBeGreaterThan(base)});
  it("branches from the requested historical frame",()=>{const parent=runSimulation(scenario),branched=continueFromFrame(parent,{...scenario,severity:20,parentSimulationId:"parent",branchWeek:4},4);expect(branched.frames[4]).toEqual(parent.frames[4]);expect(branched.frames.length).toBe(parent.frames.length);expect(branched.frames[8].globalPressure).not.toEqual(parent.frames[8].globalPressure)});
});
