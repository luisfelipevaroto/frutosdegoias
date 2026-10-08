-- Teste transacional: requer loja-fixture sem provedor configurado; não chama gateways.
begin;
do $$
declare emp uuid:='8333409a-a50d-4174-b8f4-0ad9253be6ec';actor uuid;prod uuid;failed boolean;j jsonb;payload jsonb;
begin
 select user_id into actor from public.admin_users where empresa_id=emp limit 1;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 if exists(select 1 from public.integracoes_credenciais where empresa_id=emp and provedor in('mercado_pago','pagbank') and pagamento_conectado) then raise exception 'Fixture requires a store without configured payment';end if;
 failed:=false;begin update public.configuracoes_loja set valor=valor||'{"online":true,"pix_online":true}'::jsonb where empresa_id=emp and chave='pagamentos';exception when others then failed:=true;end;if not failed then raise exception 'Online enabled without credentials';end if;
 perform public.salvar_credencial_pagamento(emp,'mercado_pago','teste','{"access_token":"test_only_not_real"}');
 failed:=false;begin perform public.salvar_credencial_pagamento(emp,'pagbank','teste','{"token":"test_only_not_real"}');exception when others then if SQLERRM not like 'Desconecte%' then raise;end if;failed:=true;end;if not failed then raise exception 'Second provider accepted';end if;
 insert into public.integracoes_empresa(empresa_id,tipo,provedor,ativo,configuracoes) values(emp,'pagamento','mercado_pago',true,'{}') on conflict(empresa_id,tipo,provedor) do update set ativo=true;
 update public.configuracoes_loja set valor=valor||'{"pix_online":false,"cartao_online":true,"pix_manual":true}'::jsonb where empresa_id=emp and chave='pagamentos';
 if not exists(select 1 from public.configuracoes_loja where empresa_id=emp and chave='pagamentos' and valor->>'online'='true' and valor->>'pix_manual'='false') then raise exception 'Configuration normalization failed';end if;
 select p.id into prod from public.produtos p where empresa_id=emp and ativo and preco>0 and not exists(select 1 from public.produto_grupos_adicionais g where g.produto_id=p.id) limit 1;
 payload:=jsonb_build_object('p_cliente',jsonb_build_object('nome','Teste transacional','cpf','00000000191','whatsapp','31999990000','telefone','31999990000'),'p_tipo_entrega','retirada','p_taxa_entrega',0,'p_forma_pagamento','cartao','p_itens',jsonb_build_array(jsonb_build_object('produto_id',prod,'adicionais_ids','[]'::jsonb,'quantidade',1)),'p_usar_fidelidade',false);
 j:=public.criar_pedido_com_pagamento(emp,true,payload);
 if not exists(select 1 from public.pedidos where id=(j->>'id')::uuid and provedor_pagamento='mercado_pago' and status_pagamento='pendente') then raise exception 'Online order not atomically pending';end if;
 failed:=false;begin perform public.criar_pedido_com_pagamento(emp,true,payload||'{"p_forma_pagamento":"pix"}'::jsonb);exception when others then failed:=true;end;if not failed then raise exception 'Disabled Pix accepted';end if;
 failed:=false;begin perform public.criar_pedido_com_pagamento(emp,false,payload||'{"p_forma_pagamento":"pix"}'::jsonb);exception when others then failed:=true;end;if not failed then raise exception 'Manual Pix accepted';end if;
 perform public.desconectar_provedor_pagamento(emp,'mercado_pago');
 if exists(select 1 from public.configuracoes_loja where empresa_id=emp and chave='pagamentos' and (valor->>'online'='true' or valor->>'cartao_online'='true' or valor->>'pix_online'='true')) then raise exception 'Disconnect did not disable methods';end if;
 if not exists(select 1 from public.integracoes_credenciais where empresa_id=emp and provedor='mercado_pago' and not pagamento_conectado) then raise exception 'History credential erased';end if;
 perform public.salvar_credencial_pagamento(emp,'pagbank','teste','{"token":"test_only_not_real"}');
 failed:=false;begin perform public.salvar_credencial_pagamento(emp,'mercado_pago','teste','{"access_token":"test_only_not_real"}');exception when others then if SQLERRM not like 'Desconecte%' then raise;end if;failed:=true;end;if not failed then raise exception 'Reverse exclusivity failed';end if;
end $$;
rollback;
select 'PASS: exclusivity, configuration prerequisites, independent methods, atomic pending order and disconnect; all fixtures rolled back' as result;
