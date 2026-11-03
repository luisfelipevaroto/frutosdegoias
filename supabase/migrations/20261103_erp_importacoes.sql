-- Confirmacoes idempotentes de importacao de pedidos pelo ERP.
-- Aplicar apos 20261103_erp_api_keys.sql em ambiente de teste.
create table if not exists public.erp_pedidos_importacoes (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  chave_id uuid references public.erp_api_chaves(id) on delete set null,
  referencia_erp text,
  importado_em timestamptz not null default now(),
  primary key (empresa_id, pedido_id),
  constraint erp_referencia_valida check (
    referencia_erp is null or (char_length(referencia_erp) between 1 and 120)
  )
);
create index if not exists erp_pedidos_importacoes_empresa_data_idx
  on public.erp_pedidos_importacoes (empresa_id, importado_em);
alter table public.erp_pedidos_importacoes enable row level security;
revoke all on public.erp_pedidos_importacoes from anon, authenticated;
grant select, insert, update, delete on public.erp_pedidos_importacoes to service_role;
comment on table public.erp_pedidos_importacoes is
  'Confirmacao de importacao pelo ERP; nao modifica status de pedido nem pagamento.';
