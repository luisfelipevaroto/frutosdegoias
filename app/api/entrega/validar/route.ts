import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Local = { cep?:string;street?:string;neighborhood?:string;city?:string;state?:string;location?:{coordinates?:{latitude?:string;longitude?:string}} };

function km(aLat:number,aLon:number,bLat:number,bLon:number){
  const r=6371,dLat=(bLat-aLat)*Math.PI/180,dLon=(bLon-aLon)*Math.PI/180;
  const x=Math.sin(dLat/2)**2+Math.cos(aLat*Math.PI/180)*Math.cos(bLat*Math.PI/180)*Math.sin(dLon/2)**2;
  return r*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}
async function cepInfo(cep:string):Promise<Local|null>{
  const r=await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`,{cache:"no-store"});
  if(!r.ok)return null; return r.json();
}
export async function POST(req:Request){
  try{
    const {empresaId,cep}=await req.json(),limpo=String(cep||"").replace(/\D/g,"");
    if(!empresaId||limpo.length!==8)return NextResponse.json({error:"Informe um CEP válido."},{status:400});
    const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!key)return NextResponse.json({error:"Validação de entrega indisponível."},{status:503});
    const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,key);
    const [{data:empresa},{data:cfg}]=await Promise.all([
      db.from("empresas").select("cep,endereco,cidade,estado").eq("id",empresaId).eq("ativo",true).single(),
      db.from("configuracoes_loja").select("valor").eq("empresa_id",empresaId).eq("chave","entrega").maybeSingle()
    ]);
    if(!empresa)return NextResponse.json({error:"Empresa não encontrada."},{status:404});
    const destino=await cepInfo(limpo);
    if(!destino)return NextResponse.json({error:"CEP não encontrado."},{status:404});
    const raio=Number((cfg?.valor as any)?.raio_km||0);
    let distanciaKm:number|null=null,dentro=true;
    if(raio>0){
      const origemCep=String(empresa.cep||"").replace(/\D/g,"");
      if(origemCep.length!==8)return NextResponse.json({error:"A loja precisa cadastrar um CEP de origem para validar o raio de entrega."},{status:422});
      const origem=await cepInfo(origemCep);
      const a=origem?.location?.coordinates,b=destino.location?.coordinates;
      if(!a?.latitude||!a?.longitude||!b?.latitude||!b?.longitude)return NextResponse.json({error:"Não foi possível calcular a distância deste CEP. Tente outro endereço ou fale com a loja."},{status:422});
      distanciaKm=km(Number(a.latitude),Number(a.longitude),Number(b.latitude),Number(b.longitude));
      dentro=distanciaKm<=raio;
    }
    return NextResponse.json({valido:dentro,raioKm:raio,distanciaKm:distanciaKm===null?null:Number(distanciaKm.toFixed(2)),endereco:{cep:destino.cep||limpo,logradouro:destino.street||"",bairro:destino.neighborhood||"",cidade:destino.city||"",estado:destino.state||""}});
  }catch{return NextResponse.json({error:"Não foi possível validar o endereço."},{status:400})}
}