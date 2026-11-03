import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from '../../services/toast'
import { CalendarDays, Check, Clock3, Scissors, Sparkles, UserRound } from 'lucide-react'
import { localDate } from '../../utils/booking'
import { catalogApi, appointmentsApi } from '../../services/api'
import type { Barber, Service } from '../../types'
import { FormField, Input, TextArea } from '../../components/shared/FormField'
import styles from './BookingPage.module.css'

type Step = 1 | 2 | 3 | 4

interface FormData {
  barber_id: string
  service_id: string
  appointment_date: string
  appointment_time: string
  client_name: string
  client_phone: string
  client_email: string
  notes: string
}

const CATEGORY_LABELS: Record<string, string> = {
  corte: 'Corte',
  barba: 'Barba',
  combo: 'Combo',
  color: 'Color',
  general: 'General',
}

export default function BookingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [slots, setSlots] = useState<string[]>([])
  const [loadError, setLoadError] = useState('')
  const [links, setLinks] = useState<{barber_id:string;service_id:string}[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<FormData>({
    barber_id: 'any', service_id: '', appointment_date: '',
    appointment_time: '', client_name: '', client_phone: '',
    client_email: '', notes: '',
  })

  useEffect(() => {
    let live = true
    catalogApi.get()
      .then(c => { if (live) { setBarbers(c.barbers); setServices(c.services); setLinks(c.barber_services) } })
      .catch(e => { if (live) setLoadError(e.message) })
    return () => { live = false }
  }, [])

  useEffect(() => {
    let live = true
    setSlots([])
    setForm(f => ({ ...f, appointment_time: '' }))
    if (form.barber_id && form.appointment_date && form.service_id) {
      setLoadingSlots(true)
      appointmentsApi.getAvailableSlots({
        barber_id: form.barber_id,
        date: form.appointment_date,
        service_id: form.service_id,
      })
        .then(s => { if (live) setSlots(s) })
        .catch(() => toast.error('Error al cargar horarios'))
        .finally(() => { if (live) setLoadingSlots(false) })
    }
    return () => { live = false }
  }, [form.barber_id, form.appointment_date, form.service_id])

  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const selectedBarber = barbers.find(b => b.id === form.barber_id)
  const selectedService = services.find(s => s.id === form.service_id)

  const eligibleServices = services.filter(s => form.barber_id === 'any' ? links.some(l => l.service_id === s.id) : links.some(l => l.barber_id === form.barber_id && l.service_id === s.id))
  const servicesByCategory = eligibleServices.reduce<Record<string, Service[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = []
    acc[s.category].push(s)
    return acc
  }, {})

  const today = localDate()

  const formatTime = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    const suffix = h >= 12 ? 'pm' : 'am'
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
    return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`
  }

  const formatPrice = (p: number) =>
    new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(p)

  const canGoNext = () => {
    if (step === 1) return !!form.barber_id && !!form.service_id
    if (step === 2) return !!form.appointment_date && !!form.appointment_time
    if (step === 3) return form.client_name.trim().length > 0 && /^\+?[0-9 ()-]{8,25}$/.test(form.client_phone)
    return false
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const appt = await appointmentsApi.create(form)
      toast.success('Cita confirmada')
      navigate(`/mi-cita/${appt.access_token}`, { replace: true })
    } catch (err: any) {
      toast.error(err.message || 'Error al agendar la cita')
    } finally {
      setSubmitting(false)
    }
  }

  const steps = ['Servicio', 'Horario', 'Datos', 'Confirmar']

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1 className={styles.heroTitle}>Reserva tu <span>cita.</span></h1>
        <p className={styles.heroSub}>Selecciona el profesional, el servicio y el horario que mejor se ajuste a tu agenda.</p>
      </div>

      {loadError && <p role="alert">{loadError}. Comprueba la configuración y recarga la página.</p>}
      <div className={styles.stepper}>
        {steps.map((label, i) => {
          const n = (i + 1) as Step
          const active = step === n
          const done = step > n
          return (
            <div key={n} aria-current={active ? 'step' : undefined} className={`${styles.stepItem} ${active ? styles.stepActive : ''} ${done ? styles.stepDone : ''}`}>
              <div className={styles.stepCircle}>{done ? <Check size={15} strokeWidth={2.4} /> : n}</div>
              <span className={styles.stepLabel}>{label}</span>
              {i < steps.length - 1 && <div className={`${styles.stepLine} ${done ? styles.stepLineDone : ''}`} />}
            </div>
          )
        })}
      </div>

      <div className={styles.card}>
        {step === 1 && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Elige servicio y barbero</h2>
            <div className={styles.section}>
              <p className={styles.sectionLabel}>Servicio</p>
              {Object.entries(servicesByCategory).map(([cat, svcs]) => (
                <div key={cat} className={styles.serviceGroup}>
                  <p className={styles.categoryLabel}><Sparkles size={13} strokeWidth={2} />{CATEGORY_LABELS[cat] || cat}</p>
                  <div className={styles.serviceList}>
                    {svcs.map(s => (
                      <button key={s.id} aria-pressed={form.service_id === s.id} className={`${styles.serviceCard} ${form.service_id === s.id ? styles.selected : ''}`} onClick={() => setForm(f => ({ ...f, service_id: s.id }))}>
                        <div className={styles.serviceInfo}>
                          <span className={styles.serviceName}>{s.name}</span>
                          {s.description && <span className={styles.serviceDesc}>{s.description}</span>}
                        </div>
                        <div className={styles.serviceMeta}>
                          <span className={styles.servicePrice}>{formatPrice(s.price)}</span>
                          <span className={styles.serviceDuration}><Clock3 size={12} strokeWidth={2} />{s.duration} min</span>
                        </div>
                        {form.service_id === s.id && <span className={styles.checkMark}><Check size={14} strokeWidth={2.6} /></span>}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.section}>
              <p className={styles.sectionLabel}>Barbero</p>
              <div className={styles.barberGrid}>
                <button aria-pressed={form.barber_id === 'any'} className={`${styles.barberCard} ${form.barber_id === 'any' ? styles.selected : ''}`} onClick={() => setForm(f => ({ ...f, barber_id: 'any' }))}><span className={styles.barberAvatar}><Scissors size={21} strokeWidth={2} /></span><span className={styles.barberInfo}><span className={styles.barberName}>Cualquier barbero disponible</span><span className={styles.barberSpec}>Según el horario que elijas</span></span>{form.barber_id === 'any' && <span className={styles.checkMark}><Check size={14} /></span>}</button>
                {barbers.filter(b => !form.service_id || links.some(l => l.barber_id === b.id && l.service_id === form.service_id)).map(b => (
                  <button key={b.id} aria-pressed={form.barber_id === b.id} className={`${styles.barberCard} ${form.barber_id === b.id ? styles.selected : ''}`} onClick={() => setForm(f => ({ ...f, barber_id: b.id }))}>
                    <div className={styles.barberAvatar}><Scissors size={21} strokeWidth={1.9} /></div>
                    <div className={styles.barberInfo}>
                      <span className={styles.barberName}>{b.name}</span>
                      {b.specialty && <span className={styles.barberSpec}>{b.specialty}</span>}
                    </div>
                    {form.barber_id === b.id && <span className={styles.checkMark}><Check size={14} strokeWidth={2.6} /></span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}><CalendarDays size={22} strokeWidth={1.9} />Selecciona fecha y hora</h2>
            <FormField label="Fecha de la cita" required>
              <Input type="date" value={form.appointment_date} min={today} onChange={set('appointment_date')} />
            </FormField>
            {form.appointment_date && (
              <div className={styles.section}>
                <p className={styles.sectionLabel}>Horarios disponibles</p>
                {loadingSlots ? (
                  <div className={styles.slotsLoading}><div className="spinner" /></div>
                ) : slots.length === 0 ? (
                  <p className={styles.noSlots}>No hay horarios disponibles para este dia.</p>
                ) : (
                  <div className={styles.slotsGrid}>
                    {slots.map(slot => (
                      <button key={slot} className={`${styles.slotBtn} ${form.appointment_time === slot ? styles.selected : ''}`} onClick={() => setForm(f => ({ ...f, appointment_time: slot }))}>
                        {formatTime(slot)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}><UserRound size={22} strokeWidth={1.9} />Datos de contacto</h2>
            <div className={styles.formGrid}>
              <FormField label="Nombre completo" required><Input placeholder="Ej: Juan Perez" value={form.client_name} onChange={set('client_name')} /></FormField>
              <FormField label="Telefono" required><Input type="tel" placeholder="Ej: 8888-1234" value={form.client_phone} onChange={set('client_phone')} /></FormField>
              <FormField label="Correo electrónico (opcional; no se envían correos automáticos)"><Input type="email" placeholder="Ej: juan@email.com" value={form.client_email} onChange={set('client_email')} /></FormField>
              <FormField label="Notas adicionales"><TextArea placeholder="Ej: preferencia de estilo o indicaciones." value={form.notes} onChange={set('notes')} /></FormField>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Confirma tu cita</h2>
            <div className={styles.summary}>
              <div className={styles.summaryRow}><span className={styles.summaryKey}>Barbero</span><span className={styles.summaryVal}>{selectedBarber?.name || 'Cualquier barbero disponible'}</span></div>
              <div className={styles.summaryRow}><span className={styles.summaryKey}>Servicio</span><span className={styles.summaryVal}>{selectedService?.name}</span></div>
              <div className={styles.summaryRow}><span className={styles.summaryKey}>Duracion</span><span className={styles.summaryVal}>{selectedService?.duration} minutos</span></div>
              <div className={styles.summaryRow}><span className={styles.summaryKey}>Precio</span><span className={`${styles.summaryVal} ${styles.gold}`}>{selectedService && formatPrice(selectedService.price)}</span></div>
              <div className={styles.summaryDivider} />
              <div className={styles.summaryRow}><span className={styles.summaryKey}>Fecha</span><span className={styles.summaryVal}>{new Date(form.appointment_date + 'T12:00:00').toLocaleDateString('es-CR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
              <div className={styles.summaryRow}><span className={styles.summaryKey}>Hora</span><span className={styles.summaryVal}>{formatTime(form.appointment_time)}</span></div>
              <div className={styles.summaryDivider} />
              <div className={styles.summaryRow}><span className={styles.summaryKey}>Cliente</span><span className={styles.summaryVal}>{form.client_name}</span></div>
              <div className={styles.summaryRow}><span className={styles.summaryKey}>Telefono</span><span className={styles.summaryVal}>{form.client_phone}</span></div>
              {form.client_email && <div className={styles.summaryRow}><span className={styles.summaryKey}>Correo</span><span className={styles.summaryVal}>{form.client_email}</span></div>}
              {form.notes && <div className={styles.summaryRow}><span className={styles.summaryKey}>Notas</span><span className={styles.summaryVal}>{form.notes}</span></div>}
            </div>
          </div>
        )}

        <div className={styles.actions}>
          {step > 1 && <button className={styles.btnBack} onClick={() => setStep(s => (s - 1) as Step)}>Atras</button>}
          <div style={{ flex: 1 }} />
          {step < 4 ? (
            <button className={styles.btnNext} onClick={() => setStep(s => (s + 1) as Step)} disabled={!canGoNext()}>Continuar</button>
          ) : (
            <button className={styles.btnConfirm} onClick={handleSubmit} disabled={submitting}>{submitting ? 'Agendando...' : 'Confirmar cita'}</button>
          )}
        </div>
      </div>
    </div>
  )
}
