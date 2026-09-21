import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export async function POST(req:Request){
 try{
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!key)return NextResponse.json({error:"Pagamento online não configurado."},{status:503});
  const {pedidoId,email,cpf}=await req.json();
  if(!pedidoId||!String(email||"").includes("@"))return NextResponse.json({error:"Informe um e-mail válido para o PIX."},{status:400});
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,key);
  const {data:p}=await db.from("pedidos").select("id,numero,empresa_id,valor_total,status_pagamento").eq("id",pedidoId).single();
  if(!p)return NextResponse.json({error:"Pedido não encontrado."},{status:404});
  if(p.status_pagamento==="pago")return NextResponse.json({error:"Este pedido já está pago."},{status:409});
  const {data:i}=await db.from("integracoes_empresa").select("ativo").eq("empresa_id",p.empresa_id).eq("tipo","pagamento").eq("provedor","mercado_pago").eq("ativo",true).maybeSingle();
  const {data:c}=await db.from("integracoes_credenciais").select("credenciais,ambiente").eq("empresa_id",p.empresa_id).eq("provedor","mercado_pago").maybeSingle();
  const token=(c?.credenciais as any)?.access_token;
  if(!i||!token)return NextResponse.json({error:"Mercado Pago não está conectado para esta empresa."},{status:400});
  const amount=Number(p.valor_total).toFixed(2);
  const body={type:"online",total_amount:amount,external_reference:p.id,processing_mode:"automatic",transactions:{payments:[{amount,payment_method:{id:"pix",type:"bank_transfer"}}]},payer:{email:String(email).trim(),identification:{type:"CPF",number:String(cpf||"").replace(/\D/g,"")}}};
  const r=await fetch("https://api.mercadopago.com/v1/orders",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json","X-Idempotency-Key":crypto.randomUUID()},body:JSON.stringify(body)});
  const d=await r.json();if(!r.ok)return NextResponse.json({error:d.message||d.error||"Mercado Pago recusou a cobrança.",details:d},{status:400});
  const pay=d?.transactions?.payments?.[0],pm=pay?.payment_method||{};
  await db.from("pedidos").update({provedor_pagamento:"mercado_pago",pagamento_externo_id:d.id,status_pagamento:"pendente",pagamento_url:pm.ticket_url||null}).eq("id",p.id).eq("empresa_id",p.empresa_id);
  return NextResponse.json({orderId:d.id,pedidoNumero:p.numero,status:pay?.status||d.status,qrCode:pm.qr_code||null,qrCodeBase64:pm.qr_code_base64||null,ticketUrl:pm.ticket_url||null,ambiente:c?.ambiente||"teste"});
 }catch{return NextResponse.json({error:"Não foi possível gerar o PIX."},{status:400})}
}