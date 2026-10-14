# Finalização — acompanhamento em 14/10/2026

Regras comerciais confirmadas pelo proprietário: Mercado Pago da plataforma separado das lojas; teste de sete dias; suspensão sete dias após o vencimento. Nenhuma conta de integração foi informada como liberada. Tokens de Uber, iFood e PagBank serão obtidos pelo proprietário. Não incluir credenciais em arquivos, repositório ou conversa.

## Primeiro pacote preparado

- Next.js 16.4.0 e React 19.3.0; adaptação de headers assíncronos e compilação webpack.
- Checkout: mínimo e troco rejeitados dentro da transação; metadados de pagamento/entrega gravados juntos. Migração `checkout-atomico.sql` aplicada em produção; execução pública do criar_pedido legado revogada; serviço e PDV preservados.
- Carrinho recuperado por empresa durante sete dias. O checkout continua calculando preço e disponibilidade no servidor; valores recuperados são apenas a apresentação provisória.
- Mercado Pago: assinatura HMAC, consulta a Orders ou Payments, conferência de referência/empresa/moeda/valor, proteção para eventos atrasados não reverterem um pagamento confirmado. Falhas solicitam retentativa.
- Pix usa o identificador estável do pedido como chave de idempotência e recupera a cobrança existente. Pix/cartão podem ser retomados no acompanhamento do pedido.
- Nova configuração da chave de assinatura em Integrações. Selecionar Payments e Orders no painel de desenvolvedores Mercado Pago e cadastrar a chave de assinatura no delivery. Sem essa chave o webhook recusa a confirmação, em vez de aceitar um evento sem autenticação.

## As seis etapas permanecem em andamento

1. Segurança: primeiro pacote acima. Revisão individual das demais funções privilegiadas ainda pendente.
2. Mercado Pago: confirmação/retomada preparadas. Sandbox, conciliação agendada, estorno e recuperação de falha na criação inicial do pedido ainda pendentes; este pacote não os declara concluídos.
3. Uber/WhatsApp/PagBank: Uber já tem despacho/rastreamento; validação comercial e corrida real pendentes. Serviço WhatsApp e checkout PagBank ainda precisam de implementação e homologação. Não ativar apenas por cadastrar token.
4. iFood/99: aguardam acesso ao fluxo contratado e homologação; não apresentar como operacionais.
5. Assinaturas/provisionamento: regra confirmada, mas recorrência/suspensão automática ainda não ativadas. Configurar credenciais exclusivas da conta SaaS, assinatura de webhook e agendamento; não reutilizar tokens das lojas. Provisionamento guiado ainda pendente. Consulta ao Pilot-teste expirou: não há sincronização confirmada. Nunca executar `reset.sql` para atualizar uma loja existente.
6. Carrinho: persistência preparada. Histórico/paginação e agregação dos relatórios ainda pendentes.

Este documento registra conclusão por funcionalidade. Não significa que as seis etapas foram entregues ou que integrações reais passaram em homologação. Não houve cobrança, entrega ou mensagem real nos testes.

Referências de implementação: [assinatura de notificações](https://www.mercadopago.com.br/developers/pt/docs/wallet-connect/notifications), [Orders](https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/notifications), [planos recorrentes](https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/create-preapproval-plan/post).
