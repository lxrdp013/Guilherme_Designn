import { login as identityLogin, logout as identityLogout, updateUser, admin as identityAdmin, verifyRequestOrigin } from '@netlify/identity';
import { contentStore, privateStore, digits, clean, id, now, url, textList, mediaIds, json, failure, read, save, all, verifyOrigin, sessionFromIdentity, userSession, requireRole } from './lib.mjs';

const categories=['sites','social','motion','branding'];
const normalizedEmail=value=>clean(value,160).toLowerCase();
const validEmail=value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)&&value.length<=160;
const allowedStatuses=['novo','em_producao','aguardando_aprovacao','ajustes','aprovado','finalizado'];
const DEFAULT_SETTINGS={aboutName:'Guilherme S.',aboutRole:'Design & Motion',aboutTitle:'Criatividade com direção. Soluções visuais com propósito.',aboutBio:'Transformo ideias em experiências digitais e materiais visuais que valorizam sua marca, combinando estratégia, estética e tecnologia.',aboutImage:'',instagram:'',whatsapp:'',contactEmail:'',aboutButton:'Pedir orçamento'};
const sanitizeSettings=v=>({aboutName:clean(v.aboutName,100),aboutRole:clean(v.aboutRole,100),aboutTitle:clean(v.aboutTitle,200),aboutBio:clean(v.aboutBio,1500),aboutImage:clean(v.aboutImage,80),instagram:url(v.instagram),whatsapp:digits(v.whatsapp).slice(0,15),contactEmail:clean(v.contactEmail,150),aboutButton:clean(v.aboutButton,45)||'Pedir orçamento'});
const stamp=(record,old)=>({...record,id:old?.id||id(),createdAt:old?.createdAt||now(),updatedAt:now()});
const settings = async()=>({...DEFAULT_SETTINGS,...await read(contentStore(),'settings')});
const publicPrint = v=>({id:v.id,title:v.title,description:v.description,price:v.price,leadTime:v.leadTime,quantities:v.quantities,material:v.material,media:v.media||[],mediaTypes:v.mediaTypes||{},featured:v.featured,createdAt:v.createdAt});
const publicProject = v=>({id:v.id,title:v.title,category:v.category,description:v.description,kind:v.kind,website:v.website,media:v.media||[],mediaTypes:v.mediaTypes||{},featured:v.featured,createdAt:v.createdAt});
const parseBody=async(req)=>{const type=req.headers.get('content-type')||'';if(!type.includes('application/json'))throw Object.assign(Error('Conteúdo JSON obrigatório.'),{status:415});const len=Number(req.headers.get('content-length')||0);if(len>100000)throw Object.assign(Error('Dados muito grandes.'),{status:413});const raw=await req.text();if(raw.length>100000)throw Object.assign(Error('Dados muito grandes.'),{status:413});return JSON.parse(raw||'{}')};
const errorText=(err)=>err?.message||'Falha ao processar a operação.';

async function login(req){
 verifyRequestOrigin(req);
 const body=await parseBody(req);
 const email=normalizedEmail(body.email), password=String(body.password||'');
 if(!validEmail(email)||password.length<8||password.length>128)return failure('E-mail ou senha incorretos.',401);
 let identity;
 try { identity=await identityLogin(email,password); }
 catch { return failure('E-mail ou senha incorretos. Confira também a confirmação da conta no Identity.',401); }
 const session=await sessionFromIdentity(identity);
 if(!session)return failure('Conta sem acesso a projetos. Confirme o cadastro com o administrador.',403);
 // Cookies nf_jwt/nf_refresh are set by Netlify Identity's server runtime, not by our app.
 return json({user:{id:session.id,role:session.role,name:session.name}});
}
async function getPublic(){const [prints,portfolio,cfg]=await Promise.all([all(contentStore(),'prints/'),all(contentStore(),'portfolio/'),settings()]);return json({settings:cfg,prints:prints.filter(v=>!v.hidden).map(publicPrint),portfolio:portfolio.filter(v=>!v.hidden).map(publicProject)});}
async function getMe(req){const s=await userSession();if(!s)return failure('Não autenticado.',401);return json({user:{id:s.id,role:s.role,name:s.name}});}
async function getDashboard(){const [clients,projects,briefings,prints,portfolio,cfg]=await Promise.all([all(privateStore(),'clients/'),all(privateStore(),'projects/'),all(privateStore(),'briefings/'),all(contentStore(),'prints/'),all(contentStore(),'portfolio/'),settings()]);return json({clients:clients.map(({passwordHash,...x})=>x),projects,briefings,prints,portfolio,settings:cfg});}
async function savePrint(body){const store=contentStore();const old=body.id?await read(store,`prints/${clean(body.id,80)}`):null;
 const x=stamp({title:clean(body.title,100),description:clean(body.description,1500),price:clean(body.price,60),leadTime:clean(body.leadTime,140),quantities:clean(body.quantities,170),material:clean(body.material,200),media:mediaIds(body.media,3),mediaTypes:Object.fromEntries(Object.entries(body.mediaTypes||{}).filter(([k,v])=>/^[a-f0-9-]{36}$/.test(k)&&/^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm))$/.test(v)).slice(0,3)),featured:!!body.featured,hidden:!!body.hidden},old);
 if(!x.title)return failure('Informe o nome do material.');await save(store,`prints/${x.id}`,x);return json({item:x});
}
async function savePortfolio(body){const store=contentStore();const old=body.id?await read(store,`portfolio/${clean(body.id,80)}`):null;
 const kind=body.kind==='site'?'site':body.kind==='video'?'video':'artes';
 const x=stamp({title:clean(body.title,130),description:clean(body.description,1200),category:categories.includes(body.category)?body.category:'branding',kind,website:url(body.website),videoUrl:url(body.videoUrl),media:mediaIds(body.media,10),mediaTypes:Object.fromEntries(Object.entries(body.mediaTypes||{}).filter(([k,v])=>/^[a-f0-9-]{36}$/.test(k)&&/^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm))$/.test(v)).slice(0,10)),featured:!!body.featured,hidden:!!body.hidden},old);
 if(!x.title)return failure('Informe o nome do projeto.');if(kind==='site'&&!x.website)return failure('Informe o endereço do site.');await save(store,`portfolio/${x.id}`,x);return json({item:x});
}
async function saveClient(body){
 const store=privateStore();
 const old=body.id?await read(store,`clients/${clean(body.id,80)}`):null;
 if(body.id&&!old)return failure('Cliente não encontrado.',404);
 const email=normalizedEmail(body.email);
 if(!validEmail(email))return failure('Informe um e-mail válido para acesso.');
 if(clean(body.name,120).length<2)return failure('Informe o nome do cliente.');
 const allClients=await all(store,'clients/');
 if(allClients.some(x=>x.email===email&&x.id!==old?.id))return failure('E-mail já cadastrado.');
 // An Identity user ID is immutable. Do not silently transfer a customer's projects
 // by changing an email in the admin UI.
 if(old?.identityUserId&&old.email!==email)return failure('Para alterar o e-mail de acesso, solicite o procedimento de migração da conta.',409);
 const password=String(body.password||'');
 let identityUserId=old?.identityUserId||'';
 if(!identityUserId){
  if(password.length<8||password.length>128)return failure('Defina uma senha inicial de 8 a 128 caracteres.');
  // Only a verified admin can reach this function. Identity stores the password,
  // not Netlify Blobs and not our GitHub repository.
  try {
   const created=await identityAdmin.createUser({email,password,data:{app_metadata:{roles:['client']},user_metadata:{full_name:clean(body.name,120)}}});
   identityUserId=created?.id||'';
  } catch(err){console.error('Identity create user',err);return failure('Não foi possível criar a conta no Netlify Identity. Confira Identity > Users.',409)}
  if(!identityUserId)return failure('O Identity não retornou o identificador do novo usuário.',502);
 }else if(password){
  // Avoid ambiguous admin-side password resets. Clients can change their own
  // password; forgotten passwords can be reset with Identity recovery email.
  return failure('Para trocar a senha de um cliente existente, use a recuperação de senha do Netlify Identity.',409);
 }
 const x=stamp({name:clean(body.name,120),phone:digits(body.phone).slice(0,15),email,disabled:!!body.disabled,identityUserId},old);
 if(!x.name)return failure('Informe o nome do cliente.');
 await save(store,`clients/${x.id}`,x);
 await save(store,`identity-links/${identityUserId}`,{clientId:x.id});
 // Old custom auth hashes, if any, are deliberately not copied into the new record.
 return json({item:x});
}
async function saveProject(body){const store=privateStore();const old=body.id?await read(store,`projects/${clean(body.id,80)}`):null;const clientId=clean(body.clientId,80);
 if(!await read(store,`clients/${clientId}`))return failure('Escolha um cliente cadastrado.');
 const stages=textList(body.stages,12,70);if(!stages.length)return failure('Adicione pelo menos uma etapa.');
 const currentStage=Math.min(Math.max(Number(body.currentStage)||0,0),stages.length-1);
 const x=stamp({clientId,title:clean(body.title,150),type:clean(body.type,80),dueDate:clean(body.dueDate,30),stages,currentStage,description:clean(body.description,1500),status:allowedStatuses.includes(body.status)?body.status:'em_producao',versions:old?.versions||[],reviews:old?.reviews||[],history:[...(old?.history||[]).slice(-90),{at:now(),event:old?'Projeto atualizado':'Projeto criado',stage:stages[currentStage]}]},old);
 if(old&&old.clientId!==clientId)return failure('Para mudar de cliente, crie um novo projeto.');if(!x.title)return failure('Informe o título do projeto.');await save(store,`projects/${x.id}`,x);return json({item:x});
}
async function publishVersion(body){const store=privateStore();const x=await read(store,`projects/${clean(body.projectId,80)}`);if(!x)return failure('Projeto não encontrado.',404);
 const media=mediaIds(body.media,10);const link=url(body.link);if(!media.length&&!link)return failure('Anexe ao menos uma mídia ou um link de prévia.');
 const v={id:id(),number:x.versions.length+1,media,mediaTypes:Object.fromEntries(Object.entries(body.mediaTypes||{}).filter(([k,v])=>media.includes(k)&&/^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm)|application\/pdf)$/.test(v))),link,note:clean(body.note,1000),createdAt:now()};x.versions.push(v);x.status='aguardando_aprovacao';x.updatedAt=now();x.history.push({at:now(),event:`Prévia V${v.number} publicada`});await save(store,`projects/${x.id}`,x);return json({item:x});
}
async function review(session,body){const store=privateStore();const x=await read(store,`projects/${clean(body.projectId,80)}`);if(!x||x.clientId!==session.id)return failure('Projeto não encontrado.',404);
 const version=x.versions.at(-1);if(!version||version.id!==body.versionId)return failure('Esta versão não está mais disponível para aprovação.',409);
 if(x.status!=='aguardando_aprovacao')return failure('Esta etapa não está aguardando aprovação.',409);
 const decision=body.decision==='approved'?'approved':body.decision==='changes'?'changes':null;
 if(!decision)return failure('Selecione aprovar ou solicitar ajustes.');const comment=clean(body.comment,2000);if(decision==='changes'&&!comment)return failure('Descreva os ajustes desejados.');
 const entry={id:id(),versionId:version.id,decision,comment,timecode:clean(body.timecode,20),at:now(),clientId:session.id};
 x.reviews.push(entry);x.status=decision==='approved'?'aprovado':'ajustes';x.history.push({at:entry.at,event:decision==='approved'?`Versão ${version.number} aprovada`:`Ajustes solicitados na versão ${version.number}`});x.updatedAt=now();await save(store,`projects/${x.id}`,x);return json({item:x});
}
async function saveBriefing(req,body){
 // Honeypot field: do not let bots submit hundreds of briefs.
 if(body.website_field)return json({ok:true});
 const phone=digits(body.contact);if(phone.length<10||clean(body.name,100).length<2||clean(body.sector,150).length<2)return failure('Preencha nome, contato e setor da empresa.');
 const interests=textList(body.interests,4,30).filter(x=>['video','posts','impressos','sites'].includes(x));if(!interests.length)return failure('Selecione pelo menos um serviço.');
 const x={id:id(),name:clean(body.name,120),contact:phone,sector:clean(body.sector,150),interests,video:body.video&&typeof body.video==='object'?{theme:clean(body.video.theme,600),duration:clean(body.video.duration,70),narration:['propria','ia','sem'].includes(body.video.narration)?body.video.narration:''}:null,posts:textList(body.posts,3,40),prints:body.prints&&typeof body.prints==='object'?Object.fromEntries(['cartao','panfleto','banner','outro'].map(k=>[k,{selected:!!body.prints[k]?.selected,quantity:clean(body.prints[k]?.quantity,50),material:clean(body.prints[k]?.material,150),description:clean(body.prints[k]?.description,250)}])):null,sites:{kind:clean(body.sites?.kind,40),purpose:clean(body.sites?.purpose,1200)},notes:clean(body.notes,1600),createdAt:now(),updatedAt:now(),status:'novo'};
 if(JSON.stringify(x).length>18000)return failure('Briefing excedeu o tamanho permitido.');
 await save(privateStore(),`briefings/${x.id}`,x);return json({ok:true,reference:x.id.split('-')[0]});
}
async function updateBriefing(body){const store=privateStore();const x=await read(store,`briefings/${clean(body.id,80)}`);if(!x)return failure('Briefing não encontrado.',404);x.status=['novo','contatado','em_orcamento','concluido'].includes(body.status)?body.status:x.status;x.updatedAt=now();await save(store,`briefings/${x.id}`,x);return json({item:x});}
async function remove(body){const table=String(body.type||'');const idval=clean(body.id,80);const sets={print:[contentStore(),'prints/'],portfolio:[contentStore(),'portfolio/'],client:[privateStore(),'clients/'],project:[privateStore(),'projects/'],briefing:[privateStore(),'briefings/']};if(!sets[table]||!idval)return failure('Tipo ou ID inválido.');const [store,prefix]=sets[table];if(table==='client'){const projects=await all(privateStore(),'projects/');if(projects.some(x=>x.clientId===idval))return failure('Este cliente tem projetos. Remova os projetos antes.');}await store.delete(prefix+idval);return json({ok:true});}

export default async function handler(req){
 try{
  verifyOrigin(req);
  const action=new URL(req.url).searchParams.get('action')||'public';const method=req.method;
  if(method==='GET'&&action==='public')return await getPublic();
  if(method==='POST'&&action==='briefing')return await saveBriefing(req,await parseBody(req));
  if(method==='POST'&&action==='login')return await login(req);
  if(method==='POST'&&action==='logout'){verifyRequestOrigin(req);await identityLogout();return json({ok:true});}
  if(method==='GET'&&action==='me')return await getMe(req);
  const session=await userSession();const denied=requireRole(session,['clientData','review','changePassword'].includes(action)?'client':'admin');if(denied)return denied;
  if(action==='changePassword'&&method==='POST'){
   if(session.role!=='client')return failure('Esta ação é exclusiva do cliente.',403);
   const body=await parseBody(req);
   const oldPw=String(body.oldPassword||''),newPw=String(body.newPassword||'');
   if(newPw.length<8||newPw.length>128)return failure('A nova senha precisa ter de 8 a 128 caracteres.');
   // Confirm the current password with Netlify Identity first.
   const account=await read(privateStore(),`clients/${session.id}`);
   try{await identityLogin(account.email,oldPw);}catch{return failure('Senha atual incorreta.',403)}
   await updateUser({password:newPw});
   return json({ok:true});
  }
  if(action==='clientData'&&method==='GET'){const list=(await all(privateStore(),'projects/')).filter(p=>p.clientId===session.id);return json({projects:list});}
  if(action==='review'&&method==='POST'){if(session.role!=='client')return failure('Somente o cliente pode aprovar.',403);return await review(session,await parseBody(req));}
  if(action==='dashboard'&&method==='GET')return await getDashboard();
  if(method!=='POST')return failure('Método não permitido.',405);
  const body=await parseBody(req);
  switch(action){
   case 'saveSettings':{const x=sanitizeSettings(body);await save(contentStore(),'settings',x);return json({item:x})}
   case 'savePrint': return await savePrint(body);
   case 'savePortfolio': return await savePortfolio(body);
   case 'saveClient': return await saveClient(body);
   case 'saveProject': return await saveProject(body);
   case 'publishVersion':return await publishVersion(body);
   case 'updateBriefing':return await updateBriefing(body);
   case 'remove':return await remove(body);
   default:return failure('Operação desconhecida.',404);
  }
 }catch(err){console.error('GS API:',err);return failure(err?.status?errorText(err):'Falha no servidor. Confira a configuração do Netlify.',err?.status||500)}
}
