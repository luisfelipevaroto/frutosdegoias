-- Rate limiting atomico por chave ERP: 60 chamadas por minuto UTC.
create table if not exists public.erp_api_limites (
 chave_id uuid not null references public.erp_api_chaves(id) on delete cascade,
 janela_inicio timestamptz not null,
 requisicoes integer not null default 1 check (requisicoes between 1 and 60),
 primary key (chave_id, janela_inicio)
);
alter table public.erp_api_limites enable row level security;
revoke all on public.erp_api_limites from anon, authenticated;
grant select, insert, update, delete on public.erp_api_limites to service_role;

create or replace function public.erp_api_consumir_limite(p_chave_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare permitido boolean;
begin
 insert into public.erp_api_limites(chave_id, janela_inicio, requisicoes)
 values (p_chave_id, date_trunc('minute', now()), 1)
 on conflict (chave_id, janela_inicio) do update
 set requisicoes = public.erp_api_limites.requisicoes + 1
 where public.erp_api_limites.requisicoes < 60
 returning true into permitido;
 return coalesce(permitido, false);
end;
$$;
revoke all on function public.erp_api_consumir_limite(uuid) from public, anon, authenticated;
grant execute on function public.erp_api_consumir_limite(uuid) to service_role;
comment on function public.erp_api_consumir_limite(uuid) is
 'Rate limit atomico de 60 chamadas/minuto por chave ERP. Somente service_role.';
