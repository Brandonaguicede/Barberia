import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import toast from '../../services/toast'
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock3, Scissors, ShieldCheck, UserRound } from 'lucide-react'
import { localDate } from '../../utils/booking'
import { addCalendarDays, calendarDateLabel } from '../../utils/calendar'
import BookingCalendar from '../../components/client/BookingCalendar'
import ServicePicker from '../../components/client/ServicePicker'
import { catalogApi, appointmentsApi, type Catalog } from '../../services/api'
import useCatalogUpdates from '../../hooks/useCatalogUpdates'
import { reconcileCatalog } from '../../utils/catalog'
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

export default function BookingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [step, setStep] = useState<Step>(1)
  const [mobileScheduleStage, setMobileScheduleStage] = useState<'date' | 'time'>('date')
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [slotResult, setSlotResult] = useState<{ key: string; slots: string[]; loading: boolean; error: string }>({ key: '', slots: [], loading: false, error: '' })
  const [slotAttempt, setSlotAttempt] = useState(0)
  const [horizonDays, setHorizonDays] = useState(90)
  const [loadError, setLoadError] = useState('')
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [catalogAttempt, setCatalogAttempt] = useState(0)
  const [refreshingCatalog, setRefreshingCatalog] = useState(false)
  const [catalogSyncError, setCatalogSyncError] = useState('')
  const [catalogNotice, setCatalogNotice] = useState('')
  const [links, setLinks] = useState<{barber_id:string;service_id:string}[]>([])
  const [workingWeekdays, setWorkingWeekdays] = useState<{barber_id:string;weekday:number}[] | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<FormData>({
    barber_id: '', service_id: '', appointment_date: '',
    appointment_time: '', client_name: '', client_phone: '',
    client_email: '', notes: '',
  })
  const catalogRef = useRef<Catalog | null>(null)
  const formRef = useRef(form)
  const stepRef = useRef(step)
  const submittingRef = useRef(submitting)
  const deferredCatalog = useRef(false)
  formRef.current = form; stepRef.current = step; submittingRef.current = submitting
  useCatalogUpdates(() => setCatalogAttempt(n => n + 1), submitting)
  useEffect(() => {
    if (!submitting && deferredCatalog.current) { deferredCatalog.current = false; setCatalogAttempt(n => n + 1) }
  }, [submitting])

  useEffect(() => {
    let live = true
    setLoadingCatalog(!catalogRef.current)
    setRefreshingCatalog(true)
    setLoadError('')
    catalogApi.get()
      .then(c => { if (live) {
        if (submittingRef.current) { deferredCatalog.current = true; return }
        const previous = catalogRef.current
        const changes = reconcileCatalog(previous, c, formRef.current, localDate())
        catalogRef.current = c
        setBarbers(c.barbers); setServices(c.services); setLinks(c.barber_services); setHorizonDays(c.settings.horizon_days); setWorkingWeekdays(c.working_weekdays ?? null)
        setForm(current => ({ ...current, ...reconcileCatalog(previous, c, current, localDate()).selection }))
        setCatalogSyncError('')
        if (previous) setSlotAttempt(n => n + 1)
        if (changes.selectionChanged) { setCatalogNotice('El servicio o barbero elegido cambió. Revisa tu selección para continuar.'); setStep(1) }
        else if (changes.priceChanged) { setCatalogNotice('El precio del servicio se actualizó. Revísalo antes de continuar.'); if (stepRef.current > 1) setStep(1) }
        else if (changes.durationChanged || changes.dateChanged) { setCatalogNotice('La duración o la disponibilidad cambió. Confirma de nuevo la fecha y hora.'); if (stepRef.current > 2) setStep(2) }
      } })
      .catch(() => { if (live) {
        if (catalogRef.current) setCatalogSyncError('No pudimos actualizar los servicios. Vuelve a intentar antes de confirmar.')
        else setLoadError('No pudimos cargar la agenda. Comprueba tu conexión e inténtalo de nuevo.')
      } })
      .finally(() => { if (live) { setLoadingCatalog(false); setRefreshingCatalog(false) } })
    return () => { live = false }
  }, [catalogAttempt])

  useEffect(() => {
    if (!catalogSyncError && !loadError) return
    const timer = setTimeout(() => { if (document.visibilityState !== 'hidden' && navigator.onLine && !submittingRef.current) setCatalogAttempt(n => n + 1) }, 60000)
    return () => clearTimeout(timer)
  }, [catalogSyncError, loadError, catalogAttempt])

  useEffect(() => {
    if (location.hash === '#servicios' || location.hash === '#barberos') {
      setStep(1)
      const frame = requestAnimationFrame(() => document.querySelector(location.hash)?.scrollIntoView({ behavior: 'instant', block: 'center' }))
      return () => cancelAnimationFrame(frame)
    }
  }, [location.hash])

  useEffect(() => {
    let live = true
    const key = `${form.barber_id}|${form.service_id}|${form.appointment_date}|${slotAttempt}`
    if (form.barber_id && form.appointment_date && form.service_id) {
      setSlotResult({ key, slots: [], loading: true, error: '' })
      appointmentsApi.getAvailableSlots({
        barber_id: form.barber_id,
        date: form.appointment_date,
        service_id: form.service_id,
      })
        .then(slots => { if (live) {
          setSlotResult({ key, slots, loading: false, error: '' })
          const current = formRef.current
          if (current.barber_id === form.barber_id && current.service_id === form.service_id && current.appointment_date === form.appointment_date && current.appointment_time && !slots.includes(current.appointment_time)) {
            setForm(f => ({ ...f, appointment_time: '' }))
            setCatalogNotice('La hora elegida ya no está disponible. Selecciona otra hora; tus datos se conservan.')
            setStep(s => s > 2 ? 2 : s)
          }
        } })
        .catch(() => { if (live) { setSlotResult({ key, slots: [], loading: false, error: 'No pudimos consultar las horas. Comprueba tu conexión y vuelve a intentar.' }); setStep(s => s > 2 ? 2 : s) } })
    }
    return () => { live = false }
  }, [form.barber_id, form.appointment_date, form.service_id, slotAttempt])

  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const selectedBarber = barbers.find(b => b.id === form.barber_id)
  const selectedService = services.find(s => s.id === form.service_id)

  const eligibleServices = services.filter(s => links.some(l => l.service_id === s.id && barbers.some(b => b.id === l.barber_id)))
  const eligibleBarbers = barbers.filter(b => links.some(l => l.barber_id === b.id && (!form.service_id || l.service_id === form.service_id)))
  const relevantBarbers = form.barber_id ? eligibleBarbers.filter(b => b.id === form.barber_id) : eligibleBarbers
  const barberWorkdays = workingWeekdays === null ? null : Array.from(new Set(workingWeekdays.filter(row => relevantBarbers.some(b => b.id === row.barber_id)).map(row => Number(row.weekday))))
  const workdaysKey = barberWorkdays === null ? 'unknown' : barberWorkdays.join(',')
  useEffect(() => {
    if (!form.appointment_date || barberWorkdays === null) return
    const weekday = new Date(`${form.appointment_date}T12:00:00Z`).getUTCDay()
    if (!barberWorkdays.includes(weekday)) setForm(current => ({ ...current, appointment_date: '', appointment_time: '' }))
  }, [workdaysKey, form.appointment_date])
  const selectService = (id: string) => setForm(current => {
    const matching = barbers.filter(b => links.some(l => l.barber_id === b.id && l.service_id === id))
    return { ...current, service_id: id, barber_id: matching.some(b => b.id === current.barber_id) ? current.barber_id : matching.length === 1 ? matching[0].id : '', appointment_time: '' }
  })

  const today = localDate()
  const maxDate = addCalendarDays(today, horizonDays)
  const slotKey = `${form.barber_id}|${form.service_id}|${form.appointment_date}|${slotAttempt}`
  const slots = slotResult.key === slotKey ? slotResult.slots : []
  const loadingSlots = Boolean(form.appointment_date && (slotResult.key !== slotKey || slotResult.loading))
  const slotsError = slotResult.key === slotKey ? slotResult.error : ''
  const morningSlots = slots.filter(time => Number(time.split(':')[0]) < 12)
  const afternoonSlots = slots.filter(time => Number(time.split(':')[0]) >= 12)
  const selectDate = (date: string) => {
    setForm(current => ({ ...current, appointment_date: date, appointment_time: '' }))
    setMobileScheduleStage('time')
  }

  useEffect(() => {
    if (step !== 2) return
    const frame = requestAnimationFrame(() => {
      document.getElementById('mobile-schedule-stage')?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [mobileScheduleStage, step])

  const formatTime = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    const suffix = h >= 12 ? 'pm' : 'am'
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
    return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`
  }

  const formatPrice = (p: number) =>
    new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(p)

  const validSelection = !!selectedService && !!selectedBarber && eligibleBarbers.some(b => b.id === form.barber_id)
  const validTime = !!form.appointment_date && form.appointment_date >= today && form.appointment_date <= maxDate && !loadingSlots && !slotsError && slots.includes(form.appointment_time)
  const validEmail = form.client_email.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.client_email.trim())
  const validContact = form.client_name.trim().length > 0 && /^\+?[0-9 ()-]{8,25}$/.test(form.client_phone) && form.client_phone.replace(/\D/g, '').length >= 8 && validEmail
  const canGoNext = () => {
    if (step === 1) return validSelection
    if (step === 2) return validTime
    if (step === 3) return validContact && validTime
    return false
  }

  const handleSubmit = async () => {
    if (submitting || refreshingCatalog || catalogSyncError) return
    if (!validSelection || !validTime || !validContact) { setStep(!validSelection ? 1 : !validTime ? 2 : 3); return }
    setSubmitting(true)
    try {
      const appt = await appointmentsApi.create({ ...form, client_email: form.client_email.trim() })
      toast.success('Cita confirmada')
      navigate(`/mi-cita/${appt.access_token}`, { replace: true, state: { justBooked: true } })
    } catch (err: any) {
      toast.error(err.message || 'Error al agendar la cita')
    } finally {
      setSubmitting(false)
    }
  }

  const steps = ['Servicio', 'Horario', 'Datos', 'Confirmar']
  const stepIcons = [Scissors, CalendarDays, UserRound, Check]
  const stepDescriptions = ['Seleccioná el servicio que deseás y el profesional.', 'Encuentra un espacio que se ajuste a tu agenda.', 'Indica un correo válido para recibir el aviso de tu cita.', 'Revisa los detalles. Ya casi está todo listo.']
  const changeStep = (next: Step) => {
    if (next === 2) {
      const isMobile = window.matchMedia('(max-width: 760px)').matches
      if (!isMobile && (!form.appointment_date || form.appointment_date < today || form.appointment_date > maxDate)) {
        setForm(current => ({ ...current, appointment_date: today, appointment_time: '' }))
      }
      setMobileScheduleStage(form.appointment_time ? 'time' : 'date')
    }
    setStep(next)
    requestAnimationFrame(() => {
      document.getElementById('booking-step-title')?.focus({ preventScroll: true })
      document.getElementById('reservar')?.scrollIntoView({ block: 'start', behavior: 'instant' })
    })
  }

  return (
    <div className={`${styles.page} ${step > 1 ? styles.inProgress : ''} ${step === 2 ? styles.schedulePage : ''}`}>
      <section className={styles.hero} aria-labelledby="booking-title">
        <h1 id="booking-title" className={styles.heroTitle}>Elegí tu <span>Estilo.</span></h1>
        <p className={styles.heroSub}>Reservá tu próximo corte con nosotros.</p>
        <div className={styles.benefits} aria-label="Cómo reservar">
          <div><span className={styles.benefitIcon}><CalendarDays aria-hidden="true" /></span><p>Rápido<br />y sencillo</p></div>
          <div><span className={styles.benefitIcon}><Scissors aria-hidden="true" /></span><p>Tu barbero,<br />tu estilo</p></div>
          <div><span className={styles.benefitIcon}><ShieldCheck aria-hidden="true" /></span><p>Tu cita<br />confirmada</p></div>
        </div>
        <p className={styles.heroNote}>Un buen corte comienza con un espacio para ti.</p>
      </section>

      <section id="reservar" className={styles.bookingPanel} aria-label="Reservá tu cita">
      <ol className={styles.stepper} aria-label="Pasos de la reserva">
        {steps.map((label, i) => {
          const n = (i + 1) as Step
          const active = step === n
          const done = step > n
          const Icon = stepIcons[i]
          return (
            <li key={n} aria-current={active ? 'step' : undefined} className={`${styles.stepItem} ${active ? styles.stepActive : ''} ${done ? styles.stepDone : ''}`}>
              {done ? <button type="button" className={styles.stepCircle} aria-label={`Volver a ${label}`} disabled={submitting} onClick={() => changeStep(n)}><Check size={23} aria-hidden="true" /></button> : <span className={styles.stepCircle}><Icon size={23} aria-hidden="true" /></span>}
              <span className={styles.stepLabel}>{label}</span>
            </li>
          )
        })}
      </ol>
      {catalogNotice && <div className={styles.catalogNotice} role="status"><p>{catalogNotice}</p><button type="button" aria-label="Cerrar actualización del catálogo" onClick={() => setCatalogNotice('')}>Entendido</button></div>}
      {catalogSyncError && <div className={styles.catalogNotice} role="alert"><p>{catalogSyncError}</p><button type="button" onClick={() => setCatalogAttempt(n => n + 1)} disabled={refreshingCatalog}>Actualizar servicios</button></div>}

      <div className={styles.card}>
        <h2 className={styles.stepTitle} id="booking-step-title" tabIndex={-1}>{step}. {['Elegí el servicio y barbero', 'Selecciona fecha y hora', 'Datos de contacto', 'Confirma tu cita'][step - 1]}</h2>
        <p className={styles.stepDescription}>{stepDescriptions[step - 1]}</p>
        {step === 1 && (
          <div className={styles.stepContent}>
            {loadError && <div className={styles.emptyState} role="alert"><p>{loadError}</p><button className={styles.retryBtn} onClick={() => setCatalogAttempt(n => n + 1)}>Volver a intentar <ArrowRight size={16} aria-hidden="true" /></button></div>}
            {loadingCatalog && <div className={styles.skeletons} role="status" aria-label="Cargando servicios y barberos"><span /><span /><span /></div>}
            {!loadingCatalog && !loadError && eligibleServices.length === 0 && <div className={styles.emptyState}><Scissors size={30} strokeWidth={1.5} aria-hidden="true" /><h3>Estamos preparando nuestra agenda</h3><p>Los servicios y horarios estarán disponibles pronto. Vuelve a visitarnos para reservar.</p></div>}
            {!loadingCatalog && !loadError && eligibleServices.length > 0 && <>
            <div className={styles.section} id="servicios">
              <label className={styles.sectionLabel} htmlFor="booking-service"><Scissors size={21} aria-hidden="true" />Servicio</label>
              <ServicePicker id="booking-service" value={form.service_id} services={eligibleServices} onChange={selectService} />
            </div>
            <div className={styles.section} id="barberos" role="group" aria-labelledby="barber-label">
              <p className={styles.sectionLabel} id="barber-label"><UserRound size={21} aria-hidden="true" />Barbero</p>
              <div className={styles.barberGrid}>
                {eligibleBarbers.map(b => (
                  <button key={b.id} aria-pressed={form.barber_id === b.id} className={`${styles.barberCard} ${form.barber_id === b.id ? styles.selected : ''}`} onClick={() => setForm(f => ({ ...f, barber_id: b.id, appointment_time: '' }))}>
                    <div className={styles.barberAvatar} aria-hidden="true">{b.name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toLocaleUpperCase('es')}</div>
                    <div className={styles.barberInfo}>
                      <span className={styles.barberName}>{b.name}</span>
                      <span className={styles.barberSpec}>{b.specialty || (form.barber_id === b.id ? 'Tu barbero para esta cita' : 'Reservar con este barbero')}</span>
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
            <div className={styles.bookingContext}><span className={styles.contextIcon}><Scissors size={20} aria-hidden="true" /></span><div><strong>{selectedService?.name}</strong><span>Con {selectedBarber?.name.trim()} · {selectedService?.duration} min</span></div><button type="button" onClick={() => changeStep(1)}>Cambiar</button></div>
            <div className={styles.mobileStageHeader} id="mobile-schedule-stage" aria-live="polite">
              <span className={styles.mobileStageCount}>{mobileScheduleStage === 'date' ? '1' : '2'}<small>/2</small></span>
              <div>
                <strong>{mobileScheduleStage === 'date' ? 'Elige un día' : 'Elige una hora'}</strong>
                <span>{mobileScheduleStage === 'date' ? 'Selecciona una fecha disponible.' : calendarDateLabel(form.appointment_date)}</span>
              </div>
              {mobileScheduleStage === 'time' && <button type="button" onClick={() => setMobileScheduleStage('date')}>Cambiar fecha</button>}
            </div>
            <div className={`${styles.dateTimeLayout} ${mobileScheduleStage === 'date' ? styles.mobileDateStage : styles.mobileTimeStage}`}>
              <div className={styles.calendarColumn}>
                <div className={styles.calendarShell}>
                  <BookingCalendar value={form.appointment_date} minDate={today} maxDate={maxDate} workingWeekdays={barberWorkdays} onChange={selectDate} />
                </div>
              </div>
              {form.appointment_date && (
                <div className={`${styles.section} ${styles.timesSection}`}>
                  <div className={styles.timesHeading}><p className={styles.sectionLabel}><Clock3 size={20} aria-hidden="true" />Elige tu hora</p>{!loadingSlots && !slotsError && slots.length > 0 && <span>{slots.length} {slots.length === 1 ? 'hora disponible' : 'horas disponibles'}</span>}</div>
                  {loadingSlots ? (
                    <div className={styles.skeletons} role="status" aria-label="Cargando horarios"><span /><span /></div>
                  ) : slotsError ? (
                    <div className={styles.slotMessage} role="alert"><p>{slotsError}</p><button className={styles.retryBtn} onClick={() => setSlotAttempt(n => n + 1)}>Volver a intentar <ArrowRight size={16} aria-hidden="true" /></button></div>
                  ) : slots.length === 0 ? (
                    <div className={styles.slotMessage}><p>No quedan horas para este día.</p><span>Elige otra fecha y encontraremos un espacio para ti.</span>{form.appointment_date < maxDate && <button className={styles.retryBtn} onClick={() => selectDate(addCalendarDays(form.appointment_date, 1))}>Ver el siguiente día <ArrowRight size={16} aria-hidden="true" /></button>}</div>
                  ) : (
                    <div className={styles.timeGroups}>
                      {[{ label: 'Por la mañana', entries: morningSlots }, { label: 'Por la tarde', entries: afternoonSlots }].filter(group => group.entries.length > 0).map(group => <div key={group.label}><p className={styles.timeGroupLabel}>{group.label}</p><div className={styles.slotsGrid}>{group.entries.map(slot => (
                        <button key={slot} aria-pressed={form.appointment_time === slot} className={`${styles.slotBtn} ${form.appointment_time === slot ? styles.selected : ''}`} onClick={() => setForm(f => ({ ...f, appointment_time: slot }))}>
                          {formatTime(slot)}{form.appointment_time === slot && <Check size={14} aria-hidden="true" />}
                        </button>
                      ))}</div></div>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {step === 3 && (
          <div className={styles.stepContent}>
            <div className={styles.formGrid}>
              <FormField label="Nombre completo" required><Input autoComplete="name" placeholder="Tu nombre y apellido" value={form.client_name} onChange={set('client_name')} /></FormField>
              <FormField label="Telefono" required><Input type="tel" autoComplete="tel" inputMode="tel" placeholder="Ej: 8888-1234" value={form.client_phone} onChange={set('client_phone')} /></FormField>
              <FormField label="Correo electrónico" required error={form.client_email.trim().length > 0 && !validEmail ? "Ingresa un correo válido." : undefined}>
                <Input type="email" required autoComplete="email" placeholder="tu@correo.com" value={form.client_email} onChange={set('client_email')} />
              </FormField>
              <p className={styles.emailHint}>Te enviaremos el aviso de la cita a este correo. Revisa Spam o Promociones si no aparece en Recibidos.</p>
              <details className={styles.optionalFields}><summary>Añadir una nota (opcional)</summary><div>
                <FormField label="Notas adicionales"><TextArea placeholder="Ej: preferencia de estilo o indicaciones." value={form.notes} onChange={set('notes')} /></FormField>
              </div></details>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className={styles.stepContent}>
            <div className={styles.summary}>
              <div className={styles.summaryRow}><span className={styles.summaryKey}>Barbero</span><span className={styles.summaryVal}>{selectedBarber?.name}</span></div>
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
            <button className={styles.btnConfirm} onClick={handleSubmit} disabled={submitting || refreshingCatalog || !!catalogSyncError || !validSelection || !validTime || !validContact}>{submitting ? 'Agendando...' : refreshingCatalog ? 'Actualizando servicios…' : <>Confirmar cita <Check size={22} aria-hidden="true" /></>}</button>
          )}
        </div>
        <p className={styles.panelNote}><ShieldCheck size={13} aria-hidden="true" />Tus datos se usan para gestionar tu cita.</p>
      </section>
    </div>
  )
}
