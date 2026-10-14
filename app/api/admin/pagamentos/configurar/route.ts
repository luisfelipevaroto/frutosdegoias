import {NextResponse} from 'next/server';
import {autorizarEmpresa} from '@/lib/admin-server';
export async function POST(req:Request) {
 try {
  const {empresaId,secret}=await req.json();
  if(typeof empresaId!=='string')return NextResponse.json({error:'Empresa inválida.'},{status:400});
  const access=await autorizarEmpresa(req,empresaId);if(access instanceof NextResponse)return access;
  if(typeof secret!=='string'||secret.trim().length<16||secret.length>512)return NextResponse.json({error:'Informe a chave de assinatura fornecida pelo Mercado Pago.'},{status:400});
  const c=await access.db.from('integracoes_credenciais').select('credenciais').eq('empresa_id',empresaId).eq('provedor','mercado_pago').eq('pagamento_conectado',true).maybeSingle();
  if(c.error)return NextResponse.json({error:'Consulta indisponível.'},{status:503});
  if(!c.data)return NextResponse.json({error:'Conecte o Mercado Pago primeiro.'},{status:409});
  const saved=await access.db.from('integracoes_credenciais').update({credenciais:{...(c.data.credenciais as object),webhook_secret:secret.trim()}}).eq('empresa_id',empresaId).eq('provedor','mercado_pago').eq('pagamento_conectado',true);
  if(saved.error)return NextResponse.json({error:'Não foi possível salvar.'},{status:503});
  return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Não foi possível configurar.'},{status:400});}
}
