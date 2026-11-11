begin;

create or replace function public.importar_produtos_planilha(
  p_empresa_id uuid, p_linhas jsonb, p_confirmacao text default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
<<lote>>
declare
  linha record;
  atual public.produtos%rowtype;
  categoria public.categorias%rowtype;
  subcategoria public.subcategorias%rowtype;
  produto_id uuid;
  categoria_id uuid;
  subcategoria_id uuid;
  preco numeric;
  promocional numeric;
  problema text;
  antes jsonb;
  depois jsonb;
  itens jsonb := '[]';
  erros jsonb := '[]';
  ids uuid[] := '{}';
  novos text[] := '{}';
  chave_novo text;
  confirmacao text;
  item jsonb;
  iguais integer := 0;
  criados integer := 0;
  atualizados integer := 0;
begin
  if auth.uid() is null or not coalesce(public.is_admin_empresa(p_empresa_id), false) then
    raise exception 'Sem acesso a esta empresa' using errcode = '42501';
  end if;
  if jsonb_typeof(p_linhas) is distinct from 'array' then
    raise exception 'Planilha inválida' using errcode = '22023';
  end if;
  if jsonb_array_length(p_linhas) not between 1 and 3000 or octet_length(p_linhas::text) > 6000000 then
    raise exception 'Use de 1 a 3.000 produtos por arquivo, com até 6 MB de dados' using errcode = '22023';
  end if;

  if p_confirmacao is not null then
    perform pg_advisory_xact_lock(hashtextextended('planilha-produtos:' || p_empresa_id::text, 0));
  end if;

  for linha in
    select pos + 1 as numero, nullif(btrim(valor->>'id'), '') as id,
      btrim(valor->>'nome') as nome, nullif(valor->>'descricao', '') as descricao,
      btrim(valor->>'categoria') as categoria, nullif(btrim(valor->>'subcategoria'), '') as subcategoria,
      btrim(valor->>'preco') as preco, nullif(btrim(valor->>'preco_promocional'), '') as promocional,
      lower(btrim(valor->>'ativo')) as ativo
    from jsonb_array_elements(p_linhas) with ordinality as dados(valor, pos)
    where valor <> 'null'::jsonb
  loop
    problema := null;
    produto_id := null;
    categoria_id := null;
    subcategoria_id := null;
    antes := null;
    promocional := null;

    if linha.id is not null then
      if linha.id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        problema := 'ID do produto inválido.';
      else
        produto_id := linha.id::uuid;
        if produto_id = any(ids) then
          problema := 'ID do produto repetido na planilha.';
        else
          ids := array_append(ids, produto_id);
          if p_confirmacao is not null then
            select p.* into atual from public.produtos p
              where p.id = produto_id and p.empresa_id = p_empresa_id for update;
          else
            select p.* into atual from public.produtos p
              where p.id = produto_id and p.empresa_id = p_empresa_id;
          end if;
          if not found then
            problema := 'ID do produto não encontrado nesta empresa.';
          elsif exists (select 1 from public.variacoes v where v.produto_id = lote.produto_id) then
            problema := 'Produto com variação. Edite pelo cadastro de produtos.';
          end if;
        end if;
      end if;
    end if;

    if problema is null then
      if coalesce(length(linha.nome), 0) not between 1 and 300 then
        problema := 'Informe o nome do produto (até 300 caracteres).';
      elsif coalesce(length(linha.descricao), 0) > 5000 then
        problema := 'Descrição acima de 5.000 caracteres.';
      elsif coalesce(linha.preco, '') !~ '^[0-9]{1,8}([.,][0-9]{1,2})?$' then
        problema := 'Informe um preço válido, com até duas casas decimais.';
      elsif linha.promocional is not null and linha.promocional !~ '^[0-9]{1,8}([.,][0-9]{1,2})?$' then
        problema := 'Preço promocional inválido.';
      elsif coalesce(linha.ativo, '') not in ('sim', 'não', 'nao') then
        problema := 'Preencha Ativo com Sim ou Não.';
      else
        preco := replace(linha.preco, ',', '.')::numeric;
        promocional := replace(linha.promocional, ',', '.')::numeric;
        if promocional is not null and promocional >= preco then
          problema := 'Preço promocional deve ser menor que o preço normal.';
        end if;
      end if;
    end if;

    if problema is null then
      select c.* into categoria from public.categorias c
        where c.empresa_id = p_empresa_id and c.nome = linha.categoria
        order by (lote.produto_id is not null and c.id = atual.categoria_id) desc nulls last, c.id limit 1;
      if not found then
        problema := 'Categoria não encontrada. Use o nome da aba Categorias.';
      elsif (produto_id is null or categoria.id is distinct from atual.categoria_id) and
          (select count(*) from public.categorias c where c.empresa_id = p_empresa_id and c.nome = linha.categoria) > 1 then
        problema := 'Há mais de uma categoria com esse nome. Ajuste os nomes no painel.';
      else
        categoria_id := categoria.id;
        if linha.subcategoria is not null then
          select s.* into subcategoria from public.subcategorias s
            where s.empresa_id = p_empresa_id and s.categoria_id = lote.categoria_id and s.nome = linha.subcategoria
            order by (lote.produto_id is not null and s.id = atual.subcategoria_id) desc nulls last, s.id limit 1;
          if not found then
            problema := 'A subcategoria informada não pertence à categoria selecionada.';
          elsif (produto_id is null or subcategoria.id is distinct from atual.subcategoria_id) and
              (select count(*) from public.subcategorias s where s.empresa_id = p_empresa_id and s.categoria_id = lote.categoria_id and s.nome = linha.subcategoria) > 1 then
            problema := 'Há mais de uma subcategoria com esse nome nessa categoria.';
          else
            subcategoria_id := subcategoria.id;
          end if;
        end if;
      end if;
    end if;

    if problema is null and produto_id is null then
      chave_novo := categoria_id::text || ':' || coalesce(subcategoria_id::text, '') || ':' || lower(linha.nome);
      if chave_novo = any(novos) or exists (
        select 1 from public.produtos p where p.empresa_id = p_empresa_id
          and (p.categoria_id = lote.categoria_id or (p.categoria_id is null and p.categoria = linha.categoria))
          and ((p.subcategoria_id is not null and p.subcategoria_id = lote.subcategoria_id)
            or (p.subcategoria_id is null and p.subcategoria is not distinct from linha.subcategoria))
          and lower(btrim(p.nome)) = lower(linha.nome)
      ) then
        problema := 'Já existe um produto com esse nome nessa categoria e subcategoria. Use o ID exportado para editar.';
      end if;
      novos := array_append(novos, chave_novo);
    end if;

    if problema is not null then
      erros := erros || jsonb_build_array(jsonb_build_object('linha', linha.numero, 'mensagem', problema));
      continue;
    end if;

    if produto_id is not null then
      antes := jsonb_build_object(
        'nome', atual.nome, 'descricao', atual.descricao, 'categoria_id', atual.categoria_id,
        'subcategoria_id', atual.subcategoria_id, 'categoria', atual.categoria,
        'subcategoria', atual.subcategoria, 'preco', atual.preco,
        'preco_promocional', atual.preco_promocional, 'ativo', atual.ativo
      );
    end if;
    depois := jsonb_build_object(
      'nome', linha.nome, 'descricao', linha.descricao, 'categoria_id', categoria_id,
      'subcategoria_id', subcategoria_id, 'categoria', linha.categoria, 'subcategoria', linha.subcategoria,
      'preco', preco, 'preco_promocional', promocional, 'ativo', linha.ativo = 'sim'
    );

    if antes = depois then
      iguais := iguais + 1;
    else
      itens := itens || jsonb_build_array(jsonb_build_object(
        'linha', linha.numero, 'id', produto_id, 'antes', antes, 'depois', depois
      ));
      if produto_id is null then criados := criados + 1;
      else atualizados := atualizados + 1;
      end if;
    end if;
  end loop;

  confirmacao := md5(p_empresa_id::text || ':' || itens::text);
  if p_confirmacao is not null and jsonb_array_length(erros) = 0 then
    if p_confirmacao <> confirmacao then
      raise exception 'O catálogo mudou desde a prévia. Valide a planilha novamente.' using errcode = '40001';
    end if;
    for item in select value from jsonb_array_elements(itens)
    loop
      depois := item->'depois';
      if item->>'id' is null then
        insert into public.produtos (empresa_id, nome, descricao, categoria_id, subcategoria_id, categoria, subcategoria, preco, preco_promocional, ativo)
        values (p_empresa_id, depois->>'nome', depois->>'descricao', (depois->>'categoria_id')::uuid,
          (depois->>'subcategoria_id')::uuid, depois->>'categoria', depois->>'subcategoria',
          (depois->>'preco')::numeric, (depois->>'preco_promocional')::numeric, (depois->>'ativo')::boolean);
      else
        update public.produtos p set nome = depois->>'nome', descricao = depois->>'descricao',
          categoria_id = (depois->>'categoria_id')::uuid, subcategoria_id = (depois->>'subcategoria_id')::uuid,
          categoria = depois->>'categoria', subcategoria = depois->>'subcategoria',
          preco = (depois->>'preco')::numeric, preco_promocional = (depois->>'preco_promocional')::numeric,
          ativo = (depois->>'ativo')::boolean
        where p.id = (item->>'id')::uuid and p.empresa_id = p_empresa_id;
        if not found then raise exception 'Produto indisponível. Valide novamente.' using errcode = '40001'; end if;
      end if;
    end loop;
  end if;
  return jsonb_build_object('erros', erros, 'itens', itens, 'confirmacao', confirmacao,
    'criados', criados, 'atualizados', atualizados, 'iguais', iguais);
end;
$$;

revoke all on function public.importar_produtos_planilha(uuid, jsonb, text) from public, anon;
grant execute on function public.importar_produtos_planilha(uuid, jsonb, text) to authenticated;

commit;
