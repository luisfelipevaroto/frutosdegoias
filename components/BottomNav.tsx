"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCarrinho } from "@/lib/carrinho-context";

const KEY = "frutos_cliente";

function IconPedidos(){return <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/></svg>}
function IconPerfil(){return <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></svg>}
function IconCarrinho(){return <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L20.5 8H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>}

export default function BottomNav(){
 const path=usePathname();const {itens}=useCarrinho();const [cadastrado,setCadastrado]=useState(false);
 useEffect(()=>{try{setCadastrado(!!localStorage.getItem(KEY))}catch{}},[path]);
 if(path.startsWith('/admin')) return null;
 const qtd=itens.reduce((s,i)=>s+i.quantidade,0);
 const item=(href:string,label:string,icon:React.ReactNode)=><Link href={href} className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] ${path===href||path.startsWith(href+'/')?'text-brand-700':'text-neutral-500'}`}>{icon}<span>{label}</span></Link>;
 return <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,.06)] backdrop-blur md:hidden"><div className="mx-auto flex max-w-md">{item('/pedidos','Pedidos',<IconPedidos/>)}{item(cadastrado?'/conta':'/cadastro',cadastrado?'Perfil':'Entrar',<IconPerfil/>)}<Link href="/carrinho" className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] ${path.startsWith('/carrinho')?'text-brand-700':'text-neutral-500'}`}><span className="relative"><IconCarrinho/>{qtd>0&&<span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-700 px-1 text-[9px] font-bold text-white">{qtd>99?'99+':qtd}</span>}</span><span>Carrinho</span></Link></div></nav>;
}
