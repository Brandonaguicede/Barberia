import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'
import { localDate } from '../src/utils/booking.ts'

// Requires npm run dev with the non-secret fixture env documented in setup.md.
test('reserva y enlace privado en escritorio y móvil (API simulada)',async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.SMOKE_BROWSER?{executablePath:process.env.SMOKE_BROWSER}:{})})
 const token='a'.repeat(64),nextToken='b'.repeat(64),base=process.env.SMOKE_URL||'http://localhost:5173'
 const date=localDate(new Date(Date.now()+3*86400000)),appt={id:'10000000-0000-4000-8000-000000000001',client_name:'Ana Pérez',client_phone:'88881234',barber_id:'barber-1',service_id:'service-1',service_name:'Corte clásico',barber_name:'Ángel',service_duration:45,service_price:8000,appointment_date:date,appointment_time:'09:00',starts_at:date+'T15:00:00Z',ends_at:date+'T15:45:00Z',status:'confirmed',can_cancel:true,can_reschedule:true,access_token:token}
 try{
 await fs.mkdir('.npm-cache/screenshots',{recursive:true})
 for(const [device,viewport]of [['desktop',{width:1366,height:900}],['mobile',{width:390,height:844}]]){
 const context=await browser.newContext({viewport,serviceWorkers:'block'}),page=await context.newPage(),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 let current={...appt},createCount=0
 await context.route('**/functions/v1/booking',async route=>{
 const b=route.request().postDataJSON();let data
 if(b.action==='catalog')data={barbers:[{id:'barber-1',name:'Ángel',active:true}],services:[{id:'service-1',name:'Corte clásico',duration:45,price:8000,category:'corte',active:true}],barber_services:[{barber_id:'barber-1',service_id:'service-1'}],settings:{shop_name:'ANGEL BARBER SHOP',horizon_days:90}}
 else if(b.action==='slots')data=[{barber_id:'barber-1',starts_at:date+'T15:00:00Z'},{barber_id:'barber-1',starts_at:date+'T16:00:00Z'}]
 else if(b.action==='create'){createCount++;data=current}
 else if(b.action==='reschedule'){current={...current,appointment_time:b.appointment.appointment_time,access_token:nextToken};data=current}
 else if(b.action==='cancel'){current={...current,status:'cancelled',can_cancel:false,can_reschedule:false};data=current}
 else data=current
 await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)})
 })
 await page.goto(base)
 await page.getByRole('button',{name:/Corte clásico/}).click()
 await page.getByRole('button',{name:'Continuar',exact:true}).click()
 await page.getByLabel('Fecha de la cita').fill(date)
 await page.getByRole('button',{name:'9:00 am',exact:true}).click()
 await page.getByRole('button',{name:'Continuar',exact:true}).click()
 await page.getByLabel('Nombre completo').fill('Ana Pérez')
 await page.getByLabel(/Telefono/).fill('88881234')
 await page.getByRole('button',{name:'Continuar',exact:true}).click()
 await page.getByRole('button',{name:'Confirmar cita',exact:true}).click()
 await page.waitForURL(`**/mi-cita/${token}`)
 await page.getByRole('heading',{name:'Mi cita',exact:true}).waitFor()
 await page.getByText('Confirmada',{exact:true}).waitFor()
 assert.equal(createCount,1)
 const whatsapp=await page.getByRole('link',{name:'Guardar mi cita en WhatsApp'}).getAttribute('href')
 assert.ok(new URL(whatsapp).searchParams.get('text').includes(`/mi-cita/${token}`))
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false)
 await page.screenshot({path:`.npm-cache/screenshots/receipt-${device}.png`,fullPage:true,animations:'disabled'})
 await page.getByRole('button',{name:'Reprogramar',exact:true}).click()
 await page.getByLabel('Nueva fecha').fill(date)
 await page.getByLabel('Nueva hora').selectOption('10:00')
 await page.getByRole('button',{name:'Confirmar nuevo horario'}).click()
 await page.waitForURL(`**/mi-cita/${nextToken}`)
 await page.getByText('10:00',{exact:true}).waitFor()
 await page.getByRole('button',{name:'Cancelar cita',exact:true}).click()
 assert.equal(current.status,'confirmed')
 await page.getByRole('button',{name:'Conservar cita'}).click()
 assert.equal(current.status,'confirmed')
 await page.getByRole('button',{name:'Cancelar cita',exact:true}).click()
 await page.getByRole('button',{name:'Sí, cancelar mi cita'}).click()
 await page.getByText('Cancelada',{exact:true}).waitFor()
 await page.reload();await page.getByText('Cancelada',{exact:true}).waitFor()
 assert.deepEqual(errors,[])
 await context.close()
 }
 }finally{await browser.close()}
})
