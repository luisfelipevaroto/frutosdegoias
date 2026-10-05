import { DashboardSuperadmin, metricasVazias, moduloEfetivo } from "@/lib/superadmin";
export const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const numero = (value: number) => value.toLocaleString("pt-BR");
export default function Dashboard({ dados, abrirEmpresa }: { dados: DashboardSuperadmin; abrirEmpresa: (id: string) => void }) {
  const ativas = dados.empresas.filter(e => e.ativo).length;
  const ranking = [...dados.empresas].sort((a, b) => (dados.porEmpresa[b.id]?.gmvMes || 0) - (dados.porEmpresa[a.id]?.gmvMes || 0)).slice(0, 5);
  const uso = dados.modulos.map(m => ({ ...m, total: dados.empresas.filter(e => moduloEfetivo(e, m.id, dados.empresaModulos, dados.planoModulos).ativo).length })).sort((a, b) => b.total - a.total);
  return <>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <Metrica titulo="Empresas ativas" valor={numero(ativas)} detalhe={`${dados.empresas.length - ativas} inativas · ${dados.empresas.length} no total`} destaque />
      <Metrica titulo="Pedidos no mês" valor={numero(dados.metricas.pedidosMes)} detalhe={`${numero(dados.metricas.pedidos)} pedidos em todo o histórico`} />
      <Metrica titulo="GMV do mês" valor={brl(dados.metricas.gmvMes)} detalhe="Valor dos pedidos, excluindo cancelados" destaque />
      <Metrica titulo="GMV acumulado" valor={brl(dados.metricas.gmv)} detalhe="Inclui entrega e pedidos com pagamento pendente" />
      <Metrica titulo="Clientes cadastrados" valor={numero(dados.clientes)} detalhe="Cadastros por loja; um cliente pode constar em mais de uma" />
      <Metrica titulo="Pedidos cancelados" valor={numero(dados.metricas.cancelados)} detalhe="Todo o histórico · incluídos na contagem de pedidos" />
    </div>
    <div className="mt-6 grid gap-5 xl:grid-cols-2">
      <section className="rounded-2xl border bg-white p-5 md:p-6"><h3 className="font-bold">Empresas em destaque</h3><p className="mt-1 text-xs text-neutral-500">Ordenadas pelo GMV deste mês</p><div className="mt-5 space-y-4">{ranking.map((e, index) => { const m = dados.porEmpresa[e.id] || metricasVazias(); return <button key={e.id} onClick={() => abrirEmpresa(e.id)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-neutral-50"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-xs font-bold text-neutral-500">{index + 1}</span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{e.nome}</b><span className="text-xs text-neutral-500">{numero(m.pedidosMes)} pedidos no mês</span></span><b className="text-sm">{brl(m.gmvMes)}</b></button>; })}{!ranking.length && <p className="text-sm text-neutral-500">Nenhuma empresa cadastrada.</p>}</div></section>
      <section className="rounded-2xl border bg-white p-5 md:p-6"><h3 className="font-bold">Distribuição dos módulos</h3><p className="mt-1 text-xs text-neutral-500">Empresas com o recurso liberado pelo plano ou por exceção</p><div className="mt-6 space-y-4">{uso.map(m => <div key={m.id}><div className="mb-1.5 flex justify-between gap-3 text-sm"><span>{m.nome}</span><span className="text-neutral-500">{m.total} / {dados.empresas.length}</span></div><div className="h-2 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${dados.empresas.length ? m.total / dados.empresas.length * 100 : 0}%` }} /></div></div>)}{!uso.length && <p className="text-sm text-neutral-500">Nenhum módulo disponível.</p>}</div></section>
    </div>
    <section className="mt-5 rounded-2xl border bg-white p-5 md:p-6"><h3 className="font-bold">Planos atuais</h3><p className="mt-1 text-xs text-neutral-500">Distribuição das empresas. Cobrança e assinaturas serão a próxima etapa.</p><div className="mt-4 flex flex-wrap gap-3">{dados.planos.map(p => <div key={p.id} className="min-w-40 rounded-xl border p-4"><p className="text-sm font-semibold">{p.nome}{!p.ativo && <span className="ml-2 text-xs text-neutral-400">Inativo</span>}</p><p className="mt-2 text-2xl font-bold">{dados.empresas.filter(e => e.plano_id === p.id).length}<span className="ml-2 text-xs font-normal text-neutral-500">empresas</span></p></div>)}<div className="min-w-40 rounded-xl bg-neutral-50 p-4"><p className="text-sm text-neutral-500">Sem plano</p><p className="mt-2 text-2xl font-bold">{dados.empresas.filter(e => !e.plano_id).length}</p></div></div></section>
  </>;
}
function Metrica({ titulo, valor, detalhe, destaque = false }: { titulo: string; valor: string; detalhe: string; destaque?: boolean }) {
  return <section className={`rounded-2xl border p-5 ${destaque ? "border-emerald-100 bg-[#eaf3ee]" : "bg-white"}`}><h3 className="text-sm text-neutral-600">{titulo}</h3><p className="mt-3 text-3xl font-bold tracking-tight">{valor}</p><p className="mt-3 text-xs leading-relaxed text-neutral-500">{detalhe}</p></section>;
}
