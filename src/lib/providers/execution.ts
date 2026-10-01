import {z} from 'zod';
export type ProviderBudget={calls:number;maxCalls:number;deadline:number;stopped:boolean;signal?:AbortSignal};
export function providerSettings(){return z.object({countries:z.coerce.number().int().min(1).max(12),calls:z.coerce.number().int().min(1).max(60),seconds:z.coerce.number().int().min(1).max(120)}).parse({countries:process.env.DECISION_MAX_COUNTRIES??'6',calls:process.env.PROVIDER_MAX_CALLS??'24',seconds:process.env.PROVIDER_MAX_SECONDS??'60'})}
export function createProviderBudget(signal?:AbortSignal):ProviderBudget{const settings=providerSettings();return {calls:0,maxCalls:settings.calls,deadline:Date.now()+settings.seconds*1000,stopped:false,signal}}
export class ProviderError extends Error{constructor(message:string,public fatal=false){super(message)}}
// The timeout covers headers AND response body. Errors never contain upstream bodies or keys.
export async function providerJson(url:string,init:RequestInit,budget?:ProviderBudget){
  if(budget&&(budget.stopped||budget.signal?.aborted||budget.calls>=budget.maxCalls||Date.now()>=budget.deadline))throw new ProviderError('Provider budget exhausted or cancelled');
  if(budget)budget.calls++;
  const controller=new AbortController(),ms=Math.min(5000,budget?budget.deadline-Date.now():5000);
  let timer:ReturnType<typeof setTimeout>|undefined;
  const abort=()=>controller.abort();budget?.signal?.addEventListener('abort',abort,{once:true});
  try{return await Promise.race([(async()=>{const response=await fetch(url,{...init,signal:controller.signal});if(!response.ok){const fatal=[400,401,402,403,404].includes(response.status);if(fatal&&budget)budget.stopped=true;throw new ProviderError(`OpenRouter decision request failed (${response.status})`,fatal)}return response.json()})(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new ProviderError('Provider request timed out'))},ms)})])}catch(e){throw e instanceof ProviderError?e:new ProviderError('Provider response unavailable')}finally{clearTimeout(timer);budget?.signal?.removeEventListener('abort',abort)}
}
