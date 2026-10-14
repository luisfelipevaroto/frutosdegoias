begin;
create or replace function public.empresa_admin_por_dominio(p_dominio text)
returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(e) from public.empresas e where lower(e.dominio_principal)=lower(p_dominio) and public.is_admin_empresa(e.id) limit 1;
$$;
revoke execute on function public.empresa_admin_por_dominio(text) from public,anon;
grant execute on function public.empresa_admin_por_dominio(text) to authenticated;
create or replace function public.validar_empresa_novo_pedido()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.empresas where id=new.empresa_id and ativo) then raise exception 'Empresa indisponível para novos pedidos';end if;
 return new;
end $$;
revoke execute on function public.validar_empresa_novo_pedido() from public,anon,authenticated;
create trigger validar_empresa_novo_pedido before insert on public.pedidos for each row execute function public.validar_empresa_novo_pedido();
commit;
