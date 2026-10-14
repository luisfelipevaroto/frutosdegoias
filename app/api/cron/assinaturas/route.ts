import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {configuracaoSaas,conciliarSaas} from '@/lib/assinaturas-saas-server';
export async function GET(req:Request){
 if(process.env.SAAS_AUTOMACAO_ATIVA!=='true')return NextResponse.json({executada:false,motivo:'Automação não ativada.'});
 if(!process.env.CRON_SECRET||req.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`)return NextResponse.json({error:'Acesso negado.'},{status:401});
 try{
  configuracaoSaas();const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
  const rows=await db.from('cobrancas_saas').select('empresa_id').not('preapproval_id','is',null);if(rows.error)throw Error();
  const failures:string[]=[];let ok=0;
  for(const c of rows.data||[]){try{await conciliarSaas(db,c.empresa_id);ok++;}catch{failures.push(c.empresa_id);}}
  return NextResponse.json({conciliadas:ok,falhas:failures.length},{status:failures.length?503:200,headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Conciliação não executada.'},{status:503});}
}
