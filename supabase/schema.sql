-- Schema inicial do banco de dados (Postgres / Supabase)
-- Rode isso no SQL Editor do Supabase para criar as tabelas do projeto.

create table produtos (
  id uuid primary key default gen_random_uuid(),
  categoria text not null check (categoria in ('sorvete', 'picole', 'acai', 'monte_do_jeito')),
  nome text not null,
  descricao text,
  foto_url text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table variacoes (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references produtos(id) on delete cascade,
  nome text not null, -- "unidade", "300ml", "500ml"
  preco numeric(10,2) not null default 2.00
);

create table adicionais (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  preco numeric(10,2) not null default 0
);

-- Liga quais adicionais aparecem em qual produto (usado pelo "Monte do seu jeito")
create table produto_adicionais (
  produto_id uuid not null references produtos(id) on delete cascade,
  adicional_id uuid not null references adicionais(id) on delete cascade,
  primary key (produto_id, adicional_id)
);

create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text not null,
  cpf text not null unique,
  endereco text,
  gasto_acumulado_fidelidade numeric(10,2) not null default 0,
  criado_em timestamptz not null default now()
);

create table pedidos (
  id uuid primary key default gen_random_uuid(),
  numero serial, -- número curto tipo #1042 pra exibir na UI
  cliente_id uuid references clientes(id),
  tipo_entrega text not null check (tipo_entrega in ('entrega', 'retirada')),
  endereco_entrega text,
  horario_retirada timestamptz,
  taxa_entrega numeric(10,2) not null default 0,
  forma_pagamento text not null check (forma_pagamento in ('pix', 'cartao', 'dinheiro')),
  status_pagamento text not null default 'pendente' check (status_pagamento in ('pendente', 'pago')),
  status_pedido text not null default 'recebido'
    check (status_pedido in ('recebido', 'em_preparo', 'saiu_para_entrega', 'entregue')),
  mercado_pago_payment_id text,
  valor_total numeric(10,2) not null,
  criado_em timestamptz not null default now()
);

create table itens_pedido (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  produto_id uuid references produtos(id),
  variacao_id uuid references variacoes(id),
  adicionais_ids uuid[] default '{}',
  quantidade int not null default 1,
  preco_unitario numeric(10,2) not null
);

-- Índice útil para o painel admin (pedidos ao vivo, ordenados por status/hora)
create index idx_pedidos_status on pedidos(status_pedido, criado_em desc);
