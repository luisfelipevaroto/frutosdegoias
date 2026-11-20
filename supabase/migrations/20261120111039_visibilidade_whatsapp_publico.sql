begin;

-- Expõe somente disponibilidade, sem credenciais ou identificadores da conta Meta.
create function public.whatsapp_disponivel_cliente(p_empresa_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.empresas e
    where e.id = p_empresa_id and e.ativo
      and public.modulo_empresa_ativo(e.id, 'whatsapp_api')
      and exists (
        select 1 from public.integracoes_credenciais c
        where c.empresa_id = e.id and c.provedor = 'meta_whatsapp'
          and c.ambiente = 'producao'
          and coalesce(btrim(c.credenciais->>'access_token'), '') <> ''
          and coalesce(btrim(c.credenciais->>'phone_number_id'), '') <> ''
      )
      and exists (
        select 1 from public.integracoes_empresa i
        where i.empresa_id = e.id and i.tipo = 'whatsapp' and i.provedor = 'meta_whatsapp' and i.ativo
      )
  );
$$;
revoke all on function public.whatsapp_disponivel_cliente(uuid) from public;
grant execute on function public.whatsapp_disponivel_cliente(uuid) to anon, authenticated, service_role;

create or replace function public.ativar_whatsapp_pedido_cliente(
  p_empresa_id uuid, p_numero bigint, p_cpf text, p_whatsapp text
) returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  pedido_id uuid;
begin
  if not public.whatsapp_disponivel_cliente(p_empresa_id) then return false; end if;
  if length(regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g')) <> 11
    or length(regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g')) < 10 then
    return false;
  end if;
  select p.id into pedido_id
  from public.pedidos p
  join public.clientes c on c.id = p.cliente_id and c.empresa_id = p.empresa_id
  where p.empresa_id = p_empresa_id and p.numero = p_numero
    and regexp_replace(c.cpf, '[^0-9]', '', 'g') = regexp_replace(p_cpf, '[^0-9]', '', 'g')
    and regexp_replace(coalesce(c.whatsapp,c.telefone,''), '[^0-9]', '', 'g') = regexp_replace(p_whatsapp, '[^0-9]', '', 'g')
  limit 1;
  if pedido_id is null then return false; end if;
  update public.pedidos set whatsapp_optin = true,
    whatsapp_optin_em = coalesce(whatsapp_optin_em, now()) where id = pedido_id;
  return true;
end;
$$;

commit;
