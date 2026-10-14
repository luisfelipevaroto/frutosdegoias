begin;
create table public.cobrancas_saas(
 empresa_id uuid primary key references public.assinaturas_empresa(empresa_id),
 referencia uuid unique not null default gen_random_uuid(),autor uuid not null,
 preapproval_id text unique,checkout_url text,payload jsonb not null,
 primeiro_vencimento date not null,versao_assinatura bigint not null,
 estado text not null default 'criando' check(estado in('criando','pendente','authorized','paused','cancelled')),
 suspensa_em timestamptz,suspensao_versao_empresa timestamptz,
 conciliada_em timestamptz,criado_em timestamptz not null default now()
);
alter table public.cobrancas_saas enable row level security;
revoke all on public.cobrancas_saas from public,anon,authenticated;
grant select,insert,update on public.cobrancas_saas to service_role;
create or replace function public.conciliar_assinatura_saas(p_empresa uuid,p_vencimento date,p_estado text,p_versao bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.cobrancas_saas%rowtype; s public.assinaturas_empresa%rowtype;
 e public.empresas%rowtype; hoje date:=(now() at time zone 'America/Sao_Paulo')::date; suspend boolean; ts timestamptz;
begin
 select * into c from public.cobrancas_saas where empresa_id=p_empresa for update;
 if not found or c.preapproval_id is null then raise exception 'Cobrança automática não vinculada';end if;
 select * into s from public.assinaturas_empresa where empresa_id=p_empresa for update;
 if s.versao<>p_versao or c.versao_assinatura<>p_versao then raise exception 'Contrato alterado: revise a cobrança automática' using errcode='40001';end if;
 if p_vencimento is null or p_estado not in('authorized','paused','cancelled','pending') then raise exception 'Dados de conciliação inválidos';end if;
 select * into e from public.empresas where id=p_empresa for update;
 suspend:=hoje>=p_vencimento+7;
 if suspend and e.ativo then
  update public.empresas set ativo=false,status='suspensa',atualizado_em=clock_timestamp() where id=p_empresa returning atualizado_em into ts;
  c.suspensa_em:=clock_timestamp();c.suspensao_versao_empresa:=ts;
 elsif not suspend and c.suspensa_em is not null and e.ativo=false and e.atualizado_em=c.suspensao_versao_empresa then
  -- Restore only the suspension created here; later manual edits always win.
  update public.empresas set ativo=true,status='ativa',atualizado_em=clock_timestamp() where id=p_empresa;
  c.suspensa_em:=null;c.suspensao_versao_empresa:=null;
 elsif not suspend and e.ativo then
  c.suspensa_em:=null;c.suspensao_versao_empresa:=null;
 end if;
 update public.assinaturas_empresa set vencimento=p_vencimento,
 status=case when p_estado='cancelled' then 'cancelada' when hoje>p_vencimento then 'atrasada' when s.fim_teste is not null and hoje<s.fim_teste then 'trial' else 'ativa' end,
 versao=versao+1,atualizado_em=clock_timestamp() where empresa_id=p_empresa;
 update public.cobrancas_saas set estado=case when p_estado='pending' then 'pendente' else p_estado end,
 versao_assinatura=p_versao+1,suspensa_em=c.suspensa_em,suspensao_versao_empresa=c.suspensao_versao_empresa,conciliada_em=clock_timestamp() where empresa_id=p_empresa;
 if s.vencimento is distinct from p_vencimento or (e.ativo and suspend) or (not e.ativo and not suspend and (select ativo from public.empresas where id=p_empresa)) or s.status is distinct from (select status from public.assinaturas_empresa where empresa_id=p_empresa) then
  insert into public.historico_comercial(entidade,entidade_id,empresa_id,autor,antes,depois)
  values('assinatura',p_empresa,p_empresa,c.autor,to_jsonb(s),(select to_jsonb(a) from public.assinaturas_empresa a where empresa_id=p_empresa)||jsonb_build_object('automacao','mercado_pago','suspensa',suspend));
 end if;
 return jsonb_build_object('suspensa',suspend,'vencimento',p_vencimento);
end $$;
revoke execute on function public.conciliar_assinatura_saas(uuid,date,text,bigint) from public,anon,authenticated;
grant execute on function public.conciliar_assinatura_saas(uuid,date,text,bigint) to service_role;
commit;
