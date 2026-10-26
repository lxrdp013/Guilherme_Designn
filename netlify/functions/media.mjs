import { filesStore, privateStore, read, userSession, requireRole, json, failure, id, now, clean, verifyOrigin } from './lib.mjs';
const TYPES=new Set(['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm','application/pdf']);
const LIMIT=3*1024*1024;
export default async function handler(req){
 try{
  verifyOrigin(req);
  const store=filesStore();
  if(req.method==='POST'){
   const session=await userSession(req);const denied=requireRole(session,'admin');if(denied)return denied;
   const data=await req.formData();const file=data.get('file');if(!file||typeof file==='string'||!TYPES.has(file.type))return failure('Arquivo inválido. Aceitos: JPG, PNG, WebP, GIF, MP4, WebM e PDF.');
   if(file.size>LIMIT)return failure('Arquivo acima de 3 MB. Para vídeos maiores, use o campo de link externo.');
   const visibility=data.get('visibility')==='private'?'private':'public';
   const clientId=clean(data.get('clientId'),80);const projectId=clean(data.get('projectId'),80);
   if(visibility==='private'&&(!clientId||!projectId))return failure('Arquivo privado exige cliente e projeto.');
   const key=id();const meta={visibility,clientId,projectId,mime:file.type,name:clean(file.name,160),createdAt:now()};
   await store.set(key,await file.arrayBuffer(),{metadata:meta});return json({id:key,url:`/.netlify/functions/media?id=${key}`,name:meta.name,mime:meta.mime,visibility});
  }
  if(req.method!=='GET')return failure('Método não permitido.',405);
  const key=new URL(req.url).searchParams.get('id')||'';
  if(!/^[a-f0-9-]{36}$/.test(key))return failure('Arquivo inválido.',400);
  const item=await store.getWithMetadata(key,{type:'arrayBuffer',consistency:'strong'});if(!item)return failure('Arquivo não encontrado.',404);
  const meta=item.metadata||{};
  if(meta.visibility!=='public'){
   const session=await userSession(req);
   if(!session)return failure('Acesso não autorizado.',403);
   if(session.role!=='admin'){
    if(session.role!=='client'||session.id!==meta.clientId)return failure('Acesso não autorizado.',403);
    const project=await read(privateStore(),`projects/${meta.projectId}`);
    if(!project||project.clientId!==session.id||!(project.versions||[]).some(v=>(v.media||[]).includes(key)))return failure('Este arquivo não está disponível no seu projeto.',403);
   }
  }
  return new Response(item.data,{status:200,headers:{'Content-Type':meta.mime||'application/octet-stream','Content-Disposition':`inline; filename="${String(meta.name||'arquivo').replace(/["\r\n\\]/g,'_')}"`,'Cache-Control':meta.visibility==='public'?'public, max-age=120':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex','Content-Security-Policy':"default-src 'none'; sandbox"}});
 }catch(e){console.error('GS MEDIA',e);return failure('Não foi possível carregar o arquivo.',500)}
}
