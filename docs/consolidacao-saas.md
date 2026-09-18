# Consolidação SaaS após a95e314

## Histórico preservado

A main consultada em 18/09/2026 estava em c7ce861eafaa99d58922927d86ca9d8b8af24e40,
com quatro commits posteriores a a95e31429c922f758ee687a36b2e011dfa2a4aa8:

- 20d7fb1: cancelamento com motivo, data e responsável, sem exclusão do pedido.
- 6bd37a3: formulário de configuração de fidelidade por empresa.
- aaed0f5: Super Admin com empresas, planos e overrides de módulos.
- c7ce861: cadastro de disponibilidade das integrações por empresa.

Este commit continua essa sequência. Não faz squash, reset, amend ou force push.
Inclui correção dos indicadores do dashboard para excluir cancelados do faturamento
e dos pedidos em andamento, acesso a Integrações no menu, tipo cancelado,
validação dos valores de fidelidade e detecção de atualização sem permissão no Super Admin.

## Banco existente

Projeto: efbldnjqmfzxmhipzhux.
A migration fundacao_saas_modulos_integracoes_cancelamento foi confirmada por
consulta somente de leitura ao histórico de migrations. As tabelas planos,
modulos, plano_modulos, empresa_modulos, super_admin_users e integracoes_empresa
estão presentes. Nenhuma migration, seed, reset ou escrita de dados foi executada.
Os dados de Frutos de Goiás e ArtBel foram preservados.
Os SQL antigos da pasta supabase não representam o estado completo desse projeto;
não execute schema.sql, reset.sql ou importações para testar esta consolidação.

## Limitações verificadas antes dos testes

- Fidelidade: o painel grava tipo_recompensa e valor_recompensa, mas as funções
  consultar_fidelidade, area_cliente e criar_pedido com p_empresa_id ainda leem
  desconto_percentual (padrão 10). Recompensa fixa e novos percentuais não estão
  integrados ao cálculo final. Não validar descontos reais como concluídos.
- Super Admin: a política UPDATE de empresas exige is_admin_empresa(id), sem
  exceção para is_super_admin(). Ser Super Admin não basta para editar qualquer
  empresa. A tela agora mostra erro quando uma atualização não alcança nenhuma linha.
- Suspensão e módulos: os controles existentes constituem a fundação administrativa.
  criar_pedido verifica empresas.ativo, mas não o novo status nem módulos; suspender
  na tela não deve ser considerado bloqueio operacional completo.
- As integrações são cadastros de configuração; não processam pagamentos, entregas
  ou mensagens. Credenciais e APIs reais não foram implementadas.
- Os indicadores existentes consultam os 100 pedidos mais recentes; não constituem
  relatório financeiro completo para volumes maiores.

Essas pendências exigem uma próxima alteração coordenada de regras no banco e aplicação.
Não foram feitas alterações no banco nesta consolidação do repositório.

## Validação reproduzível

Instale as dependências com pnpm install --frozen-lockfile. Configure as variáveis
públicas do Supabase conforme .env.example para executar o aplicativo.
Execute pnpm typecheck e pnpm build.

No ambiente Windows desta revisão, o modo padrão de build encontrou spawn EPERM.
BUILD_WORKER_THREADS=1 permite executar o mesmo build usando threads e compilação
no processo principal. Essa opção é explícita e não altera o padrão da Vercel.
O build de validação usa URL/chave fictícias, sem operações no banco de produção.
Resultado em 18/09/2026: typecheck aprovado; build de produção aprovado com
BUILD_WORKER_THREADS=1 e todas as 18 páginas geradas. git diff --check aprovado.
O build não substitui testes autenticados de permissões e fluxos reais.
A instalação também sinalizou que Next.js 14.2.5 possui vulnerabilidade conhecida;
a atualização do framework permanece pendente e não faz parte desta consolidação.

## Roteiro após deploy

1. Confirmar que o deploy da Vercel corresponde ao novo commit da main.
2. Conferir identificação, catálogo e acesso administrativo de cada empresa no
   respectivo domínio, sem editar dados existentes.
3. Abrir /superadmin, /admin/pedidos, /admin/fidelidade e /admin/integracoes.
4. Conferir cancelados já existentes e indicadores; testar novas operações apenas
   com registros de teste, respeitando as limitações acima.
5. Testar acesso negado com usuário sem permissão. Não tratar visibilidade de um
   controle como confirmação de autorização no banco.
