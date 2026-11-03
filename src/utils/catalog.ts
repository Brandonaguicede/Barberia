import type { Catalog } from '../services/api'
import { addCalendarDays } from './calendar.ts'

export interface CatalogSelection { service_id: string; barber_id: string; appointment_date: string; appointment_time: string }
export function reconcileCatalog(previous: Catalog | null, next: Catalog, current: CatalogSelection, today: string) {
  const activeBarbers = next.barbers.filter(b => b.active)
  const available = next.services.filter(s => s.active && next.barber_services.some(l => l.service_id === s.id && activeBarbers.some(b => b.id === l.barber_id)))
  const serviceId = available.some(s => s.id === current.service_id) ? current.service_id : available.length === 1 ? available[0].id : ''
  const matching = activeBarbers.filter(b => next.barber_services.some(l => l.barber_id === b.id && (!serviceId || l.service_id === serviceId)))
  const barberId = matching.some(b => b.id === current.barber_id) ? current.barber_id : matching.length === 1 ? matching[0].id : ''
  const before = previous?.services.find(s => s.id === current.service_id)
  const after = next.services.find(s => s.id === serviceId)
  const selectionChanged = Boolean(previous && (serviceId !== current.service_id || barberId !== current.barber_id))
  const priceChanged = Boolean(before && after && serviceId === current.service_id && Number(before.price) !== Number(after.price))
  const durationChanged = Boolean(before && after && serviceId === current.service_id && before.duration !== after.duration)
  const dateValid = !current.appointment_date || (current.appointment_date >= today && current.appointment_date <= addCalendarDays(today, next.settings.horizon_days))
  return {
    selection: { service_id: serviceId, barber_id: barberId, appointment_date: dateValid ? current.appointment_date : '', appointment_time: selectionChanged || durationChanged || !dateValid ? '' : current.appointment_time },
    selectionChanged, priceChanged, durationChanged, dateChanged: !dateValid,
  }
}
