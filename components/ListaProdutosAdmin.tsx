"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { rotuloCategoria } from "@/lib/types";
import { buscarProdutosAdmin, ProdutoAdmin, TAMANHO_PAGINA } from "@/lib/produtos-admin";
type Props = { empresaId:string; revisao:number; categorias:{id:string;nome:string}[]; subcategorias:{id:string;nome:string}[]; editar:(p:ProdutoAdmin)=>void; alternar:(id:string,ativo:boolean)=>Promise<void> };
export default function ListaProdutosAdmin({empresaId,revisao,categorias,subcategorias,editar,alternar}:Props) {
  const [busca,setBusca]=useState(""),[termo,setTermo]=useState("");
  const [produtos,setProdutos]=useState<ProdutoAdmin[]>([]),[total,setTotal]=useState<number|null>(null),[mais,setMais]=useState(true),[loading,setLoading]=useState(true),[erro,setErro]=useState(""),[alterando,setAlterando]=useState("");
  const container=useRef<HTMLDivElement>(null),sentinela=useRef<HTMLDivElement>(null),geracao=useRef(0),ocupado=useRef(false),offset=useRef(0),podeCarregar=useRef(false);
  const request=useCallback(async(reset=false)=>{
    if(!empresaId||(!reset&&(ocupado.current||!podeCarregar.current)))return;
    const token=reset?++geracao.current:geracao.current;
    ocupado.current=true;setLoading(true);setErro("");
    if(reset){offset.current=0;podeCarregar.current=false;setProdutos([]);setTotal(null);setMais(true);container.current?.scrollTo({top:0});}
    try {
      const page=await buscarProdutosAdmin(supabase,empresaId,termo,offset.current);
      if(token!==geracao.current)return;
      offset.current+=page.produtos.length;
      const temMais=page.produtos.length>0&&(page.total===null?page.produtos.length===TAMANHO_PAGINA:offset.current<page.total);
      podeCarregar.current=temMais;setMais(temMais);setTotal(page.total);
      setProdutos(current=>reset?page.produtos:[...current,...page.produtos.filter(p=>!current.some(v=>v.id===p.id))]);
    }catch(e){if(token===geracao.current){podeCarregar.current=false;setErro(e instanceof Error?e.message:"Erro ao carregar.");}}
    finally{if(token===geracao.current){ocupado.current=false;setLoading(false);}}
  },[empresaId,termo]);
  useEffect(()=>{const timer=setTimeout(()=>setTermo(busca.trim()),300);return()=>clearTimeout(timer);},[busca]);
  useEffect(()=>{request(true);return()=>{geracao.current++;};},[request,revisao]);
  const aguardandoBusca=busca.trim()!==termo;
  useEffect(()=>{
    if(loading||erro||aguardandoBusca||!mais||!sentinela.current)return;
    const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))request();},{root:container.current,rootMargin:"0px 0px 120px 0px"});
    observer.observe(sentinela.current);return()=>observer.disconnect();
  },[loading,erro,mais,aguardandoBusca,request]);
  async function toggle(p:ProdutoAdmin){if(alterando)return;setAlterando(p.id);try{await alternar(p.id,!p.ativo);}finally{setAlterando("");}}
  return <section className="min-w-0 self-start rounded-xl border bg-white" aria-label="Produtos cadastrados">
    <div className="border-b p-4"><h2 className="font-semibold">Produtos cadastrados</h2><label className="mt-3 block text-xs font-medium">Pesquisar produto<input type="search" maxLength={150} value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Digite o nome do produto" className="mt-1 w-full rounded-lg border p-2.5 text-sm"/></label><p className="mt-2 text-xs text-neutral-500" aria-live="polite">{aguardandoBusca?"Buscando…":total===null?"Carregando lista…":`${produtos.length} de ${total} produtos${termo?" encontrados":""}`}</p></div>
    <div ref={container} className="max-h-[70vh] overflow-y-auto overscroll-contain p-3" tabIndex={0} aria-label="Lista de produtos, role para carregar mais" aria-busy={loading||aguardandoBusca}>
      {!aguardandoBusca&&produtos.map(p=><article key={p.id} className="mb-2 flex flex-wrap items-center gap-3 rounded-lg border p-3"><div className="min-w-0 flex-1"><b className="block break-words text-sm">{p.nome}</b><p className="text-xs text-neutral-500">{categorias.find(c=>c.id===p.categoria_id)?.nome||rotuloCategoria(p.categoria)}{p.subcategoria_id?` · ${subcategorias.find(s=>s.id===p.subcategoria_id)?.nome||""}`:""} · {p.ativo?"Ativo":"Inativo"}</p></div><button disabled={!!alterando} onClick={()=>editar(p)} className="rounded border px-3 py-1 text-sm disabled:opacity-40">Editar</button><button disabled={!!alterando} onClick={()=>toggle(p)} className="text-sm disabled:opacity-40">{alterando===p.id?"Salvando…":p.ativo?"Desativar":"Ativar"}</button></article>)}
      {(loading||aguardandoBusca)&&<p role="status" className="flex items-center justify-center gap-2 py-5 text-sm text-neutral-500"><span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-200 border-t-brand-700"/>{produtos.length&&!aguardandoBusca?"Carregando mais produtos…":"Carregando produtos…"}</p>}
      {erro&&<div role="alert" className="p-3 text-sm text-red-700">{erro}<button onClick={()=>{podeCarregar.current=true;request(produtos.length===0);}} className="mt-2 block rounded border px-3 py-2 text-neutral-700">Tentar novamente</button></div>}
      {!loading&&!aguardandoBusca&&!erro&&!produtos.length&&<p className="py-6 text-center text-sm text-neutral-500">{termo?"Nenhum produto encontrado para esta pesquisa.":"Nenhum produto cadastrado."}</p>}
      {!loading&&!aguardandoBusca&&!erro&&mais&&<div ref={sentinela} className="py-2 text-center"><button onClick={()=>request()} className="rounded-lg border px-4 py-2 text-sm">Carregar mais 20 produtos</button></div>}
      {!loading&&!erro&&!mais&&produtos.length>0&&<p className="py-3 text-center text-xs text-neutral-400">Todos os produtos foram carregados.</p>}
    </div>
  </section>;
}

