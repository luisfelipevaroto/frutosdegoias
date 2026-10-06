-- Execute somente no piloto. Todos os dados fictícios são desfeitos ao final.
begin;
select set_config('request.jwt.claim.sub','43ea81df-5e7a-4c97-8c2f-143b3ae54c1c',true);
insert into public.empresas(id,nome,slug,plano_id) values
 ('11111111-1111-4111-a111-111111111111','Teste de grupos A','teste-grupos-a','a27b8714-7099-4e10-bea2-e39cebf16e7a'),
 ('22222222-2222-4222-a222-222222222222','Teste de grupos B','teste-grupos-b','a27b8714-7099-4e10-bea2-e39cebf16e7a');
insert into public.admin_users(user_id,empresa_id) values('43ea81df-5e7a-4c97-8c2f-143b3ae54c1c','11111111-1111-4111-a111-111111111111');
insert into public.produtos(id,empresa_id,categoria,nome,preco) values
 ('33333333-3333-4333-a333-333333333333','11111111-1111-4111-a111-111111111111','Teste','Açaí de teste',20),
 ('44444444-4444-4444-a444-444444444444','11111111-1111-4111-a111-111111111111','Teste','Produto antigo',20);
insert into public.adicionais(id,empresa_id,nome,preco) values('55555555-5555-4555-a555-555555555555','11111111-1111-4111-a111-111111111111','Avulso de teste',2);
insert into public.produto_adicionais(produto_id,adicional_id) values('44444444-4444-4444-a444-444444444444','55555555-5555-4555-a555-555555555555');
insert into public.grupos_adicionais(id,empresa_id,nome,gratis,minimo,maximo) values('66666666-6666-4666-a666-666666666666','22222222-2222-4222-a222-222222222222','Grupo alheio',true,1,3);
set local role authenticated;
do $$
declare eid uuid:='11111111-1111-4111-a111-111111111111';pid uuid:='33333333-3333-4333-a333-333333333333';gf uuid;gp uuid;bad boolean;
begin
 gf:=public.salvar_grupo_adicionais(eid,null,'Frutas',true,1,3,true,'[{"nome":"Banana"},{"nome":"Morango"},{"nome":"Kiwi"},{"nome":"Uva"}]');
 gp:=public.salvar_grupo_adicionais(eid,null,'Pagos',false,1,null,true,'[{"nome":"Leite em pó","preco":4}]');
 perform public.vincular_grupos_produto(pid,array[gf,gp]);
 if (select count(*) from public.produto_grupos_adicionais where produto_id=pid)<>2 then raise exception 'Falhou: vincular grupos';end if;
 bad:=false;begin perform public.vincular_grupos_produto(pid,array[gf,'66666666-6666-4666-a666-666666666666'::uuid]);exception when others then bad:=true;end;
 if not bad or (select count(*) from public.produto_grupos_adicionais where produto_id=pid)<>2 then raise exception 'Falhou: outro tenant/atomicidade';end if;
 if exists(select 1 from public.grupos_adicionais where empresa_id='22222222-2222-4222-a222-222222222222') then raise exception 'Falhou: isolamento da leitura';end if;
 bad:=false;begin perform public.salvar_grupo_adicionais('22222222-2222-4222-a222-222222222222',null,'Intruso',true,1,3,true,'[{"nome":"X"}]');exception when others then bad:=true;end;
 if not bad then raise exception 'Falhou: escrita de outro tenant';end if;
 bad:=false;begin perform public.salvar_grupo_adicionais(eid,null,'Sem itens',true,2,3,true,'[{"nome":"X"}]');exception when others then bad:=true;end;
 if not bad or exists(select 1 from public.grupos_adicionais where nome='Sem itens') then raise exception 'Falhou: mínimo impossível/atomicidade';end if;
 bad:=false;begin perform public.salvar_grupo_adicionais(eid,null,'Limites invertidos',true,3,1,true,'[]');exception when others then bad:=true;end;
 if not bad then raise exception 'Falhou: limites invertidos';end if;
 bad:=false;begin update public.grupos_adicionais set maximo=null where id=gf;exception when check_violation then bad:=true;end;
 if not bad then raise exception 'Falhou: limite grátis nulo';end if;
 bad:=false;begin perform public.vincular_grupos_produto(pid,array[gf,gf]);exception when others then bad:=true;end;
 if not bad then raise exception 'Falhou: grupos duplicados';end if;
end $$;
reset role;
do $$
declare eid uuid:='11111111-1111-4111-a111-111111111111';pid uuid:='33333333-3333-4333-a333-333333333333';gf uuid;gp uuid;free_ids uuid[];paid_id uuid;ids uuid[];r jsonb;bad boolean;j jsonb;site uuid;caixa uuid;
begin
 select id into gf from public.grupos_adicionais where empresa_id=eid and nome='Frutas';select id into gp from public.grupos_adicionais where empresa_id=eid and nome='Pagos';
 select array_agg(id order by nome) into free_ids from public.adicionais where grupo_id=gf;select id into paid_id from public.adicionais where grupo_id=gp;
 ids:=free_ids[1:3]||paid_id;
 if public.calcular_adicionais_grupos(eid,pid,ids)<>4 then raise exception 'Falhou: grátis e pagos';end if;
 if public.calcular_adicionais_grupos(eid,pid,array[free_ids[1],paid_id])<>4 then raise exception 'Falhou: mínimo';end if;
 bad:=false;begin perform public.calcular_adicionais_grupos(eid,pid,free_ids||paid_id);exception when others then bad:=true;end;if not bad then raise exception 'Falhou: máximo';end if;
 bad:=false;begin perform public.calcular_adicionais_grupos(eid,pid,array[paid_id]);exception when others then bad:=true;end;if not bad then raise exception 'Falhou: mínimo grátis';end if;
 bad:=false;begin perform public.calcular_adicionais_grupos(eid,pid,free_ids[1:3]);exception when others then bad:=true;end;if not bad then raise exception 'Falhou: mínimo pago';end if;
 bad:=false;begin perform public.calcular_adicionais_grupos(eid,pid,ids||paid_id);exception when others then bad:=true;end;if not bad then raise exception 'Falhou: ids duplicados';end if;
 bad:=false;begin perform public.calcular_adicionais_grupos(eid,pid,ids||'55555555-5555-4555-a555-555555555555'::uuid);exception when others then bad:=true;end;if not bad then raise exception 'Falhou: item não vinculado';end if;
 if public.calcular_adicionais_grupos(eid,'44444444-4444-4444-a444-444444444444','{}')<>0 or public.calcular_adicionais_grupos(eid,'44444444-4444-4444-a444-444444444444',array['55555555-5555-4555-a555-555555555555'::uuid])<>2 then raise exception 'Falhou: compatibilidade avulsos';end if;
 select x into j from jsonb_array_elements(public.catalogo_publico(eid)) x where x->>'id'=pid::text;
 if (select array_agg(a->>'nome' order by n) from jsonb_array_elements(j->'grupos_adicionais') g cross join lateral jsonb_array_elements(g->'itens') with ordinality x(a,n) where g->>'nome'='Frutas') is distinct from array['Banana','Morango','Kiwi','Uva'] then raise exception 'Falhou: ordem de cadastro no catálogo';end if;
 if jsonb_array_length(j->'grupos_adicionais')<>2 or jsonb_array_length(j->'adicionais')<>0 then raise exception 'Falhou: catálogo agrupado';end if;
 if exists(select 1 from jsonb_array_elements(j->'grupos_adicionais') g cross join lateral jsonb_array_elements(g->'itens') a where (g->>'gratis')::boolean and (a->>'preco')::numeric<>0) then raise exception 'Falhou: preços grátis no catálogo';end if;
 r:=public.criar_pedido(eid,'{"nome":"Cliente fictício","cpf":"00000000191","telefone":"31999990000"}','retirada',null,null,0,'dinheiro',jsonb_build_array(jsonb_build_object('produto_id',pid,'adicionais_ids',to_jsonb(ids),'quantidade',2,'preco_unitario',0)),false);
 site:=(r->>'id')::uuid;if (r->>'valor_total')::numeric<>48 or not exists(select 1 from public.itens_pedido where pedido_id=site and preco_unitario=24 and quantidade=2) then raise exception 'Falhou: total site e preço persistido';end if;
 r:=public.criar_pedido_pdv(eid,null,'retirada',null,0,'dinheiro',jsonb_build_array(jsonb_build_object('produto_id',pid,'adicionais_ids',to_jsonb(ids),'quantidade',2)));
 caixa:=(r->>'id')::uuid;if (r->>'valor_total')::numeric<>48 or not exists(select 1 from public.itens_pedido where pedido_id=caixa and preco_unitario=24 and quantidade=2) then raise exception 'Falhou: total caixa';end if;
 bad:=false;begin perform public.criar_pedido_pdv(eid,null,'retirada',null,0,'dinheiro',jsonb_build_array(jsonb_build_object('produto_id',pid,'adicionais_ids',to_jsonb(free_ids||paid_id),'quantidade',1)));exception when others then bad:=true;end;if not bad then raise exception 'Falhou: pedido excedeu máximo';end if;
 bad:=false;begin perform public.criar_pedido(eid,'{"nome":"Cliente fictício","cpf":"00000000191"}','retirada',null,null,0,'dinheiro',jsonb_build_array(jsonb_build_object('produto_id',pid,'adicionais_ids','[]'::jsonb,'quantidade',1)),false);exception when others then bad:=true;end;if not bad then raise exception 'Falhou: pedido sem obrigatórios';end if;
 bad:=false;begin insert into public.adicionais(empresa_id,grupo_id,nome,preco) values(eid,'66666666-6666-4666-a666-666666666666','Intruso',0);exception when others then bad:=true;end;if not bad then raise exception 'Falhou: integridade tenant';end if;
 -- Remoção no editor preserva o identificador histórico e bloqueia novas seleções.
 perform public.salvar_grupo_adicionais(eid,gp,'Pagos',false,1,null,false,'[]');
 if not exists(select 1 from public.adicionais where id=paid_id and not ativo) then raise exception 'Falhou: inativação sem apagar histórico';end if;
 if public.calcular_adicionais_grupos(eid,pid,free_ids[1:3])<>0 then raise exception 'Falhou: grupo desativado';end if;
 bad:=false;begin perform public.calcular_adicionais_grupos(eid,pid,ids);exception when others then bad:=true;end;if not bad then raise exception 'Falhou: item desativado selecionável';end if;
 if has_function_privilege('anon','public.salvar_grupo_adicionais(uuid,uuid,text,boolean,integer,integer,boolean,jsonb)','EXECUTE') or has_function_privilege('authenticated','public.calcular_adicionais_grupos(uuid,uuid,uuid[])','EXECUTE') or has_table_privilege('anon','public.grupos_adicionais','INSERT') then raise exception 'Falhou: permissões';end if;
end $$;
set local role anon;
select jsonb_array_length(public.catalogo_publico('11111111-1111-4111-a111-111111111111')) as catalogo_publico_anon_produtos;
reset role;
rollback;
select 'PASS: cadastro, isolamento, limites, preços, site, PDV, avulsos e histórico; testes desfeitos' as resultado;
