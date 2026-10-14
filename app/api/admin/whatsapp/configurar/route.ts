import {NextResponse} from 'next/server';
import {autorizarEmpresa} from '@/lib/admin-server';
export async function GET(req:Request){
 try{const empresaId=new URL(req.url).searchParams.get('empresaId');if(!empresaId)return NextResponse.json({error:'Empresa inválida.'},{status:400});const access=await autorizarEmpresa(req,empresaId);if(access instanceof NextResponse)return access;const c=await access.db.from('integracoes_credenciais').select('credenciais').eq('empresa_id',empresaId).eq('provedor','meta_whatsapp').maybeSingle();if(c.error)throw Error();const v=c.data?.credenciais as Record<string,any>|undefined;const q=await access.db.from('whatsapp_notificacoes').select('id,status_pedido,status_envio,status_entrega,tentativas,erro,criado_em').eq('empresa_id',empresaId).order('criado_em',{ascending:false}).limit(20);if(q.error)throw Error();return NextResponse.json({template:v?.template_name||'',language:v?.template_language||'pt_BR',version:v?.graph_version||'',ativo:v?.envio_ativo===true,fila:q.data},{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'Consulta indisponível.'},{status:503});}
}
export async function POST(req:Request){
 try{
  const {empresaId,template,language,version,appSecret,verifyToken,ativo,acao}=await req.json();
  if(typeof empresaId!=='string')return NextResponse.json({error:'Empresa inválida.'},{status:400});
  const access=await autorizarEmpresa(req,empresaId);if(access instanceof NextResponse)return access;
  const module=await access.db.rpc('modulo_empresa_ativo',{p_empresa_id:empresaId,p_chave:'whatsapp_api'});if(module.error||module.data!==true)return NextResponse.json({error:'WhatsApp não liberado para esta empresa.'},{status:403});
  if(typeof template!=='string'||typeof language!=='string'||typeof version!=='string'||typeof appSecret!=='string'||appSecret.length>512||typeof verifyToken!=='string'||verifyToken.length>512||typeof ativo!=='boolean')return NextResponse.json({error:'Confira os campos da Meta.'},{status:400});
  const c=await access.db.from('integracoes_credenciais').select('credenciais,ambiente').eq('empresa_id',empresaId).eq('provedor','meta_whatsapp').single();
  const cred=c.data?.credenciais as Record<string,any>|undefined;
  if(c.error||!cred?.access_token||!/^\d{1,30}$/.test(cred.waba_id||''))return NextResponse.json({error:'Cadastre primeiro token e WABA ID.'},{status:409});
  if(acao==='pausar'){const paused=await access.db.from('integracoes_credenciais').update({credenciais:{...cred,envio_ativo:false}}).eq('empresa_id',empresaId).eq('provedor','meta_whatsapp');if(paused.error)throw Error();return NextResponse.json({ok:true,paused:true});}
  const signing=appSecret.trim()||cred.app_secret,verification=verifyToken.trim()||cred.verify_token;
  if(!/^[a-z0-9_]{1,100}$/.test(template)||!/^[a-z]{2}_[A-Z]{2}$/.test(language)||!/^v\d+\.\d+$/.test(version)||typeof signing!=='string'||signing.length<16||typeof verification!=='string'||verification.length<16)return NextResponse.json({error:'Confira o modelo, idioma, versão e chaves da Meta.'},{status:400});
  if(process.env.VERCEL_ENV==='preview'&&c.data?.ambiente!=='teste')return NextResponse.json({error:'O piloto aceita somente conexão de teste.'},{status:409});
  const r=await fetch(`https://graph.facebook.com/${version}/${cred.waba_id}/message_templates?name=${encodeURIComponent(template)}&fields=name,status,language,components`,{headers:{Authorization:`Bearer ${cred.access_token}`},signal:AbortSignal.timeout(10000),cache:'no-store'});
  if(!r.ok)return NextResponse.json({error:'Não foi possível verificar o modelo na Meta.'},{status:503});
  const response=await r.json(),t=response.data?.find((t:any)=>t.name===template&&t.language===language&&t.status==='APPROVED');
  const body=t?.components?.find((c:any)=>c.type==='BODY')?.text||'';
  if(!t||JSON.stringify((body.match(/\{\{\d+\}\}/g)||[]))!==JSON.stringify(['{{1}}','{{2}}','{{3}}'])||t.components.some((c:any)=>c.type==='HEADER'&&(c.format!=='TEXT'||/\{\{/.test(c.text||''))))return NextResponse.json({error:'Use um modelo aprovado com três parâmetros no corpo: nome, número do pedido e etapa. Não use cabeçalho dinâmico.'},{status:409});
  const saved=await access.db.from('integracoes_credenciais').update({credenciais:{...cred,template_name:template,template_language:language,graph_version:version,app_secret:signing,verify_token:verification,envio_ativo:ativo}}).eq('empresa_id',empresaId).eq('provedor','meta_whatsapp');
  if(saved.error)throw Error();return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Não foi possível configurar os envios.'},{status:503});}
}
