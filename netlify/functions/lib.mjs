import { getStore } from '@netlify/blobs';
import { randomUUID, createHmac, timingSafeEqual, scryptSync, randomBytes } from 'node:crypto';

export const contentStore = () => getStore({name:'gs-v4-content',consistency:'strong'});
export const privateStore = () => getStore({name:'gs-v4-private',consistency:'strong'});
export const filesStore = () => getStore({name:'gs-v4-files',consistency:'strong'});
export const digits = s => String(s||'').replace(/\D/g,'');
export const clean = (v,n=500) => String(v??'').trim().slice(0,n);
export const id = () => randomUUID();
export const now = () => new Date().toISOString();
export const url = v => {const s=clean(v,1000); try{ const u=new URL(s); return ['http:','https:'].includes(u.protocol)?u.toString():'';}catch{return ''}};
export const textList = (arr,max=20,n=160) => Array.isArray(arr)?arr.slice(0,max).map(x=>clean(x,n)).filter(Boolean):[];
export const mediaIds = (arr,max=6) => Array.isArray(arr)?arr.slice(0,max).map(x=>clean(x,80)).filter(x=>/^[a-f0-9-]{36}$/.test(x)):[];
export const json = (data,status=200,extra={}) => Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
export const failure = (message,status=400) => json({error:message},status);
export const read = async (store,key) => (await store.get(key,{type:'json',consistency:'strong'})) || null;
export const save = (store,key,value) => store.setJSON(key,value);
export async function all(store,prefix){const {blobs}=await store.list({prefix});return (await Promise.all(blobs.map(x=>read(store,x.key)))).filter(Boolean).sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));}
export const appSecret = () => {const secret=process.env.SESSION_SECRET||'';if(secret.length<32)throw Error('Configure SESSION_SECRET com pelo menos 32 caracteres no Netlify.');return secret};
export const safeEqual=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y)};
export const passwordHash = pass => {const salt=randomBytes(20).toString('hex');const hash=scryptSync(pass,salt,64).toString('hex');return `scrypt:${salt}:${hash}`};
export const verifyPassword = (pass,stored) => {try{const [alg,salt,hash]=stored.split(':');if(alg!=='scrypt')return false;return safeEqual(scryptSync(pass,salt,64).toString('hex'),hash)}catch{return false}};
function hmac(value){return createHmac('sha256',appSecret()).update(value).digest('base64url')}
function sign(payload){const data=Buffer.from(JSON.stringify(payload)).toString('base64url');return `${data}.${hmac(data)}`}
export function getSession(req){
 try{
  const cookie=(req.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(x=>x.startsWith('gs_session='));
  if(!cookie)return null;const value=decodeURIComponent(cookie.slice(11));const [data,sig]=value.split('.');
  if(!data||!sig||!safeEqual(hmac(data),sig))return null;
  const s=JSON.parse(Buffer.from(data,'base64url').toString('utf8'));
  if(s.exp<Date.now()||!['admin','client'].includes(s.role))return null;
  return s;
 }catch{return null}
}
export function sessionCookie(session){const data=sign({...session,exp:Date.now()+1000*60*60*8});return `gs_session=${encodeURIComponent(data)}; Path=/; Max-Age=28800; HttpOnly; Secure; SameSite=Lax`}
export const clearSession = ()=> 'gs_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax';
export function verifyOrigin(req){
 if(['GET','HEAD','OPTIONS'].includes(req.method))return;
 const origin=req.headers.get('origin');
 if(origin && new URL(origin).host !== new URL(req.url).host)throw Object.assign(Error('Origem não autorizada.'),{status:403});
}
export async function userSession(req){const s=getSession(req);if(!s)return null;if(s.role==='client'){const customer=await read(privateStore(),`clients/${s.id}`);if(!customer||customer.disabled)return null;}return s}
export function requireRole(session,role){if(!session)return failure('Faça login para continuar.',401);if(role==='admin'&&session.role!=='admin')return failure('Acesso restrito ao administrador.',403);return null}
