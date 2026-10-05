# Ambiente piloto

O projeto Supabase `Pilot-teste` (`yudjxdumtoryjcpfcpcu`) atende somente os deployments Preview. Produção continua no projeto `efbldnjqmfzxmhipzhux`.

A estrutura foi reconstruída a partir do banco ativo, sem executar os arquivos legados schema.sql/reset.sql: 28 tabelas, 50 funções da aplicação, 60 políticas RLS, constraints, índices, sequência, triggers e Realtime. As permissões do piloto foram reduzidas: anon tem leitura de catálogo e RPCs públicas necessárias, sem escrita direta nas tabelas ou execução de criar_pedido; a API de pedidos usa service_role. Funções administrativas exigem authenticated e autorização no corpo/RLS. Credenciais e dados comerciais privados não são públicos.

Dados iniciais: 4 planos, 8 módulos, 2 empresas marcadas PILOTO, 242 produtos, 11 categorias, 17 subcategorias, 13 adicionais e 104 vínculos produto/adicional. Clientes e pedidos são fictícios (dois de cada). Nenhum cliente, pedido, usuário Auth, sessão, token OAuth, credencial ou webhook de produção foi copiado. O usuário criado diretamente no piloto recebeu os vínculos autorizados de Superadmin e administrador das duas lojas.

Pagamentos online/PIX e entregas integradas estão desativados. O bucket midias-empresas e as regras de upload foram criados. As imagens existentes do catálogo mantêm os links públicos de origem; os arquivos físicos de Storage não foram duplicados. Novos uploads feitos no piloto ficam no Storage do piloto.

Os domínios das lojas de teste devem apontar para os endereços Preview, nunca para os domínios reais. Os nomes terminados em .pilot.test são placeholders até registrar os aliases da Vercel. O acesso global funciona em /superadmin/login; o administrador da loja usa /admin/login em um domínio de Preview associado à empresa.

Na Vercel, configurar NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY do piloto em Preview e SUPABASE_SERVICE_ROLE_KEY somente no servidor Preview. Alterar variáveis não altera deployments antigos: usar um novo deployment de Preview, como o desta branch.

Fluxo futuro: mudança de código e migração → banco piloto e Preview → validação → aprovação da publicação → produção. Nunca reaplicar a baseline no banco de produção. O piloto tem usuários e senha independentes.

Verificação: catálogo público e domínio resolvidos sob role anon; gravações anônimas e acesso a credenciais bloqueados; autorização e acesso às duas lojas testados sob role authenticated com o usuário piloto. Novas tabelas privadas mantêm RLS sem políticas públicas de acesso.
