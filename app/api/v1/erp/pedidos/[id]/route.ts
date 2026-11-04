import { NextResponse } from 'next/server';
import { autorizarErp, erpError } from '@/lib/erp-api-auth';
import { erpJson, erpUuid } from '@/lib/erp-pedidos';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };
export async function GET(req: Request, context: Ctx) {
  try {
    const access = await autorizarErp(req);
    if (access instanceof NextResponse) return access;
    const { id } = await context.params;
    if (!erpUuid.test(id)) return erpError(400, 'ID de pedido invalido');
    const { data: pedido, error: pedidoError } = await access.db.from('pedidos')
      .select('id,numero,cliente_id,tipo_entrega,endereco_entrega,horario_retirada,taxa_entrega,forma_pagamento,status_pagamento,status_pedido,valor_total,criado_em,desconto_fidelidade,observacoes,troco_para,precisa_troco,origem_pedido,provedor_entrega')
      .eq('empresa_id', access.empresaId).eq('id', id).maybeSingle();
    if (pedidoError) throw pedidoError;
    if (!pedido) return erpError(404, 'Pedido nao encontrado');
    const { data: itens, error: itensError } = await access.db.from('itens_pedido')
      .select('id,produto_id,variacao_id,adicionais_ids,quantidade,preco_unitario')
      .eq('empresa_id', access.empresaId).eq('pedido_id', id).order('id');
    if (itensError) throw itensError;
    const productIds = [...new Set((itens ?? []).map(i => i.produto_id).filter(Boolean))];
    const variationIds = [...new Set((itens ?? []).map(i => i.variacao_id).filter(Boolean))];
    const additionIds = [...new Set((itens ?? []).flatMap(i => i.adicionais_ids ?? []))];
    const [clienteResult, produtosResult, variacoesResult, adicionaisResult] = await Promise.all([
      pedido.cliente_id ? access.db.from('clientes').select('id,nome,telefone,whatsapp,endereco').eq('empresa_id', access.empresaId).eq('id', pedido.cliente_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      productIds.length ? access.db.from('produtos').select('id,nome').eq('empresa_id', access.empresaId).in('id', productIds) : Promise.resolve({ data: [], error: null }),
      variationIds.length ? access.db.from('variacoes').select('id,nome,produto_id').in('id', variationIds) : Promise.resolve({ data: [], error: null }),
      additionIds.length ? access.db.from('adicionais').select('id,nome,preco').eq('empresa_id', access.empresaId).in('id', additionIds) : Promise.resolve({ data: [], error: null })
    ]);
    if (clienteResult.error || produtosResult.error || variacoesResult.error || adicionaisResult.error) throw new Error('ERP_LOOKUP_FAILED');
    const products = new Map((produtosResult.data ?? []).map(p => [p.id, p]));
    const variations = new Map((variacoesResult.data ?? []).map(v => [v.id, v]));
    const additions = new Map((adicionaisResult.data ?? []).map(a => [a.id, a]));
    return erpJson({
      data: {
        ...pedido,
        cliente: clienteResult.data,
        itens: (itens ?? []).map(item => ({
          id: item.id,
          produto_id: item.produto_id,
          produto_nome_atual: products.get(item.produto_id)?.nome ?? null,
          variacao_id: item.variacao_id,
          variacao_nome_atual: item.variacao_id ? variations.get(item.variacao_id)?.nome ?? null : null,
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          adicionais: (item.adicionais_ids ?? []).map((aid: string) => ({
            id: aid,
            nome_atual: additions.get(aid)?.nome ?? null,
            preco_atual: additions.get(aid)?.preco ?? null
          }))
        }))
      },
      aviso: 'Nomes e precos de adicionais consultados do catalogo atual podem diferir dos existentes na data do pedido.'
    });
  } catch { return erpError(503, 'Servico temporariamente indisponivel'); }
}
