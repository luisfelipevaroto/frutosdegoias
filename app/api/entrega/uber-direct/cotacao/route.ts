import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function serverDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const db = serverDb();
    if (!db) return NextResponse.json({ error: "Servidor de entrega não configurado." }, { status: 503 });

    const input = await req.json();
    const empresaId = String(input?.empresaId || "");
    const endereco = String(input?.endereco || "").trim();
    if (!empresaId || !endereco) return NextResponse.json({ error: "Empresa e endereço são obrigatórios." }, { status: 400 });

    const [{ data: secretRows, error: secretError }, { data: empresa, error: empresaError }] = await Promise.all([
      db.rpc("credencial_uber_direct_backend", { p_empresa_id: empresaId }),
      db.from("empresas").select("id,nome,endereco,cep,cidade,estado,telefone").eq("id", empresaId).eq("ativo", true).single(),
    ]);
    if (secretError) return NextResponse.json({ error: "Configuração do Uber envio indisponível." }, { status: 500 });
    if (empresaError || !empresa) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });

    const secret = Array.isArray(secretRows) ? secretRows[0] : secretRows;
    if (!secret?.customer_id || !secret?.client_id || !secret?.client_secret) return NextResponse.json({ error: "Uber envio ainda não está conectado para esta empresa." }, { status: 400 });

    const origem = [empresa.endereco, empresa.cidade && `${empresa.cidade}/${empresa.estado || ""}`, empresa.cep && `CEP ${empresa.cep}`].filter(Boolean).join(" - ");
    if (!origem) return NextResponse.json({ error: "Cadastre o endereço da loja antes de usar o Uber envio." }, { status: 422 });

    const auth = await fetch("https://login.uber.com/oauth/v2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: secret.client_id, client_secret: secret.client_secret, grant_type: "client_credentials", scope: "eats.deliveries" }),
      cache: "no-store",
    });
    const authData = await auth.json();
    if (!auth.ok || !authData.access_token) return NextResponse.json({ error: "Falha ao autenticar o Uber envio." }, { status: 502 });

    const quoteResponse = await fetch(`https://api.uber.com/v1/customers/${encodeURIComponent(secret.customer_id)}/delivery_quotes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authData.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ pickup_address: origem, dropoff_address: endereco }),
      cache: "no-store",
    });
    const quote = await quoteResponse.json();
    if (!quoteResponse.ok) return NextResponse.json({ error: quote?.message || "Uber envio indisponível para este endereço." }, { status: 400 });

    return NextResponse.json({ nome: "Uber envio", provedor: "uber_direct", quoteId: quote.id, valor: Number(quote.fee || 0) / 100, moeda: quote.currency || "BRL", duracaoMinutos: quote.duration ? Math.ceil(Number(quote.duration) / 60) : null, expiraEm: quote.expires || null });
  } catch (error) {
    console.error("uber_quote_error", error);
    return NextResponse.json({ error: "Não foi possível calcular o Uber envio." }, { status: 500 });
  }
}
