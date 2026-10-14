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

## Segundo pacote preparado

Histórico por período com páginas de vinte pedidos e totais agregados no banco; quadro operacional busca todos os pedidos abertos, independente dos cem registros antigos. Migração resumo-pedidos.sql aplicada em produção.

Cobrança SaaS: link hospedado Mercado Pago para o responsável autorizar a recorrência mensal; conciliação de faturas, regra de sete dias de atraso, restauração apenas de suspensão financeira própria e preservação de suspensão manual; proteção contra contrato editado enquanto a cobrança está vinculada. A criação interrompida não gera outra assinatura: o Superadmin pode vincular o identificador confirmado no provedor. Migrações assinaturas-automaticas.sql e ajustes de auditoria aplicados em produção. Zero contratos automáticos foram criados nos testes.

Configuração exclusiva no projeto Vercel da plataforma: SAAS_MERCADO_PAGO_ACCESS_TOKEN, SAAS_MERCADO_PAGO_AMBIENTE (teste/producao), SAAS_APP_URL (HTTPS), SAAS_MERCADO_PAGO_WEBHOOK_SECRET e CRON_SECRET. Selecionar notificações subscription_preapproval e subscription_authorized_payment para /api/assinaturas/webhook. A conferência por webhook complementa o cron diário às 09h de São Paulo. Só definir SAAS_AUTOMACAO_ATIVA=true após homologar a conta e as regras; o cron permanece sem executar enquanto esse campo estiver ausente. Em preview usar somente conta/token de teste. Não colocar esses valores em NEXT_PUBLIC_* e não usar as credenciais das lojas.

A conta SaaS ainda não foi configurada nesta execução e não houve testes financeiros reais. A assinatura usa a data de fim do teste cadastrada no contrato comercial; os planos existentes estão configurados para sete dias. Mudanças manuais no contrato não alteram silenciosamente a recorrência no provedor: conciliação interrompe a alteração de acesso em caso de versão divergente. Cancelamento de recorrência e renegociação requerem revisão no Mercado Pago antes de atualizar o contrato.

Provisionamento: preparar/vincular o administrador e escolher plano nos detalhes da empresa; novo usuário recebe um link privado de ativação a ser entregue pelo proprietário; nenhum e-mail é enviado pelo agente ou automaticamente por esse fluxo. Administrador existente mantém a senha. Link usa fragmento para evitar registros de servidor e a tela de ativação não carrega rastreamento. Migração provisionar-admin.sql aplicada. Domínio/DNS/HTTPS continuam exigindo conexão no projeto Vercel; o checklist de catálogo e abertura da loja está no painel.

Validação local deste pacote: 49 testes aprovados, TypeScript e build aprovados. A verificação de pagamentos/convites utiliza respostas simuladas, sem enviar mensagens, criar assinaturas ou trocar senhas reais.

Pilot-teste identificado como INACTIVE no Supabase; solicitada reativação para sincronização. Não executar migrações antes de confirmar que a restauração concluiu.

## Terceiro pacote preparado

WhatsApp: reserva atômica da fila, envio por modelo aprovado conferido na Meta, limites de tentativas, proteção para consentimento/plano/etapa atual e bloqueio de credenciais reais no preview. A configuração permite salvar sem autorizar envios, pausar e consultar os vinte retornos recentes. O webhook valida HMAC sobre os bytes originais e acompanha aceitação/entrega/leitura/falha sem regredir uma leitura. A fila inclui Pronto e ativação de acompanhamento.

Depois de homologar a conta/modelo, configurar WHATSAPP_AUTOMACAO_ATIVA=true e CRON_SECRET nos projetos que operam as lojas. Alterações de etapa, confirmações de pagamento e eventos Uber acionam o processamento em segundo plano; há processamento manual no painel e uma conferência diária às 09h05. Tentativas conhecidamente rejeitadas têm espera crescente. Respostas incertas ficam em revisão; não há reenvio automático de uma chamada possivelmente aceita. Itens com mais de 24h ficam fora dos envios automáticos. A verificação diária é contingência e não substitui monitoramento contínuo da fila.

Nova empresa inativa pode configurar seu painel com administrador vinculado, sem expor a empresa publicamente. O login identifica a empresa pelo acesso autenticado; autenticar um usuário não concede administração de outra empresa. Uma regra de banco bloqueia novos pedidos de empresa inativa, inclusive PDV, mantendo configuração e acompanhamento administrativo dos registros existentes.

Migrados produção e piloto: whatsapp-worker.sql e admin-empresa-inativa.sql. A ferramenta retornou erro de sessão em duas tentativas da primeira migração. A consulta confirmou ausência de mudança parcial; a versão que substitui o gatilho no lugar foi aplicada e verificada.

53 testes passaram; testes de envio e webhook usam respostas simuladas. Nenhuma mensagem, cobrança, convite por e-mail ou entrega real foi disparada. Homologação Meta, PagBank e Uber permanece dependente das contas liberadas. iFood/99 precisam de modalidade/API contratada antes do despacho real; continuam bloqueados.

Referência do formato de mensagens: [exemplos oficiais Meta](https://github.com/fbsamples/whatsapp-api-examples/blob/main/send-messages-flight-app-python/message_helper.py).
