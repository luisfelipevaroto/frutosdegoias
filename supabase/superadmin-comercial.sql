-- Etapa comercial aditiva. Não atribui assinaturas ou preços às empresas existentes.
alter table public.planos add column preco_mensal numeric(12,2) check (preco_mensal >= 0);
alter table public.planos add column dias_teste integer not null default 0 check (dias_teste between 0 and 365);
alter table public.planos add column versao bigint not null default 1;
alter table public.planos add column atualizado_em timestamptz not null default now();

create table public.assinaturas_empresa (
  empresa_id uuid primary key references public.empresas(id) on delete restrict,
  plano_id uuid not null references public.planos(id) on delete restrict,
  nome_plano_snapshot text not null,
  valor_mensal numeric(12,2) not null check (valor_mensal between 0 and 999999.99),
  status text not null check (status in ('trial','ativa','atrasada','cancelada')),
  inicio date not null,
  fim_teste date,
  vencimento date,
  notas text not null default '' check (length(notas) <= 1000),
  versao bigint not null default 1,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (fim_teste is null or fim_teste >= inicio),
  check (vencimento is null or vencimento >= inicio),
  check (status <> 'trial' or fim_teste is not null),
  check (status not in ('ativa','atrasada') or vencimento is not null)
);
create index assinaturas_empresa_plano_idx on public.assinaturas_empresa(plano_id);
create table public.historico_comercial (
  id uuid primary key default gen_random_uuid(),
  entidade text not null check (entidade in ('plano','assinatura','modulo')),
  entidade_id uuid not null,
  empresa_id uuid references public.empresas(id) on delete restrict,
  autor uuid not null,
  antes jsonb,
  depois jsonb,
  criado_em timestamptz not null default now()
);
create index historico_comercial_empresa_data_idx on public.historico_comercial(empresa_id,criado_em desc);
alter table public.assinaturas_empresa enable row level security;
alter table public.historico_comercial enable row level security;
revoke all on public.assinaturas_empresa, public.historico_comercial from public, anon, authenticated;
grant select,insert,update on public.assinaturas_empresa to service_role;
grant select,insert on public.historico_comercial to service_role;

-- Somente o servidor autorizado chama esta função. As gravações são atômicas.
create function public.superadmin_salvar_comercial(p_acao text,p_dados jsonb,p_autor uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid; v_empresa uuid; v_plano uuid; v_versao bigint;
  v_old jsonb; v_new jsonb; v_preco numeric; v_dias integer;
  v_plan public.planos%rowtype; v_sub public.assinaturas_empresa%rowtype;
begin
  if not exists(select 1 from public.super_admin_users where user_id=p_autor) then
    raise exception 'Acesso negado' using errcode='42501';
  end if;
  v_versao := (p_dados->>'versao')::bigint;
  if p_acao='salvar_plano' then
    perform pg_catalog.pg_advisory_xact_lock(804205);
    v_id := nullif(p_dados->>'id','')::uuid;
    if nullif(trim(p_dados->>'nome'),'') is null or length(p_dados->>'nome')>100
      or length(coalesce(p_dados->>'descricao',''))>1000 then raise exception 'Dados do plano inválidos'; end if;
    v_preco := (p_dados->>'preco_mensal')::numeric;
    v_dias := (p_dados->>'dias_teste')::integer;
    if v_preco is null or v_preco<0 or v_preco>999999.99 or round(v_preco,2)<>v_preco
      or v_dias is null or v_dias<0 or v_dias>365 or jsonb_typeof(p_dados->'ativo')<>'boolean'
      or jsonb_typeof(p_dados->'modulos')<>'array' then raise exception 'Valores do plano inválidos'; end if;
    if exists(select 1 from public.planos where lower(trim(nome))=lower(trim(p_dados->>'nome')) and (v_id is null or id<>v_id)) then
      raise exception 'Já existe um plano com esse nome' using errcode='23505';
    end if;
    if exists(select 1 from jsonb_array_elements_text(p_dados->'modulos') m where not exists(select 1 from public.modulos where id=m::uuid and ativo)) then
      raise exception 'Módulo inválido';
    end if;
    if v_id is null then
      if v_versao is distinct from 0 then raise exception 'Versão inválida' using errcode='40001'; end if;
      insert into public.planos(nome,descricao,ativo,preco_mensal,dias_teste)
      values(trim(p_dados->>'nome'),nullif(trim(p_dados->>'descricao'),''),(p_dados->>'ativo')::boolean,v_preco,v_dias) returning id into v_id;
    else
      select * into v_plan from public.planos where id=v_id for update;
      if not found or v_plan.versao is distinct from v_versao then raise exception 'Plano alterado. Atualize o painel.' using errcode='40001'; end if;
      v_old := to_jsonb(v_plan) || jsonb_build_object('modulos',(select coalesce(jsonb_agg(modulo_id),'[]'::jsonb) from public.plano_modulos where plano_id=v_id and ativo));
      update public.planos set nome=trim(p_dados->>'nome'),descricao=nullif(trim(p_dados->>'descricao'),''),ativo=(p_dados->>'ativo')::boolean,
        preco_mensal=v_preco,dias_teste=v_dias,versao=versao+1,atualizado_em=now() where id=v_id;
    end if;
    insert into public.plano_modulos(plano_id,modulo_id,ativo)
    select v_id,id,exists(select 1 from jsonb_array_elements_text(p_dados->'modulos') m where m::uuid=id)
    from public.modulos where ativo
    on conflict(plano_id,modulo_id) do update set ativo=excluded.ativo;
    select to_jsonb(p) || jsonb_build_object('modulos',p_dados->'modulos') into v_new from public.planos p where id=v_id;
    insert into public.historico_comercial(entidade,entidade_id,autor,antes,depois) values('plano',v_id,p_autor,v_old,v_new);
  elsif p_acao='salvar_assinatura' then
    v_empresa := (p_dados->>'empresa_id')::uuid; v_plano := (p_dados->>'plano_id')::uuid;
    perform 1 from public.empresas where id=v_empresa for update;
    if not found then raise exception 'Empresa não encontrada'; end if;
    select * into v_sub from public.assinaturas_empresa where empresa_id=v_empresa for update;
    if found then
      if v_sub.versao is distinct from v_versao then raise exception 'Assinatura alterada. Atualize o painel.' using errcode='40001'; end if;
      v_old := to_jsonb(v_sub);
    elsif v_versao is distinct from 0 then raise exception 'Assinatura alterada. Atualize o painel.' using errcode='40001';
    end if;
    select * into v_plan from public.planos where id=v_plano for share;
    if not found or (not v_plan.ativo and (v_sub.plano_id is null or v_sub.plano_id<>v_plano)) then raise exception 'Escolha um plano ativo'; end if;
    if v_plan.versao is distinct from (p_dados->>'plano_versao')::bigint then raise exception 'Plano alterado. Atualize o painel.' using errcode='40001'; end if;
    if (p_dados->>'status') is null or (p_dados->>'status') not in ('trial','ativa','atrasada','cancelada') then raise exception 'Status inválido'; end if;
    v_preco := (p_dados->>'valor_mensal')::numeric;
    if v_preco is null or v_preco<0 or v_preco>999999.99 or round(v_preco,2)<>v_preco then raise exception 'Mensalidade inválida'; end if;
    insert into public.assinaturas_empresa(empresa_id,plano_id,nome_plano_snapshot,valor_mensal,status,inicio,fim_teste,vencimento,notas)
    values(v_empresa,v_plano,v_plan.nome,v_preco,p_dados->>'status',(p_dados->>'inicio')::date,
      nullif(p_dados->>'fim_teste','')::date,nullif(p_dados->>'vencimento','')::date,coalesce(p_dados->>'notas',''))
    on conflict(empresa_id) do update set plano_id=excluded.plano_id,nome_plano_snapshot=excluded.nome_plano_snapshot,
      valor_mensal=excluded.valor_mensal,status=excluded.status,inicio=excluded.inicio,fim_teste=excluded.fim_teste,
      vencimento=excluded.vencimento,notas=excluded.notas,versao=public.assinaturas_empresa.versao+1,atualizado_em=now();
    update public.empresas set plano_id=v_plano,atualizado_em=now() where id=v_empresa;
    select to_jsonb(s) into v_new from public.assinaturas_empresa s where empresa_id=v_empresa;
    insert into public.historico_comercial(entidade,entidade_id,empresa_id,autor,antes,depois) values('assinatura',v_empresa,v_empresa,p_autor,v_old,v_new);
  elsif p_acao='herdar_modulo' then
    v_empresa := (p_dados->>'empresa_id')::uuid; v_id := (p_dados->>'modulo_id')::uuid;
    perform 1 from public.empresas where id=v_empresa for update;
    if not found then raise exception 'Empresa não encontrada'; end if;
    select to_jsonb(m) into v_old from public.empresa_modulos m where empresa_id=v_empresa and modulo_id=v_id for update;
    if v_old is null then return jsonb_build_object('herdado',true); end if;
    if v_old->'configuracoes'<>'{}'::jsonb then raise exception 'Este módulo contém configurações próprias. Preserve-as antes de voltar ao plano.'; end if;
    delete from public.empresa_modulos where empresa_id=v_empresa and modulo_id=v_id;
    v_new := jsonb_build_object('modulo_id',v_id,'origem','plano');
    insert into public.historico_comercial(entidade,entidade_id,empresa_id,autor,antes,depois) values('modulo',v_id,v_empresa,p_autor,v_old,v_new);
  else raise exception 'Operação inválida';
  end if;
  return v_new;
end;
$$;
revoke all on function public.superadmin_salvar_comercial(text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.superadmin_salvar_comercial(text,jsonb,uuid) to service_role;

-- Catálogo definido pelo proprietário. O plano Base e suas empresas são preservados.
do $$
declare p uuid; n text; price numeric; keys text[];
begin
  foreach n in array array['Básico','Médio','Avançado'] loop
    if exists(select 1 from public.planos where lower(nome)=lower(n)) then raise exception 'Plano comercial já existe: %',n; end if;
    price:=case n when 'Básico' then 29.90 when 'Médio' then 49.90 else 99.90 end;
    keys:=case n when 'Básico' then array[]::text[] when 'Médio' then array['pedidos','entrega_propria','fidelidade','pagamento_online'] else null end;
    insert into public.planos(nome,descricao,preco_mensal,dias_teste)
    values(n,case n when 'Básico' then 'Cardápio visual para consulta.' when 'Médio' then 'Pedidos, entrega própria, fidelidade e pagamento online.' else 'Todos os módulos, incluindo WhatsApp e entrega integrada.' end,price,7) returning id into p;
    insert into public.plano_modulos(plano_id,modulo_id,ativo)
    select p,id,case when n='Avançado' then true else chave=any(keys) end from public.modulos where ativo;
  end loop;
end $$;

-- Impede pedidos no cardápio visual, incluindo chamadas diretas da função pública.
-- Conserva o corpo e as permissões da função de pedidos já instalada.
do $$
declare f regprocedure; definition text;
begin
  f:='public.criar_pedido(uuid,jsonb,text,text,timestamptz,numeric,text,jsonb,boolean)'::regprocedure;
  definition:=pg_get_functiondef(f);
  if position(E'\nbegin\n' in definition)=0 then raise exception 'Corpo de criar_pedido inesperado'; end if;
  definition:=replace(definition,E'\nbegin\n',E'\nbegin\n if not public.modulo_empresa_ativo(p_empresa_id, ''pedidos'') then raise exception ''Esta loja oferece somente cardápio visual.''; end if;\n');
  execute definition;
end $$;

