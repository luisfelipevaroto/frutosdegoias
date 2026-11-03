# API ERP v1 — especificação inicial

Status: planejamento; endpoints ainda não implementados. Branch de trabalho `feat/erp-api-v1`.

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
