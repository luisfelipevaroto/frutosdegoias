import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {createPublicKey,verify} from 'node:crypto';
import {consultarPedidoPagBank} from '@/lib/pagbank/server';

export const runtime='nodejs';
export async function POST(req:Request){
 try{
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key)return NextResponse.json({error:'Indisponível'},{status:503});
  const signatures=(req.headers.get('x-payload-signature')||'').split(',').map(s=>s.trim()).filter(Boolean);
  if(!signatures.length)return NextResponse.json({error:'Assinatura ausente'},{status:401});
  const raw=Buffer.from(await req.arrayBuffer());
  if(raw.length>65536)return NextResponse.json({error:'Payload excessivo'},{status:413});
  // Extraímos apenas o identificador para localizar a conta. O evento ainda não é confiável.
  const event=JSON.parse(raw.toString('utf8'));
  const id=String(event.id||'');
  if(!/^ORDE_[a-zA-Z0-9-]+$/.test(id))return NextResponse.json({error:'Evento inválido'},{status:400});
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,key,{auth:{persistSession:false}});
  const {data:p}=await db.from('pedidos').select('id,empresa_id,valor_total,status_pagamento,forma_pagamento,provedor_pagamento,pagamento_externo_id').eq('pagamento_externo_id',id).eq('provedor_pagamento','pagbank').maybeSingle();
  if(!p)return NextResponse.json({ok:true});
  const {data:c}=await db.from('integracoes_credenciais').select('ambiente,credenciais').eq('empresa_id',p.empresa_id).eq('provedor','pagbank').eq('pagamento_conectado',true).maybeSingle();
  const token=(c?.credenciais as {token?:string})?.token;
  if(!token)return NextResponse.json({error:'Credencial ausente'},{status:503});
  const base=c?.ambiente==='producao'?'https://api.pagseguro.com':'https://sandbox.api.pagseguro.com';
  const kr=await fetch(base+'/public-keys?type=webhook',{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(!kr.ok)return NextResponse.json({error:'Chave pública indisponível'},{status:503});
  const publicKey=(await kr.json()).public_key;
  if(typeof publicKey!=='string')return NextResponse.json({error:'Chave inválida'},{status:503});
  const pub=createPublicKey({key:Buffer.from(publicKey,'base64'),format:'der',type:'spki'});
  const valid=signatures.some(s=>{try{return verify('sha256',raw,pub,Buffer.from(s,'base64'))}catch{return false}});
  if(!valid)return NextResponse.json({error:'Assinatura inválida'},{status:401});
  // Confirma status e valor diretamente na API autenticada, sem confiar no payload.
  const order=await consultarPedidoPagBank<any>({token,ambiente:c?.ambiente==='producao'?'producao':'sandbox'},id);
  if(order.id!==id||order.reference_id!==p.id)return NextResponse.json({error:'Referência divergente'},{status:409});
  const paid=(order.charges||[]).some((charge:any)=>charge.status==='PAID'&&Number(charge.amount?.value)===Math.round(Number(p.valor_total)*100));
  if(paid&&p.status_pagamento==='pendente'){
   const saved=await db.from('pedidos').update({status_pagamento:'pago'}).eq('id',p.id).eq('empresa_id',p.empresa_id).eq('provedor_pagamento','pagbank').eq('status_pagamento','pendente');
   if(saved.error)return NextResponse.json({error:'Falha ao atualizar'},{status:503});
  }
  return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:'Falha ao validar notificação'},{status:503})}
}
