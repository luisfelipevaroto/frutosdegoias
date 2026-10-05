"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export type GrupoAdmin={id:string;nome:string;gratis:boolean;minimo:number;maximo:number|null;ativo:boolean;adicionais:{id:string;nome:string;preco:number;ativo:boolean}[]};
type ItemForm={id?:string;nome:string;preco:string;ativo:boolean};
type Form={id?:string;nome:string;gratis:boolean;minimo:string;maximo:string;ativo:boolean;itens:ItemForm[]};
const novoItem=():ItemForm=>({nome:"",preco:"",ativo:true});
const novoGrupo=():Form=>({nome:"",gratis:true,minimo:"1",maximo:"3",ativo:true,itens:[novoItem()]});
const moeda=(n:number)=>Number(n).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

export default function GruposAdicionaisAdmin({empresaId,grupos,atualizado}:{empresaId:string;grupos:GrupoAdmin[];atualizado:()=>Promise<void>}) {
  const [form,setForm]=useState<Form>(novoGrupo),[salvando,setSalvando]=useState(false),[erro,setErro]=useState(""),[sucesso,setSucesso]=useState("");
  function editar(g:GrupoAdmin){setErro("");setSucesso("");setForm({id:g.id,nome:g.nome,gratis:g.gratis,minimo:String(g.minimo),maximo:String(g.maximo??3),ativo:g.ativo,itens:g.adicionais.map(a=>({...a,preco:String(a.preco)}))});}
  function atualizarItem(i:number,patch:Partial<ItemForm>){setForm(f=>({...f,itens:f.itens.map((a,n)=>n===i?{...a,...patch}:a)}));}
  async function salvar(e:React.FormEvent){
    e.preventDefault();setErro("");setSucesso("");
    const min=form.gratis?Number(form.minimo):1,max=form.gratis?Number(form.maximo):null;
    if(!form.nome.trim())return setErro("Informe o título do grupo.");
    if(!Number.isInteger(min)||min<1||min>100||(max!==null&&(!Number.isInteger(max)||max<min||max>100)))return setErro("O mínimo deve ser pelo menos 1 e o máximo deve ser maior ou igual ao mínimo (até 100).");
    if(form.itens.length>100)return setErro("Cada grupo pode ter até 100 itens.");
    if(form.ativo&&form.itens.filter(a=>a.ativo).length<min)return setErro("Cadastre itens ativos suficientes para o mínimo obrigatório.");
    if(form.itens.some(a=>!a.nome.trim()||(!form.gratis&&(a.preco===""||!Number.isFinite(Number(a.preco))||Number(a.preco)<0||Number(a.preco)>999999.99))))return setErro("Informe o nome e, nos grupos pagos, um preço válido para cada item.");
    setSalvando(true);
    try {
      const {error}=await supabase.rpc("salvar_grupo_adicionais",{p_empresa_id:empresaId,p_id:form.id??null,p_nome:form.nome.trim(),p_gratis:form.gratis,p_minimo:min,p_maximo:max,p_ativo:form.ativo,p_itens:form.itens.map(a=>({id:a.id??null,nome:a.nome.trim(),preco:form.gratis?0:Number(a.preco),ativo:a.ativo}))});
      if(error)throw new Error(error.code==="23505"?"Já existe um grupo com este título.":error.message);
      setForm(novoGrupo());setSucesso("Grupo salvo. Vincule-o aos produtos na aba Produtos.");await atualizado();
    }catch(e){setErro(e instanceof Error?e.message:"Não foi possível salvar o grupo.");}finally{setSalvando(false);}
  }
  return <div className="grid items-start gap-5 lg:grid-cols-[430px_1fr]">
    <form onSubmit={salvar} className="rounded-xl border bg-white p-4">
      <h2 className="mb-2 font-semibold">{form.id?"Editar grupo de adicionais":"Novo grupo de adicionais"}</h2>
      <p className="mb-4 text-xs text-neutral-500">Cada grupo vinculado ao produto exige pelo menos uma escolha do cliente.</p>
      {erro&&<p role="alert" className="mb-3 rounded bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      {sucesso&&<p role="status" className="mb-3 rounded bg-green-50 p-3 text-sm text-green-700">{sucesso}</p>}
      <fieldset disabled={salvando} className="space-y-3 disabled:opacity-60">
        <label className="block text-sm">Título<input required maxLength={100} placeholder="Ex.: Frutas, Complementos, Adicionais" value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} className="mt-1 w-full rounded border p-2"/></label>
        <label className="block text-sm">Itens grátis?<select value={form.gratis?"sim":"nao"} onChange={e=>setForm({...form,gratis:e.target.value==="sim"})} className="mt-1 w-full rounded border p-2"><option value="sim">Sim</option><option value="nao">Não</option></select></label>
        {form.gratis?<div className="grid grid-cols-2 gap-3"><label className="text-sm">Mínimo de itens<input required type="number" min={1} max={100} step={1} value={form.minimo} onChange={e=>setForm({...form,minimo:e.target.value})} className="mt-1 w-full rounded border p-2"/></label><label className="text-sm">Máximo de itens grátis<input required type="number" min={Number(form.minimo)||1} max={100} step={1} value={form.maximo} onChange={e=>setForm({...form,maximo:e.target.value})} className="mt-1 w-full rounded border p-2"/></label></div>:<p className="rounded bg-neutral-50 p-3 text-xs text-neutral-600">Escolha mínima: 1 item. Cada item soma seu preço ao carrinho, sem limite máximo de escolhas.</p>}
        <div className="border-t pt-3"><h3 className="mb-2 text-sm font-semibold">Itens (subprodutos)</h3><div className="max-h-80 space-y-3 overflow-y-auto pr-1">{form.itens.map((a,i)=><div key={a.id??`novo-${i}`} className="rounded-lg border p-3"><label className="block text-xs">Nome do item<input required maxLength={100} value={a.nome} onChange={e=>atualizarItem(i,{nome:e.target.value})} className="mt-1 w-full rounded border p-2 text-sm"/></label>{!form.gratis&&<label className="mt-2 block text-xs">Valor do item (R$)<input required type="number" min={0} max={999999.99} step="0.01" value={a.preco} onChange={e=>atualizarItem(i,{preco:e.target.value})} className="mt-1 w-full rounded border p-2 text-sm"/></label>}<div className="mt-2 flex items-center justify-between"><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={a.ativo} onChange={e=>atualizarItem(i,{ativo:e.target.checked})}/>Item ativo</label><button type="button" onClick={()=>setForm(f=>({...f,itens:f.itens.filter((_,n)=>n!==i)}))} className="text-xs text-red-700">Remover</button></div></div>)}</div><button type="button" disabled={form.itens.length>=100} onClick={()=>setForm(f=>({...f,itens:[...f.itens,novoItem()]}))} className="mt-3 rounded border px-3 py-2 text-sm disabled:opacity-40">+ Adicionar item</button></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.ativo} onChange={e=>setForm({...form,ativo:e.target.checked})}/>Grupo ativo</label>
        <button disabled={!empresaId} className="w-full rounded bg-brand-700 p-2 text-white disabled:opacity-40">{salvando?"Salvando...":"Salvar grupo"}</button>
        {form.id&&<button type="button" onClick={()=>{setForm(novoGrupo());setErro("");setSucesso("");}} className="w-full rounded border p-2 text-sm">Cancelar edição</button>}
      </fieldset>
    </form>
    <div className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Grupos cadastrados</h2>{!grupos.length&&<p className="mt-3 text-sm text-neutral-500">Crie um grupo e seus itens para começar.</p>}<div className="mt-3 max-h-[70vh] space-y-3 overflow-y-auto">{grupos.map(g=><div key={g.id} className="rounded-lg border p-3"><div className="flex items-start justify-between gap-3"><div><h3 className="break-words font-semibold">{g.nome} {!g.ativo&&<span className="text-xs font-normal text-neutral-500">(inativo)</span>}</h3><p className="mt-1 text-xs text-neutral-500">{g.gratis?`${g.minimo} a ${g.maximo} itens grátis`:"Mínimo 1 item · pagos"}</p></div><button type="button" disabled={salvando} onClick={()=>editar(g)} className="shrink-0 rounded border px-3 py-1 text-sm disabled:opacity-40">Editar</button></div><ul className="mt-2 text-sm text-neutral-600">{g.adicionais.map(a=><li key={a.id} className="py-1">{a.nome} · {g.gratis?"Grátis":moeda(a.preco)}{!a.ativo?" (inativo)":""}</li>)}</ul></div>)}</div></div>
  </div>;
}
