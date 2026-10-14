import {NextResponse} from 'next/server';
import {autorizarSuperadmin,resposta} from '@/lib/superadmin-server';
export async function POST(req:Request){
 try{
  const access=await autorizarSuperadmin(req);if(access instanceof NextResponse)return access;
  const {empresaId,email,planoId}=await req.json();
  if(typeof empresaId!=='string'||typeof email!=='string'||email.length>254||!/^\S+@\S+\.\S+$/.test(email))return resposta({error:'Empresa ou e-mail inválido.'},400);
  const e=await access.db.from('empresas').select('id,dominio_principal').eq('id',empresaId).single();if(e.error||!e.data)return resposta({error:'Empresa não encontrada.'},404);
  if(!e.data.dominio_principal)return resposta({error:'Cadastre e conecte o domínio da empresa antes de preparar seu acesso.'},409);
  const host=String(e.data.dominio_principal);if(!/^[a-z0-9.-]+$/i.test(host))return resposta({error:'Domínio inválido.'},400);
  // Resolve existing users without changing their password or creating duplicates.
  let userId:string|undefined,pendente=false;
  for(let page=1;;page++){
   const users=await access.db.auth.admin.listUsers({page,perPage:100});if(users.error)throw Error('Consulta de usuários indisponível.');
   const found=users.data.users.find(u=>u.email?.toLowerCase()===email.trim().toLowerCase());userId=found?.id;pendente=Boolean(found?.invited_at&&!found.email_confirmed_at);
   if(userId||users.data.users.length<100)break;
  }
  let token:string|undefined;const tipo=userId?"recovery":"invite";
  if(!userId||pendente){
   const invite=await access.db.auth.admin.generateLink({type:tipo,email:email.trim()});
   if(invite.error||!invite.data.user||!invite.data.properties?.hashed_token)throw Error('Não foi possível preparar o convite. Confira o usuário no Supabase antes de repetir.');
   userId=invite.data.user.id;token=invite.data.properties.hashed_token;
  }
  const grant=await access.db.rpc('provisionar_admin_empresa',{p_empresa:empresaId,p_usuario:userId,p_plano:planoId||null,p_autor:access.userId});
  if(grant.error)throw Error('Usuário preparado, mas acesso não vinculado. Revise o plano e tente novamente; a senha não foi alterada.');
  // Link is returned only to the authenticated owner. No email is sent here.
  return resposta({novo:Boolean(token),url:token?`https://${host}/ativar-acesso#token_hash=${encodeURIComponent(token)}&type=${tipo}`:null,mensagem:token?'Acesso preparado. Entregue este link privado ao responsável.':'Usuário existente vinculado. Ele pode entrar com sua senha atual.'});
 }catch(e){return resposta({error:e instanceof Error?e.message:'Provisionamento indisponível.'},503);}
}
