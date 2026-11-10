const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

function load(file, mocks = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports, require: n => mocks[n] ??
      (n.startsWith('@/') ? load(n.replace('@/', '') + '.ts', mocks) : require(n)),
    process: {env: {SUPABASE_SERVICE_ROLE_KEY:'fixture', NEXT_PUBLIC_SUPABASE_URL:'https://fixture.supabase.co'}},
    URL, Request, AbortSignal, console
  });
  return module.exports;
}
const regras = load('lib/regras-entrega.ts');
const pagamentos = load('lib/pagamentos.ts');
const config = { cep_inicio: '36680-001', cep_fim: '36689-999', frete_gratis_ativo: true, frete_gratis_minimo: 50 };

test('CEP range includes both boundaries, rejects outside and missing configuration', () => {
  assert.equal(regras.cepNaFaixa('36680001', config), true);
  assert.equal(regras.cepNaFaixa('36689-999', config), true);
  for (const cep of ['36680000', '36690000', '', '3668000'])
    assert.equal(regras.cepNaFaixa(cep, config), false);
  assert.equal(regras.cepNaFaixa('36680001', {}), false);
  assert.equal(regras.cepNaFaixa('36680001', {cep_inicio:'36689999',cep_fim:'36680001'}), false);
});

test('free shipping requires module, switch, and discounted product threshold', () => {
  assert.equal(regras.freteGratisAplicavel(config, true, 50), true);
  assert.equal(regras.freteGratisAplicavel(config, true, 49.99), false);
  assert.equal(regras.freteGratisAplicavel(config, false, 500), false);
  assert.equal(regras.freteGratisAplicavel({...config, frete_gratis_ativo:false}, true, 500), false);
  assert.equal(regras.freteGratisAplicavel({...config, frete_gratis_minimo:-1}, true, 50), false);
});

test('offline card and manual Pix are limited to pickup, independent of online credentials', () => {
  const cfg = {pix_manual:true,cartao_retirada:true};
  assert.equal(pagamentos.pagamentoPermitido(cfg, [], 'pix', false, 'retirada'), true);
  assert.equal(pagamentos.pagamentoPermitido(cfg, [], 'cartao', false, 'retirada'), true);
  assert.equal(pagamentos.pagamentoPermitido(cfg, [], 'pix', false, 'entrega'), false);
  assert.equal(pagamentos.pagamentoPermitido(cfg, [], 'cartao', false, 'entrega'), false);
  assert.equal(pagamentos.pagamentoPermitido(cfg, [], 'pix', true, 'retirada'), false);
});

test('CEP API denies outside range before calling external lookup', async () => {
  class ResponseMock { static json(body, opts={}) { return {body,status:opts.status??200}; } }
  let lookups = 0;
  const db = {from(table) {const q={select:()=>q,eq:()=>q,single:async()=>({data:{id:'fixture'}}),maybeSingle:async()=>({data:{valor:{...config,propria:true}}})};return q;},
    rpc:async()=>({data:false})};
  // The outside-range path must stop before any network request.
  const route = load('app/api/entrega/validar/route.ts', {
    'next/server':{NextResponse:ResponseMock},
    '@supabase/supabase-js':{createClient:()=>db},
    '@/lib/regras-entrega':regras,
  });
  const result = await route.POST(new Request('https://fixture.test',{method:'POST',body:JSON.stringify({empresaId:'fixture',cep:'36690000'})}));
  assert.equal(result.body.valido,false);
});

test('receipt uses tenant, category, additions, free delivery and pickup payment', () => {
  const React = require('react'), {renderToStaticMarkup} = require('react-dom/server');
  const C = load('components/CupomPedido.tsx', {'@/lib/pagamentos':pagamentos}).default;
  const html = renderToStaticMarkup(React.createElement(C, {
    empresa:{nome:'ArtBel Burguer',endereco:'Rua da empresa',cidade:'São João Nepomuceno',estado:'MG'},
    pedido:{numero:1,criado_em:'2026-11-10T12:00:00Z',tipo_entrega:'retirada',forma_pagamento:'pix',valor_total:50,tempo_producao:'30 minutos'},
    itens:[{id:'item',quantidade:1,preco_unitario:50,produto_nome:'Hambúrguer',categoria_nome:'Lanches',adicionais:[{id:'a',nome:'Queijo'}]}],
  }));
  for (const text of ['ArtBel Burguer','Rua da empresa','Lanches','Queijo','Pix manual no balcão','30 minutos','10.25pt'])
    assert.ok(html.includes(text),text);
  assert.ok(!html.includes('FRUTOS DE GOIÁS'));
});
