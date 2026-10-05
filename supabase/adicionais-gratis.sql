-- Aplicar primeiro no piloto. Todos os produtos existentes mantêm limite zero.
alter table public.produtos add column if not exists adicionais_gratis integer not null default 0;
alter table public.produtos add constraint produtos_adicionais_gratis_check check (adicionais_gratis between 0 and 100);

create or replace function public.calcular_total_adicionais(p_empresa_id uuid,p_produto_id uuid,p_ids uuid[])
returns numeric language plpgsql stable security invoker set search_path='' as $$
declare v_gratis integer; v_qtd integer; v_distintos integer; v_validos integer; v_total numeric;
begin
  select adicionais_gratis into v_gratis from public.produtos where id=p_produto_id and empresa_id=p_empresa_id;
  if not found then raise exception 'Produto inválido para esta empresa'; end if;
  select count(*),count(distinct x) into v_qtd,v_distintos from unnest(coalesce(p_ids,'{}'::uuid[])) x;
  if v_qtd<>v_distintos then raise exception 'Adicionais repetidos ou inválidos'; end if;
  select count(*) into v_validos from public.adicionais a join public.produto_adicionais pa on pa.adicional_id=a.id
  where pa.produto_id=p_produto_id and a.empresa_id=p_empresa_id and a.id=any(coalesce(p_ids,'{}'::uuid[]));
  if v_validos<>v_qtd then raise exception 'Adicional não disponível para este produto'; end if;
  select coalesce(sum(preco) filter(where posicao>v_gratis),0) into v_total from (
    select a.preco,row_number() over(order by a.preco desc,a.id asc) as posicao
    from public.adicionais a join public.produto_adicionais pa on pa.adicional_id=a.id
    where pa.produto_id=p_produto_id and a.empresa_id=p_empresa_id and a.id=any(coalesce(p_ids,'{}'::uuid[]))
  ) valores;
  return v_total;
end $$;
revoke all on function public.calcular_total_adicionais(uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.calcular_total_adicionais(uuid,uuid,uuid[]) to service_role;

-- Conserva assinaturas, permissões e regras atuais dos pedidos.
do $$
declare f regprocedure; definition text; updated text; matches integer;
begin
  foreach f in array array[
    'public.criar_pedido(uuid,jsonb,text,text,timestamptz,numeric,text,jsonb,boolean)'::regprocedure,
    'public.criar_pedido_pdv(uuid,uuid,text,text,numeric,text,jsonb,text,boolean,numeric)'::regprocedure
  ] loop
    definition:=pg_get_functiondef(f);
    select count(*) into matches from regexp_matches(definition,'select coalesce\(sum\(a\.preco\),0\) into ad_total[^;]+;','g');
    if matches<>2 then raise exception 'Cálculo de adicionais inesperado em %',f; end if;
    updated:=regexp_replace(definition,'select coalesce\(sum\(a\.preco\),0\) into ad_total[^;]+;',
      'ad_total:=public.calcular_total_adicionais(p_empresa_id,pr.id,ad_ids);','g');
    execute updated;
  end loop;
  f:='public.catalogo_publico(uuid)'::regprocedure;
  definition:=pg_get_functiondef(f);
  if position('''preco'',p.preco,''preco_promocional'',p.preco_promocional,' in definition)=0 then raise exception 'Catálogo público inesperado'; end if;
  execute replace(definition,'''preco'',p.preco,''preco_promocional'',p.preco_promocional,',
    '''preco'',p.preco,''preco_promocional'',p.preco_promocional,''adicionais_gratis'',p.adicionais_gratis,');
end $$;
notify pgrst,'reload schema';

