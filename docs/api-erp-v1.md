# API ERP v1 — especificação inicial

Status: autenticação, gerenciamento de chaves e leitura de pedidos implementados na branch de trabalho. Migração SQL ainda não aplicada; confirmação de importação implementada; migrações e testes pendentes. Branch de trabalho `feat/erp-api-v1`.

## Autenticação

Todas as requisições devem usar HTTPS e `Authorization: Bearer <chave_da_empresa>`. Uma chave pertence a uma única empresa, pode ser revogada e nunca é armazenada em texto puro. O servidor determina a empresa a partir da chave; não confia em `empresa_id` informado pelo ERP.

## Endpoints propostos

- `GET /api/v1/erp/pedidos?limit=50&cursor=...`: lista paginada de pedidos, incluindo alterações de status.
- `GET /api/v1/erp/pedidos/{id}`: pedido completo com cliente, endereço, itens, variações, adicionais, preços e status.
- `POST /api/v1/erp/pedidos/{id}/confirmar`: registra importação idempotente e referência opcional do ERP, sem alterar status comercial do pedido.

## Regras

1. Consultas sempre filtradas pelo tenant autenticado.
2. Paginação estável com cursor composto (timestamp, UUID), para não perder pedidos empatados.
3. Importação idempotente pela chave `(empresa_id, pedido_id)`; novas tentativas não duplicam pedidos.
4. Chaves protegidas por hash, revogação, logs sem segredos e limitação de requisições.
5. Retorno `401` para chave inválida, `404` para pedido de outra empresa, `429` para limite excedido e `503` para indisponibilidade.
6. Não retornar CPF ou dados pessoais desnecessários. Retornar somente campos operacionais necessários ao ERP.
7. A implementação deve preservar o checkout, autenticação e pagamentos existentes na `main`.

## Antes de publicar

Criar migração SQL de credenciais e confirmações; implementar e testar endpoints; validar isolamento Frutos de Goiás / ArtBel; revisar autenticação, CORS, limites e documentação com exemplos; executar testes de regressão e deploy de Preview. Publicar na `main` somente após esses testes.

## Autenticação implementada (não publicada)

- Migração: `supabase/migrations/20261103_erp_api_keys.sql`. Aplicar somente após testes e backup.
- `GET /api/v1/erp/status`: exige `Authorization: Bearer erp_<64 caracteres hexadecimais>`; responde `{ "ok": true, "api": "erp", "version": "v1" }`.
- `GET /api/admin/erp-chaves?empresa_id=<uuid>`: lista metadados de chaves; exige JWT de administrador da empresa.
- `POST /api/admin/erp-chaves?empresa_id=<uuid>`: corpo `{ "nome": "ERP da loja" }`; retorna chave em texto puro uma única vez; exige JWT administrativo.
- `DELETE /api/admin/erp-chaves?empresa_id=<uuid>&id=<uuid>`: revoga a chave; exige JWT administrativo.
- A empresa é identificada pelo hash da chave e não por parâmetro fornecido pelo ERP.
- Não publicar até validar autorização de administradores, rate limiting, proteção de credenciais e testes automatizados.

## Consulta de pedidos implementada (branch de desenvolvimento)

`GET /api/v1/erp/pedidos?limit=50&cursor=<cursor>` retorna `data` e `pagination` (`limit`, `has_more`, `next_cursor`). O cursor é opaco, composto por `criado_em` e `id`. Limite de 1 a 100; omissão usa 50. A ordenação é crescente por criação e ID. O ERP deve guardar o último cursor processado, e usar `id` como chave única para evitar duplicações.

`GET /api/v1/erp/pedidos/<uuid>` retorna pedido, cliente (nome, telefone, WhatsApp, endereço), itens, quantidades, preços unitários, nomes atuais de produtos e variações, adicionais atuais, forma/status de pagamento, entrega, descontos e observações. Os valores históricos de adicionais e nomes no momento da compra não estão armazenados na tabela de itens; campos com sufixo `_atual` são apenas referência e podem ter mudado. O ERP deve usar `valor_total` e `preco_unitario` registrados no pedido, não recalcular o valor total a partir do catálogo atual.

### Limitação importante

A listagem por `criado_em` é um feed de **novos pedidos**, não um feed completo de mudanças de status. Não há `atualizado_em` em `pedidos` no schema atual. Para sincronizar alterações, o ERP deve reconsultar pedidos relevantes por ID; antes de prometer atualização incremental de status, precisamos criar um registro de eventos/alterações com migração específica.

### Exemplo de chamada

```bash
curl -H 'Authorization: Bearer SUA_CHAVE_ERP' 'https://SEU_DOMINIO/api/v1/erp/pedidos?limit=50'
```

Os endpoints ainda não foram testados em deploy de Preview e não devem ser considerados disponíveis em produção.

## Confirmação de importação (implementada na branch)

`POST /api/v1/erp/pedidos/<uuid>/confirmar` com `Authorization: Bearer <token>` e JSON opcional `{ "referencia_erp": "PED-123" }`.

- Primeira confirmação: HTTP `201`, `{ "importado": true, "ja_importado": false, "pedido_id": "...", "referencia_erp": "PED-123", "importado_em": "..." }`.
- Repetição com mesma referência: HTTP `200`, `ja_importado: true`.
- Repetição com referência divergente: HTTP `409`.
- Pedido inexistente ou de outra empresa: HTTP `404`.
- A confirmação não modifica o status comercial ou financeiro do pedido.
- A migração `supabase/migrations/20261103_erp_importacoes.sql` cria uma chave primária composta por empresa e pedido para impedir duplicações concorrentes.

### Fluxo recomendado para o ERP

1. Consultar novos pedidos paginados e buscar detalhes por ID.
2. Gravar o pedido no banco local com índice único para o ID externo do delivery.
3. Confirmar na API somente após a transação local ser concluída.
4. Em falhas de rede, repetir a confirmação com a mesma referência; o endpoint é idempotente.

A API ainda não foi homologada. Migrações SQL não foram executadas no Supabase de produção.

## Validação de migrações — 2026-11-03

As migrações `erp_api_keys_v1` e `erp_importacoes_v1` foram aplicadas ao projeto Supabase original Frutos de Goias (`efbldnjqmfzxmhipzhux`). Conferência SQL: ambas as tabelas têm RLS ativo, sem SELECT para `anon` e `authenticated`, com SELECT para `service_role`. Teste SQL transacional criou chave temporária, confirmou o mesmo pedido duas vezes com `ON CONFLICT DO NOTHING`, verificou unicidade e executou `ROLLBACK`; contagens finais das duas tabelas: zero. O teste confirma constraints e idempotência em SQL, **não** comprova o funcionamento HTTP ponta a ponta. Deployment Preview do commit anterior `cff4040` está READY; aguardar compilação da revisão de migrações. Ainda faltam testes de autenticação real, controle de acesso entre empresas, limite de requisições e confirmação via endpoint HTTP antes de liberar a main.

## Limitação de requisições — 2026-11-03

Rate limit implementado: **60 chamadas por minuto UTC por chave ERP válida**, com contador atômico no PostgreSQL via `erp_api_consumir_limite(uuid)`. Acima do limite, a API responde `429` com cabeçalho `Retry-After: 60`. Migração `erp_rate_limit_v1` aplicada no Supabase original. Teste SQL transacional verificou 60 permissões e bloqueio na 61ª tentativa, seguido de rollback; nenhuma chave nem contador de teste persistiu. A função RPC concede EXECUTE somente a `service_role` e não a `anon`/`authenticated`.

**Limites do teste:** ainda não houve teste HTTP com token válido; o controle é por chave válida, não protege tentativas de token inválido (requer proteção adicional no edge/WAF). Os registros de janelas antigas precisam de política de limpeza. A aplicação atualizada aguarda validação do build Preview.
