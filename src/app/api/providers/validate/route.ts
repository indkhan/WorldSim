import{NextResponse}from"next/server";
import{z}from"zod";
import{validateProviderKeys}from"@/lib/providers/validate";

const schema=z.object({openrouter:z.string().min(1)});
export async function POST(req:Request){try{await validateProviderKeys(schema.parse(await req.json()).openrouter);return NextResponse.json({ok:true})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Provider validation failed."},{status:400})}}
