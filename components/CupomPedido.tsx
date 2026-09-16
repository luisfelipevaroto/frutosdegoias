"use client";

type Props={pedido:any;itens:any[]};
const moeda=(v:any)=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function CupomPedido({pedido:p,itens}:Props){
 function imprimir(){window.print()}
 const subtotal=itens.reduce((s,i)=>s+Number(i.preco_unitario||0)*Number(i.quantidade||0),0);
 return <>
  <button onClick={imprimir} className="print:hidden flex w-full items-center justify-center gap-2 rounded-xl border bg-white p-3 font-medium text-neutral-700">🖨️ Imprimir pedido</button>
  <div id="cupom-nao-fiscal" className="hidden print:block">
   <div className="cupom">
    <div className="centro"><b>FRUTOS DE GOIÁS</b><br/>Juiz de Fora - MG<br/>Rua Santa Rita, 583 - Centro<br/><b>CUPOM NÃO FISCAL</b></div>
    <div className="linha"/><div><b>PEDIDO #{p.numero}</b><br/>{new Date(p.criado_em).toLocaleString('pt-BR')}<br/>Tipo: {p.tipo_entrega==='entrega'?'ENTREGA':'RETIRADA'}<br/>Pagamento: {p.forma_pagamento}</div>
    {p.tipo_entrega==='entrega'&&p.endereco_entrega&&<><div className="linha"/><div><b>ENDEREÇO</b><br/>{p.endereco_entrega}</div></>}
    <div className="linha"/>
    {itens.map(i=><div key={i.id} className="item"><div><b>{i.quantidade}x {i.produto_nome||'Produto'}</b>{i.variacao_nome&&<div>{i.variacao_nome}</div>}{i.adicionais?.length>0&&<div>+ {i.adicionais.map((a:any)=>a.nome).join(', ')}</div>}</div><div>{moeda(Number(i.preco_unitario)*Number(i.quantidade))}</div></div>)}
    <div className="linha"/><div className="total"><span>Subtotal</span><span>{moeda(subtotal)}</span></div>{Number(p.desconto_fidelidade)>0&&<div className="total"><span>Desconto</span><span>- {moeda(p.desconto_fidelidade)}</span></div>}<div className="total"><span>Entrega</span><span>{moeda(p.taxa_entrega)}</span></div><div className="linha"/><div className="total grande"><b>TOTAL</b><b>{moeda(p.valor_total)}</b></div>
    <div className="linha"/><div className="centro">*** CUPOM NÃO FISCAL ***<br/>Obrigado pela preferência!</div>
   </div>
  </div>
  <style jsx global>{`@media print{body *{visibility:hidden!important}#cupom-nao-fiscal,#cupom-nao-fiscal *{visibility:visible!important}#cupom-nao-fiscal{display:block!important;position:absolute;left:0;top:0;width:80mm;background:#fff;color:#000}.cupom{width:72mm;margin:0 auto;font-family:monospace;font-size:11px;line-height:1.35}.centro{text-align:center}.linha{border-top:1px dashed #000;margin:7px 0}.item,.total{display:flex;justify-content:space-between;gap:8px;margin:4px 0}.item>div:first-child{max-width:52mm}.grande{font-size:14px}@page{size:80mm auto;margin:3mm}}`}</style>
 </>;
}
