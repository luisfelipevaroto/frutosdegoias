import {supabase} from './supabase';
export async function buscarPedidosPainel(empresaId:string) {
 const fields='*,clientes(nome,telefone,whatsapp,endereco)',rows:any[]=[];
 for(let offset=0;;){
  const r=await supabase.from('pedidos').select(fields).eq('empresa_id',empresaId).in('status_pedido',['recebido','em_preparo','saiu_para_entrega']).order('criado_em',{ascending:false}).order('id').range(offset,offset+499);
  if(r.error)return {data:null,error:r.error};
  if(!r.data?.length)break;
  rows.push(...r.data);offset+=r.data.length;
 }
 const closed=await supabase.from('pedidos').select(fields).eq('empresa_id',empresaId).in('status_pedido',['entregue','cancelado']).order('criado_em',{ascending:false}).order('id').limit(20);
 if(closed.error)return {data:null,error:closed.error};
 return {data:[...rows,...closed.data],error:null};
}
