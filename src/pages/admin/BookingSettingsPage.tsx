import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarDays, Check, Circle, Clock3, Pencil, Plus, Scissors, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import toast from '../../services/toast'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'
import type { Barber, Service, User } from '../../types'
import { authApi, barbersApi, servicesApi } from '../../services/api'
import { notifyCatalogChanged } from '../../services/catalogEvents'
import { FormField, Input, Select } from '../../components/shared/FormField'
import styles from './BookingSettingsPage.module.css'

interface Settings {
  shop_name: string; minimum_notice_minutes: number; cancellation_notice_minutes: number
  reschedule_notice_minutes: number; slot_interval_minutes: number; buffer_minutes: number
  horizon_days: number; reminder_minutes: number; barber_can_manage_availability: boolean
}
type Mode = 'barber_schedules' | 'barber_breaks' | 'barber_time_off'
interface Availability { id: string; barber_id: string; weekday?: number; opens_at?: string; closes_at?: string; starts_at?: string; ends_at?: string; reason?: string }
interface Details { assigned: string[]; barber_schedules: Availability[]; barber_breaks: Availability[]; barber_time_off: Availability[] }
const EMPTY_DETAILS: Details = { assigned: [], barber_schedules: [], barber_breaks: [], barber_time_off: [] }
const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MODES: { value: Mode; label: string }[] = [{ value: 'barber_schedules', label: 'Horario semanal' }, { value: 'barber_breaks', label: 'Descansos' }, { value: 'barber_time_off', label: 'Vacaciones y bloqueos' }]
const RULES = [
  ['minimum_notice_minutes', 'Anticipación mínima (min)', 0, 1440], ['cancellation_notice_minutes', 'Plazo de cancelación (min)', 0, 10080],
  ['reschedule_notice_minutes', 'Plazo de reprogramación (min)', 0, 10080], ['slot_interval_minutes', 'Intervalo entre horas (min)', 5, 120],
  ['buffer_minutes', 'Tiempo entre servicios (min)', 0, 120], ['horizon_days', 'Días habilitados para reservar', 1, 365], ['reminder_minutes', 'Recordatorio previo (min)', 5, 1440],
] as const
const localDateTime = (value?: string) => value ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)).replace(' ', 'T') : ''
const prettyDate = (value?: string) => value ? new Date(value).toLocaleString('es-CR', { timeZone: 'America/Costa_Rica', dateStyle: 'medium', timeStyle: 'short' }) : ''

export default function BookingSettingsPage() {
  const { isAdmin, user } = useAuth()
  const [params, setParams] = useSearchParams()
  const requestedBarber = params.get('barbero') || ''
  const [settings, setSettings] = useState<Settings | null>(null)
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [barber, setBarber] = useState(requestedBarber)
  const [details, setDetails] = useState<Details>(EMPTY_DETAILS)
  const [loading, setLoading] = useState(true)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<Mode>('barber_schedules')
  const [editing, setEditing] = useState<string | null>(null)
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [reason, setReason] = useState('')
  const [accountMode, setAccountMode] = useState<'existing' | 'new'>('existing')
  const [account, setAccount] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    let live = true
    Promise.all([supabase.from('booking_settings').select('*').eq('id', true).single(), barbersApi.getAllAdmin(), servicesApi.getAllAdmin(), isAdmin ? authApi.getUsers() : Promise.resolve([])])
      .then(([s, b, v, u]) => {
        if (!live) return
        if (s.error) throw s.error
        setSettings(s.data); setBarbers(b); setServices(v); setUsers(u)
        setBarber(current => isAdmin ? b.find(item => item.id === requestedBarber)?.id || b.find(item => item.id === current)?.id || b[0]?.id || '' : user?.barber_id || '')
      }).catch(() => { if (live) setError('No pudimos cargar la configuración. Usa «Actualizar» para volver a intentar.') })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [isAdmin, user?.barber_id, requestedBarber, refresh])

  useEffect(() => {
    let live = true
    if (!barber) { setLoadingDetails(false); return }
    setLoadingDetails(true)
    Promise.all([
      supabase.from('barber_services').select('service_id').eq('barber_id', barber),
      supabase.from('barber_schedules').select('*').eq('barber_id', barber).order('weekday').order('opens_at'),
      supabase.from('barber_breaks').select('*').eq('barber_id', barber).order('weekday').order('starts_at'),
      supabase.from('barber_time_off').select('*').eq('barber_id', barber).order('starts_at'),
    ]).then(([links, weekly, breaks, blocks]) => {
      if (!live) return
      if (links.error || weekly.error || breaks.error || blocks.error) throw new Error('No pudimos cargar la agenda de este barbero. Usa «Actualizar» para volver a intentar.')
      setDetails({ assigned: (links.data || []).map(row => row.service_id), barber_schedules: weekly.data || [], barber_breaks: breaks.data || [], barber_time_off: blocks.data || [] })
    }).catch(e => { if (live) setError(e.message) }).finally(() => { if (live) setLoadingDetails(false) })
    return () => { live = false }
  }, [barber, refresh])

  useEffect(() => { setDetails(EMPTY_DETAILS) }, [barber])

  const resetDraft = () => { setEditing(null); setSelectedDays([]); setStart(''); setEnd(''); setReason('') }
  useEffect(() => { resetDraft(); setAccount(''); setEmail(''); setPassword(''); setError('') }, [barber, mode])
  const selectedBarber = barbers.find(b => b.id === barber)
  const staff = isAdmin ? users.find(u => u.id === selectedBarber?.user_id) : user
  const staffReady = Boolean(staff?.role === 'Barber' && Number(staff.active) === 1 && (!staff.subscriptionExpirationDate || new Date(staff.subscriptionExpirationDate).getTime() > Date.now()))
  const servicesReady = services.some(s => s.active && details.assigned.includes(s.id))
  const scheduleReady = details.barber_schedules.length > 0
  const ready = Boolean(selectedBarber?.active && staffReady && servicesReady && scheduleReady)
  const allowed = isAdmin || Boolean(settings?.barber_can_manage_availability)
  const rows = details[mode]
  const availableAccounts = users.filter(u => u.role === 'Barber' && !u.barber_id)
  const disabled = busy || loadingDetails

  const run = async (operation: () => Promise<void>) => {
    if (busy || loadingDetails) return
    setBusy(true); setError('')
    try { await operation(); notifyCatalogChanged(); setRefresh(n => n + 1); toast.success('Cambios guardados') }
    catch (e) { setError(e instanceof Error ? e.message : (e as { message?: string })?.message || 'No pudimos guardar los cambios.') }
    finally { setBusy(false) }
  }
  const saveAccount = () => run(async () => {
    if (!barber || selectedBarber?.user_id) throw new Error('Este barbero ya tiene una cuenta vinculada. Puedes gestionarla en Usuarios.')
    if (accountMode === 'new') {
      if (!email.trim() || password.length < 12) throw new Error('Completa el correo y una contraseña de al menos 12 caracteres.')
      await authApi.createUser({ username: email.trim(), password, role: 'Barber', barber_id: barber })
      setEmail(''); setPassword('')
    } else {
      const target = availableAccounts.find(u => u.id === account)
      if (!target) throw new Error('Selecciona una cuenta de barbero sin asignar.')
      await authApi.updateUser(target.id, { active: target.active, barber_id: barber })
    }
  })
  const saveAvailability = () => run(async () => {
    if (!allowed || !barber) throw new Error('No tienes permiso para editar esta agenda.')
    if (!start || !end || start >= end) throw new Error('La hora o fecha de fin debe ser posterior al inicio.')
    if (mode !== 'barber_time_off' && selectedDays.length === 0) throw new Error('Selecciona al menos un día de la semana.')
    if (mode !== 'barber_time_off' && rows.some(row => row.id !== editing && selectedDays.includes(row.weekday!) && start < (row.closes_at || row.ends_at || '').slice(0, 5) && end > (row.opens_at || row.starts_at || '').slice(0, 5))) throw new Error('El intervalo coincide con otra regla de ese día. Edita la regla existente o elige otras horas.')
    const payloads: Record<string, string | number | null>[] = mode === 'barber_time_off' ? [{ barber_id: barber, starts_at: new Date(`${start}:00-06:00`).toISOString(), ends_at: new Date(`${end}:00-06:00`).toISOString(), reason: reason.trim() || null }]
      : selectedDays.map(weekday => ({ barber_id: barber, weekday, ...(mode === 'barber_schedules' ? { opens_at: start, closes_at: end } : { starts_at: start, ends_at: end }) }))
    if (editing) {
      const result = await supabase.from(mode).update(payloads[0]).eq('id', editing).eq('barber_id', barber).select('id').single()
      if (result.error) throw result.error
    } else {
      const result = await supabase.from(mode).insert(payloads).select('id')
      if (result.error) throw result.error
    }
    resetDraft()
  })
  const editRow = (row: Availability) => {
    setEditing(row.id); setSelectedDays(row.weekday === undefined ? [] : [row.weekday]); setReason(row.reason || '')
    setStart(mode === 'barber_time_off' ? localDateTime(row.starts_at) : (row.opens_at || row.starts_at || '').slice(0, 5))
    setEnd(mode === 'barber_time_off' ? localDateTime(row.ends_at) : (row.closes_at || row.ends_at || '').slice(0, 5))
    requestAnimationFrame(() => document.getElementById('availability-editor')?.scrollIntoView({ block: 'center', behavior: 'instant' }))
  }
  const removeRow = (row: Availability) => {
    if (!window.confirm('¿Eliminar esta regla de disponibilidad? Las citas existentes se conservan.')) return
    void run(async () => {
      const result = await supabase.from(mode).delete().eq('id', row.id).eq('barber_id', barber).select('id').single()
      if (result.error) throw result.error
      if (row.id === editing) resetDraft()
    })
  }
  const toggleService = (id: string) => run(async () => {
    const previous = details.assigned
    setDetails(current => ({ ...current, assigned: previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id] }))
    try {
      const query = previous.includes(id) ? supabase.from('barber_services').delete().eq('barber_id', barber).eq('service_id', id) : supabase.from('barber_services').insert({ barber_id: barber, service_id: id })
      const { error } = await query
      if (error) throw error
    } catch (error) {
      setDetails(current => ({ ...current, assigned: previous }))
      throw error
    }
  })
  const saveSettings = () => run(async () => {
    if (!settings) return
    const patch = { shop_name: settings.shop_name.trim(), barber_can_manage_availability: settings.barber_can_manage_availability, ...Object.fromEntries(RULES.map(([key]) => [key, settings[key]])) }
    const result = await supabase.from('booking_settings').update(patch).eq('id', true).select('id').single()
    if (result.error) throw result.error
  })

  return <section className={styles.page}>
    <div className={styles.header}><div><p className={styles.eyebrow}>TENORIO BARBER · ADMINISTRACIÓN</p><h1>{isAdmin ? 'Agenda y disponibilidad' : 'Mi disponibilidad'}</h1><p className={styles.intro}>Configura aquí los servicios, las horas y los descansos. Los clientes verán los espacios disponibles para reservar.</p></div><button className={styles.secondary} disabled={busy} onClick={() => { setError(''); setRefresh(n => n + 1) }}>Actualizar</button></div>
    {error && <div className={styles.error} role="alert">{error}</div>}
    {loading && <p role="status" className={styles.muted}>Cargando configuración…</p>}
    {!loading && barbers.length === 0 && <div className={styles.panel}><h2>Primero agrega un barbero</h2><p>Crea su perfil para asignarle servicios y configurar su agenda.</p><Link className={styles.primary} to="/admin/barberos">Agregar barbero</Link></div>}
    {barbers.length > 0 && <>
      <div className={styles.selector}><FormField label="Barbero"><Select value={barber} disabled={!isAdmin || busy} onChange={e => { setBarber(e.target.value); setParams({ barbero: e.target.value }, { replace: true }) }}>{barbers.map(b => <option key={b.id} value={b.id}>{b.name}{!b.active ? ' (inactivo)' : ''}</option>)}</Select></FormField>{isAdmin && <Link className={styles.textLink} to="/admin/barberos">Gestionar barberos</Link>}</div>
      {loadingDetails ? <p role="status" className={styles.muted}>Cargando agenda…</p> : <div className={`${styles.readiness} ${ready ? styles.ready : ''}`} role="status"><h2>{ready ? 'Configuración completa para recibir reservas' : 'Completa estos pasos para habilitar las reservas'}</h2>{!selectedBarber?.active && <p>Este barbero está inactivo. Actívalo desde Barberos para aceptar citas.</p>}<ol>{[
        { label: 'Cuenta de personal activa', complete: staffReady, href: '#cuenta' }, { label: 'Servicios asignados', complete: servicesReady, href: '#servicios-agenda' }, { label: 'Horario semanal guardado', complete: scheduleReady, href: '#disponibilidad' },
      ].map(item => <li key={item.label}><a href={item.href}>{item.complete ? <Check size={17} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}<span>{item.label}</span><strong>{item.complete ? 'Listo' : 'Pendiente'}</strong></a></li>)}</ol><p>Las horas disponibles también dependen de la fecha, los descansos y las citas ya reservadas.</p></div>}

      <div className={styles.setupGrid}>
        <section className={styles.panel} id="cuenta"><h2><UserRound size={21} aria-hidden="true" />Cuenta de personal</h2>{selectedBarber?.user_id ? <><p className={styles.accountEmail}>{staff?.email || 'Cuenta vinculada'}</p><p>{staffReady ? 'La cuenta está activa y vinculada a este barbero.' : 'La cuenta está inactiva o vencida. Revisa su estado en Usuarios.'}</p>{isAdmin && <Link className={styles.textLink} to="/admin/usuarios">Gestionar esta cuenta</Link>}</> : isAdmin ? <><p>Vincula una cuenta existente o créala aquí. Se usará para entrar al sistema y recibir los avisos de las citas.</p><form onSubmit={e => { e.preventDefault(); void saveAccount() }} className={styles.form}><FormField label="Tipo de cuenta"><Select value={accountMode} disabled={disabled} onChange={e => setAccountMode(e.target.value as 'existing' | 'new')}><option value="existing">Vincular cuenta existente</option><option value="new">Crear cuenta de barbero</option></Select></FormField>{accountMode === 'existing' ? <FormField label="Cuenta de barbero"><Select value={account} required disabled={disabled} onChange={e => setAccount(e.target.value)}><option value="">Seleccionar cuenta</option>{availableAccounts.map(u => <option key={u.id} value={u.id}>{u.email || u.username}{!u.active ? ' (inactiva)' : ''}</option>)}</Select></FormField> : <><FormField label="Correo del barbero" required><Input type="email" required autoComplete="off" value={email} disabled={disabled} onChange={e => setEmail(e.target.value)} /></FormField><FormField label="Contraseña de acceso" required><Input type="password" minLength={12} required autoComplete="new-password" placeholder="Al menos 12 caracteres" value={password} disabled={disabled} onChange={e => setPassword(e.target.value)} /></FormField></>}{accountMode === 'existing' && availableAccounts.length === 0 && <p className={styles.hint}>No hay cuentas de barbero sin asignar. Selecciona «Crear cuenta de barbero».</p>}<button className={styles.primary} disabled={disabled || (accountMode === 'existing' && !account)}>{busy ? 'Guardando…' : accountMode === 'existing' ? 'Vincular cuenta' : 'Crear y vincular cuenta'}</button></form></> : <p>La administración debe vincular tu cuenta a un perfil de barbero.</p>}</section>
        <section className={styles.panel} id="servicios-agenda"><h2><Scissors size={21} aria-hidden="true" />Servicios que ofrece</h2><p>Marca los servicios que pueden reservar con este barbero.</p>{services.length === 0 ? <p>No hay servicios creados todavía.</p> : <fieldset className={styles.serviceList} disabled={!isAdmin || disabled}><legend className={styles.srOnly}>Servicios asignados a este barbero</legend>{services.map(s => <label key={s.id}><input type="checkbox" checked={details.assigned.includes(s.id)} disabled={!s.active && !details.assigned.includes(s.id)} onChange={() => void toggleService(s.id)} /><span><strong>{s.name}{!s.active ? ' · Inactivo' : ''}</strong><small>{s.duration} min · {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(s.price)}</small></span></label>)}</fieldset>}{isAdmin && <Link className={styles.textLink} to="/admin/servicios">Agregar o editar servicios</Link>}</section>
      </div>

      <section className={styles.panel} id="disponibilidad"><div className={styles.sectionHeading}><div><h2><CalendarDays size={21} aria-hidden="true" />Días y horas de trabajo</h2><p>Guarda un horario semanal y añade descansos o bloqueos cuando lo necesites.</p></div><span className={styles.zone}><Clock3 size={14} aria-hidden="true" />Hora de Costa Rica</span></div><FormField label="Disponibilidad"><Select value={mode} disabled={busy} onChange={e => setMode(e.target.value as Mode)}>{MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</Select></FormField>
        <ul className={styles.availabilityList}>{rows.map(row => <li key={row.id}><span><strong>{mode === 'barber_time_off' ? `${prettyDate(row.starts_at)} — ${prettyDate(row.ends_at)}` : `${DAYS[row.weekday!]} · ${(row.opens_at || row.starts_at || '').slice(0, 5)} — ${(row.closes_at || row.ends_at || '').slice(0, 5)}`}</strong>{row.reason && <small>{row.reason}</small>}</span>{allowed && <div className={styles.rowActions}><button className={styles.secondary} disabled={disabled} onClick={() => editRow(row)} aria-label={`Editar ${mode === 'barber_time_off' ? 'bloqueo' : DAYS[row.weekday!]}`}><Pencil size={15} aria-hidden="true" />Editar</button><button className={styles.iconButton} disabled={disabled} onClick={() => removeRow(row)} aria-label={`Eliminar ${mode === 'barber_time_off' ? 'bloqueo' : DAYS[row.weekday!]}`}><Trash2 size={16} aria-hidden="true" /></button></div>}</li>)}</ul>
        {!loadingDetails && rows.length === 0 && <p className={styles.empty}>{mode === 'barber_schedules' ? 'Todavía no hay horario semanal. Agrégalo abajo para que se generen horas disponibles.' : mode === 'barber_breaks' ? 'No hay descansos configurados.' : 'No hay vacaciones ni bloqueos configurados.'}</p>}
        {!allowed ? <p className={styles.hint}>La administración debe habilitar la edición de tu disponibilidad.</p> : <form id="availability-editor" className={styles.editor} onSubmit={e => { e.preventDefault(); void saveAvailability() }}><h3>{editing ? 'Editar regla' : mode === 'barber_schedules' ? 'Agregar horario de trabajo' : mode === 'barber_breaks' ? 'Agregar descanso' : 'Agregar vacaciones o bloqueo'}</h3><fieldset disabled={disabled} className={styles.editorFields}>
          {mode !== 'barber_time_off' && <fieldset className={styles.days}><legend>{editing ? 'Día' : 'Días de la semana'}</legend><div>{[1, 2, 3, 4, 5, 6, 0].map(day => <label key={day} className={selectedDays.includes(day) ? styles.daySelected : ''}><input type={editing ? 'radio' : 'checkbox'} name="availability-days" checked={selectedDays.includes(day)} onChange={() => setSelectedDays(current => editing ? [day] : current.includes(day) ? current.filter(d => d !== day) : [...current, day])} />{DAYS[day]}</label>)}</div>{!editing && <button type="button" className={styles.textButton} onClick={() => setSelectedDays([1, 2, 3, 4, 5])}>Seleccionar lunes a viernes</button>}</fieldset>}
          <div className={styles.timeFields}><FormField label={mode === 'barber_time_off' ? 'Fecha y hora de inicio' : 'Hora de inicio'} required><Input required type={mode === 'barber_time_off' ? 'datetime-local' : 'time'} value={start} onChange={e => setStart(e.target.value)} /></FormField><FormField label={mode === 'barber_time_off' ? 'Fecha y hora de fin' : 'Hora de fin'} required><Input required type={mode === 'barber_time_off' ? 'datetime-local' : 'time'} value={end} onChange={e => setEnd(e.target.value)} /></FormField></div>
          {mode === 'barber_time_off' && <FormField label="Motivo (opcional)"><Input maxLength={500} value={reason} onChange={e => setReason(e.target.value)} placeholder="Ej: vacaciones" /></FormField>}
          <div className={styles.formActions}><button className={styles.primary} disabled={disabled}>{editing ? <Check size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}{busy ? 'Guardando…' : editing ? 'Guardar cambios' : mode === 'barber_schedules' ? 'Guardar horario' : mode === 'barber_breaks' ? 'Guardar descanso' : 'Guardar bloqueo'}</button>{editing && <button type="button" className={styles.secondary} disabled={disabled} onClick={resetDraft}>Cancelar edición</button>}</div>
        </fieldset></form>}
      </section>
    </>}

    {isAdmin && settings && <details className={styles.rules}><summary><ShieldCheck size={18} aria-hidden="true" />Reglas generales de las reservas</summary><form onSubmit={e => { e.preventDefault(); void saveSettings() }} className={styles.form}><div className={styles.rulesGrid}><FormField label="Nombre de la barbería"><Input required value={settings.shop_name} onChange={e => setSettings({ ...settings, shop_name: e.target.value })} /></FormField>{RULES.map(([key, label, min, max]) => <FormField key={key} label={label}><Input type="number" required min={min} max={max} value={settings[key]} onChange={e => setSettings({ ...settings, [key]: Number(e.target.value) })} /></FormField>)}</div><label className={styles.permission}><input type="checkbox" checked={settings.barber_can_manage_availability} onChange={e => setSettings({ ...settings, barber_can_manage_availability: e.target.checked })} />Permitir que los barberos editen sus horarios, descansos y bloqueos</label><p className={styles.hint}>Los cambios no cancelan citas existentes. Los recordatorios automáticos requieren que el envío de avisos esté activado.</p><button className={styles.primary} disabled={disabled}>Guardar reglas</button></form></details>}
  </section>
}
