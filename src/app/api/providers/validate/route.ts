import {privateAccess} from "@/lib/access";
import{NextResponse}from"next/server";
import{z}from"zod";
import{validateProviderKeys}from"@/lib/providers/validate";

const schema=z.object({openrouter:z.string().min(1).max(256)});
export async function POST(req:Request){const denied=privateAccess(req);if(denied)return denied;try{await validateProviderKeys(schema.parse(await req.json()).openrouter);return NextResponse.json({ok:true})}catch{return NextResponse.json({error:"Provider validation failed or timed out."},{status:400})}}
