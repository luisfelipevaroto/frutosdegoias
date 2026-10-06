-- Aplicar após grupos-adicionais.sql. Preserva a ordem atualmente retornada pelo painel nos registros existentes.
alter table public.adicionais add column ordem integer not null default 0 check(ordem>=0);
with positions as (select id,row_number() over(partition by grupo_id order by ctid)::integer pos from public.adicionais where grupo_id is not null) update public.adicionais a set ordem=p.pos from positions p where p.id=a.id;

create or replace function public.salvar_grupo_adicionais(p_empresa_id uuid,p_id uuid,p_nome text,p_gratis boolean,p_minimo integer,p_maximo integer,p_ativo boolean,p_itens jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare gid uuid; item jsonb; aid uuid; retained uuid[]:='{}'; validos integer; pos integer:=0;
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
   pos:=pos+1;
   if length(trim(coalesce(item->>'nome',''))) not between 1 and 100 then raise exception 'Informe o nome dos itens'; end if;
   if not p_gratis and ((item->>'preco')::numeric is null or (item->>'preco')::numeric<0 or (item->>'preco')::numeric>999999.99) then raise exception 'Preço inválido'; end if;
   aid:=nullif(item->>'id','')::uuid;
   if aid is null then
     insert into public.adicionais(empresa_id,grupo_id,nome,preco,ativo,ordem) values(p_empresa_id,gid,trim(item->>'nome'),case when p_gratis then 0 else (item->>'preco')::numeric end,coalesce((item->>'ativo')::boolean,true),pos) returning id into aid;
   else
     if aid=any(retained) then raise exception 'Item repetido'; end if;
     update public.adicionais set ordem=pos,nome=trim(item->>'nome'),preco=case when p_gratis then 0 else (item->>'preco')::numeric end,ativo=coalesce((item->>'ativo')::boolean,true) where id=aid and grupo_id=gid and empresa_id=p_empresa_id;
     if not found then raise exception 'Item de outro grupo'; end if;
   end if;
   retained:=array_append(retained,aid);
 end loop;
 update public.adicionais set ativo=false where grupo_id=gid and not(id=any(retained));
 select count(*) into validos from public.adicionais where grupo_id=gid and ativo;
 if p_ativo and validos<(case when p_gratis then p_minimo else 1 end) then raise exception 'Cadastre itens suficientes para o mínimo obrigatório'; end if;
 return gid;
end $$;
create or replace function public.grupos_produto_json(p_produto_id uuid,p_empresa_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'nome',g.nome,'gratis',g.gratis,'minimo',g.minimo,'maximo',g.maximo,
 'itens',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'nome',a.nome,'preco',case when g.gratis then 0 else a.preco end) order by a.ordem,a.id),'[]'::jsonb) from public.adicionais a where a.grupo_id=g.id and a.empresa_id=p_empresa_id and a.ativo)) order by g.criado_em,g.id),'[]'::jsonb)
 from public.produto_grupos_adicionais pg join public.grupos_adicionais g on g.id=pg.grupo_id
 where pg.produto_id=p_produto_id and g.empresa_id=p_empresa_id and g.ativo;
$$;
notify pgrst,'reload schema';
