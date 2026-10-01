import {privateAccess} from "@/lib/access";
import {NextResponse} from 'next/server';
import {authenticated} from '@/lib/access';
import {createProviderBudget} from '@/lib/providers/execution';
import {scenarioSchema} from '@/lib/simulation/schema';
import {runProviderSimulation} from '@/lib/simulation/provider-runner';
import {hasDatabase,prisma} from '@/lib/db/prisma';
import {narrate} from '@/lib/providers/openrouter';
import {packResult} from '@/lib/simulation/transport-server';
export const runtime='nodejs';export const maxDuration=300;
export async function POST(req:Request){const denied=privateAccess(req);if(denied)return denied;
  let input;try{input=scenarioSchema.parse(await req.json())}catch{return NextResponse.json({error:'Invalid scenario settings'},{status:400})}
  try{
    const key=req.headers.get('x-provider-mode')==='deterministic'?null:req.headers.get('x-openrouter-api-key')||(authenticated(req)?process.env.OPENROUTER_API_KEY:null);
    const budget=key?createProviderBudget(req.signal):undefined;const result=await runProviderSimulation(input,key,budget);
    if(key&&budget&&!budget.stopped&&budget.calls<budget.maxCalls&&Date.now()<budget.deadline)try{result.analysis=await narrate({scenario:input,final:result.frames.at(-1)?.countries.map(c=>({name:c.name,pressure:c.pressure})),methodology:result.methodology},key,budget)}catch{result.warnings=[...(result.warnings||[]),'Narration unavailable; numerical results remain usable.']}
    result.saveStatus='unsaved';
    if(hasDatabase())try{const row=await prisma.simulation.create({data:{title:input.title,input,status:'completed',result:packResult(result),modelVersions:{engine:'2.0'}}});result.id=row.id;result.createdAt=row.createdAt.toISOString();result.saveStatus='saved'}catch{result.warnings=[...(result.warnings||[]),'Saving unavailable; this result is unsaved.']}
    return NextResponse.json(packResult(result));
  }catch{return NextResponse.json({error:'Simulation execution failed'},{status:500})}
}
export async function GET(req:Request){const denied=privateAccess(req);if(denied)return denied;if(!hasDatabase())return NextResponse.json([]);try{return NextResponse.json(await prisma.simulation.findMany({take:20,orderBy:{createdAt:'desc'},select:{id:true,title:true,createdAt:true,status:true,input:true}}))}catch{return NextResponse.json({error:'History unavailable'},{status:503})}}
