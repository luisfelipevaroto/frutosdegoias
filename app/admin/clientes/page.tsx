"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getEmpresaAdminAtual } from "@/lib/empresa-admin";
import { buscarClientesAdmin, CLIENTES_POR_PAGINA, type ClienteAdmin } from "@/lib/clientes-admin";

const dataCadastro = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" });

export default function Clientes() {
  const router = useRouter();
  const [empresa, setEmpresa] = useState<{ id: string; nome: string } | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState({ termo: "", pagina: 0 });
  const [clientes, setClientes] = useState<ClienteAdmin[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [revisao, setRevisao] = useState(0);

  useEffect(() => {
    let ativo = true;
    async function identificar() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!ativo) return;
        if (!user) { router.replace("/admin/login"); return; }
        const atual = await getEmpresaAdminAtual(user.id);
        if (!ativo) return;
        if (!atual) throw new Error("Seu usuário não possui acesso administrativo a esta empresa.");
        setEmpresa({ id: atual.id, nome: atual.nome });
      } catch (e) {
        if (ativo) {
          setErro(e instanceof Error ? e.message : "Não foi possível identificar a empresa.");
          setCarregando(false);
        }
      }
    }
    void identificar();
    return () => { ativo = false; };
  }, [router, revisao]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const termo = busca.trim();
      setFiltro(atual => atual.termo === termo ? atual : { termo, pagina: 0 });
    }, 300);
    return () => clearTimeout(timer);
  }, [busca]);

  useEffect(() => {
    if (!empresa) return;
    let ativo = true;
    setCarregando(true);
    setErro("");
    setClientes([]);
    buscarClientesAdmin(supabase, empresa.id, filtro.termo, filtro.pagina)
      .then(resultado => {
        if (!ativo) return;
        setClientes(resultado.clientes);
        setTotal(resultado.total);
      })
      .catch(e => {
        if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível carregar os clientes.");
      })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [empresa?.id, filtro, revisao]);

  const buscando = busca.trim() !== filtro.termo;
  const ocupado = carregando || buscando;
  const paginas = Math.max(1, Math.ceil(total / CLIENTES_POR_PAGINA));

  return (
    <main className="min-h-screen bg-neutral-50 p-4">
      <div className="mx-auto max-w-6xl">
        <Link href="/admin" className="text-sm text-brand-700">← Voltar ao painel</Link>
        <h1 className="mt-2 text-xl font-bold">Clientes{empresa && ` · ${empresa.nome}`}</h1>
        <p className="mt-1 text-sm text-neutral-500">Clientes cadastrados na loja online e no PDV.</p>
        <section className="mt-5 overflow-hidden rounded-xl border bg-white">
          <div className="space-y-3 border-b p-4">
            <label className="block text-sm font-medium">
              Buscar por nome, CPF ou telefone
              <input type="search" maxLength={150} value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Digite o nome, CPF ou telefone" className="mt-1 w-full rounded-lg border p-2.5 font-normal" />
            </label>
            <p aria-live="polite" className="text-sm text-neutral-500">
              {ocupado ? "Carregando clientes…" : erro ? "" : `${total} ${total === 1 ? "cliente" : "clientes"}${filtro.termo ? " encontrados" : " cadastrados"}`}
            </p>
          </div>
          {erro ? (
            <div role="alert" className="p-4 text-sm text-red-700">
              <p>{erro}</p>
              <button type="button" onClick={() => setRevisao(v => v + 1)} className="mt-3 rounded border px-3 py-2 text-neutral-700">Tentar novamente</button>
            </div>
          ) : ocupado ? (
            <p role="status" className="p-6 text-center text-sm text-neutral-500">Carregando clientes…</p>
          ) : clientes.length === 0 ? (
            <p className="p-6 text-center text-sm text-neutral-500">{filtro.termo ? "Nenhum cliente encontrado para esta pesquisa." : "Nenhum cliente cadastrado."}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Clientes cadastrados nesta empresa</caption>
                <thead className="bg-neutral-50 text-xs text-neutral-600">
                  <tr>{["Nome", "Telefone / WhatsApp", "CPF", "Cadastro", "Data do cadastro"].map(titulo => <th key={titulo} scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">{titulo}</th>)}</tr>
                </thead>
                <tbody className="divide-y">
                  {clientes.map(cliente => (
                    <tr key={cliente.id}>
                      <td className="min-w-44 break-words px-4 py-3 font-medium">{cliente.nome}</td>
                      <td className="whitespace-nowrap px-4 py-3">{cliente.whatsapp || cliente.telefone || "Não informado"}</td>
                      <td className="whitespace-nowrap px-4 py-3">{cliente.cpf || "Não informado"}</td>
                      <td className="px-4 py-3">{cliente.cpf ? "Completo" : "Simples"}</td>
                      <td className="whitespace-nowrap px-4 py-3">{dataCadastro.format(new Date(cliente.criado_em))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!erro && total > CLIENTES_POR_PAGINA && (
            <nav aria-label="Páginas de clientes" className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm">
              <button type="button" disabled={ocupado || filtro.pagina === 0} onClick={() => setFiltro(atual => ({ ...atual, pagina: atual.pagina - 1 }))} className="rounded border px-3 py-2 disabled:opacity-40">Anterior</button>
              <span>Página {filtro.pagina + 1} de {paginas}</span>
              <button type="button" disabled={ocupado || filtro.pagina + 1 >= paginas} onClick={() => setFiltro(atual => ({ ...atual, pagina: atual.pagina + 1 }))} className="rounded border px-3 py-2 disabled:opacity-40">Próxima</button>
            </nav>
          )}
        </section>
      </div>
    </main>
  );
}
