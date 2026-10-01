import {providerJson} from './execution';
export async function validateProviderKeys(key:string){await providerJson('https://openrouter.ai/api/v1/key',{headers:{Authorization:`Bearer ${key}`}})}
