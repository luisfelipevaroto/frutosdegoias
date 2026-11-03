-- ERP API v1: chaves por empresa, armazenadas apenas como SHA-256.
-- Aplicar em ambiente de teste antes de habilitar a API.
create table if not exists public.erp_api_chaves (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null references public.empresas(id) on delete cascade,
 nome text not null check (char_length(nome) between 1 and 100),
 prefixo text not null,
 chave_hash text not null unique check (chave_hash ~ '^[0-9a-f]{64}$'),
 ativo boolean not null default true,
 criado_em timestamptz not null default now(),
 revogado_em timestamptz
);
create index if not exists erp_api_chaves_empresa_idx on public.erp_api_chaves(empresa_id);
alter table public.erp_api_chaves enable row level security;
revoke all on public.erp_api_chaves from anon, authenticated;
grant select, insert, update, delete on public.erp_api_chaves to service_role;
comment on table public.erp_api_chaves is 'Chaves de API ERP por empresa. Nunca armazenar o token em texto puro.';
