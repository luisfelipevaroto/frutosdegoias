import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export async function POST(req:Request){
 try{
  const {empresaId,latitude,longitude}=await req.json();
  const lat=Number(latitude),lng=Number(longitude);
  if(!empresaId||!Number.isFinite(lat)||!Number.isFinite(lng))return NextResponse.json({error:"Endereço sem geolocalização válida."},{status:400});
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key)return NextResponse.json({error:"Cotação iFood indisponível no servidor."},{status:503});
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,key);
  const [{data:modulo},{data:cfg},{data:cred,error:credError}]=await Promise.all([
   db.rpc("modulo_empresa_ativo",{p_empresa_id:empresaId,p_chave:"entrega_integrada"}),
   db.from("configuracoes_loja").select("valor").eq("empresa_id",empresaId).eq("chave","entrega").maybeSingle(),
   db.rpc("credencial_ifood_backend",{p_empresa_id:empresaId})
  ]);
  if(modulo!==true)return NextResponse.json({error:"Entrega integrada não está disponível para esta loja."},{status:403});
  const ent=(cfg?.valor||{}) as any;
  if(!ent.integrada||!ent.ifood)return NextResponse.json({error:"iFood não é o provedor de entrega ativo desta loja."},{status:400});
  if(credError)return NextResponse.json({error:"Não foi possível carregar a integração iFood."},{status:500});
  const c=Array.isArray(cred)?cred[0]:cred;
  if(!c?.client_id||!c?.client_secret||!c?.merchant_id)return NextResponse.json({error:"Integração iFood incompleta. Verifique Client ID, Client Secret e Merchant ID."},{status:422});
  const form=new URLSearchParams({grantType:"client_credentials",clientId:c.client_id,clientSecret:c.client_secret});
  const tr=await fetch("https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},body:form,cache:"no-store"});
  const td=await tr.json().catch(()=>({}));
  if(!tr.ok||!td.accessToken)return NextResponse.json({error:tr.status===401?"Credenciais iFood não autorizadas.":"Não foi possível autenticar no iFood."},{status:502});
  const url=`https://merchant-api.ifood.com.br/shipping/v1.0/merchants/${encodeURIComponent(c.merchant_id)}/deliveryAvailabilities?latitude=${encodeURIComponent(String(lat))}&longitude=${encodeURIComponent(String(lng))}`;
  const qr=await fetch(url,{headers:{Authorization:`Bearer ${td.accessToken}`,Accept:"application/json"},cache:"no-store"});
  const q=await qr.json().catch(()=>({}));
  if(!qr.ok)return NextResponse.json({error:qr.status===404?"iFood não possui entrega disponível para este endereço.":q?.message||q?.error?.message||"Não foi possível calcular a entrega pelo iFood."},{status:qr.status>=500?502:422});
  const valor=Number(q?.quote?.netValue??q?.quote?.grossValue);
  if(!q?.id||!Number.isFinite(valor))return NextResponse.json({error:"O iFood retornou uma cotação inválida."},{status:502});
  const minSec=Number(q?.deliveryTime?.min),maxSec=Number(q?.deliveryTime?.max);
  return NextResponse.json({quoteId:q.id,valor,distanciaKm:Number.isFinite(Number(q.distance))?Number((Number(q.distance)/1000).toFixed(2)):null,duracaoMinutosMin:Number.isFinite(minSec)?Math.ceil(minSec/60):null,duracaoMinutosMax:Number.isFinite(maxSec)?Math.ceil(maxSec/60):null,expiraEm:q.expirationAt||null,provedor:"ifood"});
 }catch{return NextResponse.json({error:"Não foi possível calcular a entrega pelo iFood."},{status:500})}
}
