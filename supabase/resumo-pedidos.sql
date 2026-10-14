begin;
create or replace function public.resumo_pedidos_admin(p_empresa_id uuid,p_inicio date,p_fim date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.is_admin_empresa(p_empresa_id) then raise exception 'Acesso negado' using errcode='42501';end if;
 if public.modulo_empresa_ativo(p_empresa_id,'pedidos') is distinct from true and public.modulo_empresa_ativo(p_empresa_id,'relatorios') is distinct from true then raise exception 'Módulo indisponível' using errcode='42501';end if;
 if p_inicio is null or p_fim is null or p_fim<p_inicio or p_fim-p_inicio>366 then raise exception 'Selecione um período de até 366 dias';end if;
 select jsonb_build_object(
  'pedidos',count(*),'cancelados',count(*) filter(where status_pedido='cancelado'),
  'valor_pedidos',coalesce(sum(valor_total) filter(where status_pedido<>'cancelado'),0),
  'pagamentos_confirmados',coalesce(sum(valor_total) filter(where status_pagamento='pago' and status_pedido<>'cancelado'),0),
  'em_andamento',(select count(*) from public.pedidos where empresa_id=p_empresa_id and status_pedido in ('recebido','em_preparo','saiu_para_entrega') and (provedor_pagamento is null or status_pagamento='pago'))
 ) into result from public.pedidos where empresa_id=p_empresa_id
 and criado_em >= (p_inicio::timestamp at time zone 'America/Sao_Paulo')
 and criado_em < ((p_fim+1)::timestamp at time zone 'America/Sao_Paulo');
 if public.modulo_empresa_ativo(p_empresa_id,'relatorios') is distinct from true then
  result:=result-'valor_pedidos'-'pagamentos_confirmados';
 end if;
 return result;
end $$;
revoke all on function public.resumo_pedidos_admin(uuid,date,date) from public,anon;
grant execute on function public.resumo_pedidos_admin(uuid,date,date) to authenticated;
create index if not exists pedidos_empresa_criado_id_idx on public.pedidos(empresa_id,criado_em desc,id);
commit;
