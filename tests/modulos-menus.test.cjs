const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function load(file, mocks = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require: name => mocks[name] ?? (name.startsWith("@/lib/")
      ? load(name.replace("@/", "") + ".ts", mocks) : require(name)),
    process: { env: {} },
  });
  return module.exports;
}

const Link = ({ children, href }) => React.createElement("a", { href }, children);
function hooks(liberado) {
  return {
    useEffect: () => {},
    useMemo: fn => fn(),
    useRef: () => ({ current: null }),
    useState: inicial => [typeof inicial === "boolean" ? liberado : inicial, () => {}],
  };
}
function mocks(liberado) {
  return {
    react: hooks(liberado),
    "next/link": { default: Link },
    "next/navigation": { useRouter: () => ({ replace() {} }) },
    "@/lib/supabase": { supabase: {} },
    "@/lib/empresa-admin": { getEmpresaAdminAtual: async () => null },
  };
}

test("menu da empresa oculta Fidelidade e Pedidos desativados e mostra os liberados", () => {
  for (const liberado of [false, true]) {
    const Page = load("app/admin/page.tsx", {
      ...mocks(liberado),
      "next/image": { default: () => null },
      "@/components/HistoricoPedidosAdmin": { default: () => null },
      "@/components/GruposAdicionaisAdmin": { default: () => null },
      "@/components/ListaProdutosAdmin": { default: () => null },
      "@/components/PlanilhaProdutosAdmin": { default: () => null },
    }).default;
    const html = renderToStaticMarkup(React.createElement(Page));
    assert.equal(html.includes('href="/admin/fidelidade"'), liberado);
    assert.equal(html.includes('href="/admin/pedidos"'), liberado);
  }
});

test("integrações oculta módulos desativados e mantém configuração para módulos liberados", () => {
  for (const liberado of [false, true]) {
    const base = mocks(liberado);
    const Formas = load("components/FormasPagamento.tsx", base).default;
    const Page = load("app/admin/integracoes/page.tsx", {
      ...base,
      "@/components/ConfirmacaoMercadoPago": { default: () => null },
      "@/components/FormasPagamento": { default: Formas },
    }).default;
    const html = renderToStaticMarkup(React.createElement(Page));
    for (const destino of ["whatsapp", "rastreamento", "ifood", "uber-direct"]) {
      assert.equal(html.includes(`href="/admin/integracoes/${destino}"`), liberado, destino);
    }
    assert.equal(html.includes("Pix (online)"), liberado);
    assert.equal(html.includes("Frete grátis"), liberado);
    assert.ok(html.includes("Retirada na loja"));
  }
});

test("atalho flutuante do iFood obedece ao módulo de entrega", () => {
  for (const liberado of [false, true]) {
    const Layout = load("app/admin/integracoes/layout.tsx", mocks(liberado)).default;
    const html = renderToStaticMarkup(React.createElement(Layout));
    assert.equal(html.includes('href="/admin/integracoes/ifood"'), liberado);
  }
});

test("acesso direto segue os mesmos módulos dos menus", () => {
  const { moduloDaRotaPainel } = load("lib/modulos-painel.ts");
  for (const [rota, modulo] of [
    ["/admin/fidelidade", "fidelidade"],
    ["/admin/pdv", "pedidos"],
    ["/admin/pedidos", "pedidos"],
    ["/admin/integracoes/whatsapp", "whatsapp_api"],
    ["/admin/integracoes/ifood", "entrega_integrada"],
    ["/admin/integracoes/uber-direct", "entrega_integrada"],
    ["/admin/integracoes/rastreamento", "tracking"],
    ["/admin/login", null], ["/admin", null], ["/admin/integracoes", null],
  ]) assert.equal(moduloDaRotaPainel(rota), modulo);
});
