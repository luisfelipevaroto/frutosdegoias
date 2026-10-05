import type { Adicional } from "./types";
export type GrupoAdicionais = { id:string; nome:string; gratis:boolean; minimo:number; maximo:number|null; ativo?:boolean; itens:Adicional[] };
export function validarSelecaoGrupos(grupos:GrupoAdicionais[], selecionados:Adicional[]) {
  for(const g of grupos){const n=g.itens.filter(a=>selecionados.some(s=>s.id===a.id)).length;
    if(n<g.minimo)return `Escolha pelo menos ${g.minimo} ${g.minimo===1?"item":"itens"} em ${g.nome}.`;
    if(g.maximo!==null&&n>g.maximo)return `Escolha no máximo ${g.maximo} itens em ${g.nome}.`;
  }return "";
}
export function alternarItemGrupo(grupo:GrupoAdicionais,item:Adicional,selecionados:Adicional[]) {
  if(selecionados.some(a=>a.id===item.id))return selecionados.filter(a=>a.id!==item.id);
  const n=grupo.itens.filter(a=>selecionados.some(s=>s.id===a.id)).length;
  if(grupo.maximo!==null&&n>=grupo.maximo)return selecionados;
  return [...selecionados,{...item,preco:grupo.gratis?0:Number(item.preco)}];
}
