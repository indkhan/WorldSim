import {afterEach,expect,it,vi} from 'vitest';
import {decideWithOpenRouter,narrate,openRouterOverrides} from '@/lib/providers/openrouter';
import {runProviderSimulation} from '@/lib/simulation/provider-runner';
const s={title:'Test',description:'Synthetic shock',family:'energy' as const,severity:70,durationWeeks:4,seed:42};
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()});
it.each([{}, {answers:{action:{choice:'unknown',confidence:.5}}},{answers:{action:{choice:'maintain_routine',confidence:2}}},{answers:{action:{choice:'maintain_routine',confidence:'NaN'}}}])('rejects malformed decisions %j',async body=>{vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(body))));await expect(decideWithOpenRouter({actor:'household',situation:'test'},'key')).rejects.toThrow()});
it('stops all later calls and narration on rejected credentials',async()=>{const fetch=vi.fn(async()=>new Response('',{status:401}));vi.stubGlobal('fetch',fetch);const result=await runProviderSimulation(s,'key');expect(result.providerMode).toBe('deterministic');expect(result.warnings?.length).toBeGreaterThan(0);expect(fetch).toHaveBeenCalledOnce()});
it('rejects invalid environment settings',async()=>{vi.stubEnv('DECISION_MAX_COUNTRIES','bad');await expect(openRouterOverrides([],s,1,'key')).rejects.toThrow()});
it('bounds narration time',async()=>{vi.useFakeTimers();vi.stubGlobal('fetch',()=>new Promise(()=>{}));const check=expect(narrate({},'key')).rejects.toThrow();await vi.advanceTimersByTimeAsync(12000);await check;vi.useRealTimers()});
