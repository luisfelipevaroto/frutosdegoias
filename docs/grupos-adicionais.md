# Grupos de adicionais

No painel da loja, abra **Adicionais → Novo grupo de adicionais**. Informe o título (por exemplo, Frutas), escolha **Itens grátis?** e cadastre os subprodutos.

- **Sim:** configure mínimo e máximo. Exemplo: mínimo 1, máximo 3. Todos os itens selecionados nesse grupo são grátis. Ao escolher três, os demais ficam bloqueados; desmarcar uma opção libera outra.
- **Não:** informe o preço de cada item. O cliente escolhe pelo menos um; cada selecionado soma o preço ao produto, sem limite máximo.

Em **Produtos**, edite o açaí e marque os grupos em **Grupos obrigatórios**. Cada grupo ativo vinculado precisa atingir seu mínimo antes de adicionar ao carrinho. Os limites são por unidade do produto. Um item pode ser selecionado uma vez em cada unidade. A quantidade do produto multiplica o preço base e os adicionais pagos.

Os adicionais avulsos antigos permanecem opcionais. Os grupos podem ser compartilhados por vários produtos da mesma empresa: editar um grupo atualiza todos os produtos vinculados. Inativar o grupo retira sua exigência e suas opções do catálogo; remover/inativar um item impede novas seleções e conserva seu registro para o histórico.

## Instalação

`supabase/grupos-adicionais.sql` foi aplicado apenas no **Pilot-teste**. O arquivo contém a versão final das funções, incluindo as correções verificadas no piloto. Aplicar uma vez em uma base que ainda não tenha essa estrutura. Não usar `schema.sql` ou `reset.sql` para atualizar uma base existente.

A publicação em produção exige aplicar essa migração no banco real antes de publicar o código. A migração conserva as permissões das RPCs de catálogo e pedidos e exige a estrutura atual das duas RPCs de pedidos (interrompe a transação se encontrar uma versão diferente).

As novas tabelas têm RLS por empresa. Os cadastros usam funções com `SECURITY INVOKER`, exigem usuário administrativo da empresa e salvam as regras/itens em uma transação. A vinculação de grupos também é atômica. Os preços e as escolhas são conferidos no servidor, no site e no PDV, usando os valores atuais do banco.

## Validação

- Testes de aplicação: `node --test --test-isolation=none tests/superadmin.test.cjs` (21 testes).
- `pnpm typecheck` e `pnpm build` aprovados.
- `tests/grupos-adicionais-db.sql`: somente no piloto. Usa dados fictícios e rollback; cobre cadastro autenticado, isolamento entre empresas, limites, obrigatoriedade de todos os grupos, preços, quantidade, pedidos do site/PDV, adicionais avulsos e inativação sem apagar registros.
- Conferência visual dos componentes reais em uma demonstração local com estados de seleção vazia e limite atingido. O teste completo com login no Preview deve ser feito pelo proprietário, com seu usuário exclusivo do piloto.

Não foram criados grupos nem alterados produtos do catálogo automaticamente. Os testes SQL não deixaram empresas, clientes ou pedidos adicionais no piloto.
