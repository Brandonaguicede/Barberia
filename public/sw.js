/* Never cache navigations, API requests, private links or personal data. */
self.addEventListener('install',()=>self.skipWaiting())
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()))
self.addEventListener('push',event=>{
 let payload={title:'Aviso de la barbería',body:'Abre la agenda para consultar los detalles.',url:'/admin/citas'}
 try{payload={...payload,...event.data.json()}}catch{/* Use generic non-sensitive fallback. */}
 event.waitUntil(self.registration.showNotification(payload.title,{body:payload.body,icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',tag:payload.tag,data:{url:payload.url}}))
})
self.addEventListener('notificationclick',event=>{
 event.notification.close()
 const target=new URL(event.notification.data?.url||'/admin/citas',self.location.origin)
 const url=target.origin===self.location.origin&&target.pathname==='/admin/citas'?target.href:new URL('/admin/citas',self.location.origin).href
 event.waitUntil((async()=>{const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of windows){if(new URL(client.url).origin===self.location.origin){await client.navigate(url);return client.focus()}}return self.clients.openWindow(url)})())
})
