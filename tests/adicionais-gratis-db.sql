-- Somente no piloto: todos os dados de verificação são revertidos.
begin;
do $$
declare e uuid; p uuid; v uuid; ad uuid; ids uuid[]:='{}'; actor uuid; result jsonb; pedido uuid; i integer;
begin
  select user_id into actor from public.super_admin_users limit 1;
  if actor is null then raise exception 'Usuário piloto não encontrado'; end if;
  insert into public.empresas(nome,slug,plano_id) select 'Verificação adicionais','verificacao-'||gen_random_uuid(),id from public.planos where nome='Avançado' limit 1 returning id into e;
  insert into public.admin_users(user_id,empresa_id) values(actor,e);
  perform set_config('request.jwt.claim.sub',actor::text,true);
  insert into public.produtos(empresa_id,categoria,nome,preco,ativo,adicionais_gratis) values(e,'monte_do_jeito','Açaí fictício',20,true,3) returning id into p;
  for i in 1..4 loop
    insert into public.adicionais(empresa_id,nome,preco) values(e,'Adicional fictício '||i,i) returning id into ad;
    ids:=array_append(ids,ad); insert into public.produto_adicionais(produto_id,adicional_id) values(p,ad);
  end loop;
  if public.calcular_total_adicionais(e,p,ids)<>1 then raise exception 'Mais caros não ficaram grátis'; end if;
  if public.calcular_total_adicionais(e,p,array[ids[4],ids[3],ids[2],ids[1]])<>1 then raise exception 'Ordem alterou preço'; end if;
  if public.calcular_total_adicionais(e,p,ids[1:3])<>0 then raise exception 'Até limite deveria ser grátis'; end if;
  if public.calcular_total_adicionais(e,p,'{}')<>0 then raise exception 'Lista vazia incorreta'; end if;
  result:=public.criar_pedido(e,jsonb_build_object('nome','Cliente fictício','cpf','00000000000','whatsapp','00000000000'),'retirada',null,null,0,'dinheiro',jsonb_build_array(jsonb_build_object('produto_id',p,'quantidade',2,'adicionais_ids',to_jsonb(ids))),false);
  pedido:=(result->>'id')::uuid;
  if (result->>'valor_total')::numeric<>42 or (select preco_unitario from public.itens_pedido where pedido_id=pedido)<>21 then raise exception 'Site cobrou total incorreto'; end if;
  result:=public.criar_pedido_pdv(e,null,'retirada',null,0,'dinheiro',jsonb_build_array(jsonb_build_object('produto_id',p,'quantidade',2,'adicionais_ids',to_jsonb(ids))));
  if (result->>'valor_total')::numeric<>42 then raise exception 'PDV cobrou total incorreto'; end if;
  insert into public.variacoes(produto_id,nome,preco) values(p,'Grande',30) returning id into v;
  result:=public.criar_pedido(e,jsonb_build_object('nome','Cliente fictício','cpf','00000000000','whatsapp','00000000000'),'retirada',null,null,0,'dinheiro',jsonb_build_array(jsonb_build_object('produto_id',p,'variacao_id',v,'quantidade',2,'adicionais_ids',to_jsonb(ids))),false);
  if (result->>'valor_total')::numeric<>62 then raise exception 'Variação incorreta'; end if;
  update public.produtos set adicionais_gratis=0 where id=p;
  if public.calcular_total_adicionais(e,p,ids)<>10 then raise exception 'Regra desativada alterou preços'; end if;
  update public.produtos set adicionais_gratis=3,preco_promocional=18 where id=p;
  result:=public.criar_pedido(e,jsonb_build_object('nome','Cliente fictício','cpf','00000000000','whatsapp','00000000000'),'retirada',null,null,0,'dinheiro',jsonb_build_array(jsonb_build_object('produto_id',p,'quantidade',2,'adicionais_ids',to_jsonb(ids))),false);
  if (result->>'valor_total')::numeric<>38 then raise exception 'Promoção incorreta'; end if;
  if (select (x->>'adicionais_gratis')::int from jsonb_array_elements(public.catalogo_publico(e)) x where x->>'id'=p::text)<>3 then raise exception 'Catálogo não expõe limite'; end if;
  begin perform public.calcular_total_adicionais(e,p,array[ids[1],ids[1]]); raise exception 'Repetição indevidamente aceita'; exception when raise_exception then if sqlerrm<>'Adicionais repetidos ou inválidos' then raise; end if; end;
  insert into public.adicionais(empresa_id,nome,preco) values(e,'Não vinculado',50) returning id into ad;
  begin perform public.calcular_total_adicionais(e,p,array[ad]); raise exception 'Adicional não vinculado aceito'; exception when raise_exception then if sqlerrm<>'Adicional não disponível para este produto' then raise; end if; end;
end $$;
rollback;

