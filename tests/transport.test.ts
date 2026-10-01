import {expect,it} from 'vitest';
import {runSimulation} from '@/lib/simulation/engine';
import {packResult,unpackStored} from '@/lib/simulation/transport-server';
import {unpackResult} from '@/lib/simulation/transport';
it('keeps default and maximum responses below 4.5 MB and roundtrips exactly',async()=>{for(const durationWeeks of [12,104]){const result=runSimulation({title:'Test',description:'Synthetic shock',family:'energy',severity:70,seed:42,durationWeeks});const packed=packResult(result),bytes=Buffer.byteLength(JSON.stringify(packed));console.log(`${durationWeeks} weeks: ${bytes} bytes`);expect(bytes).toBeLessThan(4_500_000);expect(unpackStored(packed)).toEqual(result);expect(await unpackResult(packed)).toEqual(result)}},30000);
