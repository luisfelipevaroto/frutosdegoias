import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {assinaturaValida} from '@/lib/mercado-pago-eventos';
import {recursoSaas,conciliarSaas} from '@/lib/assinaturas-saas-server';
export async function POST(req:Request){
 try{
  const secret=process.env.SAAS_MERCADO_PAGO_WEBHOOK_SECRET;
  if(!secret)return NextResponse.json({error:'Confirmação SaaS não configurada.'},{status:503});
  const body=await req.json(),id=new URL(req.url).searchParams.get('data.id')||'';
  if(!['subscription_preapproval','subscription_authorized_payment'].includes(body.type))return NextResponse.json({ok:true});
  if(!/^[a-z0-9_-]{1,100}$/i.test(id)||String(body.data?.id)!==id||!assinaturaValida(req.headers.get('x-signature'),req.headers.get('x-request-id'),id,secret))return NextResponse.json({error:'Assinatura inválida.'},{status:401});
  const preapproval=body.type==='subscription_preapproval'?id:(await recursoSaas(`/authorized_payments/${encodeURIComponent(id)}`)).preapproval_id;
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
  const c=await db.from('cobrancas_saas').select('empresa_id').eq('preapproval_id',String(preapproval)).maybeSingle();
  if(c.error)throw Error();
  if(c.data)await conciliarSaas(db,c.data.empresa_id);
  return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:'Conciliação não confirmada.'},{status:503});}
}
