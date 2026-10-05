const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');

// Execute the actual TypeScript modules; no production credentials or writes.
function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: name => mocks[name] ?? require(name),
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public', SUPABASE_SERVICE_ROLE_KEY: 'server-secret' } },
    console, Intl, Date, Request });
  return module.exports;
}
const core = load('lib/superadmin.ts');
class NextResponse {
  constructor(data, options) { this.data = data; this.status = options.status; this.headers = options.headers; }
  static json(data, options) { return new NextResponse(data, options); }
}
const next = { NextResponse };

test('GMV excludes canceled orders and uses the São Paulo month boundary', () => {
  const total = core.metricasVazias(), companies = {};
  core.acumularPedidos([
    { empresa_id: 'a', valor_total: '10.10', status_pedido: 'entregue', criado_em: '2026-10-01T02:59:59Z' },
    { empresa_id: 'a', valor_total: '20.20', status_pedido: 'pendente', criado_em: '2026-10-01T03:00:00Z' },
    { empresa_id: 'b', valor_total: '100', status_pedido: 'cancelado', criado_em: '2026-10-05T12:00:00Z' },
    { empresa_id: null, valor_total: '.10', status_pedido: 'entregue', criado_em: '2026-10-05T12:00:00Z' },
  ], '2026-10', total, companies);
  assert.equal(total.pedidos, 4); assert.equal(total.pedidosMes, 3); assert.equal(total.cancelados, 1);
  assert.equal(total.gmv, 30.4); assert.equal(total.gmvMes, 20.3);
  assert.equal(companies.a.gmvMes, 20.2); assert.equal(companies.b.gmv, 0);
});
test('company override false wins over enabled plan; missing plan is disabled', () => {
  const company = { id: 'a', plano_id: 'p' };
  const plans = [{ plano_id: 'p', modulo_id: 'm', ativo: true }];
  assert.equal(core.moduloEfetivo(company, 'm', [], plans).ativo, true);
  assert.equal(core.moduloEfetivo(company, 'm', [{ empresa_id: 'a', modulo_id: 'm', ativo: false }], plans).ativo, false);
  assert.equal(core.moduloEfetivo({ id: 'b', plano_id: null }, 'm', [], plans).ativo, false);
});
const form = { nome: 'Loja', slug: 'loja', dominio_principal: 'loja.example.com', ativo: false, telefone: '', whatsapp: '', endereco: '', cidade: '', estado: 'mg', cep: '' };
test('company validation rejects unsafe domains and whitelists writable fields', () => {
  for (const domain of ['https://example.com', 'example.com/path', 'javascript:alert(1)', 'example.com@evil.test']) {
    assert.throws(() => core.validarEmpresa({ ...form, dominio_principal: domain }));
  }
  assert.throws(() => core.validarEmpresa({ ...form, ativo: 'true' }));
  assert.throws(() => core.validarEmpresa({ ...form, nome: '' }));
  const result = core.validarEmpresa({ ...form, plano_id: 'injected', configuracoes: { admin: true } });
  assert.equal(result.ativo, false); assert.equal(result.status, 'suspensa'); assert.equal(result.estado, 'MG');
  assert.equal(result.plano_id, undefined); assert.equal(result.configuracoes, undefined);
});

function server(permission = true, validUser = true) {
  const calls = [];
  const api = load('lib/superadmin-server.ts', { 'next/server': next, '@supabase/supabase-js': {
    createClient(url, key) { calls.push(key); return {
      auth: { getUser: async () => ({ data: { user: validUser ? { id: 'user' } : null }, error: null }) },
      rpc: async () => ({ data: permission, error: null }),
    }; }
  } });
  return { api, calls };
}
test('privileged client is never created for absent, invalid or unauthorized sessions', async () => {
  for (const [permission, user, auth, expected] of [[true, true, null, 401], [true, false, 'Bearer fake', 401], [false, true, 'Bearer fake', 403], [null, true, 'Bearer fake', 403]]) {
    const { api, calls } = server(permission, user);
    const result = await api.autorizarSuperadmin(new Request('http://localhost/api/superadmin', { headers: auth ? { Authorization: auth } : {} }));
    assert.equal(result.status, expected); assert.ok(!calls.includes('server-secret'));
    assert.equal(result.headers['Cache-Control'], 'private, no-store');
  }
});
test('verified Superadmin receives privileged client only after permission check', async () => {
  const { api, calls } = server();
  const result = await api.autorizarSuperadmin(new Request('http://localhost', { headers: { Authorization: 'Bearer fake' } }));
  assert.equal(result.userId, 'user'); assert.deepEqual(calls, ['public', 'server-secret']);
});
test('pagination reads over 1,000 rows even when server caps each page at 500', async () => {
  const { api } = server();
  const source = Array.from({ length: 1501 }, (_, i) => ({ i }));
  let consumed = 0;
  const rows = await api.paginar(async (start, end) => ({ data: source.slice(start, Math.min(end + 1, start + 500)), error: null }), batch => { consumed += batch.length; });
  assert.equal(consumed, 1501); assert.equal(rows.length, 0);
  await assert.rejects(api.paginar(async () => ({ data: null, error: { message: 'unavailable' } })), /unavailable/);
});

function routeWith(db) {
  return load('app/api/superadmin/route.ts', { 'next/server': next, '@/lib/superadmin': core,
    '@/lib/superadmin-server': { ...server().api, autorizarSuperadmin: async () => ({ db, userId: 'u' }) }
  });
}
test('dashboard only selects credential metadata and fails closed on incomplete queries', async () => {
  const selections = [];
  const db = { from(table) {
    const query = { select(fields) { selections.push([table, fields]); return query; },
      order() { return query; }, eq() { return query; }, lte() { return query; },
      range: async () => ({ data: [], error: null }), then(resolve) { return Promise.resolve({ count: 0, error: null }).then(resolve); }
    }; return query;
  } };
  const route = routeWith(db);
  const response = await route.GET(new Request('http://localhost'));
  assert.equal(response.status, 200);
  assert.equal(response.data.clientes, 0);
  const credentials = selections.find(([table]) => table === 'integracoes_credenciais')[1];
  assert.equal(credentials, 'empresa_id,provedor,ambiente,atualizado_em');
  assert.ok(selections.every(([, fields]) => !fields.includes('*') && !fields.includes('configuracoes') && !fields.includes('cpf')));
});
test('company edit uses optimistic locking and reports duplicate/conflict writes', async () => {
  const filters = [];
  let result = { data: null, error: null };
  let payload;
  const query = { update(value) { payload = value; return query; }, eq(key, value) { filters.push([key, value]); return query; }, select() { return query; }, maybeSingle: async () => result };
  const route = routeWith({ from: () => query });
  const input = { ...form, id: '00000000-0000-0000-0000-000000000001', atualizado_em: '2026-10-05T12:00:00Z', plano_id: 'injected' };
  function req() { return new Request('http://localhost', { method: 'PATCH', body: JSON.stringify(input) }); }
  assert.equal((await route.PATCH(req())).status, 409);
  assert.deepEqual(filters.slice(0, 2), [['id', input.id], ['atualizado_em', input.atualizado_em]]);
  assert.equal(payload.plano_id, undefined);
  result = { data: null, error: { code: '23505' } };
  assert.equal((await route.PATCH(req())).status, 409);
  result = { data: { id: input.id }, error: null };
  assert.equal((await route.PATCH(req())).status, 200);
});

test('a failed dataset does not produce a partial dashboard with zero totals', async () => {
  const query = { select() { return query; }, order() { return query; }, eq() { return query; }, lte() { return query; },
    range: async () => ({ data: null, error: { message: 'test failure' } }),
    then(resolve) { return Promise.resolve({ count: 0, error: null }).then(resolve); } };
  const response = await routeWith({ from: () => query }).GET(new Request('http://localhost'));
  assert.equal(response.status, 500); assert.equal(response.data.metricas, undefined);
});
test('every route stops before database access when authorization is denied', async () => {
  let reads = 0;
  const route = load('app/api/superadmin/route.ts', { 'next/server': next, '@/lib/superadmin': core,
    '@/lib/superadmin-server': { ...server().api, autorizarSuperadmin: async () => {
      reads++; return NextResponse.json({ error: 'denied' }, { status: 403 });
    } }
  });
  for (const method of ['GET', 'POST', 'PATCH']) {
    const response = await route[method](new Request('http://localhost', { method }));
    assert.equal(response.status, 403);
  }
  assert.equal(reads, 3);
});

test('platform login checks Superadmin permission without resolving a tenant', async () => {
  const login = load('lib/superadmin-login.ts');
  const calls = [];
  await login.entrarSuperadmin({
    auth: { signInWithPassword: async input => { calls.push(input.email); return { data: { user: { id: 'u' } }, error: null }; }, signOut: async () => { throw new Error('unexpected signout'); } },
    rpc: async name => { calls.push(name); return { data: true, error: null }; },
    from: () => { throw new Error('tenant lookup must not occur'); },
  }, ' user@example.com ', 'test-password');
  assert.deepEqual(calls, ['user@example.com', 'is_super_admin']);
});
test('platform login revokes local session on permission denial or permission lookup failure', async () => {
  const login = load('lib/superadmin-login.ts');
  for (const permission of [{ data: false, error: null }, { data: null, error: { message: 'failure' } }]) {
    let signedOut = 0;
    await assert.rejects(login.entrarSuperadmin({
      auth: { signInWithPassword: async () => ({ data: { user: { id: 'u' } }, error: null }), signOut: async options => { assert.equal(options.scope, 'local'); signedOut++; return { error: null }; } },
      rpc: async () => permission,
    }, 'user@example.com', 'test-password'), /permissão|acesso/);
    assert.equal(signedOut, 1);
  }
});
test('invalid platform credentials never reach the permission check', async () => {
  const login = load('lib/superadmin-login.ts');
  await assert.rejects(login.entrarSuperadmin({
    auth: { signInWithPassword: async () => ({ data: { user: null }, error: { message: 'invalid' } }) },
    rpc: () => { throw new Error('must not check permission'); },
  }, 'user@example.com', 'wrong-password'), /inválidos/);
});
