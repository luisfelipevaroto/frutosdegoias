begin;

alter table public.clientes alter column cpf drop not null;

-- O PDV usa uma função separada porque o cadastro sem CPF é exclusivo do painel.
create function public.admin_cadastrar_cliente_pdv(
  p_empresa_id uuid,
  p_nome text,
  p_telefone text,
  p_cpf text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  cliente public.clientes%rowtype;
  nome_cliente text := nullif(btrim(p_nome), '');
  telefone_cliente text := regexp_replace(coalesce(p_telefone, ''), '[^0-9]', '', 'g');
  cpf_cliente text := regexp_replace(p_cpf, '[^0-9]', '', 'g');
begin
  if auth.uid() is null or not coalesce(public.is_admin_empresa(p_empresa_id), false) then
    raise exception 'Sem acesso a esta empresa.' using errcode = '42501';
  end if;
  if nome_cliente is null then
    raise exception 'Informe o nome do cliente.' using errcode = '22023';
  end if;
  if length(telefone_cliente) not between 10 and 15 then
    raise exception 'Informe um telefone válido com DDD.' using errcode = '22023';
  end if;
  if cpf_cliente is not null and length(cpf_cliente) <> 11 then
    raise exception 'Informe um CPF com 11 dígitos.' using errcode = '22023';
  end if;

  if cpf_cliente is null then
    perform pg_advisory_xact_lock(hashtextextended(
      'cliente-pdv:' || p_empresa_id::text || ':' || telefone_cliente || ':' || lower(nome_cliente), 0
    ));
    select c.* into cliente from public.clientes c
    where c.empresa_id = p_empresa_id and c.cpf is null
      and c.telefone = telefone_cliente and lower(c.nome) = lower(nome_cliente)
    order by c.criado_em, c.id limit 1;

    if not found then
      insert into public.clientes (empresa_id, nome, telefone, whatsapp, cpf)
      values (p_empresa_id, nome_cliente, telefone_cliente, telefone_cliente, null)
      returning * into cliente;
    end if;
  else
    insert into public.clientes (empresa_id, nome, telefone, whatsapp, cpf)
    values (p_empresa_id, nome_cliente, telefone_cliente, telefone_cliente, cpf_cliente)
    on conflict (empresa_id, cpf) do update set
      nome = excluded.nome,
      telefone = excluded.telefone,
      whatsapp = excluded.whatsapp,
      atualizado_em = now()
    returning * into cliente;
  end if;

  return jsonb_build_object('id', cliente.id, 'nome', cliente.nome, 'cpf', cliente.cpf,
    'telefone', cliente.telefone, 'whatsapp', cliente.whatsapp);
end;
$$;

revoke all on function public.admin_cadastrar_cliente_pdv(uuid, text, text, text) from public, anon;
grant execute on function public.admin_cadastrar_cliente_pdv(uuid, text, text, text) to authenticated;

commit;
