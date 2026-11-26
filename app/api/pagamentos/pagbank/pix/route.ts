import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { toDataURL } from "qrcode";
import { criarPedidoPagBank, consultarPedidoPagBank, PagBankApiError } from "@/lib/pagbank/server";
import { pagamentoPermitido } from "@/lib/pagamentos";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let ambiente: "producao" | "sandbox" | null = null;
  try {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) return NextResponse.json({ error: "Pagamento indisponível." }, { status: 503 });
    const { pedidoId, email, cpf } = await req.json();
    const documento = String(cpf || "").replace(/\D/g, "");
    if (!/^[0-9a-f-]{36}$/i.test(String(pedidoId || "")) ||
        !/^\S+@\S+\.\S+$/.test(String(email || "").trim()) || documento.length !== 11) {
      return NextResponse.json({ error: "Informe pedido, CPF e e-mail válidos." }, { status: 400 });
    }
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } });
    const { data: pedido, error: erroPedido } = await db.from("pedidos")
      .select("id,numero,empresa_id,valor_total,status_pagamento,status_pedido,forma_pagamento,provedor_pagamento,pagamento_externo_id")
      .eq("id", pedidoId).single();
    if (erroPedido || !pedido || pedido.provedor_pagamento !== "pagbank" || pedido.forma_pagamento !== "pix" ||
        pedido.status_pagamento !== "pendente" || pedido.status_pedido === "cancelado") {
      return NextResponse.json({ error: "Pedido indisponível para Pix." }, { status: 409 });
    }
    const [config, status, credencial] = await Promise.all([
      db.from("configuracoes_loja").select("valor").eq("empresa_id", pedido.empresa_id).eq("chave", "pagamentos").maybeSingle(),
      db.rpc("status_pagamento_online", { p_empresa_id: pedido.empresa_id }),
      db.from("integracoes_credenciais").select("ambiente,credenciais").eq("empresa_id", pedido.empresa_id)
        .eq("provedor", "pagbank").eq("pagamento_conectado", true).maybeSingle(),
    ]);
    if (config.error || status.error || credencial.error ||
        !pagamentoPermitido(config.data?.valor, status.data || [], "pix", true) || !credencial.data) {
      return NextResponse.json({ error: "PagBank não está ativo." }, { status: 409 });
    }
    ambiente = credencial.data.ambiente === "producao" ? "producao" : "sandbox";
    const token = (credencial.data.credenciais as { token?: string })?.token?.trim();
    if (!token) return NextResponse.json({ error: "Credencial não configurada." }, { status: 503 });
    const credenciais = { token, ambiente };
    const valor = Math.round(Number(pedido.valor_total) * 100);
    if (!Number.isSafeInteger(valor) || valor < 100) {
      return NextResponse.json({ error: "O Pix PagBank requer um pedido de pelo menos R$ 1,00." }, { status: 400 });
    }
    const anterior = String(pedido.pagamento_externo_id || "");
    if (anterior && !/^ORDE_[a-zA-Z0-9-]+$/.test(anterior)) {
      return NextResponse.json({ error: "Referência de pagamento inválida. Contate a loja." }, { status: 409 });
    }
    const order = anterior
      ? await consultarPedidoPagBank<any>(credenciais, anterior)
      : await criarPedidoPagBank<any>(credenciais, {
          reference_id: pedido.id,
          customer: { name: "Cliente delivery", email: String(email).trim(), tax_id: documento },
          items: [{ reference_id: pedido.id, name: "Pedido delivery", quantity: 1, unit_amount: valor }],
          qr_codes: [{ amount: { value: valor } }],
          notification_urls: [new URL("/api/pagamentos/pagbank/webhook", req.url).toString()],
        }, pedido.id);
    const qr = order.qr_codes?.[0] || order.charges?.[0]?.qr_code;
    if (!/^ORDE_[a-zA-Z0-9-]+$/.test(String(order.id || "")) ||
        order.reference_id !== pedido.id || (anterior && order.id !== anterior) ||
        Number(qr?.amount?.value ?? order.charges?.[0]?.amount?.value) !== valor) {
      return NextResponse.json({ error: "PagBank retornou uma cobrança divergente. Contate a loja." }, { status: 502 });
    }
    const codigo = qr?.text;
    if (typeof codigo !== "string" || !codigo.trim()) {
      return NextResponse.json({ error: "PagBank não retornou o código Pix. Confira a chave Pix e a habilitação da conta." }, { status: 502 });
    }
    if (!anterior) {
      const salvo = await db.from("pedidos").update({ pagamento_externo_id: order.id, provedor_pagamento: "pagbank" })
        .eq("id", pedido.id).eq("empresa_id", pedido.empresa_id).eq("status_pagamento", "pendente")
        .is("pagamento_externo_id", null).select("id");
      if (salvo.error) return NextResponse.json({ error: "Cobrança gerada, mas não foi possível vincular ao pedido. Tente novamente." }, { status: 503 });
      if (!salvo.data?.length) {
        const atual = await db.from("pedidos").select("pagamento_externo_id,status_pagamento,status_pedido")
          .eq("id", pedido.id).eq("empresa_id", pedido.empresa_id).single();
        if (atual.error || atual.data?.pagamento_externo_id !== order.id ||
            atual.data?.status_pagamento !== "pendente" || atual.data?.status_pedido === "cancelado") {
          return NextResponse.json({ error: "O pedido mudou durante a geração do Pix. Consulte seus pedidos." }, { status: 409 });
        }
      }
    }
    const imagem = await toDataURL(codigo, { width: 320, margin: 2, errorCorrectionLevel: "M" });
    return NextResponse.json({
      orderId: order.id, pedidoNumero: pedido.numero, qrCode: codigo, qrCodeBase64: imagem,
      ambiente: ambiente === "sandbox" ? "teste" : "producao",
    });
  } catch (erro) {
    if (erro instanceof PagBankApiError) {
      const nomeAmbiente = ambiente === "producao" ? "produção" : "teste (Sandbox)";
      console.error("PagBank Pix gateway HTTP", erro.status, erro.liberacaoNecessaria ? "liberacao_necessaria" : "recusa");
      const mensagem = erro.liberacaoNecessaria
        ? `A conta PagBank precisa de liberação para a API de Pedidos com Pix em ${nomeAmbiente}. Contate o suporte PagBank.`
        : erro.status === 401
          ? `PagBank recusou o token de ${nomeAmbiente}. Confira a credencial no painel da loja.`
          : erro.status === 403
            ? `PagBank negou o acesso à API em ${nomeAmbiente}. Verifique o token e a liberação da conta para Pix.`
            : erro.status === 400 || erro.status === 422
              ? "PagBank recusou os dados da cobrança Pix. Verifique CPF, chave Pix e habilitação da conta."
              : "PagBank indisponível no momento. Tente novamente.";
      return NextResponse.json({
        error: mensagem, codigo: erro.liberacaoNecessaria ? "PAGBANK_LIBERACAO_NECESSARIA" : `PAGBANK_HTTP_${erro.status}`,
      }, { status: 502 });
    }
    console.error("PagBank Pix falha", erro instanceof Error ? erro.name : "erro desconhecido");
    return NextResponse.json({ error: "Falha técnica ao gerar o Pix PagBank.", codigo: "PAGBANK_ERRO_INTERNO" }, { status: 502 });
  }
}
