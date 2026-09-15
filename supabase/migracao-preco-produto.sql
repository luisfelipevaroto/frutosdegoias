-- Rode isso no SQL Editor do Supabase. Não apaga nada, só adiciona a coluna.
-- Produtos simples (picolé, sorvete, açaí) usam este preço direto.
-- Produtos com variação (ex: Monte do seu Jeito) ignoram esta coluna e usam
-- a tabela `variacoes` normalmente.

alter table produtos add column preco numeric(10,2) default 2.00;
