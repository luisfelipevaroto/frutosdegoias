# Provedor e formas de pagamento

Cada empresa pode configurar Mercado Pago ou PagBank, apenas um por vez. A restrição é aplicada no cadastro de credenciais, no banco, na configuração manual e na autorização OAuth. Para trocar, desconectar o atual pelo painel. Credenciais desconectadas são preservadas para conciliar pagamentos anteriores e deixam de habilitar novos pagamentos.

Formas do painel: Dinheiro, Cartão na entrega, Cartão de crédito (online) e Pix (online). Os dois controles online são independentes e exigem o módulo de pagamento online e credenciais de um dos provedores configuradas. Pix manual foi removido. A configuração antiga `online:true` corresponde a Pix online; cartão online começa desativado e pode ser habilitado pelo responsável.

O checkout só oferece métodos habilitados e disponíveis. Mercado Pago aceita Pix pela rota existente e cartão pelo Checkout Pro, com exclusão de formas diferentes de crédito. Pedidos online são criados como pendentes em uma única transação para não aparecerem no painel como compras offline antes do pagamento. Endpoints de cobrança verificam novamente configuração, método e provedor antes de chamar o gateway.

PagBank ainda possui somente cadastro de credenciais e cliente de API; o checkout PagBank continua pendente. O painel mostra essa condição. Esta alteração não implementa cobrança PagBank nem força o uso de credenciais de produção. Nenhuma cobrança real é realizada nos testes.

Aplicar `supabase/pagamentos-exclusivos.sql` antes de publicar esta versão no ambiente correspondente. Migração aplicada em produção nesta etapa; piloto não foi migrado. As funções de conexão/desconexão são administrativas; a criação de pedidos usa uma função exclusiva do servidor.

No PDV, pagamentos offline são Dinheiro e Cartão na entrega. Pagamentos online devem usar o checkout da loja, evitando registrar um Pix manual como se fosse um Pix do gateway.
