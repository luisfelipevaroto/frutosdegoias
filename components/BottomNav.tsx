"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCarrinho } from "@/lib/carrinho-context";

const KEY = "frutos_cliente";

function IconInicio(){return <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10M9 21v-7h6v7"/></svg>}
function IconPedidos(){return <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/></svg>}
function IconPerfil(){return <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></svg>}
function IconCarrinho(){return <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L20.5 8H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>}

export default function BottomNav(){
 const path=usePathname();const {itens}=useCarrinho();const [cadastrado,setCadastrado]=useState(false);
 useEffect(()=>{try{setCadastrado(!!localStorage.getItem(KEY))}catch{}},[path]);
 if(path.startsWith('/admin')) return null;
 const qtd=itens.reduce((s,i)=>s+i.quantidade,0);const perfilHref=cadastrado?'/conta':'/cadastro';const perfilLabel=cadastrado?'Perfil':'Entrar';
 const ativo=(href:string)=>href==='/'?path==='/':path===href||path.startsWith(href+'/');
 const mobileItem=(href:string,label:string,icon:React.ReactNode)=><Link href={href} className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] ${ativo(href)?'text-brand-700':'text-neutral-500'}`}>{icon}<span>{label}</span></Link>;
 const desktopItem=(href:string,label:string,icon:React.ReactNode)=><Link href={href} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${ativo(href)?'bg-brand-50 text-brand-700':'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'}`}>{icon}<span>{label}</span></Link>;
 const cartIcon=<span className="relative"><IconCarrinho/>{qtd>0&&<span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-700 px-1 text-[9px] font-bold text-white">{qtd>99?'99+':qtd}</span>}</span>;
 return <>
  <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,.06)] backdrop-blur md:hidden"><div className="mx-auto flex max-w-md">{mobileItem('/','Início',<IconInicio/>)}{mobileItem('/pedidos','Pedidos',<IconPedidos/>)}{mobileItem(perfilHref,perfilLabel,<IconPerfil/>)}{mobileItem('/carrinho','Carrinho',cartIcon)}</div></nav>
  <nav className="fixed right-6 top-5 z-40 hidden items-center gap-1 rounded-2xl border border-neutral-200 bg-white/95 p-1.5 shadow-lg backdrop-blur md:flex">{desktopItem('/','Início',<IconInicio/>)}{desktopItem('/pedidos','Pedidos',<IconPedidos/>)}{desktopItem(perfilHref,perfilLabel,<IconPerfil/>)}{desktopItem('/carrinho','Carrinho',cartIcon)}</nav>
 </>;
}
