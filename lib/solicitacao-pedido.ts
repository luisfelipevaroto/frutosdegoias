export function jsonCanonico(value:unknown):string{
 if(Array.isArray(value))return `[${value.map(jsonCanonico).join(',')}]`;
 if(value&&typeof value==='object')return `{${Object.keys(value).sort().filter(k=>(value as any)[k]!==undefined).map(k=>`${JSON.stringify(k)}:${jsonCanonico((value as any)[k])}`).join(',')}}`;
 return JSON.stringify(value)??'null';
}
export async function chavePedidoCliente(empresaId:string,body:unknown){
 const bytes=new TextEncoder().encode(jsonCanonico(body)),digest=await crypto.subtle.digest('SHA-256',bytes),signature=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
 const storage=`delivery_solicitacao_v1:${empresaId}`;
 try{const old=JSON.parse(localStorage.getItem(storage)||'null');if(old?.signature===signature&&typeof old.id==='string'&&/^[a-f0-9-]{36}$/i.test(old.id))return old.id;}catch{}
 const id=crypto.randomUUID();try{localStorage.setItem(storage,JSON.stringify({id,signature}));}catch{}
 return id;
}
export function concluirSolicitacaoPedido(empresaId:string){try{localStorage.removeItem(`delivery_solicitacao_v1:${empresaId}`);}catch{}}
