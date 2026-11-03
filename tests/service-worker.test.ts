import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

function worker() {
  const handlers:Record<string,(event:any)=>void>={}, calls:any[]=[]
  const self={location:{origin:'https://example.vercel.app'},addEventListener:(name:string,fn:(event:any)=>void)=>{handlers[name]=fn},registration:{showNotification:async(title:string,options:unknown)=>{calls.push({title,options})}},clients:{claim:async()=>{},matchAll:async()=>[],openWindow:async(url:string)=>{calls.push({url})}},skipWaiting:()=>{}}
  vm.runInNewContext(readFileSync('public/sw.js','utf8'),{self,URL})
  return {handlers,calls}
}
test('push muestra notificación persistente sin necesitar una ventana abierta',async()=>{
  const{handlers,calls}=worker();let done:Promise<unknown>=Promise.resolve()
  handlers.push({data:{json:()=>({title:'Nueva reserva confirmada',tag:'notification-1',url:'/admin/citas?appointment=123'})},waitUntil:(p:Promise<unknown>)=>{done=p}})
  await done
  assert.equal(calls[0].title,'Nueva reserva confirmada')
  assert.equal(calls[0].options.tag,'notification-1')
  assert.ok(!('fetch'in handlers))
})
test('notificación manipulada no puede abrir un dominio externo',async()=>{
  const{handlers,calls}=worker();let done:Promise<unknown>=Promise.resolve(),closed=false
  handlers.notificationclick({notification:{close:()=>{closed=true},data:{url:'https://attacker.example/phishing'}},waitUntil:(p:Promise<unknown>)=>{done=p}})
  await done;assert.equal(closed,true);assert.equal(calls[0].url,'https://example.vercel.app/admin/citas')
})
test('payload inválido conserva un aviso genérico sin datos de clientes',async()=>{
  const{handlers,calls}=worker();let done:Promise<unknown>=Promise.resolve()
  handlers.push({data:{json:()=>{throw new Error('payload inválido')}},waitUntil:(p:Promise<unknown>)=>{done=p}})
  await done;assert.equal(calls[0].title,'Aviso de la barbería');assert.ok(calls[0].options.body.includes('agenda'))
})
