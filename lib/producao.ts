const TEMPOS_ANTIGOS:Record<string,string>={
  "30_40":"de 30 a 40 min",
  "40_50":"de 40 a 50 min",
  "ate_1h":"Em até 1h",
  "mais_1h":"Estamos com alto volume de pedidos, previsão de mais de 1h para entrega."
};
export function textoProducao(valor:unknown,textoLivre=false):string {
  if(typeof valor!=="string")return "";
  if(textoLivre)return valor;
  return Object.prototype.hasOwnProperty.call(TEMPOS_ANTIGOS,valor)?TEMPOS_ANTIGOS[valor]:valor;
}
