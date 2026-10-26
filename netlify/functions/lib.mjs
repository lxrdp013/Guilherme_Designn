import { getStore } from '@netlify/blobs';
import { getUser } from '@netlify/identity';
import { randomUUID } from 'node:crypto';

export const contentStore = () => getStore({name:'gs-v4-content',consistency:'strong'});
export const privateStore = () => getStore({name:'gs-v4-private',consistency:'strong'});
export const filesStore = () => getStore({name:'gs-v4-files',consistency:'strong'});
export const digits = s => String(s||'').replace(/\D/g,'');
export const clean = (v,n=500) => String(v??'').trim().slice(0,n);
export const id = () => randomUUID();
export const now = () => new Date().toISOString();
export const url = v => {const s=clean(v,1000);try{const u=new URL(s);return ['http:','https:'].includes(u.protocol)?u.toString():'';}catch{return ''}};
export const textList = (arr,max=20,n=160) => Array.isArray(arr)?arr.slice(0,max).map(x=>clean(x,n)).filter(Boolean):[];
export const mediaIds = (arr,max=6) => Array.isArray(arr)?arr.slice(0,max).map(x=>clean(x,80)).filter(x=>/^[a-f0-9-]{36}$/.test(x)):[];
export const json = (data,status=200,extra={}) => Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
export const failure = (message,status=400) => json({error:message},status);
export const read = async (store,key) => (await store.get(key,{type:'json',consistency:'strong'})) || null;
export const save = (store,key,value) => store.setJSON(key,value);
export async function all(store,prefix){const {blobs}=await store.list({prefix});return (await Promise.all(blobs.map(x=>read(store,x.key)))).filter(Boolean).sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));}
export function verifyOrigin(req){
 if(['GET','HEAD','OPTIONS'].includes(req.method))return;
 const origin=req.headers.get('origin');
 if(origin && new URL(origin).origin!==new URL(req.url).origin)throw Object.assign(Error('Origem não autorizada.'),{status:403});
}

/**
 * Every protected request resolves a verified Netlify Identity session.
 * Client identity is permanently bound to a single private client record by Identity user ID.
 * Never trust clientId/projectId, browser state, querystring, email supplied in a request,
 * or a claimed role to authorize project access.
 */
export async function sessionFromIdentity(identity){
 if(!identity?.id)return null;
 const roles=Array.isArray(identity.roles)?identity.roles:[];
 if(roles.includes('admin'))return {role:'admin',id:'owner',identityId:identity.id,name:identity.name||'Administrador'};
 const store=privateStore();
 const link=await read(store,`identity-links/${identity.id}`);
 if(!link?.clientId)return null;
 const customer=await read(store,`clients/${link.clientId}`);
 if(!customer||customer.disabled||customer.identityUserId!==identity.id)return null;
 // Also reject an account whose verified Identity email no longer matches the invited customer.
 if(String(customer.email).toLowerCase()!==String(identity.email||'').toLowerCase())return null;
 return {role:'client',id:customer.id,identityId:identity.id,name:customer.name};
}
export async function userSession(){return sessionFromIdentity(await getUser());}
export function requireRole(session,role){
 if(!session)return failure('Faça login para continuar.',401);
 if(role==='admin'&&session.role!=='admin')return failure('Acesso restrito ao administrador.',403);
 if(role==='client'&&session.role!=='client')return failure('Acesso restrito a clientes.',403);
 return null;
}
