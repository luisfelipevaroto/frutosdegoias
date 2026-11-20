export function moduloDaRotaPainel(caminho: string): string | null {
  if (/^\/admin\/(pedidos|pdv)(\/|$)/.test(caminho)) return "pedidos";
  if (/^\/admin\/fidelidade(\/|$)/.test(caminho)) return "fidelidade";
  if (/^\/admin\/integracoes\/(ifood|uber-direct)(\/|$)/.test(caminho)) return "entrega_integrada";
  if (/^\/admin\/integracoes\/whatsapp(\/|$)/.test(caminho)) return "whatsapp_api";
  if (/^\/admin\/integracoes\/rastreamento(\/|$)/.test(caminho)) return "tracking";
  return null;
}
