"use client";

import { Empresa } from "@/lib/empresa";
import { rotuloPagamento } from "@/lib/pagamentos";

type Props = { pedido: any; itens: any[]; empresa: Empresa | null };
const moeda = (v: unknown) =>
  Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export default function CupomPedido({ pedido: p, itens, empresa }: Props) {
  const subtotal = itens.reduce(
    (s, i) => s + Number(i.preco_unitario || 0) * Number(i.quantidade || 0),
    0,
  );
  const entrega = p.tipo_entrega === "entrega";
  return (
    <>
      <button
        onClick={() => window.print()}
        className="print:hidden flex w-full items-center justify-center gap-2 rounded-xl border bg-white p-3 font-medium text-neutral-700"
      >
        🖨️ Imprimir pedido
      </button>
      <div id="cupom-nao-fiscal" className="hidden print:block">
        <div className="cupom">
          <div className="centro">
            <b>{empresa?.nome || "Loja"}</b>
            {empresa?.endereco && <div>{empresa.endereco}</div>}
            <div>
              {[empresa?.cidade, empresa?.estado].filter(Boolean).join(" - ")}
            </div>
            {empresa?.cep && <div>CEP {empresa.cep}</div>}
            {(empresa?.telefone || empresa?.whatsapp) && (
              <div>{empresa.telefone || empresa.whatsapp}</div>
            )}
            <b>CUPOM NÃO FISCAL</b>
          </div>
          <div className="linha" />
          <b>PEDIDO #{p.numero}</b>
          <div>
            {new Date(p.criado_em).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
            })}
          </div>
          <div className="tipo-entrega">
            <b>{entrega ? "*** ENTREGA ***" : "*** RETIRADA NA LOJA ***"}</b>
          </div>
          <div>Pagamento {rotuloPagamento(p)}</div>
          {!p.provedor_pagamento && (
            <div>Receber {entrega ? "na entrega" : "no balcão"}</div>
          )}
          {p.clientes?.nome && (
            <div>
              <b>Cliente</b> {p.clientes.nome}
            </div>
          )}
          {(p.clientes?.whatsapp || p.clientes?.telefone) && (
            <div>{p.clientes.whatsapp || p.clientes.telefone}</div>
          )}
          {entrega && p.endereco_entrega && (
            <>
              <div className="linha" />
              <b>ENDEREÇO DE ENTREGA</b>
              <div>{p.endereco_entrega}</div>
            </>
          )}
          {p.tempo_producao && (
            <div className="texto">
              <b>Tempo estimado de produção</b>
              <div>{p.tempo_producao}</div>
            </div>
          )}
          <div className="linha" />
          {itens.map((i) => (
            <div key={i.id} className="item">
              <div>
                <b>
                  {i.quantidade}x {i.produto_nome || "Produto"}
                </b>
                {i.categoria_nome && <div>Categoria {i.categoria_nome}</div>}
                {i.variacao_nome && <div>{i.variacao_nome}</div>}
                {i.adicionais?.map((a: any) => (
                  <div key={a.id}>+ {a.nome}</div>
                ))}
              </div>
              <div className="valor">
                {moeda(Number(i.preco_unitario) * Number(i.quantidade))}
              </div>
            </div>
          ))}
          {p.observacoes && (
            <>
              <div className="linha" />
              <div className="texto">
                <b>Observações</b>
                <div>{p.observacoes}</div>
              </div>
            </>
          )}
          <div className="linha" />
          <div className="total">
            <span>Subtotal</span>
            <span>{moeda(subtotal)}</span>
          </div>
          {Number(p.desconto_fidelidade) > 0 && (
            <div className="total">
              <span>Desconto</span>
              <span>- {moeda(p.desconto_fidelidade)}</span>
            </div>
          )}
          {entrega && (
            <div className="total">
              <span>Entrega</span>
              <span>{p.frete_gratis ? "GRÁTIS" : moeda(p.taxa_entrega)}</span>
            </div>
          )}
          <div className="linha" />
          <div className="total grande">
            <b>TOTAL</b>
            <b>{moeda(p.valor_total)}</b>
          </div>
          {p.forma_pagamento === "dinheiro" && (
            <div>
              {p.precisa_troco
                ? `Troco para ${moeda(p.troco_para)}`
                : "Não precisa de troco"}
            </div>
          )}
          <div className="linha" />
          <div className="centro">
            *** CUPOM NÃO FISCAL ***
            <br />
            Obrigado pela preferência!
          </div>
        </div>
      </div>
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #cupom-nao-fiscal,
          #cupom-nao-fiscal * {
            visibility: visible !important;
          }
          #cupom-nao-fiscal {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 74mm;
            background: #fff;
            color: #000;
          }
          .cupom {
            width: 72mm;
            margin: 0 auto;
            font-family: monospace;
            font-size: 10.25pt;
            line-height: 1.35;
            overflow-wrap: anywhere;
          }
          .centro {
            text-align: center;
          }
          .linha {
            border-top: 1px dashed #000;
            margin: 7px 0;
          }
          .tipo-entrega {
            margin: 8px 0;
            padding: 5px 2px;
            border-top: 2px solid #000;
            border-bottom: 2px solid #000;
            text-align: center;
            font-size: 13.25pt;
          }
          .item,
          .total {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            margin: 6px 0;
            break-inside: avoid;
          }
          .item > div:first-child {
            min-width: 0;
            flex: 1;
          }
          .valor {
            flex-shrink: 0;
            white-space: nowrap;
          }
          .texto {
            white-space: pre-wrap;
            margin: 6px 0;
          }
          .grande {
            font-size: 12.5pt;
          }
          @page {
            size: 80mm auto;
            margin: 3mm;
          }
        }
      `}</style>
    </>
  );
}
