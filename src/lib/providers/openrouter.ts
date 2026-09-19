import type{ActorKind,CohortState,CountryState,DecisionOverride,ScenarioInput}from"@/lib/simulation/types";
import{actionEffect}from"@/lib/simulation/engine";

const DECISIONS_URL="https://openrouter.ai/api/alpha/decisions",DECISIONS_MODEL="~typesafe/jev-latest";
const OPTIONS:Record<ActorKind,string[]>={household:["maintain routine","adapt consumption","cut discretionary spending","seek alternatives"],business:["maintain operations","absorb costs","pass through costs","change suppliers and output"],government:["monitor","communicate guidance","targeted intervention","broad intervention"]};

async function fetchWithTimeout(url:string,init:RequestInit,ms=12_000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ms);try{return await fetch(url,{...init,signal:controller.signal})}finally{clearTimeout(timer)}}
function headers(key:string){return{Authorization:`Bearer ${key}`,"Content-Type":"application/json","HTTP-Referer":process.env.NEXT_PUBLIC_APP_URL||"http://localhost:3000","X-Title":"WorldSim"}}

export async function decideWithOpenRouter(input:{actor:ActorKind;situation:string},apiKey?:string|null){
  const key=apiKey===null?undefined:apiKey||process.env.OPENROUTER_API_KEY;
  if(!key)return null;
  const labels=OPTIONS[input.actor],criteria=Object.fromEntries(labels.map(label=>[label.replaceAll(" ","_"),label]));
  let last:unknown;
  for(let attempt=0;attempt<3;attempt++)try{
    const res=await fetchWithTimeout(DECISIONS_URL,{method:"POST",headers:headers(key),body:JSON.stringify({model:DECISIONS_MODEL,state:input.situation,questions:{action:{type:"choice",instructions:"Select the most plausible bounded response.",criteria}}})});
    if(!res.ok)throw new Error(`${res.status>=500||res.status===429?"Retryable OpenRouter decision response":"OpenRouter decision request failed"} (${res.status})`);
    const raw=await res.json(),answer=raw?.answers?.action,action=criteria[answer?.choice]??labels[0],confidence=typeof answer?.confidence==="number"?answer.confidence:answer?.probabilities?.[answer?.choice]??.5;
    return{action,confidence:Math.max(0,Math.min(1,confidence)),raw};
  }catch(e){if(e instanceof Error&&e.message.startsWith("OpenRouter decision request failed"))throw e;last=e;if(attempt<2)await new Promise(r=>setTimeout(r,250*2**attempt))}
  throw last instanceof Error?last:new Error("OpenRouter decision request failed");
}

function representativeCohorts(c:CountryState){const byKind=(kind:ActorKind)=>c.cohorts.filter(x=>x.kind===kind).sort((a,b)=>b.weight-a.weight).slice(0,kind==="household"?3:kind==="business"?2:1);return(["household","business","government"] as ActorKind[]).flatMap(byKind)}

export async function openRouterOverrides(states:CountryState[],scenario:ScenarioInput,week:number,apiKey?:string|null):Promise<{overrides:DecisionOverride[];warnings:string[]}>{
  const enabled=apiKey===null?false:Boolean(apiKey||process.env.OPENROUTER_API_KEY);
  if(!enabled)return{overrides:[],warnings:[]};
  const max=Math.max(1,Math.min(50,Number(process.env.DECISION_MAX_COUNTRIES||12))),selected=[...states].sort((a,b)=>b.pressure-a.pressure).slice(0,max),warnings:string[]=[],overrides:DecisionOverride[]=[];
  await Promise.all(selected.flatMap(c=>representativeCohorts(c).map(async(x:CohortState)=>{try{
    const decision=await decideWithOpenRouter({actor:x.kind,situation:`WorldSim synthetic scenario. Event: ${scenario.description}\nWeek ${week}/${scenario.durationWeeks}. Country: ${c.name}, ${c.region}. Actor cohort: ${x.kind}, ${x.income} income, ${x.urban?"urban":"rural"}, sector ${x.sector}. Current pressure ${(x.pressure*100).toFixed(0)}/100, exposure ${(x.exposure*100).toFixed(0)}/100, resilience ${(x.resilience*100).toFixed(0)}/100. Select the most plausible bounded response from the supplied options. Do not treat this as a real-world forecast.`},apiKey);
    if(decision)overrides.push({countryCode:c.code,cohortId:x.id,action:decision.action,confidence:decision.confidence,effect:actionEffect(x.kind,decision.action),rationale:`OpenRouter decision · confidence ${(decision.confidence*100).toFixed(0)}%. Confidence concerns the supplied decision options, not real-world outcome probability.`});
  }catch(e){warnings.push(`${c.code}/${x.id}: ${e instanceof Error?e.message:"OpenRouter decision failure"}`)}})));
  return{overrides,warnings};
}

export async function narrate(payload:unknown,apiKey?:string|null){const key=apiKey===null?undefined:apiKey||process.env.OPENROUTER_API_KEY;if(!key)return null;const r=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:headers(key),body:JSON.stringify({model:process.env.OPENROUTER_MODEL||"openai/gpt-oss-20b",temperature:.2,max_tokens:700,messages:[{role:"system",content:"You explain exploratory world simulations neutrally. Never call simulation frequency a real-world probability. Separate assumptions, observed simulated changes, uncertainty, and limitations. Do not make political endorsements or recommendations."},{role:"user",content:JSON.stringify(payload)}]})});if(!r.ok)throw new Error(`OpenRouter request failed (${r.status})`);return(await r.json()).choices?.[0]?.message?.content??null}
