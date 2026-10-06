# Fluxo de entregas Uber Direct

Pedidos: recebido → em preparo → pronto/aguardando coleta → saiu para entrega → entregue. Retirada: recebido → em preparo → pronto para retirada → retirado. A etapa visual pronto usa `pronto_em`, preservando os valores de status já existentes no banco.

Ao ficar pronto, abrir o pedido, calcular uma nova corrida e confirmar o custo cobrado pela Uber à loja. A cotação feita pelo cliente não solicita entregador. O preço da corrida no despacho pode diferir do frete cobrado ao cliente. Solicitações exigem pagamento online confirmado quando aplicável.

O webhook valida assinatura HMAC e ambiente. Busca entregas pelo ID externo ou pelo pedido, permitindo eventos anteriores à resposta de criação. Eventos duplicados ou antigos não fazem a entrega regredir; coleta altera o pedido para saiu para entrega e conclusão para entregue. Solicitações concorrentes têm trava e recuperação usa o mesmo conteúdo e chave de idempotência por até uma hora. Após esse prazo, conferir no painel Uber para evitar nova corrida indevida.

Cancelamento da corrida é feito no painel Uber; depois atualizar no painel da loja. O pedido não pode ser cancelado por esta interface durante uma solicitação incerta ou corrida ativa. Os status cancelada/devolvida da corrida exigem análise do operador e não cancelam automaticamente a compra.

## Preparação

Aplicar `supabase/fluxo-uber.sql`, depois `supabase/uber-recuperacao.sql` antes de publicar o código no respectivo ambiente. Já aplicados em Pilot-teste; produção exige sua própria migração. Conferir previamente duplicatas Uber por pedido (índice único não apaga registros).

No painel Integrações → Uber Direct, informar Customer ID, Client ID, Client Secret e Webhook Signing Key. Ativar Uber em Entrega e preencher endereço completo e telefone da loja. O preview aceita apenas credenciais de teste. Produção requer conta Uber liberada para entregas reais.

Cadastrar evento `event.delivery_status` na Uber com URL HTTPS do ambiente + `/api/integracoes/uber-direct/webhook`. O endpoint de preview precisa estar acessível à Uber, sem a proteção de login Vercel impedir o webhook. Preferir um domínio estável de piloto configurado para essa finalidade; nunca colocar o token de proteção no código.

Conferir primeiro em sandbox com Robo Courier: cotação, pedido, preparo, pronto, confirmação da corrida, coleta e entrega. Nenhuma corrida real é solicitada nos testes automatizados. A validação da conta do comerciante depende de credenciais reais e de teste completo pelo responsável antes do uso comercial.

O despacho iFood ainda não está implementado. Checkout integrado iFood é recusado até existir o fluxo completo; não ativar iFood para vendas neste momento.

Referências: https://developer.uber.com/docs/deliveries/get-started ; https://developer.uber.com/docs/deliveries/guides/robocourier ; https://developer.uber.com/docs/deliveries/daas/references/api/webhooks/delivery-status-webhook
