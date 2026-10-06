alter table public.entregas_integradas add column despacho_iniciado_em timestamptz;
create function public.marcar_inicio_despacho_uber() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.provedor='uber_direct' and new.status='solicitando' and (tg_op='INSERT' or new.chave_idempotencia is distinct from old.chave_idempotencia or new.despacho_iniciado_em is null) then new.despacho_iniciado_em=now();end if;
 return new;
end $$;
create trigger uber_inicio_despacho before insert or update on public.entregas_integradas for each row execute function public.marcar_inicio_despacho_uber();
revoke all on function public.marcar_inicio_despacho_uber() from public,anon,authenticated;
notify pgrst,'reload schema';
