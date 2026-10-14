import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {processarFilaWhatsApp} from '@/lib/whatsapp-server';
export const maxDuration=60;
export async function GET(req:Request){
 if(process.env.WHATSAPP_AUTOMACAO_ATIVA!=='true')return NextResponse.json({executada:false});
 if(!process.env.CRON_SECRET||req.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`)return NextResponse.json({error:'Acesso negado.'},{status:401});
 try{const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});const c=await db.from('integracoes_credenciais').select('empresa_id').eq('provedor','meta_whatsapp');if(c.error)throw Error();for(const row of c.data||[])await processarFilaWhatsApp(db,row.empresa_id);return NextResponse.json({ok:true});}catch{return NextResponse.json({error:'Fila indisponível.'},{status:503});}
}
