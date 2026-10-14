begin;
alter table public.whatsapp_notificacoes add column mensagem_externa_id text unique;
alter table public.whatsapp_notificacoes add column status_entrega text;
alter table public.whatsapp_notificacoes add column tentativa_iniciada_em timestamptz;
alter table public.whatsapp_notificacoes add column proxima_tentativa_em timestamptz not null default now();
create or replace function public.whatsapp_modulo_ativo(p_empresa_id uuid)
returns boolean language sql stable security invoker set search_path='' as $$select public.modulo_empresa_ativo(p_empresa_id,'whatsapp_api')$$;
create or replace function public.enfileirar_whatsapp_status()
returns trigger language plpgsql security definer set search_path='' as $$
declare tel text;visual text;anterior text;message text;
begin
 if not coalesce(new.whatsapp_optin,false) or public.whatsapp_modulo_ativo(new.empresa_id) is distinct from true then return new;end if;
 visual:=case when new.status_pedido='em_preparo' and new.pronto_em is not null then 'pronto' else new.status_pedido end;
 anterior:=case when old.status_pedido='em_preparo' and old.pronto_em is not null then 'pronto' else old.status_pedido end;
 if visual=anterior and coalesce(old.whatsapp_optin,false) then return new;end if;
 select coalesce(nullif(c.whatsapp,''),c.telefone) into tel from public.clientes c where c.id=new.cliente_id and c.empresa_id=new.empresa_id;
 if coalesce(tel,'')='' then return new;end if;
 message:='Seu pedido #'||new.numero||' está '||case visual when 'recebido' then 'recebido' when 'em_preparo' then 'em preparo' when 'pronto' then case when new.tipo_entrega='retirada' then 'pronto para retirada' else 'pronto para coleta' end when 'saiu_para_entrega' then 'a caminho' when 'entregue' then 'concluído' when 'cancelado' then 'cancelado' else visual end||'.';
 insert into public.whatsapp_notificacoes(empresa_id,pedido_id,status_pedido,telefone,mensagem) values(new.empresa_id,new.id,visual,tel,message) on conflict(pedido_id,status_pedido) do nothing;
 return new;
end $$;
revoke execute on function public.enfileirar_whatsapp_status() from public,anon,authenticated;
create or replace trigger trg_enfileirar_whatsapp_status after update of status_pedido,pronto_em,whatsapp_optin on public.pedidos for each row execute function public.enfileirar_whatsapp_status();
create or replace function public.reservar_notificacoes_whatsapp(p_empresa uuid)
returns setof public.whatsapp_notificacoes language sql security invoker set search_path='' as $$
 update public.whatsapp_notificacoes set status_envio='enviando',tentativas=tentativas+1,tentativa_iniciada_em=clock_timestamp()
 where id in(select id from public.whatsapp_notificacoes where empresa_id=p_empresa and status_envio in('pendente','erro') and tentativas<5 and proxima_tentativa_em<=now() and criado_em>now()-interval '24 hours' order by criado_em for update skip locked limit 5)
 returning *;
$$;
revoke execute on function public.reservar_notificacoes_whatsapp(uuid) from public,anon,authenticated;
grant execute on function public.reservar_notificacoes_whatsapp(uuid) to service_role;
create index whatsapp_fila_pendente_idx on public.whatsapp_notificacoes(empresa_id,proxima_tentativa_em) where status_envio in('pendente','erro');
commit;
