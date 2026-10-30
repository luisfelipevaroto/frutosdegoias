-- Auditoria somente leitura do banco delivery restaurado.
-- Nao retorna dados de clientes, senhas ou credenciais.
SELECT table_name, column_name, data_type, udt_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'empresas', 'produtos', 'categorias', 'subcategorias',
    'variacoes', 'adicionais', 'produto_adicionais',
    'grupos_adicionais', 'grupo_adicionais_itens',
    'configuracoes_loja', 'admin_users', 'super_admin_users'
  )
ORDER BY table_name, ordinal_position;

SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('empresa_por_dominio', 'catalogo_publico', 'is_admin_empresa', 'criar_pedido_com_pagamento', 'status_pagamento_online')
ORDER BY routine_name;

SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
