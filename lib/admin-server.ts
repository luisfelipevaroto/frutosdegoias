import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
export async function autorizarEmpresa(req:Request,empresaId:string){
 const token=req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
 if(!token)return NextResponse.json({error:'Entre novamente no painel.'},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!anon||!key)return NextResponse.json({error:'Servidor não configurado.'},{status:503});
 const caller=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await caller.auth.getUser(token);
 if(error||!user)return NextResponse.json({error:'Sessão expirada.'},{status:401});
 const permission=await caller.rpc('is_admin_empresa',{p_empresa_id:empresaId});
 if(permission.error||permission.data!==true)return NextResponse.json({error:'Sem acesso a esta empresa.'},{status:403});
 return {db:createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),userId:user.id};
}
