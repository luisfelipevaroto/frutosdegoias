"use client";
import {useState} from 'react';
import {supabase} from '@/lib/supabase';
import {rotuloEntrega,linkRastreamento} from '@/lib/entregas';
type Cotacao={quoteId:string;valor:number;expiraEm:string;ambiente:string};
const brl=(v:number)=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function EntregaPedido({empresaId,pedido,entrega,atualizado}:{empresaId:string;pedido:any;entrega?:any;atualizado:()=>Promise<void>}){
 const [cotacao,setCotacao]=useState<Cotacao|null>(null),[busy,setBusy]=useState(false),[erro,setErro]=useState('');
 if(pedido.tipo_entrega!=='entrega'||(pedido.provedor_entrega!=='uber_direct'&&entrega?.provedor!=='uber_direct'))return null;
 async function acao(nome:string){setBusy(true);setErro('');try{
  const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error('Entre novamente no painel.');
  const r=await fetch('/api/admin/entrega',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({empresaId,pedidoId:pedido.id,acao:nome,quoteId:cotacao?.quoteId??entrega?.quote_id})});const data=await r.json();if(!r.ok)throw new Error(data.error||'Não foi possível atualizar a entrega.');
  if(nome==='cotar')setCotacao(data);else setCotacao(null);
 }catch(e){setErro(e instanceof Error?e.message:'Não foi possível atualizar.');}finally{try{await atualizado();}finally{setBusy(false);}}}
 const pendente=['solicitando','incerto'].includes(entrega?.status),link=linkRastreamento(entrega?.tracking_url),courier=entrega?.dados?.courier;
 return <section className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
  <h3 className="font-bold text-blue-900">Entrega Uber</h3><p className="mt-2 text-sm">{rotuloEntrega(entrega?.status)||'Aguardando o pedido ficar pronto'}</p>
  {courier?.nome&&<p className="mt-2 text-sm">Entregador: {courier.nome}{courier.telefone?` · ${courier.telefone}`:''}</p>}
  {link&&<a href={link} target="_blank" rel="noopener noreferrer" className="mt-2 block text-sm font-semibold underline">Acompanhar corrida</a>}
  {entrega?.erro&&<p className="mt-2 text-sm text-amber-800">{entrega.erro}</p>}{erro&&<p role="alert" className="mt-2 text-sm text-red-700">{erro}</p>}
  {entrega?.entrega_externa_id&&<button disabled={busy} onClick={()=>acao('atualizar')} className="mt-3 w-full rounded border bg-white p-2 text-sm disabled:opacity-50">Atualizar entrega</button>}
  {pedido.status_pedido==='pronto'&&!entrega?.entrega_externa_id&&(pendente?<><p className="mt-2 text-xs">Retomar usa a mesma solicitação para recuperar a confirmação, sem abrir outra corrida.</p><button disabled={busy} onClick={()=>acao('solicitar')} className="mt-3 w-full rounded bg-brand-700 p-2 text-sm font-semibold text-white disabled:opacity-50">Retomar solicitação · {brl(entrega.valor_cotacao)}</button></>:<>
   <button disabled={busy} onClick={()=>acao('cotar')} className="mt-3 w-full rounded border bg-white p-2 text-sm disabled:opacity-50">{cotacao?'Calcular novamente':'Calcular corrida Uber'}</button>
   {cotacao&&<div className="mt-3 rounded-lg bg-white p-3"><p className="text-sm font-bold">{cotacao.ambiente==='teste'?'Teste / sandbox':'Corrida real'} · {brl(cotacao.valor)}</p><p className="mt-1 text-xs">Este é o valor cobrado pela Uber à loja. Frete do cliente: {brl(pedido.taxa_entrega||0)}. Cotação válida até {new Date(cotacao.expiraEm).toLocaleTimeString('pt-BR')}.</p><button disabled={busy||Date.parse(cotacao.expiraEm)<=Date.now()} onClick={()=>acao('solicitar')} className="mt-3 w-full rounded bg-brand-700 p-2 text-sm font-semibold text-white disabled:opacity-50">Confirmar e solicitar entregador</button></div>}
  </>)}
  {entrega?.entrega_externa_id&&!['delivered','canceled','returned'].includes(entrega.status)&&<p className="mt-3 text-xs">Para cancelar a corrida, use o painel da Uber e depois clique em Atualizar entrega. Cancelar somente o pedido não cancela a corrida.</p>}
  {busy&&<p role="status" className="mt-2 text-xs">Aguarde a confirmação...</p>}
 </section>;
}
