# Finalização do delivery — 14/10/2026

## Regras confirmadas

Assinaturas em uma conta Mercado Pago exclusiva do proprietário da plataforma, separada das lojas. Planos Básico R$29,90, Médio R$49,90 e Avançado R$99,90; teste de sete dias; suspensão sete dias após o vencimento. As contas Uber, iFood, PagBank e WhatsApp ainda não foram informadas como liberadas para homologação real.

## Situação das seis etapas

| Etapa | Entregue/preparado | Ainda falta |
|---|---|---|
| 1. Segurança | Next.js 16.4.0/React 19.3.0; criação legada de pedido privada; mínimo/troco/metadados na transação; novo pedido bloqueado para empresa inativa. | Revisão individual das demais funções privilegiadas e confirmação de posse do telefone no acesso do cliente. |
| 2. Mercado Pago | HMAC; Orders/Payments; conferência de empresa, referência, moeda e valor; eventos atrasados não rebaixam pagamento; Pix com chave do pedido e recuperação da cobrança; retomada Pix/cartão no acompanhamento. | Homologação sandbox e validação real dos ciclos de conciliação/estorno. Conciliação manual/contingência diária, estorno autorizado e idempotência da criação inicial foram preparados no quarto pacote. |
| 3. Uber/WhatsApp/PagBank | Uber conserva despacho/rastreamento e proteção de ambiente. WhatsApp tem fila, modelo aprovado, consentimento/plano, etapa Pronto, reserva atômica, retentativas e retorno assinado de entrega/leitura. | Contas/credenciais e homologação; cancelamento Uber pelo próprio delivery; checkout e confirmação PagBank ainda precisam ser implementados. |
| 4. iFood/99 | Estrutura e cotação iFood existentes; despacho continua bloqueado para impedir promessa de entrega sem operação completa. | Confirmar modalidade/API contratada e implementar solicitação, rastreamento e cancelamento. 99 não está operacional. |
| 5. SaaS/piloto | Link de assinatura e conciliação Mercado Pago SaaS; regra de suspensão/restauração; provisionamento de administrador/plano; ativação de senha sem enviar e-mail; acesso de empresa inativa para configuração; piloto reativado e migrações sincronizadas. | Configurar conta SaaS e homologar faturas/cancelamentos; revisar renovação/renegociação no provedor; conectar DNS/HTTPS de novos domínios na Vercel. |
| 6. Histórico/carrinho | Carrinho por empresa por sete dias; quadro busca todos os abertos; histórico de vinte por página; totais do banco e distinção de pagamentos confirmados; relatórios respeitam o módulo do plano. | Validação autenticada com o operador e conferência das mensagens de recuperação em situações reais de rede. |

As seis etapas **não estão integralmente concluídas**. O código preparado e as migrações não equivalem à homologação dos provedores. Não houve cobrança, entrega, mensagem ou convite por e-mail real na execução. Os testes de integrações usam respostas simuladas.

## Publicações

- PR9: checkout atômico, segurança de notificações, retomada de pagamentos e carrinho. Produção f538c0a.
- PR10: histórico, preparação SaaS e provisionamento. Produção 9647317.
- PR11: piloto sincronizado com produção, preservando histórico de ambas as branches. Pilot-teste foi restaurado de INACTIVE para ACTIVE_HEALTHY. Os três pedidos do piloto foram preservados; clientes/pedidos reais e credenciais não foram copiados.
- PR12: serviço WhatsApp e configuração administrativa de empresa inativa. Conferir os checks da Vercel antes de considerar a publicação concluída.

Migrações aditivas aplicadas em produção e piloto: pagamentos exclusivos (piloto estava pendente), checkout atômico, resumo de pedidos, assinaturas automáticas e auditoria, provisionamento administrativo, fila WhatsApp e administração de empresa inativa. Nunca atualizar uma loja existente com reset.sql ou reexecutar a baseline.

## Configuração SaaS

No projeto Vercel da plataforma: SAAS_MERCADO_PAGO_ACCESS_TOKEN, SAAS_MERCADO_PAGO_AMBIENTE (teste/producao), SAAS_APP_URL (HTTPS), SAAS_MERCADO_PAGO_WEBHOOK_SECRET e CRON_SECRET. Usar notificações subscription_preapproval e subscription_authorized_payment em /api/assinaturas/webhook. Só ativar SAAS_AUTOMACAO_ATIVA=true depois da homologação. O cron diário às 09h de São Paulo não executa enquanto essa ativação estiver ausente. Preview aceita somente a conta de teste.

Nenhuma loja entra automaticamente na cobrança: o proprietário cadastra o contrato e vincula explicitamente o link, que exige autorização do responsável no Mercado Pago. O fim do teste usa a data do contrato comercial. Uma criação interrompida exige conferir/vincular a assinatura existente antes de gerar outra. Alteração manual do contrato interrompe a conciliação por divergência de versão; não altera silenciosamente o preço recorrente do provedor. Suspensão manual posterior é preservada na restauração.

## Configuração das lojas

Mercado Pago: em Integrações, salvar a chave de assinatura e configurar Payments/Orders em /api/pagamentos/mercado-pago/webhook. Sem chave válida, a confirmação por webhook é recusada. Atualizar/rotacionar credenciais exige conferir essa configuração novamente.

WhatsApp: cadastrar token/número/WABA, versão do app e um modelo aprovado com três parâmetros no corpo (nome, número do pedido, etapa), sem cabeçalho dinâmico. Configurar o webhook mostrado no painel, App Secret e token de verificação. Autorizar os envios da empresa e, após homologação, configurar WHATSAPP_AUTOMACAO_ATIVA=true nos projetos que operam as lojas. O serviço continua desativado por padrão.

Mudança de etapa, confirmação Mercado Pago e eventos Uber acionam a fila em segundo plano. Há processamento manual e contingência diária às 09h05. Rejeições definitivas têm espera crescente e até cinco tentativas. Resposta incerta aguarda revisão para evitar duplicidade. Notificação com mais de 24h não é enviada automaticamente. A conferência diária não representa processamento contínuo de retentativas.

Nova empresa: conectar domínio/DNS/HTTPS ao projeto da plataforma; preparar administrador e plano nos detalhes da empresa; entregar o link privado ao responsável, que define a senha. Usuário existente mantém senha. O link usa fragmento, a tela não carrega rastreamento e nenhum e-mail é enviado por este fluxo. Cadastrar catálogo/horários/entrega/pagamentos e contrato; testar no piloto antes da abertura real.

## Validação

60 testes aprovados, TypeScript e build local aprovados. Verificadas permissões: anon não executa criação legada, reserva de notificações, conciliação SaaS ou identificação administrativa de empresa inativa. Produção tinha zero conexões Meta e zero contratos automáticos na verificação. Testes não confirmam áudio físico, contas liberadas ou pagamentos/corridas/mensagens reais.

Referências: [Mercado Pago — notificações](https://www.mercadopago.com.br/developers/pt/docs/wallet-connect/notifications), [Orders](https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/notifications), [assinaturas](https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/create-preapproval-plan/post), [Meta — exemplos oficiais](https://github.com/fbsamples/whatsapp-api-examples/blob/main/send-messages-flight-app-python/message_helper.py), [Supabase — generateLink](https://supabase.com/docs/reference/javascript/auth-admin-generatelink).

## Quarto pacote: recuperação e operações financeiras das lojas

A solicitação de checkout usa chave persistida por empresa e assinatura do conteúdo. Repetição do mesmo conteúdo retorna o pedido existente; conteúdo diferente não reutiliza a chave. A chave é encerrada quando a compra passa a ter acompanhamento confirmado, permitindo comprar novamente itens idênticos. O registro de resultado é gravado na mesma transação do pedido; a tabela é privada. No piloto, uma transação simulou uma resposta existente e verificou a recuperação usando service_role, com rollback ao final: os três pedidos e zero registros de solicitação foram preservados.

Histórico contém Conferir pagamento e, para cancelado/pago Mercado Pago, Estornar valor integral com confirmação do operador. A rota verifica o administrador/empresa, consulta o provedor e confere moeda/valor/referência. Estornos parciais, múltiplas transações e solicitações já registradas exigem conferência no provedor. Estado incerto não é reenviado automaticamente. Cancelar pedido continua sendo uma operação separada de devolver dinheiro.

O cron de integrações também pode consultar até três pagamentos pendentes ou pagos/cancelados por execução, ordenando pela última consulta para distribuir tentativas. Só ativar MERCADO_PAGO_CONCILIACAO_ATIVA=true depois de homologar o fluxo. A conferência diária às 09h05 é contingência; webhook é a confirmação principal. Não prometer conciliação contínua a partir dessa agenda. Conferência do Pix existente reconhece confirmação do provedor. Credenciais de produção são recusadas no preview antes de criar cobrança ou estorno.

Aplicados em produção e piloto: conciliacao-pagamentos.sql e pedidos-idempotentes.sql. Uma primeira tentativa da segunda migração falhou na sintaxe do delimitador. Consultas confirmaram rollback integral; o delimitador foi corrigido e a migração aplicada. Não houve modificação parcial, compra ou movimentação financeira real.

O catálogo de testes existente não foi substituído por clientes, pedidos ou credenciais reais. Homologações e implementação PagBank/iFood/99 permanecem pendentes.
