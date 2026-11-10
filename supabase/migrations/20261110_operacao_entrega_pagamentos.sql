begin;

insert into public.modulos(chave,nome,descricao,ativo)
values('frete_gratis','Frete grátis','Permite à loja oferecer frete grátis a partir de um valor mínimo.',true)
on conflict(chave) do nothing;

alter table public.pedidos add column if not exists frete_gratis boolean not null default false;
alter table public.pedidos add column if not exists taxa_entrega_original numeric;
alter table public.pedidos add column if not exists tempo_producao text;

create or replace function public.validar_formas_pagamento()
returns trigger language plpgsql security definer set search_path='' as $$
declare pix boolean; cartao boolean;
begin
  if new.chave='pagamentos' then
    if auth.uid() is not null and not public.is_admin_empresa(new.empresa_id) then raise exception 'Sem acesso'; end if;
    perform 1 from public.empresas where id=new.empresa_id for update;
    pix:=coalesce((new.valor->>'pix_online')::boolean,(new.valor->>'online')::boolean,false);
    cartao:=coalesce((new.valor->>'cartao_online')::boolean,false);
    if (pix or cartao) and (
      not public.modulo_empresa_ativo(new.empresa_id,'pagamento_online')
      or not exists(select 1 from public.integracoes_credenciais c
        where c.empresa_id=new.empresa_id and c.provedor in('mercado_pago','pagbank')
        and c.pagamento_conectado and nullif(trim(c.credenciais->>case
          when c.provedor='mercado_pago' then 'access_token' else 'token' end),'') is not null)
    ) then raise exception 'Configure o provedor antes de ativar pagamentos online'; end if;
    new.valor:=coalesce(new.valor,'{}')||jsonb_build_object(
      'pix_online',pix,'cartao_online',cartao,'online',pix or cartao,
      'pix_manual',coalesce((new.valor->>'pix_manual')::boolean,false),
      'cartao_retirada',coalesce((new.valor->>'cartao_retirada')::boolean,false));
  end if;
  return new;
end $$;

create or replace function public.validar_configuracao_entrega()
returns trigger language plpgsql security invoker set search_path='' as $$
declare inicio text; fim text; minimo numeric;
begin
  if new.chave<>'entrega' then return new; end if;
  if coalesce((new.valor->>'propria')::boolean,false) then
    inicio:=regexp_replace(coalesce(new.valor->>'cep_inicio',''),'[^0-9]','','g');
    fim:=regexp_replace(coalesce(new.valor->>'cep_fim',''),'[^0-9]','','g');
    if inicio !~ '^[0-9]{8}$' or fim !~ '^[0-9]{8}$' or inicio>fim then
      raise exception 'Informe a faixa de CEP inicial e final da entrega própria';
    end if;
    new.valor:=new.valor||jsonb_build_object('cep_inicio',inicio,'cep_fim',fim);
  end if;
  if coalesce((new.valor->>'frete_gratis_ativo')::boolean,false) then
    if not public.modulo_empresa_ativo(new.empresa_id,'frete_gratis') then
      raise exception 'Frete grátis não liberado pelo superadmin';
    end if;
    minimo:=(new.valor->>'frete_gratis_minimo')::numeric;
    if minimo is null or minimo<0 or minimo>100000 then raise exception 'Valor mínimo para frete grátis inválido'; end if;
  end if;
  new.valor:=new.valor-'raio_km'-'pedido_minimo';
  return new;
end $$;
drop trigger if exists entrega_configuracao_valida on public.configuracoes_loja;
create trigger entrega_configuracao_valida before insert or update on public.configuracoes_loja
for each row execute function public.validar_configuracao_entrega();
revoke all on function public.validar_configuracao_entrega() from public,anon,authenticated;

create or replace function public.criar_pedido_com_pagamento(p_empresa_id uuid,p_online boolean,p_dados jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  cfg jsonb; entrega jsonb; producao jsonb; provedor text; j jsonb;
  forma text:=p_dados->>'p_forma_pagamento';
  tipo text:=p_dados->>'p_tipo_entrega';
  cep text; inicio text; fim text;
  troco boolean:=forma='dinheiro' and coalesce((p_dados->>'p_precisa_troco')::boolean,false);
  valor_troco numeric; taxa numeric:=(p_dados->>'p_taxa_entrega')::numeric;
  gratis boolean:=false; valor_produtos numeric; tempo text;
begin
  if nullif(p_dados->>'p_chave','') is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_empresa_id::text||(p_dados->>'p_chave'),0));
    select resultado into j from public.pedidos_solicitacoes
      where empresa_id=p_empresa_id and chave=(p_dados->>'p_chave')::uuid and impressao=p_dados->>'p_impressao';
    if found then return j||jsonb_build_object('recuperado',true); end if;
    if exists(select 1 from public.pedidos_solicitacoes where empresa_id=p_empresa_id and chave=(p_dados->>'p_chave')::uuid)
      then raise exception 'Solicitação já usada para outro pedido'; end if;
  end if;
  perform 1 from public.empresas where id=p_empresa_id and ativo for update;
  if not found then raise exception 'Empresa indisponível'; end if;
  select valor into cfg from public.configuracoes_loja where empresa_id=p_empresa_id and chave='pagamentos';
  select valor into entrega from public.configuracoes_loja where empresa_id=p_empresa_id and chave='entrega';
  select valor into producao from public.configuracoes_loja where empresa_id=p_empresa_id and chave='producao';
  if tipo='entrega' then
    if coalesce(p_dados->>'p_provedor_entrega','propria')='propria' then
      if not coalesce((entrega->>'propria')::boolean,false) then raise exception 'Entrega própria indisponível'; end if;
      cep:=regexp_replace(coalesce(p_dados->>'p_cep_entrega',
        substring(p_dados->>'p_endereco_entrega' from 'CEP[ ]+([0-9-]+)'),''),'[^0-9]','','g');
      inicio:=regexp_replace(coalesce(entrega->>'cep_inicio',''),'[^0-9]','','g');
      fim:=regexp_replace(coalesce(entrega->>'cep_fim',''),'[^0-9]','','g');
      if cep !~ '^[0-9]{8}$' or inicio !~ '^[0-9]{8}$' or fim !~ '^[0-9]{8}$'
        or inicio>fim or cep<inicio or cep>fim then raise exception 'CEP fora da faixa de entrega da loja'; end if;
      taxa:=coalesce((entrega->>'taxa')::numeric,0);
    end if;
  elsif tipo='retirada' then
    if not coalesce((entrega->>'retirada')::boolean,true) then raise exception 'Retirada indisponível'; end if;
    taxa:=0;
  else raise exception 'Tipo de entrega inválido';
  end if;
  if p_online then
    select s.provedor into provedor from public.status_pagamento_online(p_empresa_id) s where s.ativo;
    if provedor is null or provedor not in('mercado_pago','pagbank')
      or not ((forma='pix' and coalesce((cfg->>'pix_online')::boolean,(cfg->>'online')::boolean,false))
        or (forma='cartao' and provedor='mercado_pago' and coalesce((cfg->>'cartao_online')::boolean,false)))
      then raise exception 'Pagamento online indisponível'; end if;
  elsif not (
    (forma='dinheiro' and coalesce((cfg->>'dinheiro')::boolean,false))
    or (forma='cartao' and tipo='entrega' and coalesce((cfg->>'cartao_entrega')::boolean,false))
    or (forma='cartao' and tipo='retirada' and coalesce((cfg->>'cartao_retirada')::boolean,false))
    or (forma='pix' and tipo='retirada' and coalesce((cfg->>'pix_manual')::boolean,false))
  ) then raise exception 'Forma de pagamento indisponível'; end if;
  if taxa is null or taxa<0 or taxa>10000 then raise exception 'Valor de entrega inválido'; end if;
  j:=public.criar_pedido(p_empresa_id,p_dados->'p_cliente',tipo,p_dados->>'p_endereco_entrega',
    nullif(p_dados->>'p_horario_retirada','')::timestamptz,taxa,forma,p_dados->'p_itens',
    coalesce((p_dados->>'p_usar_fidelidade')::boolean,false));
  valor_produtos:=(j->>'valor_total')::numeric-taxa;
  gratis:=tipo='entrega'
    and public.modulo_empresa_ativo(p_empresa_id,'frete_gratis')
    and coalesce((entrega->>'frete_gratis_ativo')::boolean,false)
    and entrega->>'frete_gratis_minimo' is not null
    and (entrega->>'frete_gratis_minimo')::numeric>=0
    and valor_produtos>=(entrega->>'frete_gratis_minimo')::numeric;
  if gratis then j:=j||jsonb_build_object('valor_total',valor_produtos); end if;
  if coalesce((producao->>'ativo')::boolean,false) then
    tempo:=left(producao->>'tempo',500);
    if not coalesce((producao->>'texto_livre')::boolean,false) then
      tempo:=case tempo when '30_40' then 'de 30 a 40 min' when '40_50' then 'de 40 a 50 min'
        when 'ate_1h' then 'Em até 1h' when 'mais_1h' then 'Estamos com alto volume de pedidos, previsão de mais de 1h para entrega.' else tempo end;
    end if;
  end if;
  if troco then
    valor_troco:=nullif(p_dados->>'p_troco_para','')::numeric;
    if valor_troco is null or valor_troco<=(j->>'valor_total')::numeric then
      raise exception 'Informe um valor para troco maior que o total do pedido'; end if;
  end if;
  update public.pedidos set
    provedor_pagamento=case when p_online then provedor else null end,
    status_pagamento='pendente',
    observacoes=nullif(left(trim(p_dados->>'p_observacoes'),500),''),
    precisa_troco=troco,troco_para=valor_troco,
    provedor_entrega=case when tipo='entrega' then coalesce(p_dados->>'p_provedor_entrega','propria') else null end,
    taxa_entrega_original=taxa,frete_gratis=gratis,
    taxa_entrega=case when gratis then 0 else taxa end,
    valor_total=(j->>'valor_total')::numeric,tempo_producao=tempo
  where id=(j->>'id')::uuid and empresa_id=p_empresa_id;
  j:=j||jsonb_build_object('frete_gratis',gratis,'taxa_entrega',case when gratis then 0 else taxa end);
  if p_online then j:=j||jsonb_build_object('provedor_pagamento',provedor); end if;
  if nullif(p_dados->>'p_chave','') is not null then
    insert into public.pedidos_solicitacoes(empresa_id,chave,impressao,resultado)
      values(p_empresa_id,(p_dados->>'p_chave')::uuid,p_dados->>'p_impressao',j);
  end if;
  return j;
end $$;
revoke execute on function public.criar_pedido_com_pagamento(uuid,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.criar_pedido_com_pagamento(uuid,boolean,jsonb) to service_role;

update public.configuracoes_loja
set valor=valor||jsonb_build_object('cartao_retirada',coalesce((valor->>'cartao_retirada')::boolean,(valor->>'cartao_entrega')::boolean,false))
where chave='pagamentos';

update public.configuracoes_loja c
set valor=(c.valor-'raio_km'-'pedido_minimo')||jsonb_build_object('cep_inicio','36680001','cep_fim','36689999'),
    atualizado_em=now()
from public.empresas e
where c.empresa_id=e.id and e.slug='artbel-burguer' and c.chave='entrega';

commit;
