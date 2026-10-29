# Migração Supabase → PostgreSQL VPS — auditoria inicial

Branch: `feat/postgres-vps-migration`. Não publicar na `main` até validação completa.

## Infraestrutura já confirmada (verificação operacional externa ao repositório)
- PostgreSQL 17 no Docker da VPS HostGator, banco `delivery`, dados restaurados (2 empresas, 245 produtos, 7 pedidos, 4 clientes).
- PgBouncer 1.24.1 em `127.0.0.1:6432`, TLS `verify-full` validado, usuário `delivery_app`.
- Porta 5432 não publicada; 6432 não publicada externamente. Certificado DNS manual precisa de renovação automatizada.
- Não alterar containers/volumes do Jipe Clube.

## Dependências identificadas no código
1. `lib/supabase.ts`: cliente Supabase usado no navegador.
2. `lib/empresa.ts`: RPC `empresa_por_dominio`; identifica tenant no navegador e salva no localStorage.
3. `lib/produtos.ts`: RPC `catalogo_publico`; formato inclui variações, adicionais e grupos.
4. `lib/admin-server.ts`: `auth.getUser(token)` + RPC `is_admin_empresa`; serviço com chave de alto privilégio.
5. `app/api/pedidos/route.ts`: cliente service-role, RPCs `status_pagamento_online` e `criar_pedido_com_pagamento`, idempotência em `pedidos_solicitacoes`, cálculo de frete e regras de pagamento.
6. `app/api/superadmin/route.ts`: consultas administrativas com diversas tabelas e contagem de clientes.
7. Integrações Mercado Pago, PagBank, Uber, WhatsApp e assinaturas também precisam auditoria completa.

## Bloqueadores conhecidos
- Restore recuperou tabelas, dados, índices e constraints; não restaurou funções RPC, triggers, RLS/policies e autenticação Supabase.
- Quatro FKs que referenciam `auth.users` foram excluídas na restauração; IDs históricos preservados, mas sem provedor de identidade.
- Não pressupor que a aplicação já funciona no banco novo.
- Não usar `empresaId` fornecido pelo cliente como autorização. Vincular tenant ao domínio/sessão no servidor.
- Nunca expor `DATABASE_URL` ou credenciais no navegador ou em logs.
- Preservar transações, idempotência e verificação server-side de preços no checkout; não reimplementar apenas como INSERT simples.
- Segredos de integrações podem estar em `integracoes_credenciais`: não imprimir ou versionar valores.

## Ordem de implementação
1. Auditar SQL original das RPCs e schema real da VPS (somente metadados, sem segredos).
2. Adicionar `pg` em Node runtime e módulo server-only de pool com `DATABASE_URL`, timeouts e TLS verify-full. Sem conectar produção até endpoint seguro disponível.
3. Implementar APIs públicas para domínio→empresa e catálogo, com tenant validado e testes.
4. Implementar sessões/autenticação própria com migração segura de contas; autorizações admin/superadmin no servidor.
5. Migrar checkout como transação atômica com validação de valores, estoque, pagamentos e idempotência; testar concorrência.
6. Migrar integrações/webhooks/cron e demais telas; testes de isolamento entre empresas.
7. Configurar conexão Vercel→VPS, regras de rede, backups, renovação automática TLS, observabilidade e rollback.
8. Fazer deploy em preview, validar ponta a ponta, só então considerar merge na `main`.

## Critérios mínimos de aceite
- Nenhuma dependência funcional de Supabase Auth, RPC ou Storage sem substituição.
- Tenant A não consegue ler ou alterar dados de B; superadmin com privilégio explícito.
- Checkout duplicado não duplica pedido/cobrança; valores calculados no servidor.
- Pagamentos e webhooks idempotentes; testes em sandbox.
- Certificado renovável e backups restauráveis.
