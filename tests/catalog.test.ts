import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reconcileCatalog } from '../src/utils/catalog.ts'
import type { Catalog } from '../src/services/api.ts'

const sample = (): Catalog => ({
  services: [{ id: 'corte', name: 'Corte', price: 4000, duration: 30, category: 'corte', active: 1, created_at: '', updated_at: '' }],
  barbers: [{ id: 'axel', name: 'Axel', active: 1, created_at: '', updated_at: '' }],
  barber_services: [{ service_id: 'corte', barber_id: 'axel' }], settings: { shop_name: 'TENORIO', horizon_days: 90 },
})
const selection = { service_id: 'corte', barber_id: 'axel', appointment_date: '2026-11-06', appointment_time: '09:00' }
test('catalogo: una actualizacion sin cambios conserva la hora y los datos del cliente', () => {
  const current = { ...selection, client_name: 'Cliente', client_phone: '88881234', notes: 'Mi preferencia' }
  const result = reconcileCatalog(sample(), sample(), current, '2026-11-03')
  assert.deepEqual(result.selection, selection)
  assert.deepEqual({ ...current, ...result.selection }, current)
  assert.equal(result.selectionChanged, false)
})
test('catalogo: el precio exige revision y la duracion invalida solo la hora', () => {
  const before = sample(), next = sample()
  next.services[0].price = 5500
  const price = reconcileCatalog(before, next, selection, '2026-11-03')
  assert.equal(price.priceChanged, true)
  assert.equal(price.selection.appointment_time, '09:00')
  next.services[0].duration = 45
  const duration = reconcileCatalog(before, next, selection, '2026-11-03')
  assert.equal(duration.durationChanged, true)
  assert.equal(duration.selection.appointment_time, '')
  assert.equal(duration.selection.appointment_date, selection.appointment_date)
})
test('catalogo: quitar un servicio o su asignacion impide reservar la seleccion anterior', () => {
  const before = sample(), next = sample()
  next.services[0].active = 0
  const inactive = reconcileCatalog(before, next, selection, '2026-11-03')
  assert.equal(inactive.selection.service_id, '')
  assert.equal(inactive.selection.appointment_time, '')
  assert.equal(inactive.selectionChanged, true)
  next.services[0].active = 1; next.barber_services = []
  assert.equal(reconcileCatalog(before, next, selection, '2026-11-03').selection.service_id, '')
})
test('catalogo: un horizonte menor invalida la fecha y una nueva asignacion conserva al profesional si sigue disponible', () => {
  const before = sample(), next = sample(); next.settings.horizon_days = 1
  const range = reconcileCatalog(before, next, selection, '2026-11-03')
  assert.equal(range.dateChanged, true)
  assert.equal(range.selection.appointment_date, '')
  assert.equal(range.selection.appointment_time, '')
  next.settings.horizon_days = 90
  next.barbers.push({ id: 'otro', name: 'Otro', active: 1, created_at: '', updated_at: '' })
  next.barber_services.push({ service_id: 'corte', barber_id: 'otro' })
  assert.equal(reconcileCatalog(before, next, selection, '2026-11-03').selection.barber_id, 'axel')
})
