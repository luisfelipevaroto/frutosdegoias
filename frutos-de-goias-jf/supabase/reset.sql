-- Rode este script ANTES do schema.sql, caso ele já tenha sido rodado
-- parcialmente antes e agora acuse "relation already exists".
-- Isso apaga as tabelas do projeto (seguro agora, pois ainda não há dados reais).

drop table if exists itens_pedido cascade;
drop table if exists pedidos cascade;
drop table if exists produto_adicionais cascade;
drop table if exists variacoes cascade;
drop table if exists adicionais cascade;
drop table if exists clientes cascade;
drop table if exists produtos cascade;
