import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cotarUber, enderecoLoja, tokenUber } from '@/lib/uber-server';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(req:Request){try{
 const {empresaId,endereco}=await req.json();if(typeof empresaId!=='string'||typeof endereco!=='string'||!endereco.trim()||endereco.length>1000)return NextResponse.json({error:'Informe o endereço completo.'},{status:400});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return NextResponse.json({error:'Servidor não configurado.'},{status:503});
 const db=createClient(url,key,{auth:{persistSession:false}});
 const [m,cfg,e,c]=await Promise.all([db.rpc('modulo_empresa_ativo',{p_empresa_id:empresaId,p_chave:'entrega_integrada'}),db.from('configuracoes_loja').select('valor').eq('empresa_id',empresaId).eq('chave','entrega').maybeSingle(),db.from('empresas').select('id,nome,endereco,cidade,estado,cep,ativo').eq('id',empresaId).eq('ativo',true).single(),db.rpc('credencial_uber_direct_backend',{p_empresa_id:empresaId})]);
 if(m.error||m.data!==true||!cfg.data?.valor?.integrada||!cfg.data?.valor?.uber_direct||e.error||!e.data)return NextResponse.json({error:'Uber envio indisponível para esta loja.'},{status:422});
 const cred=Array.isArray(c.data)?c.data[0]:c.data;if(c.error||!cred)throw new Error('Configure a integração Uber.');
 const result=await cotarUber(db,cred,await tokenUber(cred),empresaId,enderecoLoja(e.data),endereco.trim());return NextResponse.json({...result,nome:'Uber envio',provedor:'uber_direct'});
}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Não foi possível calcular a entrega.'},{status:422});}}

