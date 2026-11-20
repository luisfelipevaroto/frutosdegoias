const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const ts = require("typescript");

const moduleClientes = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "../lib/clientes-admin.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { module: moduleClientes, exports: moduleClientes.exports });
const { buscarClientesAdmin } = moduleClientes.exports;

function banco(resultado) {
  const chamadas = [];
  const consulta = {};
  for (const metodo of ["select", "eq", "or", "ilike", "order", "range"]) {
    consulta[metodo] = (...args) => { chamadas.push([metodo, ...args]); return consulta; };
  }
  consulta.then = resolve => resolve(resultado);
  return { db: { from: tabela => { chamadas.push(["from", tabela]); return consulta; } }, chamadas };
}

test("clientes de todos os tipos usam apenas a empresa autorizada e paginação estável", async () => {
  const dados = [{ id: "simples", cpf: null }, { id: "completo", cpf: "12345678909" }];
  const { db, chamadas } = banco({ data: dados, count: 82, error: null });
  const resultado = await buscarClientesAdmin(db, "empresa-autorizada", "", 1);
  assert.equal(resultado.clientes, dados);
  assert.equal(resultado.total, 82);
  assert.deepEqual(chamadas.filter(c => c[0] === "eq"), [["eq", "empresa_id", "empresa-autorizada"]]);
  assert.deepEqual(chamadas.filter(c => c[0] === "order"), [["order", "nome"], ["order", "id"]]);
  assert.deepEqual(chamadas.find(c => c[0] === "range"), ["range", 50, 99]);
  assert.equal(chamadas.some(c => c[0] === "or" || c[0] === "ilike"), false);
});

test("pesquisa nome como valor e escapa curingas; CPF e telefone aceitam máscara", async () => {
  const porNome = banco({ data: [], count: 0 });
  await buscarClientesAdmin(porNome.db, "empresa", 'Ana_%,outra.empresa', 0);
  assert.deepEqual(porNome.chamadas.find(c => c[0] === "ilike"), ["ilike", "nome", "%Ana\\_\\%,outra.empresa%"]);
  assert.equal(porNome.chamadas.some(c => c[0] === "or"), false);
  const porTelefone = banco({ data: [], count: 0 });
  await buscarClientesAdmin(porTelefone.db, "empresa", "(32) 99999-1234", 0);
  const filtro = porTelefone.chamadas.find(c => c[0] === "or")[1];
  for (const campo of ["cpf", "telefone", "whatsapp"]) assert.ok(filtro.includes(`${campo}.ilike.%32999991234%`));
});

test("falhas de consulta são exibidas como erro e empresa ausente não consulta clientes", async () => {
  const falha = banco({ data: null, error: { message: "erro interno" } });
  await assert.rejects(buscarClientesAdmin(falha.db, "empresa", "", 0), /Não foi possível carregar/);
  const vazio = banco({ data: [] });
  await assert.rejects(buscarClientesAdmin(vazio.db, "", "", 0), /Empresa não identificada/);
  assert.equal(vazio.chamadas.length, 0);
});
