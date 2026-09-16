"use client";

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {supabase} from '@/lib/supabase';
const KEY='frutos_cliente';

type Area={encontrado:boolean;cliente?:any;fidelidade?:any;pedidos?:any[];movimentos?:any[]};
const labels:Record<string,string>={recebido:'Recebido',em_preparo:'Em preparo',saiu_para_entrega:'Saiu para entrega',entregue:'Entregue'};
export default function Conta(){const [area,setArea]=useState<Area|null>(null);const [loading,setLoading]=useState(true);
 useEffect(()=>{(async()=>{try{const s=localStorage.getItem(KEY);if(!s){setLoading(false);return}const c=JSON.parse(s);const {data}=await supabase.rpc('area_cliente',{p_cpf:c.cpf,p_whatsapp:c.whatsapp});setArea(data as Area)}finally{setLoading(false)}})()},[]);
 if(loading)return <main className="mx-auto max-w-md p-4 pb-24"><p className="text-sm text-neutral-500">Carregando sua conta...</p></main>;
 if(!area?.encontrado)return <main className="mx-auto max-w-md p-4 pb-24"><h1 className="text-xl font-bold">Minha conta</h1><p className="mt-2 text-sm text-neutral-500">Entre com seu cadastro para acompanhar pedidos e fidelidade.</p><Link href="/cadastro" className="mt-4 block rounded-lg bg-brand-700 p-3 text-center font-medium text-white">Entrar / cadastrar</Link></main>;
 const f=area.fidelidade;const pct=Math.min(100,Math.round((Number(f?.saldo||0)/Number(f?.meta||100))*100));
 return <main className="mx-auto max-w-md p-4 pb-24"><div className="mb-5 flex items-start justify-between"><div><p className="text-xs text-neutral-500">Olá,</p><h1 className="text-xl font-bold">{area.cliente?.nome}</h1><p className="text-xs text-neutral-500">{area.cliente?.whatsapp}</p></div><Link href="/cadastro" className="text-sm text-brand-700">Editar perfil</Link></div>
 {f?.ativo&&<section className="mb-5 rounded-2xl bg-brand-700 p-4 text-white"><div className="flex justify-between"><div><p className="text-xs opacity-80">Programa de fidelidade</p><h2 className="mt-1 text-lg font-bold">{f.cupom_disponivel?'Você ganhou 10% OFF 🎉':`R$ ${Number(f.saldo||0).toFixed(2)} acumulados`}</h2></div><span className="text-2xl">★</span></div>{!f.cupom_disponivel&&<><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/25"><div className="h-full rounded-full bg-white" style={{width:`${pct}%`}}/></div><p className="mt-2 text-xs opacity-80">Faltam R$ {Math.max(0,Number(f.meta||100)-Number(f.saldo||0)).toFixed(2)} para liberar 10% de desconto.</p></>}{f.cupom_disponivel&&<p className="mt-2 text-xs opacity-90">Seu benefício está disponível para o próximo pedido.</p>}</section>}
 <section><div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Pedidos recentes</h2><Link href="/pedidos" className="text-xs text-brand-700">Ver todos</Link></div>{(area.pedidos??[]).length===0?<div className="rounded-xl border bg-white p-4 text-sm text-neutral-500">Você ainda não possui pedidos.</div>:(area.pedidos??[]).slice(0,3).map(p=><Link href={`/pedido/${p.numero}`} key={p.id} className="mb-2 block rounded-xl border bg-white p-4"><div className="flex justify-between"><b>Pedido #{p.numero}</b><b>R$ {Number(p.valor_total).toFixed(2)}</b></div><div className="mt-2 flex justify-between text-xs text-neutral-500"><span>{new Date(p.criado_em).toLocaleDateString('pt-BR')}</span><span className="rounded-full bg-neutral-100 px-2 py-1">{labels[p.status_pedido]??p.status_pedido}</span></div></Link>)}</section>
 </main>}
