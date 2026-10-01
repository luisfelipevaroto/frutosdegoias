"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getEmpresaAdminAtual } from "@/lib/empresa-admin";

type Cliente = { id:string; nome:string; cpf:string; telefone:string; whatsapp?:string|null; fidelidade_saldo:number; fidelidade_credito:number; fidelidade_cupom_disponivel:boolean };
type Cfg = { ativo:boolean; modo:"meta"|"cashback"; meta:number; tipo_recompensa:"percentual"|"fixo"; valor_recompensa:number; cashback_percentual:number };
const padrao:Cfg={ativo:false,modo:"meta",meta:100,tipo_recompensa:"percentual",valor_recompensa:10,cashback_percentual:5};
const brl=(v:number)=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

export default function FidelidadeAdmin(){
  const router=useRouter();
  const[empresaId,setEmpresaId]=useState(""); const[empresaNome,setEmpresaNome]=useState(""); const[clientes,setClientes]=useState<Cliente[]>([]); const[cfg,setCfg]=useState<Cfg>(padrao); const[busca,setBusca]=useState(""); const[valor,setValor]=useState<Record<string,string>>({}); const[resgate,setResgate]=useState<Record<string,string>>({}); const[motivo,setMotivo]=useState<Record<string,string>>({}); const[msg,setMsg]=useState(""); const[liberado,setLiberado]=useState<boolean|null>(null); const[processando,setProcessando]=useState<string|null>(null);

  async function resolver(){
    const{data:{user}}=await supabase.auth.getUser(); if(!user){router.replace("/admin/login");return null}
    const e=await getEmpresaAdminAtual(user.id); if(!e)return null;
    const{data:ok}=await supabase.rpc("modulo_empresa_ativo",{p_empresa_id:e.id,p_chave:"fidelidade"}); if(ok!==true){setLiberado(false);router.replace("/admin");return null}
    setLiberado(true);setEmpresaId(e.id);setEmpresaNome(e.nome);return e;
  }
  async function carregar(eid=empresaId){
    let id=eid;if(!id){const e=await resolver();if(!e)return;id=e.id}
    const[{data:c,error:ce},{data:f,error:fe}]=await Promise.all([
      supabase.from("clientes").select("id,nome,cpf,telefone,whatsapp,fidelidade_saldo,fidelidade_credito,fidelidade_cupom_disponivel").eq("empresa_id",id).order("nome"),
      supabase.from("configuracoes_loja").select("valor").eq("empresa_id",id).eq("chave","fidelidade").maybeSingle()
    ]);
    if(ce||fe)return setMsg(ce?.message||fe?.message||"Erro ao carregar.");
    setClientes((c??[])as Cliente[]);const v=(f?.valor||{})as any;
    setCfg({ativo:Boolean(v.ativo),modo:v.modo==="cashback"?"cashback":"meta",meta:Number(v.meta||100),tipo_recompensa:v.tipo_recompensa==="fixo"?"fixo":"percentual",valor_recompensa:Number(v.valor_recompensa??v.desconto_percentual??10),cashback_percentual:Number(v.cashback_percentual??5)});
  }
  useEffect(()=>{carregar()},[]);

  async function salvar(){
    if(!empresaId)return;if(cfg.modo==="cashback"&&(cfg.cashback_percentual<=0||cfg.cashback_percentual>100))return setMsg("Informe um cashback entre 0,01% e 100%.");
    const{error}=await supabase.from("configuracoes_loja").upsert({empresa_id:empresaId,chave:"fidelidade",valor:cfg,atualizado_em:new Date().toISOString()},{onConflict:"empresa_id,chave"});setMsg(error?error.message:"Configuração salva.");
  }
  async function lancar(id:string){
    const v=Number((valor[id]||"").replace(",","."));if(v<=0)return;setProcessando(id);
    const{error}=await supabase.rpc("admin_lancar_compra_fidelidade",{p_cliente_id:id,p_valor:v,p_observacao:"Compra lançada manualmente"});setProcessando(null);
    if(error)setMsg(error.message);else{setValor(x=>({...x,[id]:""}));setMsg("Compra registrada.");carregar(empresaId)}
  }
  async function resgatar(id:string){
    const v=Number((resgate[id]||"").replace(",","."));if(v<=0)return;setProcessando(id);
    const{error}=await supabase.rpc("admin_resgatar_fidelidade",{p_cliente_id:id,p_valor:v,p_observacao:motivo[id]||"Resgate manual"});setProcessando(null);
    if(error)setMsg(error.message);else{setResgate(x=>({...x,[id]:""}));setMotivo(x=>({...x,[id]:""}));setMsg("Crédito resgatado e registrado no histórico.");carregar(empresaId)}
  }
  async function zerar(c:Cliente){
    const atual=cfg.modo==="cashback"?Number(c.fidelidade_credito||0):Number(c.fidelidade_saldo||0);
    if(atual<=0&&!c.fidelidade_cupom_disponivel)return setMsg("Este cliente já está com o saldo zerado.");
    if(!window.confirm(`Zerar o saldo de fidelidade de ${c.nome}? Esta ação ficará registrada no histórico.`))return;
    setProcessando(c.id);const{error}=await supabase.rpc("admin_zerar_fidelidade_cliente",{p_cliente_id:c.id,p_observacao:"Saldo zerado manualmente no painel"});setProcessando(null);
    if(error)setMsg(error.message);else{setMsg("Saldo zerado com sucesso.");carregar(empresaId)}
  }

  if(liberado!==true)return <main className="p-4 text-sm text-neutral-500">Verificando acesso...</main>;
  const lista=clientes.filter(c=>`${c.nome} ${c.cpf} ${c.whatsapp||c.telefone}`.toLowerCase().includes(busca.toLowerCase()));
  return <main className="min-h-screen bg-neutral-50 p-4"><div className="mx-auto max-w-5xl">
    <Link href="/admin" className="text-sm text-brand-700">← Voltar</Link><h1 className="mt-1 text-xl font-bold">Fidelidade · {empresaNome}</h1>
    {msg&&<div className="my-4 rounded-lg bg-white p-3 text-sm shadow-sm">{msg}</div>}
    <section className="my-5 rounded-xl border bg-white p-4"><div className="flex justify-between gap-3"><div><b>Configuração do programa</b><p className="text-xs text-neutral-500">Escolha entre meta de compras ou cashback em crédito.</p></div><label className="text-sm"><input type="checkbox" checked={cfg.ativo} onChange={e=>setCfg({...cfg,ativo:e.target.checked})}/> Ativo</label></div>
      <div className="mt-4 grid gap-3 md:grid-cols-2"><button onClick={()=>setCfg({...cfg,modo:"meta"})} className={`rounded-xl border p-4 text-left ${cfg.modo==="meta"?"border-brand-600 bg-brand-50":""}`}><b>Meta + recompensa</b><p className="text-xs text-neutral-500">Acumula compras até atingir uma meta.</p></button><button onClick={()=>setCfg({...cfg,modo:"cashback"})} className={`rounded-xl border p-4 text-left ${cfg.modo==="cashback"?"border-brand-600 bg-brand-50":""}`}><b>Cashback</b><p className="text-xs text-neutral-500">Uma porcentagem da compra vira crédito.</p></button></div>
      {cfg.modo==="meta"?<div className="mt-4 grid gap-3 md:grid-cols-3"><label className="text-xs">Meta (R$)<input type="number" step=".01" value={cfg.meta} onChange={e=>setCfg({...cfg,meta:Number(e.target.value)})} className="mt-1 w-full rounded border p-2"/></label><label className="text-xs">Recompensa<select value={cfg.tipo_recompensa} onChange={e=>setCfg({...cfg,tipo_recompensa:e.target.value as any})} className="mt-1 w-full rounded border p-2"><option value="percentual">Percentual</option><option value="fixo">Valor fixo</option></select></label><label className="text-xs">Valor<input type="number" step=".01" value={cfg.valor_recompensa} onChange={e=>setCfg({...cfg,valor_recompensa:Number(e.target.value)})} className="mt-1 w-full rounded border p-2"/></label></div>:<label className="mt-4 block max-w-sm text-xs">Percentual de cashback (%)<input type="number" min="0.01" max="100" step=".01" value={cfg.cashback_percentual} onChange={e=>setCfg({...cfg,cashback_percentual:Number(e.target.value)})} className="mt-1 w-full rounded border p-2"/><span className="mt-1 block text-neutral-500">Ex.: compra de R$ 100 com {cfg.cashback_percentual}% gera {brl(100*cfg.cashback_percentual/100)} de crédito.</span></label>}
      <button onClick={salvar} className="mt-4 rounded-lg bg-brand-700 px-5 py-2 text-sm font-semibold text-white">Salvar configuração</button>
    </section>
    <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar cliente por nome, CPF ou telefone" className="mb-4 w-full rounded-lg border bg-white px-3 py-2 text-sm"/>
    <div className="space-y-3">{lista.map(c=><section key={c.id} className="rounded-xl border bg-white p-4"><div className="flex flex-wrap justify-between gap-3"><div><b>{c.nome}</b><p className="text-xs text-neutral-500">{c.cpf} · {c.whatsapp||c.telefone}</p></div><div className="text-right">{cfg.modo==="cashback"?<><b className="text-green-700">{brl(Number(c.fidelidade_credito||0))} de crédito</b><p className="text-xs text-neutral-500">Disponível para resgate</p></>:<><b>{brl(Number(c.fidelidade_saldo||0))} / {brl(cfg.meta)}</b><p className="text-xs">{c.fidelidade_cupom_disponivel?"Recompensa liberada":"Acumulando compras"}</p></>}</div></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"><input value={valor[c.id]||""} onChange={e=>setValor(v=>({...v,[c.id]:e.target.value}))} placeholder="Valor da compra" className="rounded border p-2 text-sm"/><button disabled={!cfg.ativo||processando===c.id} onClick={()=>lancar(c.id)} className="rounded bg-brand-700 px-4 py-2 text-sm text-white disabled:opacity-40">Lançar compra</button></div>
      {cfg.modo==="cashback"&&Number(c.fidelidade_credito)>0&&<div className="mt-3 border-t pt-3"><p className="mb-2 text-xs font-semibold text-neutral-500">Resgate manual de cashback</p><div className="grid gap-2 sm:grid-cols-[140px_1fr_auto]"><input value={resgate[c.id]||""} onChange={e=>setResgate(v=>({...v,[c.id]:e.target.value}))} placeholder="Valor R$" className="rounded border p-2 text-sm"/><input value={motivo[c.id]||""} onChange={e=>setMotivo(v=>({...v,[c.id]:e.target.value}))} placeholder="Motivo / observação" className="rounded border p-2 text-sm"/><button disabled={processando===c.id} onClick={()=>resgatar(c.id)} className="rounded border px-4 py-2 text-sm font-semibold disabled:opacity-40">Resgatar</button></div></div>}
      <div className="mt-3 flex justify-end border-t pt-3"><button disabled={processando===c.id} onClick={()=>zerar(c)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-40">Zerar saldo</button></div>
    </section>)}</div>
  </div></main>;
}
