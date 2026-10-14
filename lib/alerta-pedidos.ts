export class DetectorNovosPedidos{
 private vistos:Set<string>|null=null;
 atualizar(pedidos:{id:string;status_pedido:string}[]){const novos=this.vistos?pedidos.filter(p=>p.status_pedido==='recebido'&&!this.vistos!.has(p.id)):[];if(!this.vistos)this.vistos=new Set();for(const p of pedidos)this.vistos.add(p.id);return novos;}
}
export function limitarVolume(valor:number){return Number.isFinite(valor)?Math.max(0,Math.min(100,valor)):70;}
export class AlertaPedidos{
 private contexto:AudioContext|null=null;private saida:GainNode|null=null;private habilitado=false;private volume=70;private ate=0;private vozes=new Set<OscillatorNode>();
 constructor(private fabricar=()=>{const C=window.AudioContext||(window as any).webkitAudioContext;if(!C)throw Error('Este navegador não oferece áudio. Tente Chrome ou Edge atualizado.');return new C() as AudioContext;}){}
 ajustarVolume(valor:number){this.volume=limitarVolume(valor);if(this.contexto&&this.saida)this.saida.gain.setValueAtTime(this.volume/100*.35,this.contexto.currentTime);}
 async ativar(){if(!this.contexto||this.contexto.state==='closed'){this.contexto=this.fabricar();this.saida=this.contexto.createGain();this.saida.connect(this.contexto.destination);this.ajustarVolume(this.volume);}if(this.contexto.state!=='running')await this.contexto.resume();if(this.contexto.state!=='running')throw Error('Som bloqueado pelo navegador. Clique novamente em Ativar som.');this.habilitado=true;}
 tocar(forcar=false){if(!this.habilitado)return false;if(!this.contexto||this.contexto.state!=='running')throw Error('O som foi interrompido. Clique em Testar som para liberar novamente.');if(this.volume===0)return false;const c=this.contexto;if(forcar){this.ate=0;for(const o of this.vozes){try{o.stop();}catch{}}}if(c.currentTime<this.ate)return false;this.ate=c.currentTime+1.35;for(const [inicio,freq] of [[0,880],[.3,1174],[.72,880],[1.02,1174]]){const o=c.createOscillator(),g=c.createGain(),t=c.currentTime+inicio;o.type='sine';o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(1,t+.02);g.gain.setValueAtTime(1,t+.18);g.gain.linearRampToValueAtTime(0,t+.27);o.connect(g);g.connect(this.saida!);this.vozes.add(o);o.onended=()=>{o.disconnect();g.disconnect();this.vozes.delete(o);};o.start(t);o.stop(t+.28);}return true;}
 desativar(){this.habilitado=false;this.ate=0;for(const o of this.vozes){try{o.stop();}catch{}}}
 encerrar(){this.desativar();const c=this.contexto;this.contexto=null;this.saida=null;if(c&&c.state!=='closed')void c.close().catch(()=>{});}
}
