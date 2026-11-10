import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cepNaFaixa, limparCep } from "@/lib/regras-entrega";

export async function POST(req: Request) {
  try {
    const { empresaId, cep } = await req.json();
    const destinoCep = limparCep(cep);
    if (!empresaId || !/^\d{8}$/.test(destinoCep))
      return NextResponse.json(
        { error: "Informe um CEP válido." },
        { status: 400 },
      );
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key)
      return NextResponse.json(
        { error: "Validação de entrega indisponível." },
        { status: 503 },
      );
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
    const [empresa, cfg, modulo] = await Promise.all([
      db
        .from("empresas")
        .select("id")
        .eq("id", empresaId)
        .eq("ativo", true)
        .single(),
      db
        .from("configuracoes_loja")
        .select("valor")
        .eq("empresa_id", empresaId)
        .eq("chave", "entrega")
        .maybeSingle(),
      db.rpc("modulo_empresa_ativo", {
        p_empresa_id: empresaId,
        p_chave: "entrega_integrada",
      }),
    ]);
    if (empresa.error || !empresa.data)
      return NextResponse.json(
        { error: "Empresa não encontrada." },
        { status: 404 },
      );
    if (cfg.error || modulo.error)
      return NextResponse.json(
        { error: "Não foi possível conferir a área de entrega." },
        { status: 503 },
      );
    const config = cfg.data?.valor || {};
    const integrada =
      modulo.data === true &&
      config.integrada === true &&
      (config.uber_direct || config.ifood || config.entrega_99);
    if (!integrada && (!config.propria || !cepNaFaixa(destinoCep, config)))
      return NextResponse.json({
        valido: false,
        error: "Este CEP está fora da faixa de entrega da loja.",
      });
    const resposta = await fetch(
      `https://brasilapi.com.br/api/cep/v2/${destinoCep}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!resposta.ok)
      return NextResponse.json(
        { error: "CEP não encontrado." },
        { status: 404 },
      );
    const destino = await resposta.json();
    const coords = destino.location?.coordinates;
    const latitude = coords?.latitude == null ? NaN : Number(coords.latitude);
    const longitude =
      coords?.longitude == null ? NaN : Number(coords.longitude);
    const localizacaoValida =
      Number.isFinite(latitude) && Number.isFinite(longitude);
    if (integrada && !localizacaoValida)
      return NextResponse.json(
        { error: "Não foi possível localizar este CEP. Confira o endereço." },
        { status: 422 },
      );
    return NextResponse.json({
      valido: true,
      endereco: {
        cep: destino.cep || destinoCep,
        logradouro: destino.street || "",
        bairro: destino.neighborhood || "",
        cidade: destino.city || "",
        estado: destino.state || "",
      },
      geolocalizacao: localizacaoValida ? { latitude, longitude } : null,
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível validar o endereço." },
      { status: 503 },
    );
  }
}
