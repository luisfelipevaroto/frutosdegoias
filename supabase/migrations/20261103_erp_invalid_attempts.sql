-- Limita credenciais invalidas por identificador opaco (hash SHA-256).
-- 10 tentativas por minuto por identificador. Contadores nao guardam tokens ou IPs em texto.
create table if not exists public.erp_api_tentativas_invalidas (
 identificador_hash text not null check (identificador_hash ~ '^[0-9a-f]{64}$'),
 janela_inicio timestamptz not null,
 tentativas integer not null default 1 check (tentativas between 1 and 10),
 primary key (identificador_hash, janela_inicio)
);
alter table public.erp_api_tentativas_invalidas enable row level security;
revoke all on public.erp_api_tentativas_invalidas from anon, authenticated;
grant select, insert, update, delete on public.erp_api_tentativas_invalidas to service_role;
create or replace function public.erp_api_consumir_tentativa_invalida(p_hash text)
returns boolean language plpgsql security invoker set search_path = ''
as $$
declare permitido boolean;
begin
 if p_hash !~ '^[0-9a-f]{64}$' or p_hash is null then return false; end if;
 insert into public.erp_api_tentativas_invalidas(identificador_hash,janela_inicio,tentativas)
 values(p_hash,date_trunc('minute',now()),1)
 on conflict(identificador_hash,janela_inicio) do update
 set tentativas=public.erp_api_tentativas_invalidas.tentativas+1
 where public.erp_api_tentativas_invalidas.tentativas < 10
 returning true into permitido;
 return coalesce(permitido,false);
end;
$$;
revoke all on function public.erp_api_consumir_tentativa_invalida(text) from public,anon,authenticated;
grant execute on function public.erp_api_consumir_tentativa_invalida(text) to service_role;
