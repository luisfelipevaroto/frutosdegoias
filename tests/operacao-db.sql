-- Execute after the migration inside a transaction. All commerce fixtures roll back.
do $$
declare
  emp uuid; prod uuid; base numeric; payload jsonb; j jsonb; failed boolean;
  antes numeric; mid uuid; pedido uuid; chave_teste uuid:=gen_random_uuid();
begin
  select id into emp from public.empresas where slug='artbel-burguer';
  select p.id,coalesce(p.preco_promocional,p.preco) into prod,base
  from public.produtos p where empresa_id=emp and ativo and preco>0
    and not exists(select 1 from public.produto_grupos_adicionais g where g.produto_id=p.id) limit 1;
  if prod is null then raise exception 'Produto-fixture indisponível'; end if;
  update public.configuracoes_loja set valor=valor||jsonb_build_object('propria',true,'taxa',7,'cep_inicio','36680001','cep_fim','36689999','frete_gratis_ativo',false)
    where empresa_id=emp and chave='entrega';
  update public.configuracoes_loja set valor=valor||'{"pix_manual":true,"cartao_retirada":true,"cartao_entrega":false,"dinheiro":true}'::jsonb
    where empresa_id=emp and chave='pagamentos';
  insert into public.configuracoes_loja(empresa_id,chave,valor) values(emp,'producao','{"ativo":true,"tempo":"de 30 a 40 minutos","texto_livre":true}')
    on conflict(empresa_id,chave) do update set valor=excluded.valor;
  payload:=jsonb_build_object('p_cliente',jsonb_build_object('nome','TESTE TRANSACIONAL','cpf','00000000191','whatsapp','31999990000'),
    'p_tipo_entrega','entrega','p_endereco_entrega','Endereço-fixture - CEP 36680-001','p_cep_entrega','36680001',
    'p_taxa_entrega',999,'p_forma_pagamento','dinheiro','p_provedor_entrega','propria',
    'p_itens',jsonb_build_array(jsonb_build_object('produto_id',prod,'quantidade',1,'adicionais_ids','[]'::jsonb)));
  j:=public.criar_pedido_com_pagamento(emp,false,payload);
  if (j->>'taxa_entrega')::numeric<>7 then raise exception 'Taxa manipulada aceita'; end if;
  if not exists(select 1 from public.pedidos where id=(j->>'id')::uuid and tempo_producao='de 30 a 40 minutos') then raise exception 'Estimativa não preservada';end if;
  perform public.criar_pedido_com_pagamento(emp,false,payload||'{"p_cep_entrega":"36689999"}'::jsonb);
  failed:=false;
  begin perform public.criar_pedido_com_pagamento(emp,false,payload||'{"p_cep_entrega":"36680000"}'::jsonb);
  exception when others then failed:=true;end;
  if not failed then raise exception 'CEP anterior ao início aceito';end if;
  failed:=false;
  begin perform public.criar_pedido_com_pagamento(emp,false,payload||'{"p_cep_entrega":"36690000"}'::jsonb);
  exception when others then failed:=true;end;
  if not failed then raise exception 'CEP posterior ao fim aceito';end if;
  failed:=false;
  begin perform public.criar_pedido_com_pagamento(emp,false,payload||'{"p_forma_pagamento":"pix"}'::jsonb);
  exception when others then failed:=true;end;
  if not failed then raise exception 'Pix manual aceito na entrega';end if;
  j:=public.criar_pedido_com_pagamento(emp,false,payload||'{"p_tipo_entrega":"retirada","p_forma_pagamento":"pix"}'::jsonb);
  if not exists(select 1 from public.pedidos where id=(j->>'id')::uuid and provedor_pagamento is null and status_pagamento='pendente' and taxa_entrega=0) then raise exception 'Pix manual incorreto';end if;
  perform public.criar_pedido_com_pagamento(emp,false,payload||'{"p_tipo_entrega":"retirada","p_forma_pagamento":"cartao"}'::jsonb);
  select m.id into mid from public.modulos m where m.chave='frete_gratis';
  insert into public.empresa_modulos(empresa_id,modulo_id,ativo) values(emp,mid,false)
    on conflict(empresa_id,modulo_id) do update set ativo=false;
  failed:=false;
  begin update public.configuracoes_loja set valor=valor||jsonb_build_object('frete_gratis_ativo',true,'frete_gratis_minimo',base)
    where empresa_id=emp and chave='entrega';
  exception when others then failed:=true;end;
  if not failed then raise exception 'Frete grátis sem liberação aceito';end if;
  update public.empresa_modulos set ativo=true where empresa_id=emp and modulo_id=mid;
  update public.configuracoes_loja set valor=valor||jsonb_build_object('frete_gratis_ativo',true,'frete_gratis_minimo',base)
    where empresa_id=emp and chave='entrega';
  j:=public.criar_pedido_com_pagamento(emp,false,payload||jsonb_build_object('p_chave',chave_teste,'p_impressao','fixture'));
  pedido:=(j->>'id')::uuid;
  if not (j->>'frete_gratis')::boolean or (j->>'valor_total')::numeric<>base then raise exception 'Frete grátis no limite incorreto';end if;
  if not exists(select 1 from public.pedidos where id=pedido and taxa_entrega=0 and taxa_entrega_original=7) then raise exception 'Frete original não preservado';end if;
  j:=public.criar_pedido_com_pagamento(emp,false,payload||jsonb_build_object('p_chave',chave_teste,'p_impressao','fixture'));
  if (j->>'id')::uuid<>pedido or not (j->>'recuperado')::boolean then raise exception 'Repetição não idempotente';end if;
  update public.configuracoes_loja set valor=valor||jsonb_build_object('frete_gratis_minimo',base+0.01)
    where empresa_id=emp and chave='entrega';
  j:=public.criar_pedido_com_pagamento(emp,false,payload);
  if (j->>'frete_gratis')::boolean or (j->>'valor_total')::numeric<>base+7 then raise exception 'Frete grátis abaixo do mínimo';end if;
  -- Provider cost is distinct from what the customer pays, even for integrated delivery.
  update public.configuracoes_loja set valor=valor||jsonb_build_object('frete_gratis_minimo',0)
    where empresa_id=emp and chave='entrega';
  j:=public.criar_pedido_com_pagamento(emp,false,payload||'{"p_provedor_entrega":"uber_direct","p_taxa_entrega":19.90}'::jsonb);
  if not exists(select 1 from public.pedidos where id=(j->>'id')::uuid and taxa_entrega=0 and taxa_entrega_original=19.90) then raise exception 'Cotação integrada não preservada';end if;
end $$;
