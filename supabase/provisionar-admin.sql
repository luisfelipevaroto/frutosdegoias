begin;
create or replace function public.provisionar_admin_empresa(p_empresa uuid,p_usuario uuid,p_plano uuid,p_autor uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.super_admin_users where user_id=p_autor) then raise exception 'Acesso negado' using errcode='42501';end if;
 perform 1 from public.empresas where id=p_empresa for update;if not found then raise exception 'Empresa não encontrada';end if;
 if p_plano is not null then
  if not exists(select 1 from public.planos where id=p_plano and ativo) then raise exception 'Plano indisponível';end if;
  if exists(select 1 from public.assinaturas_empresa where empresa_id=p_empresa and plano_id<>p_plano) then raise exception 'Altere primeiro o contrato comercial';end if;
  update public.empresas set plano_id=p_plano,atualizado_em=clock_timestamp() where id=p_empresa;
 end if;
 insert into public.admin_users(user_id,empresa_id) values(p_usuario,p_empresa) on conflict(user_id,empresa_id) do nothing;
end $$;
revoke execute on function public.provisionar_admin_empresa(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.provisionar_admin_empresa(uuid,uuid,uuid,uuid) to service_role;
commit;
