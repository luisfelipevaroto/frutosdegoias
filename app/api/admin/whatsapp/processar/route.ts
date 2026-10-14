import {NextResponse} from 'next/server';
import {autorizarEmpresa} from '@/lib/admin-server';
import {processarFilaWhatsApp} from '@/lib/whatsapp-server';
export const maxDuration=60;
export async function POST(req:Request){try{const {empresaId}=await req.json();if(typeof empresaId!=='string')return NextResponse.json({error:'Empresa inválida.'},{status:400});const access=await autorizarEmpresa(req,empresaId);if(access instanceof NextResponse)return access;if(process.env.WHATSAPP_AUTOMACAO_ATIVA!=='true')return NextResponse.json({error:'Serviço de envio ainda não ativado.'},{status:503});await processarFilaWhatsApp(access.db,empresaId);return NextResponse.json({ok:true});}catch{return NextResponse.json({error:'Fila indisponível.'},{status:503});}}
