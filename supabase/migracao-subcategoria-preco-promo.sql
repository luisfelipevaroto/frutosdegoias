-- Rode isso no SQL Editor do Supabase. Não apaga nada, só adiciona colunas novas.

alter table produtos add column subcategoria text;
alter table produtos add column preco_promocional numeric(10,2);

-- Sugestão de valores para `subcategoria` nos produtos de categoria = 'picole':
-- 'tradicional', 'premium', 'kids', 'zero_lactose', 'paleta', 'proteico'
