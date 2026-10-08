import {NextResponse} from 'next/server';
import {autorizarEmpresa} from '@/lib/admin-server';
export async function POST(req:Request){
 try{const {empresaId,pedidoId,status,motivo}=await req.json();
 if(typeof empresaId!=='string'||typeof pedidoId!=='string'||!['em_preparo','pronto','saiu_para_entrega','entregue','cancelado'].includes(status))return NextResponse.json({error:'Etapa inválida.'},{status:400});
 const auth=await autorizarEmpresa(req,empresaId);if(auth instanceof NextResponse)return auth;
 const r=await auth.db.rpc('alterar_etapa_pedido',{p_empresa:empresaId,p_pedido:pedidoId,p_status:status,p_motivo:typeof motivo==='string'?motivo.slice(0,500):null,p_usuario:auth.userId});
 if(r.error)return NextResponse.json({error:r.error.message},{status:422});return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:'Não foi possível atualizar o pedido.'},{status:422});}
}
