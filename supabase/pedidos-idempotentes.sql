begin;
create table public.pedidos_solicitacoes(empresa_id uuid not null references public.empresas(id),chave uuid not null,impressao text not null,resultado jsonb not null,criado_em timestamptz not null default now(),primary key(empresa_id,chave));
alter table public.pedidos_solicitacoes enable row level security;
revoke all on public.pedidos_solicitacoes from public,anon,authenticated;
grant select,insert on public.pedidos_solicitacoes to service_role;
create or replace function public.criar_pedido_com_pagamento(p_empresa_id uuid,p_online boolean,p_dados jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg jsonb; entrega jsonb; provedor text; forma text:=p_dados->>'p_forma_pagamento'; j jsonb;
 troco boolean:=forma='dinheiro' and coalesce((p_dados->>'p_precisa_troco')::boolean,false);
 valor_troco numeric; taxa numeric:=(p_dados->>'p_taxa_entrega')::numeric; minimo numeric;
begin
 if nullif(p_dados->>'p_chave','') is not null then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_empresa_id::text||(p_dados->>'p_chave'),0));
  select resultado into j from public.pedidos_solicitacoes where empresa_id=p_empresa_id and chave=(p_dados->>'p_chave')::uuid and impressao=p_dados->>'p_impressao';
  if found then return j||jsonb_build_object('recuperado',true);end if;
  if exists(select 1 from public.pedidos_solicitacoes where empresa_id=p_empresa_id and chave=(p_dados->>'p_chave')::uuid) then raise exception 'Solicitação já usada para outro pedido';end if;
 end if;
 perform 1 from public.empresas where id=p_empresa_id and ativo for update;
 if not found then raise exception 'Empresa indisponível';end if;
 select valor into cfg from public.configuracoes_loja where empresa_id=p_empresa_id and chave='pagamentos';
 select valor into entrega from public.configuracoes_loja where empresa_id=p_empresa_id and chave='entrega';
 minimo:=coalesce((entrega->>'pedido_minimo')::numeric,0);
 if p_online then
  select s.provedor into provedor from public.status_pagamento_online(p_empresa_id) s where s.ativo;
  if provedor is distinct from 'mercado_pago' or not ((forma='pix' and coalesce((cfg->>'pix_online')::boolean,(cfg->>'online')::boolean,false)) or (forma='cartao' and coalesce((cfg->>'cartao_online')::boolean,false))) then raise exception 'Pagamento online indisponível';end if;
 elsif not ((forma='dinheiro' and coalesce((cfg->>'dinheiro')::boolean,false)) or (forma='cartao' and coalesce((cfg->>'cartao_entrega')::boolean,false))) then raise exception 'Forma de pagamento indisponível';end if;
 if taxa is null or taxa<0 or taxa>10000 then raise exception 'Valor de entrega inválido';end if;
 j:=public.criar_pedido(p_empresa_id,p_dados->'p_cliente',p_dados->>'p_tipo_entrega',p_dados->>'p_endereco_entrega',nullif(p_dados->>'p_horario_retirada','')::timestamptz,taxa,forma,p_dados->'p_itens',coalesce((p_dados->>'p_usar_fidelidade')::boolean,false));
 -- Exceptions roll back the entire operation, including customer, items and coupon.
 if (j->>'valor_total')::numeric-taxa<minimo then raise exception 'O pedido mínimo é R$ %',minimo;end if;
 if troco then
  valor_troco:=nullif(p_dados->>'p_troco_para','')::numeric;
  if valor_troco is null or valor_troco<=(j->>'valor_total')::numeric then raise exception 'Informe um valor para troco maior que o total do pedido';end if;
 end if;
 update public.pedidos set
  provedor_pagamento=case when p_online then provedor else provedor_pagamento end,
  status_pagamento=case when p_online then 'pendente' else status_pagamento end,
  observacoes=nullif(left(trim(p_dados->>'p_observacoes'),500),''),
  precisa_troco=troco,troco_para=valor_troco,
  provedor_entrega=case when p_dados->>'p_tipo_entrega'='entrega' then coalesce(p_dados->>'p_provedor_entrega','propria') else null end
 where id=(j->>'id')::uuid and empresa_id=p_empresa_id;
 if p_online then j:=j||jsonb_build_object('provedor_pagamento',provedor);end if;
 if nullif(p_dados->>'p_chave','') is not null then
  insert into public.pedidos_solicitacoes(empresa_id,chave,impressao,resultado) values(p_empresa_id,(p_dados->>'p_chave')::uuid,p_dados->>'p_impressao',j);
 end if;
 return j;
end $$;
revoke execute on function public.criar_pedido_com_pagamento(uuid,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.criar_pedido_com_pagamento(uuid,boolean,jsonb) to service_role;
commit;
