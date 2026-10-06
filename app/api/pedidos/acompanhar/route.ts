import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {linkRastreamento} from '@/lib/entregas';
export async function POST(req:Request){
 try{const {empresaId,numero,cpf,whatsapp}=await req.json();
 if(typeof empresaId!=='string'||(numero!==undefined&&!Number.isSafeInteger(numero))||typeof cpf!=='string'||cpf.length>30||typeof whatsapp!=='string'||whatsapp.length>30)return NextResponse.json({error:'Dados inválidos.'},{status:400});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL!,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,key=process.env.SUPABASE_SERVICE_ROLE_KEY!;
 const caller=createClient(url,anon,{auth:{persistSession:false}});
 const r=await caller.rpc(numero===undefined?'area_cliente':'detalhe_pedido_cliente',{p_empresa_id:empresaId,...(numero===undefined?{}:{p_numero:numero}),p_cpf:cpf,p_whatsapp:whatsapp});
 if(r.error)return NextResponse.json({error:'Consulta indisponível.'},{status:503});
 const data=r.data;
 if(data?.encontrado&&Array.isArray(data.pedidos)&&data.pedidos.length){const db=createClient(url,key,{auth:{persistSession:false}});const ready=await db.from('pedidos').select('id,pronto_em').eq('empresa_id',empresaId).in('id',data.pedidos.map((p:any)=>p.id));if(!ready.error)data.pedidos=data.pedidos.map((p:any)=>({...p,pronto_em:ready.data?.find(x=>x.id===p.id)?.pronto_em}));}
 if(data?.encontrado&&data.pedido?.id){const db=createClient(url,key,{auth:{persistSession:false}});const e=await db.from('entregas_integradas').select('status,tracking_url').eq('empresa_id',empresaId).eq('pedido_id',data.pedido.id).eq('provedor','uber_direct').maybeSingle();if(!e.error&&e.data)data.entrega={status:e.data.status,tracking_url:linkRastreamento(e.data.tracking_url)};}
 return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Consulta indisponível.'},{status:503});}
}
