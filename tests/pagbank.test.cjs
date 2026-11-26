const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const crypto = require("node:crypto");
const QRCode = require("qrcode");

function load(file, mocks = {}, extra = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    module, exports: module.exports, require: name => mocks[name] ?? require(name),
    process: { env: { SUPABASE_SERVICE_ROLE_KEY: "fixture", NEXT_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co" } },
    Buffer, URL, Request, AbortSignal, console: { error() {} }, ...extra,
  });
  return module.exports;
}
class Reply {
  constructor(body, options = {}) { this.body = body; this.status = options.status ?? 200; }
  static json(body, options) { return new Reply(body, options); }
}
const id = "8333409a-a50d-4174-b8f4-0ad9253be6ec";
const pedido = {
  id, numero: 99, empresa_id: "empresa",
  valor_total: 6.9, status_pagamento: "pendente", status_pedido: "recebido",
  forma_pagamento: "pix", provedor_pagamento: "pagbank", pagamento_externo_id: null,
};
const order = {
  id: "ORDE_fixture", reference_id: id,
  qr_codes: [{ amount: { value: 690 }, text: "pix-fixture-to-render" }],
};
function banco(p = { ...pedido }) {
  const filtros = [];
  let gravacoes = 0;
  return {
    filtros, get gravacoes() { return gravacoes; },
    db: {
      from(tabela) {
        let gravando = false;
        const q = {
          select: () => q, is: () => q,
          eq: (campo, valor) => { filtros.push([tabela, campo, valor]); return q; },
          update: valor => { gravacoes++; gravando = true; Object.assign(p, valor); return q; },
          single: async () => ({ data: p, error: null }),
          maybeSingle: async () => ({
            data: tabela === "integracoes_credenciais"
              ? { ambiente: "producao", credenciais: { token: "fixture-token" } }
              : { valor: { pix_online: true } }, error: null,
          }),
          then: resolve => resolve({ data: gravando ? [{ id }] : [], error: null }),
        };
        return q;
      },
      rpc: async () => ({ data: [{ provedor: "pagbank", ativo: true }], error: null }),
    },
  };
}
function rota(b, api) {
  return load("app/api/pagamentos/pagbank/pix/route.ts", {
    "next/server": { NextResponse: Reply },
    "@supabase/supabase-js": { createClient: () => b.db },
    "@/lib/pagbank/server": api,
    "@/lib/pagamentos": { pagamentoPermitido: () => true },
    qrcode: QRCode,
  });
}
function requisicao(cpf = "12345678909") {
  return new Request("https://frutos-de-goias-jf.vercel.app/api/pagamentos/pagbank/pix", {
    method: "POST", body: JSON.stringify({ pedidoId: id, email: "fixture@example.com", cpf }),
  });
}
const server = load("lib/pagbank/server.ts");
test("API PagBank usa produção, idempotência e identifica liberação sem revelar dados do gateway", async () => {
  let enviado;
  const api = load("lib/pagbank/server.ts", {}, {
    fetch: async (url, options) => {
      enviado = { url, options };
      return { ok: false, status: 403, json: async () => ({ error_messages: [{
        error: "ACCESS_DENIED", description: "whitelist access required. Customer secret@example.com",
      }] }) };
    },
  });
  await assert.rejects(api.criarPedidoPagBank({ token: "fixture-token", ambiente: "producao" }, {}, id), error => {
    assert.equal(error.status, 403);
    assert.equal(error.liberacaoNecessaria, true);
    assert.equal(error.message.includes("secret"), false);
    return true;
  });
  assert.equal(enviado.url, "https://api.pagseguro.com/orders");
  assert.equal(enviado.options.headers["x-idempotency-key"], id);
});

test("Pix gera imagem PNG e copia e cola, e repetição consulta a mesma cobrança", async () => {
  const b = banco();
  let criacoes = 0, consultas = 0;
  const api = { ...server,
    criarPedidoPagBank: async (_c, payload, chave) => {
      criacoes++;
      assert.equal(chave, id);
      assert.equal(payload.qr_codes[0].amount.value, 690);
      return order;
    },
    consultarPedidoPagBank: async () => { consultas++; return order; },
  };
  const route = rota(b, api);
  for (let i = 0; i < 2; i++) {
    const resposta = await route.POST(requisicao());
    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.ambiente, "producao");
    assert.equal(resposta.body.qrCode, order.qr_codes[0].text);
    assert.ok(resposta.body.qrCodeBase64.startsWith("data:image/png;base64,iVBOR"));
  }
  assert.equal(criacoes, 1);
  assert.equal(consultas, 1);
  assert.equal(b.gravacoes, 1);
  assert.ok(b.filtros.some(([t, k, v]) => t === "pedidos" && k === "empresa_id" && v === "empresa"));
});

test("CPF inválido, pedido cancelado e resposta divergente não vinculam cobrança", async () => {
  for (const caso of ["cpf", "cancelado", "valor", "referencia"]) {
    const b = banco({ ...pedido, status_pedido: caso === "cancelado" ? "cancelado" : "recebido" });
    const route = rota(b, { ...server, criarPedidoPagBank: async () => ({
      ...order, reference_id: caso === "referencia" ? "outra" : id,
      qr_codes: [{ text: "fixture", amount: { value: caso === "valor" ? 691 : 690 } }],
    }) });
    const resposta = await route.POST(requisicao(caso === "cpf" ? "123" : undefined));
    assert.equal(resposta.status, caso === "cpf" ? 400 : caso === "cancelado" ? 409 : 502);
    assert.equal(b.gravacoes, 0);
  }
});

test("recusa de produção informa ambiente correto e liberação quando identificada", async () => {
  for (const liberacao of [false, true]) {
    const route = rota(banco(), { ...server, criarPedidoPagBank: async () => {
      throw new server.PagBankApiError(403, "fixture", liberacao);
    } });
    const resposta = await route.POST(requisicao());
    assert.equal(resposta.status, 502);
    assert.ok(resposta.body.error.includes("produção"));
    assert.ok(!resposta.body.error.includes("Sandbox"));
    assert.equal(resposta.body.codigo, liberacao ? "PAGBANK_LIBERACAO_NECESSARIA" : "PAGBANK_HTTP_403");
  }
});

test("webhook verifica assinatura ECDSA e confirma referência e valor na API antes de marcar pago", async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  for (const caso of ["pago", "assinatura", "valor", "referencia", "pendente"]) {
    let gravacoes = 0;
    const db = {
      from(tabela) {
        const q = {
          select: () => q, eq: () => q,
          maybeSingle: async () => ({ data: tabela === "pedidos"
            ? { ...pedido, pagamento_externo_id: order.id }
            : { ambiente: "producao", credenciais: { token: "fixture" } } }),
          update: () => { gravacoes++; return q; },
          then: resolve => resolve({ error: null }),
        };
        return q;
      },
    };
    const route = load("app/api/pagamentos/pagbank/webhook/route.ts", {
      "next/server": { NextResponse: Reply },
      "@supabase/supabase-js": { createClient: () => db },
      "@/lib/pagbank/server": { consultarPedidoPagBank: async () => ({
        ...order, reference_id: caso === "referencia" ? "outro" : id,
        charges: [{ status: caso === "pendente" ? "WAITING" : "PAID", amount: { value: caso === "valor" ? 1 : 690 } }],
      }) },
    }, { fetch: async () => ({ ok: true, json: async () => ({
      public_key: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
    }) }) });
    const raw = JSON.stringify({ id: order.id, charges: [{ status: "PAID" }] });
    const assinatura = crypto.sign("sha256", Buffer.from(raw), privateKey).toString("base64");
    const resposta = await route.POST(new Request("https://example.test", {
      method: "POST", body: raw, headers: { "x-payload-signature": caso === "assinatura" ? "invalid" : assinatura },
    }));
    assert.equal(gravacoes, caso === "pago" ? 1 : 0);
    assert.equal(resposta.status, caso === "assinatura" ? 401 : caso === "referencia" ? 409 : 200);
  }
});
