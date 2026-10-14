import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {processarFilaWhatsApp} from '@/lib/whatsapp-server';
import {conciliarPagamentoLoja} from '@/lib/mercado-pago-conciliacao';
export const maxDuration=60;
export async function GET(req:Request){
 if(process.env.WHATSAPP_AUTOMACAO_ATIVA!=='true'&&process.env.MERCADO_PAGO_CONCILIACAO_ATIVA!=='true')return NextResponse.json({executada:false});
 if(!process.env.CRON_SECRET||req.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`)return NextResponse.json({error:'Acesso negado.'},{status:401});
 try{const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});if(process.env.MERCADO_PAGO_CONCILIACAO_ATIVA==='true'){const orders=await db.from('pedidos').select('*').eq('provedor_pagamento','mercado_pago').or('status_pagamento.eq.pendente,and(status_pagamento.eq.pago,status_pedido.eq.cancelado)').order('pagamento_consultado_em',{ascending:true,nullsFirst:true}).limit(3);if(orders.error)throw Error();for(const p of orders.data||[]){const mark=await db.from('pedidos').update({pagamento_consultado_em:new Date().toISOString()}).eq('id',p.id).eq('empresa_id',p.empresa_id);if(mark.error)throw Error();try{await conciliarPagamentoLoja(db,p);}catch{/* Unconfirmed payments retain their existing financial status. */}}}if(process.env.WHATSAPP_AUTOMACAO_ATIVA==='true'){const c=await db.from('integracoes_credenciais').select('empresa_id').eq('provedor','meta_whatsapp');if(c.error)throw Error();for(const row of c.data||[])await processarFilaWhatsApp(db,row.empresa_id);}return NextResponse.json({ok:true});}catch{return NextResponse.json({error:'Conferência indisponível.'},{status:503});}
}
