import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import toast from '../../services/toast'
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, Clock3, Scissors, ShieldCheck, UserRound, UsersRound } from 'lucide-react'
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
  const location = useLocation()
  const [step, setStep] = useState<Step>(1)
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [slots, setSlots] = useState<string[]>([])
  const [loadError, setLoadError] = useState('')
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [catalogAttempt, setCatalogAttempt] = useState(0)
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
    setLoadingCatalog(true)
    setLoadError('')
    catalogApi.get()
      .then(c => { if (live) { setBarbers(c.barbers); setServices(c.services); setLinks(c.barber_services) } })
      .catch(() => { if (live) setLoadError('No pudimos cargar la agenda. Comprueba tu conexión e inténtalo de nuevo.') })
      .finally(() => { if (live) setLoadingCatalog(false) })
    return () => { live = false }
  }, [catalogAttempt])

  useEffect(() => {
    if (location.hash === '#servicios' || location.hash === '#barberos') {
      setStep(1)
      const frame = requestAnimationFrame(() => document.querySelector(location.hash)?.scrollIntoView({ behavior: 'instant', block: 'center' }))
      return () => cancelAnimationFrame(frame)
    }
  }, [location.hash])

  useEffect(() => {
    let live = true
    setSlots([])
    setLoadingSlots(false)
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
    if (step === 1) return !!selectedService && eligibleServices.some(s => s.id === form.service_id) && barbers.some(b => links.some(l => l.barber_id === b.id && l.service_id === form.service_id) && (form.barber_id === 'any' || b.id === form.barber_id))
    if (step === 2) return !!form.appointment_date && !!form.appointment_time
    if (step === 3) return form.client_name.trim().length > 0 && /^\+?[0-9 ()-]{8,25}$/.test(form.client_phone)
    return false
  }

  const handleSubmit = async () => {
    if (submitting) return
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
  const stepIcons = [Scissors, CalendarDays, UserRound, Check]
  const stepDescriptions = ['Selecciona el servicio que deseas y el profesional.', 'Encuentra un espacio que se ajuste a tu agenda.', 'Completa tus datos para identificar tu reserva.', 'Revisa los detalles. Ya casi está todo listo.']
  const changeStep = (next: Step) => {
    setStep(next)
    requestAnimationFrame(() => document.getElementById('booking-step-title')?.focus({ preventScroll: true }))
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="booking-title">
        <p className={styles.eyebrow}><span /> TU ESTILO EMPIEZA AQUÍ</p>
        <h1 id="booking-title" className={styles.heroTitle}>Reserva tu <span>cita.</span></h1>
        <p className={styles.heroSub}>Selecciona el servicio, barbero, fecha y horario que mejor se ajuste a tu agenda.</p>
        <div className={styles.benefits} aria-label="Cómo reservar">
          <div><span className={styles.benefitIcon}><CalendarDays aria-hidden="true" /></span><p>Rápido<br />y sencillo</p></div>
          <div><span className={styles.benefitIcon}><Scissors aria-hidden="true" /></span><p>Tu barbero,<br />tu estilo</p></div>
          <div><span className={styles.benefitIcon}><ShieldCheck aria-hidden="true" /></span><p>Tu cita<br />confirmada</p></div>
        </div>
        <p className={styles.heroNote}>Un buen corte comienza con un espacio para ti.</p>
      </section>

      <section id="reservar" className={styles.bookingPanel} aria-label="Reserva tu cita">
      <ol className={styles.stepper} aria-label="Pasos de la reserva">
        {steps.map((label, i) => {
          const n = (i + 1) as Step
          const active = step === n
          const done = step > n
          const Icon = stepIcons[i]
          return (
            <li key={n} aria-current={active ? 'step' : undefined} className={`${styles.stepItem} ${active ? styles.stepActive : ''} ${done ? styles.stepDone : ''}`}>
              <div className={styles.stepCircle}>{done ? <Check size={23} aria-hidden="true" /> : <Icon size={23} aria-hidden="true" />}</div>
              <span className={styles.stepLabel}>{label}</span>
            </li>
          )
        })}
      </ol>

      <div className={styles.card}>
        <h2 className={styles.stepTitle} id="booking-step-title" tabIndex={-1}>{step}. {['Elige servicio y barbero', 'Selecciona fecha y hora', 'Datos de contacto', 'Confirma tu cita'][step - 1]}</h2>
        <p className={styles.stepDescription}>{stepDescriptions[step - 1]}</p>
        {step === 1 && (
          <div className={styles.stepContent}>
            {loadError && <div className={styles.emptyState} role="alert"><p>{loadError}</p><button className={styles.retryBtn} onClick={() => setCatalogAttempt(n => n + 1)}>Volver a intentar <ArrowRight size={16} aria-hidden="true" /></button></div>}
            {loadingCatalog && <div className={styles.skeletons} role="status" aria-label="Cargando servicios y barberos"><span /><span /><span /></div>}
            {!loadingCatalog && !loadError && eligibleServices.length === 0 && <div className={styles.emptyState}><Scissors size={30} strokeWidth={1.5} aria-hidden="true" /><h3>Estamos preparando nuestra agenda</h3><p>Los servicios y horarios estarán disponibles pronto. Vuelve a visitarnos para reservar.</p></div>}
            {!loadingCatalog && !loadError && eligibleServices.length > 0 && <>
            <div className={styles.section} id="servicios">
              <label className={styles.sectionLabel} htmlFor="booking-service"><Scissors size={21} aria-hidden="true" />Servicio</label>
              <div className={styles.serviceSelect}>
                <Scissors size={25} aria-hidden="true" />
                <div className={styles.serviceInfo} aria-hidden="true"><span className={styles.serviceName}>{selectedService?.name || 'Selecciona tu servicio'}</span><span className={styles.serviceDesc}>{selectedService ? `${selectedService.duration} min  ·  ${formatPrice(selectedService.price)}` : 'Elige el corte o tratamiento para tu visita'}</span></div>
                <ChevronDown size={20} aria-hidden="true" />
                <select id="booking-service" value={form.service_id} onChange={e => setForm(f => ({ ...f, service_id: e.target.value }))} required>
                  <option value="" disabled>Selecciona tu servicio</option>
                  {Object.entries(servicesByCategory).map(([cat, svcs]) => <optgroup key={cat} label={CATEGORY_LABELS[cat] || cat}>{svcs.map(s => <option key={s.id} value={s.id}>{s.name} · {s.duration} min · {formatPrice(s.price)}</option>)}</optgroup>)}
                </select>
              </div>
            </div>
            <div className={styles.section} id="barberos" role="group" aria-labelledby="barber-label">
              <p className={styles.sectionLabel} id="barber-label"><UserRound size={21} aria-hidden="true" />Barbero</p>
              <div className={styles.barberGrid}>
                <button aria-pressed={form.barber_id === 'any'} className={`${styles.barberCard} ${form.barber_id === 'any' ? styles.selected : ''}`} onClick={() => setForm(f => ({ ...f, barber_id: 'any' }))}><span className={styles.barberAvatar}><UsersRound size={25} strokeWidth={1.6} aria-hidden="true" /></span><span className={styles.barberInfo}><span className={styles.barberName}>Cualquiera disponible</span><span className={styles.barberSpec}>Según el horario que elijas</span></span><span className={styles.checkMark} aria-hidden="true">{form.barber_id === 'any' && <Check size={17} />}</span></button>
                {barbers.filter(b => !form.service_id || links.some(l => l.barber_id === b.id && l.service_id === form.service_id)).map(b => (
                  <button key={b.id} aria-pressed={form.barber_id === b.id} className={`${styles.barberCard} ${form.barber_id === b.id ? styles.selected : ''}`} onClick={() => setForm(f => ({ ...f, barber_id: b.id }))}>
                    <div className={styles.barberAvatar} aria-hidden="true">{b.name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toLocaleUpperCase('es')}</div>
                    <div className={styles.barberInfo}>
                      <span className={styles.barberName}>{b.name}</span>
                      <span className={styles.barberSpec}>{b.specialty || 'Elige tu profesional'}</span>
                    </div>
                    <span className={styles.checkMark} aria-hidden="true">{form.barber_id === b.id && <Check size={17} />}</span>
                  </button>
                ))}
              </div>
            </div>
            </>}
          </div>
        )}

        {step === 2 && (
          <div className={styles.stepContent}>
            <FormField label="Fecha de la cita" required>
              <Input type="date" value={form.appointment_date} min={today} onChange={set('appointment_date')} />
            </FormField>
            {form.appointment_date && (
              <div className={styles.section}>
                <p className={styles.sectionLabel}><Clock3 size={20} aria-hidden="true" />Horarios disponibles</p>
                {loadingSlots ? (
                  <div className={styles.skeletons} role="status" aria-label="Cargando horarios"><span /><span /></div>
                ) : slots.length === 0 ? (
                  <p className={styles.noSlots}>No hay horarios disponibles para este dia.</p>
                ) : (
                  <div className={styles.slotsGrid}>
                    {slots.map(slot => (
                      <button key={slot} aria-pressed={form.appointment_time === slot} className={`${styles.slotBtn} ${form.appointment_time === slot ? styles.selected : ''}`} onClick={() => setForm(f => ({ ...f, appointment_time: slot }))}>
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
            <div className={styles.formGrid}>
              <FormField label="Nombre completo" required><Input placeholder="Ej: Juan Perez" value={form.client_name} onChange={set('client_name')} /></FormField>
              <FormField label="Telefono" required><Input type="tel" placeholder="Ej: 8888-1234" value={form.client_phone} onChange={set('client_phone')} /></FormField>
              <FormField label="Correo electrónico (opcional)"><Input type="email" autoComplete="email" placeholder="tu@correo.com" value={form.client_email} onChange={set('client_email')} /></FormField>
              <FormField label="Notas adicionales"><TextArea placeholder="Ej: preferencia de estilo o indicaciones." value={form.notes} onChange={set('notes')} /></FormField>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className={styles.stepContent}>
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

      </div>
        <div className={styles.actions}>
          {step > 1 && <button className={styles.btnBack} onClick={() => changeStep((step - 1) as Step)} disabled={submitting}><ArrowLeft size={18} aria-hidden="true" />Atrás</button>}
          {step < 4 ? (
            <button className={styles.btnNext} onClick={() => changeStep((step + 1) as Step)} disabled={!canGoNext()}>Continuar <ArrowRight size={23} aria-hidden="true" /></button>
          ) : (
            <button className={styles.btnConfirm} onClick={handleSubmit} disabled={submitting}>{submitting ? 'Agendando...' : <>Confirmar cita <Check size={22} aria-hidden="true" /></>}</button>
          )}
        </div>
        <p className={styles.panelNote}><ShieldCheck size={13} aria-hidden="true" />Tus datos se usan para gestionar tu cita.</p>
      </section>
    </div>
  )
}
