import type { Adicional } from "./types";
// Por unidade: a ordem de seleção não altera quais adicionais são gratuitos.
export function calcularAdicionais(adicionais: Adicional[], limite = 0) {
  const unicos = [...new Map(adicionais.map(a => [a.id, a])).values()];
  const quantidade = Number.isInteger(limite) ? Math.max(0, limite) : 0;
  const ordenados = [...unicos].sort((a,b) => Math.round(Number(b.preco)*100)-Math.round(Number(a.preco)*100) || (a.id<b.id?-1:a.id>b.id?1:0));
  const gratis = new Set(ordenados.slice(0,quantidade).map(a=>a.id));
  return { gratis, total:unicos.reduce((s,a)=>s+(gratis.has(a.id)?0:Math.round(Number(a.preco)*100)),0)/100,
    itens:unicos.map(a=>({...a,preco:gratis.has(a.id)?0:Number(a.preco)})) };
}

