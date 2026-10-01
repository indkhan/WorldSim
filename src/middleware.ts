import type {NextRequest} from 'next/server';
import {privateAccess} from './lib/access';
export function middleware(req:NextRequest){return privateAccess(req)}
export const config={matcher:['/','/methodology','/api/:path*'],runtime:'nodejs'};
