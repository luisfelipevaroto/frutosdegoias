export const DIAS_TESTE_SAAS=7;
export const DIAS_TOLERANCIA_SAAS=7;
export function politicaAssinatura(vencimento:string,hoje:string){
 const due=new Date(`${vencimento}T12:00:00Z`),now=new Date(`${hoje}T12:00:00Z`);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(vencimento)||!Number.isFinite(due.getTime())||!Number.isFinite(now.getTime()))throw Error('Data inválida.');
 const days=Math.floor((now.getTime()-due.getTime())/86400000);
 return {atrasada:days>0,suspender:days>=DIAS_TOLERANCIA_SAAS,diasAtraso:Math.max(0,days)};
}
export function vencimentoConciliado(subscription:any,invoices:any[],valor:number,hoje:string,primeiro:string){
 const pending:string[]=[];
 for(const invoice of invoices){
  if(invoice.preapproval_id!==subscription.id||invoice.currency_id!=='BRL'||Math.round(Number(invoice.transaction_amount)*100)!==Math.round(valor*100))throw Error('Fatura divergente.');
  const date=new Date(invoice.debit_date);
  if(!Number.isFinite(date.getTime()))throw Error('Vencimento inválido.');
  const due=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(date);
  if(invoice.payment?.status!=='approved')pending.push(due);
 }
 if(pending.length)return pending.sort()[0];
 const next=subscription.next_payment_date?new Date(subscription.next_payment_date):null;
 if(next&&Number.isFinite(next.getTime()))return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(next);
 // Missing billing data must not establish a new overdue date after settled invoices.
 if(invoices.length)throw Error('O provedor não informou o próximo vencimento.');
 return primeiro;
}
