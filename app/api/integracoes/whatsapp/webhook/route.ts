import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {createHmac,timingSafeEqual} from 'node:crypto';
async function connection(req:Request){
 const id=new URL(req.url).searchParams.get('empresaId');if(!id||!/^[a-f0-9-]{36}$/i.test(id))return null;
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
 const c=await db.from('integracoes_credenciais').select('credenciais,ambiente').eq('empresa_id',id).eq('provedor','meta_whatsapp').maybeSingle();
 if(c.error||!c.data||(process.env.VERCEL_ENV==='preview'&&c.data.ambiente!=='teste'))return null;
 return {db,id,cred:c.data.credenciais as Record<string,string>};
}
export async function GET(req:Request){try{const c=await connection(req),u=new URL(req.url);if(c?.cred.verify_token&&u.searchParams.get('hub.mode')==='subscribe'&&u.searchParams.get('hub.verify_token')===c.cred.verify_token)return new Response(u.searchParams.get('hub.challenge')||'',{headers:{'Content-Type':'text/plain'}});return new Response('Não autorizado',{status:403});}catch{return new Response('Indisponível',{status:503});}}
export async function POST(req:Request){
 try{
  const c=await connection(req);if(!c?.cred.app_secret)return NextResponse.json({error:'Conexão não configurada.'},{status:503});
  const raw=Buffer.from(await req.arrayBuffer()),signature=req.headers.get('x-hub-signature-256')||'';
  if(!/^sha256=[a-f0-9]{64}$/i.test(signature)||!timingSafeEqual(Buffer.from(signature.slice(7),'hex'),createHmac('sha256',c.cred.app_secret).update(raw).digest()))return NextResponse.json({error:'Assinatura inválida.'},{status:401});
  const body=JSON.parse(raw.toString('utf8')),rank:Record<string,number>={aceito:0,enviado:1,entregue:2,lido:3};
  for(const entry of body.entry||[])for(const change of entry.changes||[]){
   const v=change.value;if(v?.metadata?.phone_number_id!==c.cred.phone_number_id)continue;
   for(const event of v.statuses||[]){
    const status:Record<string,string>={sent:'enviado',delivered:'entregue',read:'lido',failed:'erro'},mapped=status[event.status];if(!mapped||typeof event.id!=='string')continue;
    const q=await c.db.from('whatsapp_notificacoes').select('id,status_entrega').eq('empresa_id',c.id).eq('mensagem_externa_id',event.id).maybeSingle();if(q.error)throw Error();if(!q.data)continue;
    if((rank[q.data.status_entrega||'aceito']||0)>=2&&mapped==='erro')continue;
    if(mapped!=='erro'&&(rank[q.data.status_entrega||'aceito']||0)>rank[mapped])continue;
    const result=await c.db.from('whatsapp_notificacoes').update({status_entrega:mapped,...(mapped==='erro'?{status_envio:'erro',erro:'A Meta informou falha na entrega.',proxima_tentativa_em:new Date(Date.now()+300000).toISOString()}:{})}).eq('empresa_id',c.id).eq('id',q.data.id);
    if(result.error)throw Error();
   }
  }
  return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:'Evento não confirmado.'},{status:503});}
}
