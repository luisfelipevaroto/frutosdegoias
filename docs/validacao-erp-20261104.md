# Validação ERP — 04/11/2026

- 66 testes automatizados passaram (`node --test tests/*.test.cjs`, a partir da raiz do repositório). Os cinco testes ERP carregam os handlers reais com banco simulado: isolamento nos dois sentidos; primeira confirmação 201; repetição 200; referência divergente 409; dez confirmações concorrentes com um único registro; entradas inválidas; revogação, empresa inativa e limite 429.
- No PostgreSQL original, transações com rollback verificaram unicidade real de `(empresa_id,pedido_id)`, preservação da data e do pedido. Também foram usados pedidos temporários cancelados, com números negativos explícitos, nas duas empresas. Nenhum registro de teste foi persistido. A ArtBel não tinha pedidos reais.
- O usuário confirmou HTTP 200 no Preview para autenticação, listagem e detalhe usando uma chave real no painel. Confirmação HTTP e revogação HTTP não foram exercitadas no deployment; a cobertura correspondente é de handlers com mocks e constraints no banco.
- Produção pública responde sem a barreira de login da Vercel vista no Preview. Revalidar `/api/v1/erp/status` e pedidos após a liberação com uma chave do tenant.
- O ERP deve manter índice único para o ID externo do pedido em seu próprio banco e confirmar importação somente após a gravação local. A API impede duplicação da confirmação; não controla as transações internas do ERP.
- Feed paginado acompanha novos pedidos por criação. Mudanças de status exigem reconsulta por ID.

## PagBank

A suíte revelou permissão indevida para cartão online PagBank. Corrigida a regra do servidor e desabilitada a opção no painel; Pix online continua disponível quando configurado. Frutos usa credenciais de teste; ArtBel mantém seu provedor Mercado Pago. Nenhuma cobrança real foi criada nesta validação. A ativação PagBank em produção ainda requer credencial de produção e teste completo de cobrança e confirmação.
