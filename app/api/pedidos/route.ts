import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cliente, tipoEntrega, endereco, horarioRetirada, taxaEntrega, pagamento, itens } = body;
    if (!Array.isArray(itens) || itens.length === 0) return NextResponse.json({ error: "Carrinho vazio" }, { status: 400 });
    const { data, error } = await supabase.rpc("criar_pedido", {
      p_cliente: cliente ?? {},
      p_tipo_entrega: tipoEntrega,
      p_endereco_entrega: endereco ?? null,
      p_horario_retirada: horarioRetirada ?? null,
      p_taxa_entrega: Number(taxaEntrega ?? 0),
      p_forma_pagamento: pagamento,
      p_itens: itens.map((i:any) => ({ produto_id: i.produtoId, variacao_id: i.variacaoId || null, adicionais_ids: (i.adicionais ?? []).map((a:any)=>a.id), quantidade: i.quantidade }))
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, { status: 201 });
  } catch { return NextResponse.json({ error: "Requisição inválida" }, { status: 400 }); }
}
