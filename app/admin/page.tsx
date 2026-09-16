"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const statusLabels: Record<string,string> = { recebido:"Recebido", em_preparo:"Em preparo", saiu_para_entrega:"Saiu para entrega", entregue:"Entregue" };
const categorias = ["sorvete","picole","acai","monte_do_jeito","paleta"];

export default function Admin() {
  const router = useRouter(); const [tab,setTab]=useState<"dashboard"|"pedidos"|"produtos">("dashboard");
  const [pedidos,setPedidos]=useState<any[]>([]); const [produtos,setProdutos]=useState<any[]>([]); const [erro,setErro]=useState("");
  const [form,setForm]=useState<any>({categoria:"sorvete",nome:"",descricao:"",preco:"",preco_promocional:"",foto_url:"",ativo:true});

  async function carregar(){
    const {data:{user}}=await supabase.auth.getUser(); if(!user){router.replace("/admin/login");return;}
    const {data:admin}=await supabase.from("admin_users").select("user_id").eq("user_id",user.id).maybeSingle(); if(!admin){await supabase.auth.signOut();router.replace("/admin/login");return;}
    const [p,o]=await Promise.all([supabase.from("produtos").select("*").order("categoria").order("nome"),supabase.from("pedidos").select("*, clientes(nome,telefone)").order("criado_em",{ascending:false}).limit(100)]);
    setProdutos(p.data??[]); setPedidos(o.data??[]); if(p.error||o.error)setErro(p.error?.message||o.error?.message||"");
  }
  useEffect(()=>{carregar(); const ch=supabase.channel("admin-pedidos").on("postgres_changes",{event:"*",schema:"public",table:"pedidos"},carregar).subscribe(); return()=>{supabase.removeChannel(ch)}},[]);
  const hoje=useMemo(()=>{const d=new Date();return pedidos.filter(p=>new Date(p.criado_em).toDateString()===d.toDateString())},[pedidos]);
  const faturamento=hoje.reduce((s,p)=>s+Number(p.valor_total||0),0);
  async function salvarProduto(e:any){e.preventDefault();setErro(""); const payload={...form,preco:form.preco?Number(form.preco):null,preco_promocional:form.preco_promocional?Number(form.preco_promocional):null}; const r=form.id?await supabase.from("produtos").update(payload).eq("id",form.id):await supabase.from("produtos").insert(payload); if(r.error){setErro(r.error.message);return} setForm({categoria:"sorvete",nome:"",descricao:"",preco:"",preco_promocional:"",foto_url:"",ativo:true});carregar();}
  async function excluir(id:string){if(!confirm("Desativar este produto?"))return; await supabase.from("produtos").update({ativo:false}).eq("id",id);carregar()}
  async function status(id:string,status:string){await supabase.from("pedidos").update({status_pedido:status}).eq("id",id);carregar()}
  async function sair(){await supabase.auth.signOut();router.replace("/admin/login")}

  return <main className="min-h-screen bg-neutral-50 text-neutral-900"><header className="bg-white border-b sticky top-0 z-10"><div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between"><div><h1 className="font-bold">Frutos de Goiás · Admin</h1><p className="text-xs text-neutral-500">Gestão da unidade Juiz de Fora</p></div><button onClick={sair} className="text-sm text-neutral-500">Sair</button></div><nav className="max-w-6xl mx-auto px-4 flex gap-5 text-sm">{(["dashboard","pedidos","produtos"] as const).map(x=><button key={x} onClick={()=>setTab(x)} className={`py-3 border-b-2 ${tab===x?"border-brand-700 text-brand-700":"border-transparent text-neutral-500"}`}>{x[0].toUpperCase()+x.slice(1)}</button>)}</nav></header>
  <section className="max-w-6xl mx-auto p-4">
  {erro&&<div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
  {tab==="dashboard"&&<><div className="grid grid-cols-2 md:grid-cols-4 gap-3"><Card t="Pedidos hoje" v={hoje.length}/><Card t="Faturamento hoje" v={`R$ ${faturamento.toFixed(2)}`}/><Card t="Em andamento" v={pedidos.filter(p=>p.status_pedido!=="entregue").length}/><Card t="Produtos ativos" v={produtos.filter(p=>p.ativo).length}/></div><div className="mt-6 bg-white rounded-xl border p-4"><h2 className="font-semibold mb-3">Pedidos recentes</h2>{pedidos.slice(0,8).map(p=><Order key={p.id} p={p} onStatus={status}/>)}</div></>}
  {tab==="pedidos"&&<div className="bg-white rounded-xl border p-4"><h2 className="font-semibold mb-3">Pedidos</h2>{pedidos.map(p=><Order key={p.id} p={p} onStatus={status}/>)}</div>}
  {tab==="produtos"&&<div className="grid md:grid-cols-[360px_1fr] gap-5"><form onSubmit={salvarProduto} className="bg-white rounded-xl border p-4 h-fit"><h2 className="font-semibold mb-4">{form.id?"Editar produto":"Novo produto"}</h2><select value={form.categoria} onChange={e=>setForm({...form,categoria:e.target.value})} className="w-full border rounded-lg p-2 mb-2">{categorias.map(c=><option key={c}>{c}</option>)}</select><input required placeholder="Nome" value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} className="w-full border rounded-lg p-2 mb-2"/><textarea placeholder="Descrição" value={form.descricao} onChange={e=>setForm({...form,descricao:e.target.value})} className="w-full border rounded-lg p-2 mb-2"/><input type="number" step="0.01" placeholder="Preço" value={form.preco} onChange={e=>setForm({...form,preco:e.target.value})} className="w-full border rounded-lg p-2 mb-2"/><input type="number" step="0.01" placeholder="Preço promocional" value={form.preco_promocional} onChange={e=>setForm({...form,preco_promocional:e.target.value})} className="w-full border rounded-lg p-2 mb-2"/><input placeholder="URL da foto" value={form.foto_url} onChange={e=>setForm({...form,foto_url:e.target.value})} className="w-full border rounded-lg p-2 mb-3"/><label className="flex gap-2 text-sm mb-3"><input type="checkbox" checked={form.ativo} onChange={e=>setForm({...form,ativo:e.target.checked})}/> Produto disponível</label><button className="w-full bg-brand-700 text-white rounded-lg py-2">Salvar</button>{form.id&&<button type="button" onClick={()=>setForm({categoria:"sorvete",nome:"",descricao:"",preco:"",preco_promocional:"",foto_url:"",ativo:true})} className="w-full mt-2 border rounded-lg py-2">Cancelar edição</button>}</form><div className="space-y-2">{produtos.map(p=><div key={p.id} className="bg-white rounded-xl border p-3 flex gap-3 items-center"><div className="flex-1"><div className="font-medium">{p.nome}</div><div className="text-xs text-neutral-500">{p.categoria} · {p.ativo?"Ativo":"Inativo"}</div><div className="text-sm mt-1">R$ {Number(p.preco??0).toFixed(2)}</div></div><button onClick={()=>setForm(p)} className="text-sm border rounded-lg px-3 py-2">Editar</button><button onClick={()=>excluir(p.id)} className="text-sm text-red-600">Desativar</button></div>)}</div></div>}
  </section></main>
}
function Card({t,v}:{t:string,v:any}){return <div className="bg-white border rounded-xl p-4"><div className="text-xs text-neutral-500">{t}</div><div className="text-xl font-bold mt-1">{v}</div></div>}
function Order({p,onStatus}:{p:any,onStatus:(id:string,s:string)=>void}){return <div className="border-t py-3 flex flex-col md:flex-row md:items-center gap-3"><div className="flex-1"><b>#{p.numero}</b> · {p.clientes?.nome??"Cliente"}<div className="text-xs text-neutral-500">{p.clientes?.telefone??""} · {p.tipo_entrega} · {p.forma_pagamento}</div></div><b>R$ {Number(p.valor_total||0).toFixed(2)}</b><select value={p.status_pedido} onChange={e=>onStatus(p.id,e.target.value)} className="border rounded-lg p-2 text-sm">{Object.entries(statusLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>}
