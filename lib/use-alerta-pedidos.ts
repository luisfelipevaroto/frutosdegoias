"use client";
import{useCallback,useEffect,useRef,useState}from'react';
import{AlertaPedidos,limitarVolume}from'./alerta-pedidos';
const KEY='delivery_alerta_pedidos_volume';
export function useAlertaPedidos(){
 const motor=useRef<AlertaPedidos|null>(null),vivo=useRef(true),volumeRef=useRef(70);const[ativo,setAtivo]=useState(false),[volume,setVolume]=useState(70),[ocupado,setOcupado]=useState(false),[mensagem,setMensagem]=useState(''),[erro,setErro]=useState('');
 const obter=useCallback(()=>motor.current??(motor.current=new AlertaPedidos()),[]);
 useEffect(()=>{vivo.current=true;try{const v=localStorage.getItem(KEY);if(v!==null){const n=limitarVolume(Number(v));volumeRef.current=n;setVolume(n);}}catch{}return()=>{vivo.current=false;motor.current?.encerrar();motor.current=null;};},[]);
 const testar=useCallback(async()=>{setOcupado(true);setErro('');try{const m=obter();m.ajustarVolume(volumeRef.current);await m.ativar();if(!vivo.current)return;setAtivo(true);m.tocar(true);setMensagem(volumeRef.current===0?'Volume em 0%. Aumente o volume para ouvir.':'Teste de som iniciado. Se não ouviu, confira o volume do dispositivo e da aba.');}catch(e){if(vivo.current){setAtivo(false);setErro(e instanceof Error?e.message:'Não foi possível liberar o som. Tente novamente.');}}finally{if(vivo.current)setOcupado(false);}},[obter]);
 const alternar=useCallback(()=>{if(ativo){motor.current?.desativar();setAtivo(false);setMensagem('Alerta sonoro desativado.');setErro('');}else void testar();},[ativo,testar]);
 const ajustar=useCallback((v:number)=>{const n=limitarVolume(v);volumeRef.current=n;setVolume(n);motor.current?.ajustarVolume(n);setMensagem('');try{localStorage.setItem(KEY,String(n));}catch{}},[]);
 const avisar=useCallback(()=>{try{motor.current?.tocar();}catch(e){if(vivo.current){setAtivo(false);setErro(e instanceof Error?e.message:'Clique em Testar som para liberar o áudio.');}}},[]);
 return{ativo,volume,ocupado,mensagem,erro,testar,alternar,ajustar,avisar};
}
