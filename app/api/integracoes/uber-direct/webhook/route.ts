import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac,timingSafeEqual } from 'crypto';
import { resumoUber } from '@/lib/uber-server';
export const runtime='nodejs';
function assinaturaValida(raw:string,sig:string,key:string){if(!/^[a-f0-9]{64}$/i.test(sig))return false;const expected=createHmac('sha256',key).update(raw,'utf8').digest();return timingSafeEqual(expected,Buffer.from(sig,'hex'));}
export async function POST(req:Request){try{
 const raw=await req.text();if(raw.length>200000)return new NextResponse(null,{status:413});let body:any;try{body=JSON.parse(raw)}catch{return new NextResponse(null,{status:400});}
 if(body.kind!=='event.delivery_status')return new NextResponse(null,{status:200});
 const id=body.delivery_id??body.data?.id;if(typeof id!=='string'||!id.startsWith('del_')||typeof body.id!=='string'||body.id.length>255)return new NextResponse(null,{status:400});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return new NextResponse(null,{status:503});const db=createClient(url,key,{auth:{persistSession:false}});
 let e=await db.from('entregas_integradas').select('id,empresa_id,pedido_id,ambiente').eq('provedor','uber_direct').eq('entrega_externa_id',id).maybeSingle();if(e.error)return new NextResponse(null,{status:503});
 if(!e.data&&typeof body.data?.external_id==='string')e=await db.from('entregas_integradas').select('id,empresa_id,pedido_id,ambiente').eq('provedor','uber_direct').eq('pedido_id',body.data.external_id).maybeSingle();if(e.error)return new NextResponse(null,{status:503});if(!e.data)return new NextResponse(null,{status:200});
 const c=await db.rpc('credencial_uber_direct_backend',{p_empresa_id:e.data.empresa_id});const cred=Array.isArray(c.data)?c.data[0]:c.data;if(c.error)return new NextResponse(null,{status:503});
 const signature=req.headers.get('x-uber-signature')||req.headers.get('x-postmates-signature')||'';
 if(!cred?.webhook_signing_key||!assinaturaValida(raw,signature,cred.webhook_signing_key))return new NextResponse(null,{status:401});
 if(e.data.ambiente&&e.data.ambiente!==cred.ambiente)return new NextResponse(null,{status:409});
 if(typeof body.live_mode==='boolean'&&body.live_mode!==(cred.ambiente==='producao'))return new NextResponse(null,{status:409});
 if(body.data?.id&&body.data.id!==id)return new NextResponse(null,{status:400});
 const s=resumoUber({...body.data,id,status:body.status??body.data?.status});const when=body.created??body.data?.updated;if(!Number.isFinite(Date.parse(when)))return new NextResponse(null,{status:400});
 const r=await db.rpc('aplicar_evento_uber',{p_entrega:e.data.id,p_evento:body.id,p_externo:id,p_status:s.status,p_quando:when,p_resumo:s});return new NextResponse(null,{status:r.error?503:200});
}catch{return new NextResponse(null,{status:503});}}
