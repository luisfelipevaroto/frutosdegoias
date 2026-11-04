# Validação ERP — 04/11/2026

## Testes automatizados e banco

66 testes automatizados passaram (`node --test tests/*.test.cjs`, a partir da raiz). Incluem isolamento nos dois sentidos, confirmação 201/200, referência divergente 409, dez confirmações concorrentes com um registro, entradas inválidas, chave revogada, empresa inativa e quota 429. No banco original, testes transacionais com rollback verificaram unicidade e preservação do pedido nas duas empresas.

## Homologação HTTP em produção

PR #15 integrado em `611cdf94a282c788688a7972b2003b780188866a`. Deployment de produção `dpl_4GoR4448PePzWDdGZjevAsKXvZN1`, READY. Base pública: https://frutos-de-goias-jf.vercel.app/api/v1/erp.

Foram criadas duas chaves temporárias e dois pedidos temporários cancelados, um por empresa, sem clientes, sem pagamento e sem uso da sequência de números comercial. Os tokens não foram impressos nem publicados. Resultados reais por HTTPS nas duas empresas:

- Status, lista e detalhe: 200.
- Lista inclui o pedido próprio e exclui o da outra empresa.
- Leitura e confirmação de pedido estrangeiro: 404 nos dois sentidos.
- Primeira confirmação: 201.
- Oito repetições concorrentes após a confirmação: 200, `ja_importado=true`, data preservada.
- Referência ERP divergente: 409.
- Banco confirmou exatamente um registro por pedido e status de pedido/pagamento preservados.
- Ambas as chaves, após revogação no banco: endpoint status retornou 401. O endpoint administrativo de revogação não foi chamado neste teste.
- Consulta sem chave: 401.

Ao terminar, removidos somente os dois pedidos, suas confirmações e as duas chaves temporárias. Contagens de conferência: zero pedidos, zero importações e zero chaves de teste. O arquivo temporário dos tokens também foi removido. Nenhum pedido real teve status alterado.

## Contrato para o ERP

A confirmação idempotente impede duplicidade do registro na API. O ERP deve manter índice único para o ID externo em seu próprio banco e confirmar somente após a transação local. O feed acompanha criação de pedidos; mudanças de status exigem reconsulta por ID.

## PagBank

Corrigida permissão indevida para cartão online PagBank; o servidor rejeita o método e o painel desabilita a opção. Pix permanece disponível quando configurado. Frutos está com credenciais de teste, ArtBel mantém Mercado Pago. A ativação real depende da credencial PagBank de produção e do teste de cobrança e confirmação. Nenhuma cobrança real foi criada nesta validação.
