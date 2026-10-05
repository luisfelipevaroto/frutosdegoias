# Adicionais grátis por produto

Na aba Produtos, marque “Este produto oferece adicionais grátis?” e informe
a quantidade por unidade. Vincule os adicionais normalmente, mantendo seus
preços cadastrados: eles serão usados para cobrar os que excederem o limite.
Desmarcar salva limite zero e mantém a cobrança normal.

Exemplo: limite 3; selecionados adicionais de R$4, R$3, R$2 e R$1.
Os três mais caros ficam grátis e o adicional de R$1 é cobrado. Dois produtos
com essa combinação pagam R$2 de extras. A ordem de seleção não altera o preço.
Empates usam o identificador do adicional para manter o cálculo consistente.

O cardápio destaca “Até 3 adicionais grátis” no produto e no modal. O modal
identifica os selecionados gratuitos, mostra a cobrança excedente e ajusta o
total. Produtos com adicionais abrem a personalização pelo botão +.
O caixa/PDV aplica a mesma regra; o banco recalcula preço por unidade na criação
do pedido e no registro dos itens, sem confiar nos preços enviados pelo cliente.

Migration `produtos_adicionais_gratis`: supabase/adicionais-gratis.sql.
Foi aplicada somente no Pilot-teste. Default zero preserva os produtos atuais;
nenhum produto existente recebeu a promoção automaticamente. Antes de publicar
o código em produção, aplicar a migration no banco real e validar os cálculos.
Não reaplicar na mesma base: a constraint e os pontos de substituição são únicos.
O script conserva assinaturas e permissões das RPCs existentes; o helper novo
é SECURITY INVOKER e só permite execução por service_role. RLS permanece ativa.

Verificação: 21 testes de aplicação. tests/adicionais-gratis-db.sql roda somente
no piloto com dados fictícios e rollback: cobre três grátis, excedentes, ordem,
quantidade, variação, promoção, regra zero, catálogo, site e PDV. Rejeita IDs
repetidos e adicionais não vinculados. Dados comerciais reais não são alterados.

Para conferir no piloto: criar/editar Açaí com quatro adicionais e limite três;
selecionar três e depois quatro; alterar tamanho/quantidade; desmarcar a regra
no painel e conferir preços normais. Repetir a combinação no PDV.

