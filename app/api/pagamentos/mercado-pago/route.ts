import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {pagamentoPermitido} from '@/lib/pagamentos';

export async function POST(req: Request) {
  try {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "Pagamento online não configurado no servidor." },
        { status: 503 }
      );
    }

    const { pedidoId } = await req.json();
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);

    const { data: pedido } = await db
      .from("pedidos")
      .select("id,numero,empresa_id,valor_total,forma_pagamento,provedor_pagamento,status_pagamento,status_pedido,pagamento_url")
      .eq("id", pedidoId)
      .single();

    if (!pedido) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }

    if(pedido.status_pagamento==='pago'||pedido.status_pedido==='cancelado')return NextResponse.json({error:'Pedido pago ou cancelado.'},{status:409});
    const [config,status]=await Promise.all([db.from('configuracoes_loja').select('valor').eq('empresa_id',pedido.empresa_id).eq('chave','pagamentos').maybeSingle(),db.rpc('status_pagamento_online',{p_empresa_id:pedido.empresa_id})]);
    if(config.error||status.error||pedido.provedor_pagamento!=='mercado_pago'||pedido.forma_pagamento!=='cartao'||!pagamentoPermitido(config.data?.valor,status.data??[],'cartao',true))return NextResponse.json({error:'Cartão de crédito online indisponível.'},{status:400});
    if(pedido.pagamento_url)return NextResponse.json({url:pedido.pagamento_url});

    const { data: credencial } = await db
      .from("integracoes_credenciais")
      .select("credenciais,ambiente")
      .eq("empresa_id", pedido.empresa_id)
      .eq("provedor", "mercado_pago")
      .eq("pagamento_conectado",true)
      .single();

    if (!credencial) {
      return NextResponse.json(
        { error: "Mercado Pago não conectado para esta empresa." },
        { status: 400 }
      );
    }

    const token = (credencial.credenciais as { access_token?: string } | null)?.access_token;
    if (!token) {
      return NextResponse.json(
        { error: "Mercado Pago não conectado para esta empresa." },
        { status: 400 }
      );
    }

    const origin = process.env.MERCADO_PAGO_APP_URL || new URL(req.url).origin;

    const body = {
      items: [
        {
          id: pedido.id,
          title: `Pedido #${pedido.numero}`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: Number(pedido.valor_total),
        },
      ],
      external_reference: pedido.id,
      back_urls: {
        success: `${origin}/pedido/${pedido.numero}?pagamento=sucesso`,
        pending: `${origin}/pedido/${pedido.numero}?pagamento=pendente`,
        failure: `${origin}/pedido/${pedido.numero}?pagamento=erro`,
      },
      auto_return: "approved",
      payment_methods:{excluded_payment_types:['ticket','bank_transfer','debit_card','prepaid_card','atm','account_money'].map(id=>({id}))},
      notification_url: `${origin}/api/pagamentos/mercado-pago/webhook`,
    };

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || "Erro ao criar pagamento." },
        { status: 400 }
      );
    }

    const paymentUrl =
      credencial.ambiente === "teste"
        ? data.sandbox_init_point || data.init_point
        : data.init_point;

    const saved=await db
      .from("pedidos")
      .update({
        provedor_pagamento: "mercado_pago",
        pagamento_externo_id: data.id,
        pagamento_url: paymentUrl,
        status_pagamento: "pendente",
      })
      .eq("id", pedido.id)
      .eq("empresa_id", pedido.empresa_id);
    if(saved.error)return NextResponse.json({error:'Não foi possível registrar o pagamento.'},{status:503});

    return NextResponse.json({ url: paymentUrl });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível iniciar o pagamento." },
      { status: 400 }
    );
  }
}
