import {NextResponse} from 'next/server';
import {z} from 'zod';
import {hasDatabase,prisma} from '@/lib/db/prisma';
import {continueFromFrame} from '@/lib/simulation/engine';
import {packResult,unpackStored} from '@/lib/simulation/transport-server';
import type {ScenarioInput,SimulationResult} from '@/lib/simulation/types';
import type {PackedResult} from '@/lib/simulation/transport';
export const runtime='nodejs';export const maxDuration=300;
const body=z.object({description:z.string().min(10).max(6000),severity:z.number().min(0).max(100),branchWeek:z.number().int().min(0),family:z.enum(['energy','trade','technology','health','climate','custom']).optional(),durationWeeks:z.number().int().min(1).max(104).optional(),providerPolicy:z.literal('deterministic'),baseline:z.boolean().optional()});
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
  if(!hasDatabase())return NextResponse.json({error:'Database required for persisted branches'},{status:503});
  let patch;try{patch=body.parse(await req.json())}catch{return NextResponse.json({error:'Invalid branch settings; choose deterministic continuation explicitly'},{status:400})}
  try{const {id}=await params,parent=await prisma.simulation.findUnique({where:{id}});if(!parent?.result)return NextResponse.json({error:'Parent not found'},{status:404});
    const parentResult=unpackStored(parent.result as unknown as SimulationResult|PackedResult),base=parent.input as unknown as ScenarioInput;
    const input:ScenarioInput=patch.baseline?{...base,severity:0}:{...base,description:patch.description,severity:patch.severity,family:patch.family??base.family,parentSimulationId:id,branchWeek:patch.branchWeek,title:`Branch: ${parent.title}`,durationWeeks:patch.durationWeeks??base.durationWeeks};
    // A branch baseline uses the original branch's parent checkpoint.
    let checkpoint=parentResult,at=patch.branchWeek;
    if(patch.baseline){if(base.parentSimulationId&&base.branchWeek!==undefined){const row=await prisma.simulation.findUnique({where:{id:base.parentSimulationId}});if(!row?.result)return NextResponse.json({error:'Baseline checkpoint unavailable'},{status:404});checkpoint=unpackStored(row.result as unknown as SimulationResult|PackedResult);at=base.branchWeek}else at=0}
    let result;try{result=continueFromFrame(checkpoint,input,at)}catch{return NextResponse.json({error:'Branch week must exist and horizon must be after it (maximum 104)'},{status:400})}
    result.saveStatus='unsaved';try{const row=await prisma.simulation.create({data:{title:input.title,input,status:'completed',result:packResult(result),modelVersions:{engine:'2.0',branchParent:id,providerPolicy:'deterministic'}}});result.id=row.id;result.createdAt=row.createdAt.toISOString();result.saveStatus='saved'}catch{result.warnings=[...(result.warnings||[]),'Saving unavailable; this branch is unsaved.']}
    return NextResponse.json(packResult(result));
  }catch{return NextResponse.json({error:'Branch persistence unavailable'},{status:503})}
}
