/**
 * Cliente server-side isolado do PagBank.
 * Nenhuma rota de checkout usa este módulo até a ativação explícita do provedor.
 * Nunca importe em componentes client-side.
 */
export type PagBankAmbiente = "sandbox" | "producao";
export type PagBankCredenciais = { token: string; ambiente: PagBankAmbiente };
export type PagBankPedido = Record<string, unknown>;

const BASES: Record<PagBankAmbiente, string> = {
  sandbox: "https://sandbox.api.pagseguro.com",
  producao: "https://api.pagseguro.com",
};

export class PagBankApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "PagBankApiError";
  }
}

export async function pagBankRequest<T>(
  credenciais: PagBankCredenciais,
  caminho: string,
  opcoes: { method?: "GET" | "POST"; body?: unknown; idempotencyKey?: string } = {},
): Promise<T> {
  if (!credenciais.token?.trim()) throw new Error("Token PagBank não configurado");
  if (!Object.prototype.hasOwnProperty.call(BASES, credenciais.ambiente))
    throw new Error("Ambiente PagBank inválido");
  if (!/^\/(orders|charges)(\/[-a-zA-Z0-9_]+)*$/.test(caminho))
    throw new Error("Caminho PagBank não permitido");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${credenciais.token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (opcoes.idempotencyKey) headers["x-idempotency-key"] = opcoes.idempotencyKey;
  const resposta = await fetch(`${BASES[credenciais.ambiente]}${caminho}`, {
    method: opcoes.method ?? "GET",
    headers,
    body: opcoes.body === undefined ? undefined : JSON.stringify(opcoes.body),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!resposta.ok) {
    // Não expor resposta bruta do gateway: pode conter dados sensíveis.
    throw new PagBankApiError(resposta.status, `PagBank retornou HTTP ${resposta.status}`);
  }
  return (await resposta.json()) as T;
}

export function criarPedidoPagBank<T = unknown>(credenciais: PagBankCredenciais, pedido: PagBankPedido, chaveIdempotencia: string) {
  if (!chaveIdempotencia.trim()) throw new Error("Chave de idempotência obrigatória");
  return pagBankRequest<T>(credenciais, "/orders", { method: "POST", body: pedido, idempotencyKey: chaveIdempotencia });
}

export function consultarPedidoPagBank<T = unknown>(credenciais: PagBankCredenciais, id: string) {
  if (!/^ORDE_[a-zA-Z0-9-]+$/.test(id)) throw new Error("ID de pedido PagBank inválido");
  return pagBankRequest<T>(credenciais, `/orders/${id}`);
}
