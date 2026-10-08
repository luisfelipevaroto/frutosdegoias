-- Uma conexão ativa por empresa; credenciais desconectadas preservam o histórico.
alter table public.integracoes_credenciais add column pagamento_conectado boolean not null default true;
create unique index pagamento_conectado_unico on public.integracoes_credenciais(empresa_id) where provedor in('mercado_pago','pagbank') and pagamento_conectado;

create function public.validar_conexao_pagamento() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.provedor in('mercado_pago','pagbank') and new.pagamento_conectado then
  if auth.uid() is not null and not public.is_admin_empresa(new.empresa_id) then raise exception 'Sem acesso';end if;
  perform 1 from public.empresas where id=new.empresa_id for update;
  if exists(select 1 from public.integracoes_credenciais c where c.empresa_id=new.empresa_id and c.provedor in('mercado_pago','pagbank') and c.provedor<>new.provedor and c.pagamento_conectado) then raise exception 'Desconecte o provedor de pagamento atual antes de configurar outro';end if;
  if new.ambiente not in('teste','producao') or nullif(trim(new.credenciais->>case when new.provedor='mercado_pago' then 'access_token' else 'token' end),'') is null then raise exception 'Informe credenciais e ambiente válidos';end if;
 end if;
 return new;
end $$;
revoke all on function public.validar_conexao_pagamento() from public,anon,authenticated;
create trigger pagamento_conexao_exclusiva before insert or update on public.integracoes_credenciais for each row execute function public.validar_conexao_pagamento();

create or replace function public.salvar_credencial_pagamento(p_empresa_id uuid,p_provedor text,p_ambiente text,p_credenciais jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin_empresa(p_empresa_id) then raise exception 'Sem acesso';end if;
 if p_provedor not in('mercado_pago','pagbank','infinitepay','stone','paypal') then raise exception 'Provedor inválido';end if;
 if p_provedor in('mercado_pago','pagbank') and not public.modulo_empresa_ativo(p_empresa_id,'pagamento_online') then raise exception 'Pagamento online não liberado';end if;
 insert into public.integracoes_credenciais(empresa_id,provedor,ambiente,credenciais,pagamento_conectado,atualizado_em) values(p_empresa_id,p_provedor,coalesce(nullif(p_ambiente,''),'teste'),p_credenciais,true,now()) on conflict(empresa_id,provedor) do update set ambiente=excluded.ambiente,credenciais=excluded.credenciais,pagamento_conectado=true,atualizado_em=now();
end $$;
revoke all on function public.salvar_credencial_pagamento(uuid,text,text,jsonb) from public,anon;
grant execute on function public.salvar_credencial_pagamento(uuid,text,text,jsonb) to authenticated;

create or replace function public.status_credencial_pagamento(p_empresa_id uuid) returns table(provedor text,ambiente text,configurado boolean,atualizado_em timestamptz) language sql security definer set search_path='' as $$
 select c.provedor,c.ambiente,true,c.atualizado_em from public.integracoes_credenciais c where c.empresa_id=p_empresa_id and c.pagamento_conectado and public.is_admin_empresa(p_empresa_id)
$$;
revoke all on function public.status_credencial_pagamento(uuid) from public,anon;
grant execute on function public.status_credencial_pagamento(uuid) to authenticated;

create or replace function public.status_pagamento_online(p_empresa_id uuid) returns table(provedor text,ativo boolean) language sql security definer set search_path='' as $$
 select i.provedor,true from public.integracoes_empresa i join public.integracoes_credenciais c on c.empresa_id=i.empresa_id and c.provedor=i.provedor where i.empresa_id=p_empresa_id and i.tipo='pagamento' and i.ativo and i.provedor in('mercado_pago','pagbank') and c.pagamento_conectado and nullif(trim(c.credenciais->>case when c.provedor='mercado_pago' then 'access_token' else 'token' end),'') is not null and public.modulo_empresa_ativo(p_empresa_id,'pagamento_online')
$$;
revoke all on function public.status_pagamento_online(uuid) from public;
grant execute on function public.status_pagamento_online(uuid) to anon,authenticated,service_role;

create function public.validar_formas_pagamento() returns trigger language plpgsql security definer set search_path='' as $$
declare pix boolean;cartao boolean;
begin
 if new.chave='pagamentos' then
  if auth.uid() is not null and not public.is_admin_empresa(new.empresa_id) then raise exception 'Sem acesso';end if;
  perform 1 from public.empresas where id=new.empresa_id for update;
  pix:=coalesce((new.valor->>'pix_online')::boolean,(new.valor->>'online')::boolean,false);cartao:=coalesce((new.valor->>'cartao_online')::boolean,false);
  if (pix or cartao) and (not public.modulo_empresa_ativo(new.empresa_id,'pagamento_online') or not exists(select 1 from public.integracoes_credenciais c where c.empresa_id=new.empresa_id and c.provedor in('mercado_pago','pagbank') and c.pagamento_conectado and nullif(trim(c.credenciais->>case when c.provedor='mercado_pago' then 'access_token' else 'token' end),'') is not null)) then raise exception 'Configure Mercado Pago ou PagBank antes de ativar cartão de crédito e Pix online';end if;
  new.valor:=coalesce(new.valor,'{}')||jsonb_build_object('pix_online',pix,'cartao_online',cartao,'online',pix or cartao,'pix_manual',false);
 end if;
 return new;
end $$;
revoke all on function public.validar_formas_pagamento() from public,anon,authenticated;
create trigger pagamento_formas_validas before insert or update on public.configuracoes_loja for each row execute function public.validar_formas_pagamento();

create function public.desconectar_provedor_pagamento(p_empresa_id uuid,p_provedor text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin_empresa(p_empresa_id) then raise exception 'Sem acesso';end if;
 if p_provedor not in('mercado_pago','pagbank') then raise exception 'Provedor inválido';end if;
 perform 1 from public.empresas where id=p_empresa_id for update;
 update public.integracoes_credenciais set pagamento_conectado=false,atualizado_em=now() where empresa_id=p_empresa_id and provedor=p_provedor;
 update public.integracoes_empresa set ativo=false where empresa_id=p_empresa_id and tipo='pagamento' and provedor=p_provedor;
 update public.configuracoes_loja set valor=valor||'{"online":false,"pix_online":false,"cartao_online":false,"pix_manual":false}'::jsonb,atualizado_em=now() where empresa_id=p_empresa_id and chave='pagamentos';
end $$;
revoke all on function public.desconectar_provedor_pagamento(uuid,text) from public,anon;
grant execute on function public.desconectar_provedor_pagamento(uuid,text) to authenticated;
-- O pedido online já nasce identificado como pendente, no mesmo commit da criação.
create function public.criar_pedido_com_pagamento(p_empresa_id uuid,p_online boolean,p_dados jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg jsonb;provedor text;forma text:=p_dados->>'p_forma_pagamento';j jsonb;
begin
 perform 1 from public.empresas where id=p_empresa_id for update;
 select valor into cfg from public.configuracoes_loja where empresa_id=p_empresa_id and chave='pagamentos';
 if p_online then
  select s.provedor into provedor from public.status_pagamento_online(p_empresa_id) s where s.ativo;
  if provedor is distinct from 'mercado_pago' or not ((forma='pix' and coalesce((cfg->>'pix_online')::boolean,(cfg->>'online')::boolean,false)) or (forma='cartao' and coalesce((cfg->>'cartao_online')::boolean,false))) then raise exception 'Pagamento online indisponível';end if;
 elsif not ((forma='dinheiro' and coalesce((cfg->>'dinheiro')::boolean,false)) or (forma='cartao' and coalesce((cfg->>'cartao_entrega')::boolean,false))) then raise exception 'Forma de pagamento indisponível';end if;
 j:=public.criar_pedido(p_empresa_id,p_dados->'p_cliente',p_dados->>'p_tipo_entrega',p_dados->>'p_endereco_entrega',nullif(p_dados->>'p_horario_retirada','')::timestamptz,(p_dados->>'p_taxa_entrega')::numeric,forma,p_dados->'p_itens',coalesce((p_dados->>'p_usar_fidelidade')::boolean,false));
 if p_online then update public.pedidos set provedor_pagamento=provedor,status_pagamento='pendente' where id=(j->>'id')::uuid and empresa_id=p_empresa_id;j:=j||jsonb_build_object('provedor_pagamento',provedor);end if;
 return j;
end $$;
revoke all on function public.criar_pedido_com_pagamento(uuid,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.criar_pedido_com_pagamento(uuid,boolean,jsonb) to service_role;
notify pgrst,'reload schema';
