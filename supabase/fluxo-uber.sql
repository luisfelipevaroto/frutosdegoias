-- Extensão aditiva para o piloto; etapas existentes são preservadas.
alter table public.pedidos add column pronto_em timestamptz;
alter table public.pedidos add column provedor_entrega text check(provedor_entrega in ('propria','uber_direct','ifood'));
alter table public.entregas_integradas add column chave_idempotencia uuid not null default gen_random_uuid();
alter table public.entregas_integradas add column request_payload jsonb;
alter table public.entregas_integradas add column tentativa_em timestamptz;
alter table public.entregas_integradas add column ultimo_evento_em timestamptz;
alter table public.entregas_integradas add column ambiente text;
create unique index uma_entrega_uber_por_pedido on public.entregas_integradas(pedido_id) where provedor='uber_direct' and pedido_id is not null;

create table public.uber_cotacoes(quote_id text primary key,empresa_id uuid not null references public.empresas(id),pedido_id uuid references public.pedidos(id),origem text not null,destino text not null,valor numeric(10,2) not null check(valor>=0),expira_em timestamptz not null,ambiente text not null,customer_id text not null,criado_em timestamptz not null default now());
alter table public.uber_cotacoes enable row level security;
revoke all on public.uber_cotacoes from public,anon,authenticated;
grant select,insert,update,delete on public.uber_cotacoes to service_role;
create index uber_cotacoes_expira_idx on public.uber_cotacoes(expira_em);

create function public.reservar_despacho_uber(p_empresa uuid,p_pedido uuid,p_quote text,p_payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.pedidos%rowtype;e public.entregas_integradas%rowtype;q public.uber_cotacoes%rowtype;
begin
 select * into p from public.pedidos where id=p_pedido and empresa_id=p_empresa for update;
 if p.id is null or p.tipo_entrega<>'entrega' or (p.status_pedido<>'em_preparo' or p.pronto_em is null) then raise exception 'Marque o pedido como pronto antes de solicitar o entregador';end if;
 if p.provedor_pagamento is not null and p.status_pagamento<>'pago' then raise exception 'Pagamento online não confirmado';end if;
 if not public.modulo_empresa_ativo(p_empresa,'entrega_integrada') then raise exception 'Entrega integrada não liberada';end if;
 select * into e from public.entregas_integradas where pedido_id=p.id and provedor='uber_direct' for update;
 if e.entrega_externa_id is not null then return to_jsonb(e);end if;
 if e.status in('solicitando','incerto') then
   if e.tentativa_em>now()-interval '45 seconds' then raise exception 'Solicitação em andamento. Aguarde e atualize a entrega.';end if;
   update public.entregas_integradas set tentativa_em=now(),status='solicitando' where id=e.id returning * into e;
   return to_jsonb(e);
 end if;
 select * into q from public.uber_cotacoes where quote_id=p_quote and empresa_id=p_empresa and pedido_id=p.id;
 if q.quote_id is null or q.expira_em<=now() or q.destino is distinct from p.endereco_entrega then raise exception 'Cotação inválida ou expirada. Calcule novamente.';end if;
 if e.id is null then insert into public.entregas_integradas(empresa_id,pedido_id,provedor,status,quote_id,valor_cotacao,moeda,ambiente,request_payload,tentativa_em) values(p_empresa,p.id,'uber_direct','solicitando',q.quote_id,q.valor,'BRL',q.ambiente,p_payload,now()) returning * into e;
 else update public.entregas_integradas set status='solicitando',quote_id=q.quote_id,valor_cotacao=q.valor,ambiente=q.ambiente,request_payload=p_payload,chave_idempotencia=gen_random_uuid(),tentativa_em=now(),erro=null where id=e.id returning * into e;end if;
 update public.pedidos set provedor_entrega='uber_direct' where id=p.id;
 return to_jsonb(e);
end $$;
revoke all on function public.reservar_despacho_uber(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.reservar_despacho_uber(uuid,uuid,text,jsonb) to service_role;

create function public.aplicar_evento_uber(p_entrega uuid,p_evento text,p_externo text,p_status text,p_quando timestamptz,p_resumo jsonb) returns boolean language plpgsql security invoker set search_path='' as $$
declare e public.entregas_integradas%rowtype;p public.pedidos%rowtype;pid uuid;rank_old integer;rank_new integer;
begin
 if p_status not in('pending','pickup','pickup_complete','dropoff','delivered','canceled','returned') or p_externo is null or p_quando is null then raise exception 'Evento inválido';end if;
 select pedido_id into pid from public.entregas_integradas where id=p_entrega and provedor='uber_direct';
 select * into p from public.pedidos where id=pid for update;
 select * into e from public.entregas_integradas where id=p_entrega and provedor='uber_direct' for update;
 if e.id is null or (e.entrega_externa_id is not null and e.entrega_externa_id<>p_externo) then raise exception 'Entrega não encontrada';end if;
 -- O identificador também é vinculado se o webhook chegar antes da resposta ao despacho.
 if e.entrega_externa_id is null then update public.entregas_integradas set entrega_externa_id=p_externo where id=e.id;end if;
 if p_evento is not null then
  if exists(select 1 from public.uber_webhook_eventos where evento_id=p_evento and entrega_externa_id=p_externo) then return false;end if;
  insert into public.uber_webhook_eventos(evento_id,entrega_externa_id,tipo,status,payload,ambiente) values(p_evento,p_externo,'event.delivery_status',p_status,p_resumo,e.ambiente);
 end if;
 if e.ultimo_evento_em is not null and p_quando<e.ultimo_evento_em then return false;end if;
 rank_old:=case e.status when 'pending' then 1 when 'pickup' then 2 when 'pickup_complete' then 3 when 'dropoff' then 4 when 'delivered' then 5 else 0 end;
 rank_new:=case p_status when 'pending' then 1 when 'pickup' then 2 when 'pickup_complete' then 3 when 'dropoff' then 4 when 'delivered' then 5 else 0 end;
 if (e.status in('delivered','returned') and p_status<>e.status) or (e.status='canceled' and p_status not in('canceled','returned')) or (rank_new>0 and rank_new<rank_old) then return false;end if;
 update public.entregas_integradas set status=p_status,ultimo_evento_em=p_quando,tracking_url=coalesce(p_resumo->>'tracking_url',tracking_url),pickup_eta=nullif(p_resumo->>'pickup_eta','')::timestamptz,dropoff_eta=nullif(p_resumo->>'dropoff_eta','')::timestamptz,dados=coalesce(dados,'{}')||jsonb_build_object('courier',p_resumo->'courier'),erro=case when p_status in('canceled','returned') then 'A corrida foi cancelada ou devolvida. Verifique o pedido.' else null end,atualizado_em=now() where id=e.id;
 if p.id is not null and p.status_pedido not in('cancelado','entregue') then

  if p_status in('pickup_complete','dropoff') then update public.pedidos set status_pedido='saiu_para_entrega' where id=p.id;
  elsif p_status='delivered' then update public.pedidos set status_pedido='entregue' where id=p.id;
  else update public.pedidos set status_pedido=status_pedido where id=p.id;end if;

 end if;
 return true;
end $$;
revoke all on function public.aplicar_evento_uber(uuid,text,text,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.aplicar_evento_uber(uuid,text,text,text,timestamptz,jsonb) to service_role;

create function public.alterar_etapa_pedido(p_empresa uuid,p_pedido uuid,p_status text,p_motivo text,p_usuario uuid) returns void language plpgsql security invoker set search_path='' as $$
declare p public.pedidos%rowtype;e public.entregas_integradas%rowtype;
begin
 select * into p from public.pedidos where id=p_pedido and empresa_id=p_empresa for update;
 if p.id is null then raise exception 'Pedido não encontrado';end if;
 if p.status_pedido in('cancelado','entregue') then raise exception 'Pedido já concluído';end if;
 select * into e from public.entregas_integradas where pedido_id=p.id and provedor='uber_direct' for update;
 if p_status='cancelado' then
  if e.status in('solicitando','incerto','pending','pickup','pickup_complete','dropoff') then raise exception 'Cancele ou confira a corrida na Uber e atualize a entrega antes de cancelar o pedido';end if;
  if coalesce(trim(p_motivo),'')='' then raise exception 'Informe o motivo do cancelamento';end if;
  update public.pedidos set status_pedido='cancelado',motivo_cancelamento=p_motivo,cancelado_em=now(),cancelado_por=p_usuario where id=p.id;
 elsif p_status='em_preparo' and p.status_pedido='recebido' then
  update public.pedidos set status_pedido='em_preparo',pronto_em=null where id=p.id;
 elsif p_status='pronto' and p.status_pedido='em_preparo' then
  update public.pedidos set pronto_em=coalesce(pronto_em,now()) where id=p.id;
 elsif p_status in('saiu_para_entrega','entregue') then
  if p.provedor_entrega='uber_direct' or e.id is not null then raise exception 'A entrega Uber é atualizada pela integração';end if;
  if (p_status='saiu_para_entrega' and p.tipo_entrega='entrega' and p.status_pedido='em_preparo' and p.pronto_em is not null) or (p_status='entregue' and ((p.tipo_entrega='retirada' and ((p.status_pedido='em_preparo' and p.pronto_em is not null) or p.status_pedido='saiu_para_entrega')) or (p.tipo_entrega='entrega' and p.status_pedido='saiu_para_entrega'))) then
   update public.pedidos set status_pedido=p_status where id=p.id;
  else raise exception 'Etapa incompatível com o pedido';end if;
 else raise exception 'Etapa incompatível com o pedido';end if;
end $$;
revoke all on function public.alterar_etapa_pedido(uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.alterar_etapa_pedido(uuid,uuid,text,text,uuid) to service_role;
notify pgrst,'reload schema';
