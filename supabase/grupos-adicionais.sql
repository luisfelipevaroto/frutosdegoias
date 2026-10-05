-- Instalar no piloto e validar antes de publicar em produção.
create table public.grupos_adicionais (
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 nome text not null check(length(trim(nome)) between 1 and 100), gratis boolean not null default true,
 minimo integer not null default 1 check(minimo between 1 and 100), maximo integer,
 ativo boolean not null default true, criado_em timestamptz not null default now(),
 check((gratis and maximo is not null and maximo between minimo and 100) or (not gratis and minimo=1 and maximo is null))
);
create unique index grupos_adicionais_nome_idx on public.grupos_adicionais(empresa_id,lower(trim(nome)));
alter table public.adicionais add column grupo_id uuid references public.grupos_adicionais(id) on delete restrict;
alter table public.adicionais add column ativo boolean not null default true;
create index adicionais_grupo_idx on public.adicionais(grupo_id);
create table public.produto_grupos_adicionais (
 produto_id uuid not null references public.produtos(id) on delete cascade,
 grupo_id uuid not null references public.grupos_adicionais(id) on delete restrict,
 primary key(produto_id,grupo_id)
);
create index produto_grupos_grupo_idx on public.produto_grupos_adicionais(grupo_id);
alter table public.grupos_adicionais enable row level security;
alter table public.produto_grupos_adicionais enable row level security;
revoke all on public.grupos_adicionais,public.produto_grupos_adicionais from public,anon,authenticated;
grant select,insert,update,delete on public.grupos_adicionais,public.produto_grupos_adicionais to authenticated,service_role;
create policy grupos_admin on public.grupos_adicionais for all to authenticated using(public.is_admin_empresa(empresa_id)) with check(public.is_admin_empresa(empresa_id));
create policy produto_grupos_admin on public.produto_grupos_adicionais for all to authenticated
 using(exists(select 1 from public.produtos p where p.id=produto_id and public.is_admin_empresa(p.empresa_id)))
 with check(exists(select 1 from public.produtos p join public.grupos_adicionais g on g.id=grupo_id and g.empresa_id=p.empresa_id where p.id=produto_id and public.is_admin_empresa(p.empresa_id)));

-- Integridade entre empresas, inclusive nas gravações feitas pelo servidor.
create function public.validar_empresa_grupo() returns trigger language plpgsql security invoker set search_path='' as $$
declare e uuid; ge uuid;
begin
 if tg_table_name='adicionais' then
   if new.grupo_id is null then return new; end if; e:=new.empresa_id;
 else select empresa_id into e from public.produtos where id=new.produto_id; end if;
 select empresa_id into ge from public.grupos_adicionais where id=new.grupo_id;
 if ge is distinct from e then raise exception 'Grupo de outra empresa'; end if;
 return new;
end $$;
revoke all on function public.validar_empresa_grupo() from public,anon,authenticated;
create trigger adicionais_empresa_grupo before insert or update of empresa_id,grupo_id on public.adicionais for each row execute function public.validar_empresa_grupo();
create trigger produto_grupos_empresa before insert or update on public.produto_grupos_adicionais for each row execute function public.validar_empresa_grupo();

-- Grava título, regras e itens numa transação, sem remover itens do histórico.
create function public.salvar_grupo_adicionais(p_empresa_id uuid,p_id uuid,p_nome text,p_gratis boolean,p_minimo integer,p_maximo integer,p_ativo boolean,p_itens jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare gid uuid; item jsonb; aid uuid; retained uuid[]:='{}'; validos integer;
begin
 if auth.uid() is null or not public.is_admin_empresa(p_empresa_id) then raise exception 'Sem acesso a esta empresa'; end if;
 if p_itens is null or jsonb_typeof(p_itens)<>'array' or jsonb_array_length(p_itens)>100 then raise exception 'Lista de itens inválida'; end if;
 if p_gratis is null or p_ativo is null or p_minimo is null or (p_gratis and (p_maximo is null or p_minimo<1 or p_maximo<p_minimo or p_maximo>100)) then raise exception 'Verifique mínimo e máximo'; end if;
 if p_id is null then
   insert into public.grupos_adicionais(empresa_id,nome,gratis,minimo,maximo,ativo) values(p_empresa_id,trim(p_nome),p_gratis,case when p_gratis then p_minimo else 1 end,case when p_gratis then p_maximo else null end,p_ativo) returning id into gid;
 else
   select id into gid from public.grupos_adicionais where id=p_id and empresa_id=p_empresa_id for update;
   if not found then raise exception 'Grupo não encontrado'; end if;
   update public.grupos_adicionais set nome=trim(p_nome),gratis=p_gratis,minimo=case when p_gratis then p_minimo else 1 end,maximo=case when p_gratis then p_maximo else null end,ativo=p_ativo where id=gid;
 end if;
 for item in select * from jsonb_array_elements(p_itens) loop
   if length(trim(coalesce(item->>'nome',''))) not between 1 and 100 then raise exception 'Informe o nome dos itens'; end if;
   if not p_gratis and ((item->>'preco')::numeric is null or (item->>'preco')::numeric<0 or (item->>'preco')::numeric>999999.99) then raise exception 'Preço inválido'; end if;
   aid:=nullif(item->>'id','')::uuid;
   if aid is null then
     insert into public.adicionais(empresa_id,grupo_id,nome,preco,ativo) values(p_empresa_id,gid,trim(item->>'nome'),case when p_gratis then 0 else (item->>'preco')::numeric end,coalesce((item->>'ativo')::boolean,true)) returning id into aid;
   else
     if aid=any(retained) then raise exception 'Item repetido'; end if;
     update public.adicionais set nome=trim(item->>'nome'),preco=case when p_gratis then 0 else (item->>'preco')::numeric end,ativo=coalesce((item->>'ativo')::boolean,true) where id=aid and grupo_id=gid and empresa_id=p_empresa_id;
     if not found then raise exception 'Item de outro grupo'; end if;
   end if;
   retained:=array_append(retained,aid);
 end loop;
 update public.adicionais set ativo=false where grupo_id=gid and not(id=any(retained));
 select count(*) into validos from public.adicionais where grupo_id=gid and ativo;
 if p_ativo and validos<(case when p_gratis then p_minimo else 1 end) then raise exception 'Cadastre itens suficientes para o mínimo obrigatório'; end if;
 return gid;
end $$;
revoke all on function public.salvar_grupo_adicionais(uuid,uuid,text,boolean,integer,integer,boolean,jsonb) from public,anon;
grant execute on function public.salvar_grupo_adicionais(uuid,uuid,text,boolean,integer,integer,boolean,jsonb) to authenticated,service_role;

create function public.vincular_grupos_produto(p_produto_id uuid,p_grupos uuid[]) returns void language plpgsql security invoker set search_path='' as $$
declare eid uuid; n integer; validos integer;
begin
 select empresa_id into eid from public.produtos where id=p_produto_id for update;
 if eid is null or auth.uid() is null or not public.is_admin_empresa(eid) then raise exception 'Sem acesso a este produto'; end if;
 select count(*),count(distinct x) into n,validos from unnest(coalesce(p_grupos,'{}'::uuid[])) x;
 if n<>validos then raise exception 'Grupos repetidos ou inválidos'; end if;
 select count(*) into validos from public.grupos_adicionais where empresa_id=eid and id=any(coalesce(p_grupos,'{}'::uuid[]));
 if n<>validos then raise exception 'Grupo de outra empresa'; end if;
 if exists(select 1 from public.grupos_adicionais g where g.id=any(coalesce(p_grupos,'{}'::uuid[])) and g.ativo and (select count(*) from public.adicionais a where a.grupo_id=g.id and a.ativo)<g.minimo) then raise exception 'Grupo sem itens suficientes'; end if;
 delete from public.produto_grupos_adicionais where produto_id=p_produto_id;
 insert into public.produto_grupos_adicionais(produto_id,grupo_id) select p_produto_id,x from unnest(coalesce(p_grupos,'{}'::uuid[])) x;
end $$;
revoke all on function public.vincular_grupos_produto(uuid,uuid[]) from public,anon;
grant execute on function public.vincular_grupos_produto(uuid,uuid[]) to authenticated,service_role;

create function public.grupos_produto_json(p_produto_id uuid,p_empresa_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'nome',g.nome,'gratis',g.gratis,'minimo',g.minimo,'maximo',g.maximo,
 'itens',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'nome',a.nome,'preco',case when g.gratis then 0 else a.preco end) order by a.nome,a.id),'[]'::jsonb) from public.adicionais a where a.grupo_id=g.id and a.empresa_id=p_empresa_id and a.ativo)) order by g.criado_em,g.id),'[]'::jsonb)
 from public.produto_grupos_adicionais pg join public.grupos_adicionais g on g.id=pg.grupo_id
 where pg.produto_id=p_produto_id and g.empresa_id=p_empresa_id and g.ativo;
$$;
revoke all on function public.grupos_produto_json(uuid,uuid) from public,anon,authenticated;
grant execute on function public.grupos_produto_json(uuid,uuid) to service_role;

create function public.calcular_adicionais_grupos(p_empresa_id uuid,p_produto_id uuid,p_ids uuid[]) returns numeric language plpgsql stable security invoker set search_path='' as $$
declare qtd integer; distintos integer; validos integer; regra record; escolhidos integer; total numeric;
begin
 if not exists(select 1 from public.produtos where id=p_produto_id and empresa_id=p_empresa_id) then raise exception 'Produto de outra empresa'; end if;
 select count(*),count(distinct x) into qtd,distintos from unnest(coalesce(p_ids,'{}'::uuid[])) x;
 if qtd<>distintos then raise exception 'Itens repetidos ou inválidos'; end if;
 select count(*),coalesce(sum(case when g.gratis then 0 else a.preco end),0) into validos,total
 from public.adicionais a left join public.grupos_adicionais g on g.id=a.grupo_id
 where a.empresa_id=p_empresa_id and a.ativo and a.id=any(coalesce(p_ids,'{}'::uuid[])) and
 ((a.grupo_id is null and exists(select 1 from public.produto_adicionais pa where pa.produto_id=p_produto_id and pa.adicional_id=a.id)) or
 (g.ativo and g.empresa_id=p_empresa_id and exists(select 1 from public.produto_grupos_adicionais pg where pg.produto_id=p_produto_id and pg.grupo_id=g.id)));
 if validos<>qtd then raise exception 'Item não disponível para este produto'; end if;
 for regra in select ga.* from public.grupos_adicionais ga join public.produto_grupos_adicionais pg on pg.grupo_id=ga.id where pg.produto_id=p_produto_id and ga.empresa_id=p_empresa_id and ga.ativo loop
   select count(*) into escolhidos from public.adicionais a where a.grupo_id=regra.id and a.ativo and a.id=any(coalesce(p_ids,'{}'::uuid[]));
   if escolhidos<regra.minimo then raise exception 'Escolha pelo menos % item(ns) em %',regra.minimo,regra.nome; end if;
   if regra.maximo is not null and escolhidos>regra.maximo then raise exception 'Limite máximo de %: % item(ns)',regra.nome,regra.maximo; end if;
 end loop;
 return total;
end $$;
revoke all on function public.calcular_adicionais_grupos(uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.calcular_adicionais_grupos(uuid,uuid,uuid[]) to service_role;

-- O site e o caixa validam limites e preços no servidor.
do $$
declare f regprocedure; definition text; matches integer;
begin
 foreach f in array array['public.criar_pedido(uuid,jsonb,text,text,timestamptz,numeric,text,jsonb,boolean)'::regprocedure,'public.criar_pedido_pdv(uuid,uuid,text,text,numeric,text,jsonb,text,boolean,numeric)'::regprocedure] loop
   definition:=pg_get_functiondef(f);
   select count(*) into matches from regexp_matches(definition,'select coalesce\(sum\(a\.preco\),0\) into ad_total[^;]+;','g');
   if matches<>2 then raise exception 'Função de pedido inesperada: %',f; end if;
   execute regexp_replace(definition,'select coalesce\(sum\(a\.preco\),0\) into ad_total[^;]+;','ad_total:=public.calcular_adicionais_grupos(p_empresa_id,pr.id,ad_ids);','g');
 end loop;
end $$;

create or replace function public.catalogo_publico(p_empresa_id uuid) returns jsonb language sql stable security definer set search_path='public' as $$
select coalesce(jsonb_agg(item order by (item->>'ordem')::int,item->>'nome'),'[]'::jsonb) from (
 select jsonb_build_object('id',p.id,'categoria',coalesce(c.nome,p.categoria),'categoria_id',p.categoria_id,'categoria_ordem',coalesce(c.ordem,9999),
 'subcategoria',coalesce(s.nome,p.subcategoria),'subcategoria_id',p.subcategoria_id,'subcategoria_ordem',coalesce(s.ordem,9999),
 'nome',p.nome,'descricao',p.descricao,'foto_url',p.foto_url,'ativo',p.ativo,'ordem',coalesce(p.ordem,0),'preco',p.preco,'preco_promocional',p.preco_promocional,
 'variacoes',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'nome',v.nome,'preco',v.preco) order by v.nome) from public.variacoes v where v.produto_id=p.id),'[]'::jsonb),
 'adicionais',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'nome',a.nome,'preco',a.preco) order by a.nome) from public.produto_adicionais pa join public.adicionais a on a.id=pa.adicional_id where pa.produto_id=p.id and a.grupo_id is null and a.ativo),'[]'::jsonb),
 'grupos_adicionais',public.grupos_produto_json(p.id,p_empresa_id)) item
 from public.produtos p join public.empresas e on e.id=p.empresa_id and e.ativo
 left join public.categorias c on c.id=p.categoria_id left join public.subcategorias s on s.id=p.subcategoria_id
 where p.empresa_id=p_empresa_id and p.ativo
) q;
$$;
notify pgrst,'reload schema';
