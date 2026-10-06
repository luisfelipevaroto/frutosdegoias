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
const produtosAdmin = load('lib/produtos-admin.ts');
const producao=load('lib/producao.ts');
test('production text preserves free text exactly and translates existing preset codes',()=>{
  assert.equal(producao.textoProducao('30_40'),'de 30 a 40 min');
  assert.equal(producao.textoProducao('40_50'),'de 40 a 50 min');
  assert.equal(producao.textoProducao('ate_1h'),'Em até 1h');
  assert.equal(producao.textoProducao('mais_1h'),'Estamos com alto volume de pedidos, previsão de mais de 1h para entrega.');
  for(const text of ['30_40','mais_1h','Preparo: 25–35 minutos\nRetirada: aguarde a confirmação.','  De 20 a 30 min  ','constructor','<b>35 minutos</b>'])assert.equal(producao.textoProducao(text,true),text);
  assert.equal(producao.textoProducao(null),'');
});
const grupos = load('lib/grupos-adicionais.ts');
const frutas={id:'frutas',nome:'Frutas',gratis:true,minimo:1,maximo:3,itens:[1,2,3,4].map(n=>({id:`f${n}`,nome:`Fruta ${n}`,preco:10}))};
const pagos={id:'pagos',nome:'Adicionais',gratis:false,minimo:1,maximo:null,itens:[1,2,3,4].map(n=>({id:`p${n}`,nome:`Pago ${n}`,preco:4}))};
test('free groups lock at the maximum, allow deselection and never charge selected items',()=>{
  let selected=[];for(const item of frutas.itens)selected=grupos.alternarItemGrupo(frutas,item,selected);
  assert.equal(selected.length,3);assert.equal(selected.reduce((s,a)=>s+a.preco,0),0);
  selected=grupos.alternarItemGrupo(frutas,frutas.itens[0],selected);assert.equal(selected.length,2);
  selected=grupos.alternarItemGrupo(frutas,frutas.itens[3],selected);assert.equal(selected.length,3);assert.ok(selected.some(a=>a.id==='f4'));
});
test('every linked group enforces its minimum; paid choices add their own prices without a maximum',()=>{
  assert.match(grupos.validarSelecaoGrupos([frutas,pagos],[]),/Frutas/);
  let selected=grupos.alternarItemGrupo(frutas,frutas.itens[0],[]);
  assert.match(grupos.validarSelecaoGrupos([frutas,pagos],selected),/Adicionais/);
  for(const item of pagos.itens)selected=grupos.alternarItemGrupo(pagos,item,selected);
  assert.equal(grupos.validarSelecaoGrupos([frutas,pagos],selected),'');assert.equal(selected.reduce((s,a)=>s+a.preco,0),16);
  assert.match(grupos.validarSelecaoGrupos([{...frutas,minimo:2}],selected),/2 itens/);
  assert.match(grupos.validarSelecaoGrupos([frutas],frutas.itens),/máximo/);
  assert.equal(grupos.validarSelecaoGrupos([],[]),'');
});
test('product pages fetch twenty items with tenant scope and stable order',async()=>{
  const calls=[];const source=Array.from({length:47},(_,i)=>({id:String(i),nome:`Produto ${i}`,variacoes:[],produto_adicionais:[]}));
  const query={select:(fields,options)=>{assert.equal(options.count,'exact');assert.ok(fields.includes('variacoes'));return query;},eq:(key,value)=>{calls.push([key,value]);return query;},order:key=>{calls.push(['order',key]);return query;},range:async(from,to)=>({data:source.slice(from,to+1),count:source.length,error:null})};
  const db={from:table=>{assert.equal(table,'produtos');return query;}};
  const first=await produtosAdmin.buscarProdutosAdmin(db,'tenant','',0),next=await produtosAdmin.buscarProdutosAdmin(db,'tenant','',20),last=await produtosAdmin.buscarProdutosAdmin(db,'tenant','',40);
  assert.equal(first.produtos.length,20);assert.equal(next.produtos[0].id,'20');assert.equal(last.produtos.length,7);assert.equal(first.total,47);
  assert.deepEqual(calls.slice(0,4),[['empresa_id','tenant'],['order','categoria'],['order','nome'],['order','id']]);
});
test('product search runs in the database, escapes wildcard input and surfaces failures',async()=>{
  let pattern;const query={select:()=>query,eq:()=>query,ilike:(column,value)=>{assert.equal(column,'nome');pattern=value;return query;},order:()=>query,range:async()=>({data:[{id:'beyond-first-page'}],count:1,error:null})};
  assert.equal((await produtosAdmin.buscarProdutosAdmin({from:()=>query},'tenant','  Sorvete  ',0)).produtos[0].id,'beyond-first-page');assert.equal(pattern,'%Sorvete%');
  await produtosAdmin.buscarProdutosAdmin({from:()=>query},'tenant','50%_\\',0);assert.equal(pattern,'%50\\%\\_\\\\%');
  query.range=async()=>({data:null,error:{message:'failure'}});await assert.rejects(produtosAdmin.buscarProdutosAdmin({from:()=>query},'tenant','',0),/carregar os produtos/);
});
const comercial = load('lib/superadmin-comercial.ts');
const uuid='11111111-1111-4111-8111-111111111111';
const subscription={acao:'salvar_assinatura',empresa_id:uuid,plano_id:uuid,plano_versao:1,valor_mensal:29.90,status:'trial',inicio:'2026-10-05',fim_teste:'2026-10-12',vencimento:'',notas:'',versao:0};
test('commercial inputs reject invalid dates, money and forged actor; preserve cents',()=>{
  const clean=comercial.validarComercial({...subscription,autor:'forged'});
  assert.equal(clean.dados.valor_mensal,29.90);assert.equal(clean.dados.autor,undefined);
  for(const change of [{valor_mensal:29.999},{valor_mensal:NaN},{fim_teste:'2026-02-30'},{fim_teste:'2026-10-04'},{status:'ativa'},{status:'toString'},{plano_versao:-1}])assert.throws(()=>comercial.validarComercial({...subscription,...change}));
  assert.equal(comercial.somarDias('2026-12-28',7),'2027-01-04');
});
test('subscription totals distinguish contracted active revenue from trials and cancellations',()=>{
  const summary=comercial.resumoAssinaturas([{...subscription,status:'ativa',valor_mensal:49.90,vencimento:'2026-10-04'},{...subscription,status:'ativa',valor_mensal:29.90,vencimento:'2026-10-06'},{...subscription,status:'trial',valor_mensal:99.90},{...subscription,status:'cancelada',valor_mensal:99.90},{...subscription,status:'atrasada',valor_mensal:99.90}],'2026-10-05');
  assert.equal(summary.mrr,79.8);assert.equal(summary.ativas,2);assert.equal(summary.testes,1);assert.equal(summary.pendencias,2);
});
test('commercial routes deny access before parsing input or reading private records',async()=>{
  const route=load('app/api/superadmin/comercial/route.ts',{'next/server':next,'@/lib/superadmin-comercial':comercial,'@/lib/superadmin-server':{autorizarSuperadmin:async()=>NextResponse.json({}, {status:403}),resposta:(data,status=200)=>NextResponse.json(data,{status})}});
  for(const method of ['GET','POST'])assert.equal((await route[method](new Request('http://localhost',{method}))).status,403);
});
test('commercial writes use verified actor and report stale versions as conflicts',async()=>{
  let args;
  const route=load('app/api/superadmin/comercial/route.ts',{'next/server':next,'@/lib/superadmin-comercial':comercial,'@/lib/superadmin-server':{autorizarSuperadmin:async()=>({userId:'verified',db:{rpc:async(name,input)=>{args=input;assert.equal(name,'superadmin_salvar_comercial');return{error:{code:'40001',message:'Atualize o painel'}};}}}),resposta:(data,status=200)=>NextResponse.json(data,{status})}});
  const res=await route.POST(new Request('http://localhost',{method:'POST',body:JSON.stringify({...subscription,p_autor:'forged'})}));
  assert.equal(res.status,409);assert.equal(args.p_autor,'verified');assert.equal(args.p_dados.p_autor,undefined);
});
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

