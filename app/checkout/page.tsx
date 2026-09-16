"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCarrinho } from "@/lib/carrinho-context";
import { FormaPagamento, TipoEntrega } from "@/lib/types";

function calcularTaxaEntrega(endereco: string): number { return endereco ? 6 : 0; }

export default function Checkout() {
  const { itens, subtotal, limpar } = useCarrinho();
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoEntrega>("entrega"); const [endereco,setEndereco]=useState(""); const [horarioRetirada,setHorarioRetirada]=useState(""); const [pagamento,setPagamento]=useState<FormaPagamento>("pix"); const [nome,setNome]=useState(""); const [telefone,setTelefone]=useState(""); const [cpf,setCpf]=useState(""); const [loading,setLoading]=useState(false); const [erro,setErro]=useState("");
  const taxaEntrega=tipo==="entrega"?calcularTaxaEntrega(endereco):0; const total=subtotal+taxaEntrega;
  const formasDisponiveis:FormaPagamento[]=tipo==="entrega"?["pix","cartao"]:["dinheiro","pix","cartao"];
  async function confirmarPedido(){setErro("");if(!nome||!telefone){setErro("Informe nome e telefone.");return}if(tipo==="entrega"&&!endereco){setErro("Informe o endereço de entrega.");return}setLoading(true);try{const r=await fetch("/api/pedidos",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cliente:{nome,telefone,cpf},tipoEntrega:tipo,endereco,horarioRetirada:horarioRetirada?new Date(`1970-01-01T${horarioRetirada}:00`).toISOString():null,taxaEntrega,pagamento,itens})});const data=await r.json();if(!r.ok)throw new Error(data.error||"Não foi possível criar o pedido.");limpar();router.push(`/pedido/${data.numero}`)}catch(e:any){setErro(e.message)}finally{setLoading(false)}}
  return <main className="mx-auto max-w-md p-4 pb-24"><h1 className="mb-4 text-base font-medium">Como você quer receber?</h1><div className="mb-4 flex gap-2">{(["entrega","retirada"] as TipoEntrega[]).map(t=><button key={t} onClick={()=>setTipo(t)} className={`flex-1 rounded-lg border py-3 text-sm font-medium capitalize ${tipo===t?"border-brand-600 bg-brand-50 text-brand-700":"border-neutral-200 text-neutral-500"}`}>{t}</button>)}</div>
  <div className="grid grid-cols-1 gap-2 mb-4"><input required placeholder="Seu nome" value={nome} onChange={e=>setNome(e.target.value)} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"/><input required placeholder="Telefone / WhatsApp" value={telefone} onChange={e=>setTelefone(e.target.value)} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"/><input placeholder="CPF (opcional)" value={cpf} onChange={e=>setCpf(e.target.value)} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"/></div>
  {tipo==="entrega"?<div className="mb-4"><label className="mb-1 block text-xs text-neutral-500">Endereço de entrega</label><input value={endereco} onChange={e=>setEndereco(e.target.value)} placeholder="Rua, número, bairro" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"/></div>:<div className="mb-4"><label className="mb-1 block text-xs text-neutral-500">Horário de retirada</label><input type="time" value={horarioRetirada} onChange={e=>setHorarioRetirada(e.target.value)} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"/></div>}
  <label className="mb-1 block text-xs text-neutral-500">Forma de pagamento</label><div className="mb-4 flex gap-2">{formasDisponiveis.map(f=><button key={f} onClick={()=>setPagamento(f)} className={`flex-1 rounded-lg border py-2 text-sm capitalize ${pagamento===f?"border-brand-600 bg-brand-50 text-brand-700":"border-neutral-200 text-neutral-500"}`}>{f}</button>)}</div>
  <div className="border-t border-neutral-200 pt-3 text-sm"><div className="flex justify-between text-neutral-500"><span>Subtotal</span><span>R$ {subtotal.toFixed(2)}</span></div>{tipo==="entrega"&&<div className="flex justify-between text-neutral-500"><span>Taxa de entrega</span><span>R$ {taxaEntrega.toFixed(2)}</span></div>}<div className="mt-1 flex justify-between font-medium"><span>Total</span><span>R$ {total.toFixed(2)}</span></div></div>
  {erro&&<p className="mt-3 text-sm text-red-600">{erro}</p>}<button onClick={confirmarPedido} disabled={itens.length===0||loading} className="mt-4 w-full rounded-lg bg-brand-700 py-3 text-sm font-medium text-white disabled:opacity-40">{loading?"Enviando pedido...":"Confirmar pedido"}</button></main>;
}
