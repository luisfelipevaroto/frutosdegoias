"use client";
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';

const KEY='frutos_cliente';
type Cadastro={nome:string;cpf:string;whatsapp:string;endereco:string};
const vazio:Cadastro={nome:'',cpf:'',whatsapp:'',endereco:''};
export default function CadastroPage(){const router=useRouter();const [f,setF]=useState(vazio);const [msg,setMsg]=useState('');
 useEffect(()=>{try{const s=localStorage.getItem(KEY);if(s)setF({...vazio,...JSON.parse(s)})}catch{}},[]);
 function salvar(e:React.FormEvent){e.preventDefault();if(!f.nome.trim()||!f.cpf.trim()||!f.whatsapp.trim()){setMsg('Preencha nome, CPF e WhatsApp.');return;} localStorage.setItem(KEY,JSON.stringify(f));setMsg('Cadastro salvo neste aparelho.');setTimeout(()=>router.push('/checkout'),500)}
 return <main className="mx-auto max-w-md p-4"><h1 className="mb-1 text-xl font-bold">Seu cadastro</h1><p className="mb-5 text-sm text-neutral-500">Usaremos seus dados nos pedidos e no programa de fidelidade. O endereço é necessário somente para entrega.</p><form onSubmit={salvar} className="space-y-3"><input required value={f.nome} onChange={e=>setF({...f,nome:e.target.value})} placeholder="Nome completo" className="w-full rounded-lg border p-3"/><input required value={f.cpf} onChange={e=>setF({...f,cpf:e.target.value})} placeholder="CPF" inputMode="numeric" className="w-full rounded-lg border p-3"/><input required value={f.whatsapp} onChange={e=>setF({...f,whatsapp:e.target.value})} placeholder="WhatsApp" inputMode="tel" className="w-full rounded-lg border p-3"/><textarea value={f.endereco} onChange={e=>setF({...f,endereco:e.target.value})} placeholder="Endereço de entrega (rua, número, complemento e bairro)" className="min-h-24 w-full rounded-lg border p-3"/><button className="w-full rounded-lg bg-brand-700 py-3 font-medium text-white">Salvar cadastro e continuar</button>{msg&&<p className="text-sm text-brand-700">{msg}</p>}</form></main>}
