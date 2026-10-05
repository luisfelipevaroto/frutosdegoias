-- Executado junto da migração: dados sintéticos são revertidos na subtransação.
do $$
declare actor uuid; company uuid; plan uuid; result jsonb; form jsonb; count_before bigint;
begin
  if has_function_privilege('anon','public.superadmin_salvar_comercial(text,jsonb,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.superadmin_salvar_comercial(text,jsonb,uuid)','EXECUTE')
    or has_table_privilege('anon','public.assinaturas_empresa','SELECT')
    or has_table_privilege('authenticated','public.historico_comercial','SELECT') then raise exception 'Falha na privacidade comercial'; end if;
  select user_id into actor from public.super_admin_users limit 1;
  if actor is null then raise exception 'Superadmin não encontrado'; end if;
  begin
    insert into public.empresas(nome,slug) values('Validação comercial temporária','validacao-'||gen_random_uuid()) returning id into company;
    result:=public.superadmin_salvar_comercial('salvar_plano',jsonb_build_object('id',null,'nome','Validação '||gen_random_uuid(),'descricao','','preco_mensal',29.90,'dias_teste',7,'ativo',true,'versao',0,'modulos','[]'::jsonb),actor);
    plan:=(result->>'id')::uuid;
    form:=jsonb_build_object('empresa_id',company,'plano_id',plan,'plano_versao',1,'valor_mensal',29.90,'status','trial','inicio','2026-10-05','fim_teste','2026-10-12','vencimento','','notas','Teste','versao',0);
    perform public.superadmin_salvar_comercial('salvar_assinatura',form,actor);
    if (select plano_id from public.empresas where id=company)<>plan then raise exception 'Falha no vínculo'; end if;
    select count(*) into count_before from public.historico_comercial;
    begin
      perform public.superadmin_salvar_comercial('salvar_assinatura',form,actor);
      raise exception 'Conflito não detectado';
    exception when serialization_failure then null; end;
    begin
      perform public.superadmin_salvar_comercial('salvar_assinatura',form||jsonb_build_object('versao',1,'fim_teste','2026-10-04'),actor);
      raise exception 'Data inválida aceita';
    exception when check_violation then null; end;
    if (select count(*) from public.historico_comercial)<>count_before then raise exception 'Histórico parcial'; end if;
    perform public.superadmin_salvar_comercial('salvar_plano',result||jsonb_build_object('preco_mensal',99.90),actor);
    if (select valor_mensal from public.assinaturas_empresa where empresa_id=company)<>29.90 then raise exception 'Preço contratado alterado'; end if;
    begin
      perform public.superadmin_salvar_comercial('salvar_plano',result,gen_random_uuid());
      raise exception 'Autor indevido aceito';
    exception when insufficient_privilege then null; end;
    begin
      perform public.criar_pedido(company,'{}'::jsonb,'retirada',null,null,0,'pix','[]'::jsonb,false);
      raise exception 'Pedido no cardápio visual aceito';
    exception when raise_exception then
      if sqlerrm<>'Esta loja oferece somente cardápio visual.' then raise; end if;
    end;
    raise exception 'Reverter dados sintéticos' using errcode='ZX001';
  exception when sqlstate 'ZX001' then null; end;
  if exists(select 1 from public.empresas where id=company) then raise exception 'Dados sintéticos não revertidos'; end if;
end $$;

