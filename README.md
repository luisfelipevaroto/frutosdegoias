# Frutos de Goiás — Juiz de Fora (delivery próprio)

Base do site/app de pedidos, sem taxa, para a unidade do Centro de Juiz de Fora.

## O que já está pronto neste scaffold

- Estrutura Next.js (App Router) com Tailwind
- Cardápio navegável (dados mockados em `lib/produtos-mock.ts`)
- Carrinho com contexto React (`lib/carrinho-context.tsx`)
- Checkout com fluxo entrega/retirada e regras de pagamento por tipo
- Badge "Aberto/Fechado" no cabeçalho, calculado por horário (`lib/types.ts` → `lojaAberta()`), bloqueando pedidos fora do horário
- Schema completo do banco de dados (`supabase/schema.sql`)

## O que falta ligar (próximos passos)

1. **Banco de dados** ✅ já ligado no código, falta só configurar
   - Criar um projeto no [Supabase](https://supabase.com) (região South America - São Paulo)
   - Rodar `supabase/schema.sql` no SQL Editor
   - Copiar `.env.local.example` para `.env.local` e preencher com os valores de Project Settings → API
   - Cadastrar as mesmas variáveis em Vercel → Settings → Environment Variables
   - Cadastrar os produtos reais nas tabelas `produtos`, `variacoes`, `adicionais` e `produto_adicionais` (via Table Editor do Supabase, por enquanto — o painel admin ainda não existe)
   - **Subcategorias de picolé**: preencha a coluna `subcategoria` do produto com um destes valores: `tradicional`, `premium`, `kids`, `zero_lactose`, `paleta`, `proteico` — eles aparecem automaticamente na barra lateral (desktop) e em chips (celular), sem precisar mexer no código
   - **Preço promocional**: preencha `preco_promocional` menor que `preco` para o produto aparecer com o selo "Oferta" e o preço riscado (funciona hoje só em produtos sem variação — picolé, sorvete, açaí simples)

2. **Mercado Pago**
   - Criar aplicação no [Mercado Pago Developers](https://www.mercadopago.com.br/developers)
   - Implementar `app/api/pedidos/route.ts` (criar pedido + gerar preferência de pagamento Pix/Cartão via Checkout Transparente)
   - Implementar `app/api/mercadopago/webhook/route.ts` para receber a confirmação de pagamento e atualizar `status_pagamento` do pedido
   - Variáveis: `MERCADO_PAGO_ACCESS_TOKEN`

3. **Entrega (Uber Direct / Uber Envios para empresas)**
   - Cadastro em [Uber Direct](https://www.uber.com/br/pt-br/business/deliveries/) (é um produto separado do Uber para passageiros)
   - Usar a API deles para cotar e disparar a entrega a partir do endereço da loja (R. Santa Rita, 583, Centro, Juiz de Fora)
   - Enquanto isso não está pronto, o cálculo por raio/km em `calcularTaxaEntrega()` (`app/checkout/page.tsx`) serve de fallback

4. **Painel admin** (`app/admin/pedidos`, `app/admin/produtos`)
   - Ainda não implementado neste scaffold — próxima etapa depois de validar o fluxo do cliente
   - Vai consumir a mesma tabela `pedidos`, atualizando `status_pedido` em tempo real (Supabase Realtime resolve isso sem precisar de WebSocket próprio)

5. **Cadastro do cliente + fidelidade**
   - Ao criar/reconhecer cliente pelo CPF, somar o valor do pedido em `gasto_acumulado_fidelidade`
   - Quando atingir R$ 100, liberar cupom de 10% na próxima compra e resetar o contador ao ser usado

6. **Identidade visual**
   - As cores em `tailwind.config.ts` (`brand.*`) são provisórias — trocar pelas cores reais extraídas do logo/material de marca do dono
   - **Logo**: substitua `public/logo.png` pela logo real (ideal: quadrada, fundo transparente ou branco)
   - **Capa do topo**: substitua `public/capa.jpg` por uma foto horizontal da loja/produtos (ideal: 1200x400px ou proporção parecida)
   - **Fotos dos produtos**: suba as fotos no Supabase Storage (Storage → criar um bucket público, ex: "produtos") e cole a URL pública gerada no campo `foto_url` de cada produto na tabela `produtos`. O card do produto já está pronto pra exibir (`components/ProdutoCard.tsx`) — se não tiver `foto_url` preenchido, mostra um emoji de sorvete no lugar

## Rodando localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:3000`.
