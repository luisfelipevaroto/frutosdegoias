import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Local = { cep?:string;street?:string;neighborhood?:string;city?:string;state?:string;location?:{coordinates?:{latitude?:string;longitude?:string}} };

function km(aLat:number,aLon:number,bLat:number,bLon:number){
  const r=6371,dLat=(bLat-aLat)*Math.PI/180,dLon=(bLon-aLon)*Math.PI/180;
  const x=Math.sin(dLat/2)**2+Math.cos(aLat*Math.PI/180)*Math.cos(bLat*Math.PI/180)*Math.sin(dLon/2)**2;
  return r*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}
async function cepInfo(cep:string):Promise<Local|null>{
  const r=await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`,{cache:"no-store",headers:{Accept:"application/json"}});
  if(!r.ok)return null; return r.json();
}
export async function POST(req:Request){
  try{
    const {empresaId,cep}=await req.json(),limpo=String(cep||"").replace(/\D/g,"");
    if(!empresaId||limpo.length!==8)return NextResponse.json({error:"Informe um CEP válido."},{status:400});
    const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!key)return NextResponse.json({error:"Validação de entrega indisponível."},{status:503});
    const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,key);
    const [{data:empresa},{data:cfg},{data:moduloIntegrado}]=await Promise.all([
      db.from("empresas").select("cep,endereco,cidade,estado").eq("id",empresaId).eq("ativo",true).single(),
      db.from("configuracoes_loja").select("valor").eq("empresa_id",empresaId).eq("chave","entrega").maybeSingle(),
      db.rpc("modulo_empresa_ativo",{p_empresa_id:empresaId,p_chave:"entrega_integrada"})
    ]);
    if(!empresa)return NextResponse.json({error:"Empresa não encontrada."},{status:404});
    const destino=await cepInfo(limpo);
    if(!destino)return NextResponse.json({error:"CEP não encontrado."},{status:404});
    const coord=destino.location?.coordinates;
    const latitude=coord?.latitude?Number(coord.latitude):null,longitude=coord?.longitude?Number(coord.longitude):null;
    const coordsValidas=Number.isFinite(latitude)&&Number.isFinite(longitude);
    const entregaCfg=(cfg?.valor||{}) as any;
    const usaIntegrada=moduloIntegrado===true&&Boolean(entregaCfg?.integrada)&&(Boolean(entregaCfg?.uber_direct)||Boolean(entregaCfg?.ifood)||Boolean(entregaCfg?.entrega_99));
    if(usaIntegrada&&!coordsValidas)return NextResponse.json({error:"Não foi possível localizar este CEP no mapa. Confira o CEP ou informe outro endereço."},{status:422});
    const raio=Number(entregaCfg?.raio_km||0);
    let distanciaKm:number|null=null,dentro=true;
    if(Boolean(entregaCfg?.propria)&&raio>0){
      const origemCep=String(empresa.cep||"").replace(/\D/g,"");
      if(origemCep.length!==8)return NextResponse.json({error:"A loja precisa cadastrar um CEP de origem para validar o raio de entrega."},{status:422});
      const origem=await cepInfo(origemCep);
      const a=origem?.location?.coordinates;
      if(!a?.latitude||!a?.longitude||!coordsValidas)return NextResponse.json({error:"Não foi possível calcular a distância deste CEP. Tente outro endereço ou fale com a loja."},{status:422});
      distanciaKm=km(Number(a.latitude),Number(a.longitude),latitude as number,longitude as number);
      dentro=distanciaKm<=raio;
    }
    return NextResponse.json({
      valido:dentro,
      raioKm:raio,
      distanciaKm:distanciaKm===null?null:Number(distanciaKm.toFixed(2)),
      endereco:{cep:destino.cep||limpo,logradouro:destino.street||"",bairro:destino.neighborhood||"",cidade:destino.city||"",estado:destino.state||"",latitude:coordsValidas?latitude:null,longitude:coordsValidas?longitude:null},
      geolocalizacao:coordsValidas?{latitude,longitude}:null
    });
  }catch{return NextResponse.json({error:"Não foi possível validar o endereço."},{status:400})}
}