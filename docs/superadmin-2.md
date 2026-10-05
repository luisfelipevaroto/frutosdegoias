# Superadmin 2.0 — etapa 1

## Entrega

`/superadmin` passa a ter dashboard global e gestão de empresas com busca por
nome, slug ou domínio, filtros por situação e plano, cadastro e edição de dados
básicos. O botão de painel abre o domínio da empresa e exige o login dela;
não é impersonação. Um cadastro novo não provisiona usuário, catálogo ou plano.

Os módulos preservam a RPC `super_admin_definir_modulo`: exceções da empresa
prevalecem sobre os módulos herdados do plano, inclusive quando desativadas.
Os cards de integrações mostram separadamente liberação do módulo, cadastro
ativo/inativo, existência de credencial e ambiente. Não inferem conexão,
integridade das credenciais ou saúde do provedor. Valores de credenciais,
configurações, CPF e dados de clientes não são selecionados nem enviados.

## Métricas

- Empresas ativas usam `empresas.ativo`, a flag operacional atual. Divergência
  com `status` aparece na gestão; salvar sincroniza ativa/suspensa com a flag.
- Pedidos totais e do mês incluem cancelados. Cancelados têm contador próprio.
- GMV soma `valor_total` de pedidos não cancelados, incluindo entrega e pagamentos
  pendentes. Não representa faturamento liquidado nem receita de assinaturas.
- O mês usa `America/Sao_Paulo`, inclusive na virada entre setembro e outubro.
- Clientes contam registros de cadastro, sem deduplicação entre lojas.
- Os pedidos são lidos em páginas ordenadas e agregados no servidor, sem limite
  silencioso de 100 ou 1.000 registros. Pedidos posteriores ao início da consulta
  ficam para a próxima atualização. As consultas não são uma transação única;
  alterações concorrentes podem exigir uma atualização do painel.
- Para volumes maiores, evoluir para agregações no Postgres com autorização
  explícita e índices, evitando percorrer o histórico a cada atualização.

## Servidor e permissões

Necessita das variáveis públicas existentes e de `SUPABASE_SERVICE_ROLE_KEY`
apenas no servidor. Nunca usar prefixo `NEXT_PUBLIC_` nessa chave. A aplicação
já utiliza essa variável nas APIs de integrações; conferir sua presença no
ambiente de preview antes de disponibilizar esta tela.

GET, POST e PATCH validam o token com `auth.getUser(token)` e consultam
`is_super_admin` com o token do usuário antes de criar o cliente privilegiado.
Todas as respostas são `private, no-store`. O cliente privilegiado existe para
consultas globais e edição autorizada, sem ampliar as políticas RLS das lojas.
Falhas de consulta não são convertidas em métricas zeradas. PATCH permite apenas
os campos do formulário e exige o `atualizado_em` original para evitar
sobrescrita de alterações concorrentes. Não existe exclusão de empresas.

Nenhuma migration, alteração de políticas ou escrita de dados foi executada no
Supabase durante esta implementação. Os SQL antigos não são necessários para
esta etapa e não devem ser executados como instalação do novo Superadmin.

## Validação

```sh
pnpm install --frozen-lockfile
pnpm typecheck
node --test --test-isolation=none tests/superadmin.test.cjs
pnpm build
```

No Windows restrito, usar `BUILD_WORKER_THREADS=1` no build. O teste utiliza
TypeScript já instalado para executar os módulos reais com clientes simulados,
sem operações no Supabase. Em sistemas que suportam subprocessos, também pode
usar `node --test tests/superadmin.test.cjs`.

Verificados em 05/10/2026: tipos, build com variáveis fictícias, testes de cálculo,
paginação, autorização, validação de campos, projeção de metadados e concorrência;
layout desktop e celular com componentes reais renderizados em uma prévia
estática com dados de demonstração. A estrutura do banco foi conferida apenas
por consultas de leitura. O fluxo autenticado de ponta a ponta precisa ser
verificado no preview com usuário Superadmin e usuário comum. A prévia visual
não testa interações React. A inicialização local do servidor Next.js foi
bloqueada pela política automática de execução do ambiente.

## Conferência no preview

1. Entrar como Superadmin e conferir totais com pedidos conhecidos, incluindo
   cancelados e registros em ambos os lados da virada do mês.
2. Confirmar negativa de GET/POST/PATCH sem sessão e com usuário de loja.
3. Usar empresa de teste para criar/editar, testar domínio ou slug duplicado,
   desativar/reativar e conferir bloqueio de novos pedidos.
4. Abrir o mesmo registro em duas sessões e confirmar conflito na segunda edição.
5. Conferir herança e exceções dos módulos, sem alterar empresas reais.
6. Conferir ambiente das integrações e ausência de valores de credenciais nas
   respostas da API e no navegador.

## Sequência restante

1. Planos: gestão do catálogo e composição de módulos, atribuição a empresas,
   retorno à herança do plano e avaliação das exceções já existentes.
2. Assinaturas: modelagem de preço, período de teste, vencimento, estados e
   histórico; controle manual antes de cobrança recorrente.
3. Saúde das integrações: última comunicação, eventos e erros sanitizados;
   diferenciar cadastro de credenciais de verificação real de conexão.
4. Impersonação com auditoria e revisão de permissões antes de liberar acesso.

Essas etapas não foram implementadas neste PR. Publicação em produção depende
da revisão e validação do preview; este PR não altera credenciais de provedores.
