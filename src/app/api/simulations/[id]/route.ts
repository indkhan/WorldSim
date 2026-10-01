import {privateAccess} from "@/lib/access";
import {NextResponse} from 'next/server';
import {hasDatabase,prisma} from '@/lib/db/prisma';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){const denied=privateAccess(req);if(denied)return denied;if(!hasDatabase())return NextResponse.json({error:'Database not configured'},{status:503});try{const {id}=await params;const row=await prisma.simulation.findUnique({where:{id}});return row?.result?NextResponse.json({...row.result as object,id:row.id,createdAt:row.createdAt.toISOString(),saveStatus:'saved'}):NextResponse.json({error:'Not found'},{status:404})}catch{return NextResponse.json({error:'Replay unavailable'},{status:503})}}
