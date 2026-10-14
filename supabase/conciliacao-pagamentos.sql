begin;
alter table public.pedidos add column pagamento_consultado_em timestamptz;
create index pedidos_conciliacao_idx on public.pedidos(pagamento_consultado_em asc nulls first) where provedor_pagamento='mercado_pago' and status_pagamento='pendente';
create table public.estornos_pedido(
 pedido_id uuid primary key references public.pedidos(id),empresa_id uuid not null references public.empresas(id),
 autor uuid not null,chave text unique not null,estado text not null default 'solicitado' check(estado in('solicitado','confirmado','incerto')),
 criado_em timestamptz not null default now(),atualizado_em timestamptz not null default now()
);
alter table public.estornos_pedido enable row level security;
revoke all on public.estornos_pedido from public,anon,authenticated;
grant select,insert,update on public.estornos_pedido to service_role;
commit;
