import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarCheck, CalendarDays, Clock3, DollarSign, Scissors, Settings, UsersRound } from 'lucide-react'
import { appointmentsApi } from '../../services/api'
import { localDate } from '../../utils/booking'
import { useAuth } from '../../context/AuthContext'
import type { Appointment, AppStats } from '../../types'
import StatusBadge from '../../components/shared/StatusBadge'
import styles from './AdminDashboard.module.css'

export default function AdminDashboard() {
  const { user, isAdmin } = useAuth()
  const [stats, setStats] = useState<AppStats | null>(null)
  const [todayAppts, setTodayAppts] = useState<Appointment[]>([])
  const [completedAppts, setCompletedAppts] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let live = true
    let pending = false
    setStats(null)
    setTodayAppts([])
    setCompletedAppts([])
    setLoadError('')
    setLoading(true)
    if (!user || (user.role === 'Barber' && !user.barber_id)) {
      setLoading(false)
      setLoadError('Tu cuenta necesita un perfil de barbero vinculado. La administración puede revisarlo en Agenda y horarios, Cuenta de personal.')
      return
    }
    const refresh = async () => {
      if (pending || document.visibilityState === 'hidden') return
      pending = true
      const today = localDate()
      const [year, month] = today.slice(0, 7).split('-').map(Number)
      const apptParams: Record<string, string> = { date: today }
      const completedParams: Record<string, string> = {
        status: 'completed', from: today.slice(0, 7) + '-01',
        before: new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10),
      }
      if (user.role === 'Barber' && user.barber_id) {
        apptParams.barber_id = user.barber_id
        completedParams.barber_id = user.barber_id
      }
      try {
        const [s, a, completed] = await Promise.all([
          user.role === 'Admin' ? appointmentsApi.getStats() : Promise.resolve(null),
          appointmentsApi.getAll(apptParams),
          appointmentsApi.getAll(completedParams),
        ])
        if (!live) return
        setStats(s)
        setTodayAppts(a)
        setCompletedAppts(completed.sort((left, right) => (right.starts_at || '').localeCompare(left.starts_at || '')))
        setLoadError('')
      } catch {
        if (live) setLoadError('No se pudo actualizar el resumen. Revisa tu conexión; volveremos a intentarlo automáticamente.')
      } finally {
        pending = false
        if (live) setLoading(false)
      }
    }
    void refresh()
    const onRefresh = () => { void refresh() }
    const timer = window.setInterval(onRefresh, 15000)
    window.addEventListener('focus', onRefresh)
    window.addEventListener('online', onRefresh)
    document.addEventListener('visibilitychange', onRefresh)
    return () => {
      live = false
      window.clearInterval(timer)
      window.removeEventListener('focus', onRefresh)
      window.removeEventListener('online', onRefresh)
      document.removeEventListener('visibilitychange', onRefresh)
    }
  }, [user?.id, user?.role, user?.barber_id])

  const formatPrice = (p: number) =>
    new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(p)
  const monthStart = `${localDate().slice(0, 7)}-01`
  const currentMonthLabel = new Intl.DateTimeFormat('es-CR', { timeZone: 'America/Costa_Rica', month: 'long', year: 'numeric' }).format(new Date(`${monthStart}T12:00:00-06:00`))
  const completedRevenue = completedAppts.reduce((total, appointment) => total + Number(appointment.service_price || 0), 0)
  const dailyRevenue = Object.entries(completedAppts.reduce<Record<string, { total: number; count: number }>>((days, appointment) => {
    const day = days[appointment.appointment_date] ||= { total: 0, count: 0 }
    day.total += Number(appointment.service_price || 0)
    day.count += 1
    return days
  }, {})).sort(([left], [right]) => right.localeCompare(left))
  const todayRevenue = dailyRevenue.find(([date]) => date === localDate())?.[1].total ?? 0
  const formatDate = (value: string) => new Date(`${value}T12:00:00-06:00`).toLocaleDateString('es-CR', { timeZone: 'America/Costa_Rica', day: '2-digit', month: 'short' })

  const formatTime = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    const suffix = h >= 12 ? 'pm' : 'am'
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
    return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`
  }

  if (!loading && user?.role === 'Barber' && !user.barber_id) return <div className={styles.page}><h1 className={styles.title}>Mis ingresos</h1><p role="alert" className={styles.earningsEmpty}>{loadError}</p></div>

  if (loading) return <div className={styles.loader}><div className="spinner" /></div>

  const metricCards = isAdmin ? [
    { icon: CalendarCheck, value: stats?.today ?? 0, label: 'Citas hoy' },
    { icon: Clock3, value: stats?.pending ?? 0, label: 'Pendientes' },
    { icon: CalendarDays, value: stats?.upcoming ?? 0, label: 'Proximas' },
    { icon: DollarSign, value: formatPrice(stats?.monthlyRevenue ?? 0), label: 'Ingresos del mes', gold: true },
  ] : [
    { icon: CalendarCheck, value: todayAppts.filter(a => a.status !== 'cancelled').length, label: 'Mis citas hoy' },
    { icon: Clock3, value: todayAppts.filter(a => a.status === 'pending').length, label: 'Pendientes hoy' },
    { icon: DollarSign, value: formatPrice(todayRevenue), label: 'Mis ingresos hoy', gold: true },
    { icon: DollarSign, value: formatPrice(completedRevenue), label: 'Mis ingresos del mes', gold: true },
  ]

  const quickLinks = [
    { to: '/admin/citas', icon: CalendarDays, label: 'Gestionar citas' },
    { to: '/admin/barberos', icon: Scissors, label: 'Gestionar barberos' },
    { to: '/admin/servicios', icon: Settings, label: 'Gestionar servicios' },
    { to: '/admin/usuarios', icon: UsersRound, label: 'Gestionar usuarios' },
  ].filter(link => isAdmin || link.to === '/admin/citas')

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.sub}>{new Date().toLocaleDateString('es-CR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <Link to="/admin/citas" className={styles.btnNew}>
          <CalendarDays size={17} strokeWidth={2.2} />
          Nueva cita
        </Link>
      </div>

      {loadError && <p role="alert" className={styles.earningsEmpty}>{loadError}</p>}

      <div className={styles.statsGrid}>
        {metricCards.map(card => {
          const Icon = card.icon
          return (
            <div key={card.label} className={`${styles.statCard} ${card.gold ? styles.goldCard : ''}`}>
              <span className={styles.statIcon}><Icon size={22} strokeWidth={2} /></span>
              <div>
                <p className={`${styles.statValue} ${card.gold ? styles.gold : ''}`}>{card.value}</p>
                <p className={styles.statLabel}>{card.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      <section className={styles.earnings} aria-labelledby="daily-earnings-title">
        <div className={styles.earningsHeader}>
          <div className={styles.earningsHeading}>
            <h2 id="daily-earnings-title"><DollarSign size={19} aria-hidden="true" />{isAdmin ? 'Ingresos por día' : 'Mis ingresos por día'}</h2>
            <p>{currentMonthLabel} · Solo citas completadas{!isAdmin && ' de tus servicios'}</p>
          </div>
          <div className={styles.earningsTotal}><strong>{formatPrice(todayRevenue)}</strong><span>Ingresos de hoy</span></div>
        </div>
        {dailyRevenue.length === 0 ? <p className={styles.earningsEmpty}>Aún no hay citas completadas este mes.</p> : <div className={styles.earningsList}>
          {dailyRevenue.map(([date, day]) => <div key={date} className={styles.earningRow}>
            <div className={styles.earningDate}><strong>{formatDate(date)}</strong></div>
            <div className={styles.earningDetails}><span>{day.count} {day.count === 1 ? 'cita completada' : 'citas completadas'}</span></div>
            <strong className={styles.earningPrice}>{formatPrice(day.total)}</strong>
          </div>)}
        </div>}
      </section>

      <section className={styles.earnings} aria-labelledby="completed-earnings-title">
        <div className={styles.earningsHeader}>
          <div className={styles.earningsHeading}>
            <h2 id="completed-earnings-title"><DollarSign size={19} aria-hidden="true" />Ingresos por citas completadas</h2>
            <p>{currentMonthLabel} · Solo citas marcadas como completadas</p>
          </div>
          <div className={styles.earningsTotal}><strong>{formatPrice(completedRevenue)}</strong><span>{completedAppts.length} {completedAppts.length === 1 ? 'cita' : 'citas'}</span></div>
        </div>
        {completedAppts.length === 0 ? <div className={styles.earningsEmpty}>Aún no hay citas completadas este mes.</div> : <div className={styles.earningsList}>
          {completedAppts.map(appointment => <article key={appointment.id} className={styles.earningRow}>
            <div className={styles.earningDate}><strong>{formatDate(appointment.appointment_date)}</strong><span>{formatTime(appointment.appointment_time)}</span></div>
            <div className={styles.earningDetails}><strong>{appointment.client_name}</strong><span>{appointment.service_name}{appointment.barber_name ? ` · ${appointment.barber_name}` : ''}</span></div>
            <strong className={styles.earningPrice}>{formatPrice(Number(appointment.service_price || 0))}</strong>
          </article>)}
        </div>}
      </section>

      <div className={styles.quickLinks}>
        {quickLinks.map(link => {
          const Icon = link.icon
          return (
            <Link key={link.to} to={link.to} className={styles.quickLink}>
              <span className={styles.quickIcon}><Icon size={18} strokeWidth={2} /></span>
              <span>{link.label}</span>
              <ArrowRight size={16} strokeWidth={2} className={styles.arrow} />
            </Link>
          )
        })}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{user?.role === 'Barber' ? 'Mis citas de hoy' : 'Citas de hoy'}</h2>
          <span className={styles.sectionCount}>{todayAppts.length}</span>
        </div>
        {todayAppts.length === 0 ? (
          <div className={styles.empty}>
            <CalendarDays size={28} strokeWidth={1.8} />
            <p>No hay citas programadas para hoy.</p>
          </div>
        ) : (
          <div className={styles.apptList}>
            {todayAppts.map(a => (
              <div key={a.id} className={styles.apptRow}>
                <div className={styles.apptTime}>{formatTime(a.appointment_time)}</div>
                <div className={styles.apptInfo}>
                  <span className={styles.apptClient}>{a.client_name}</span>
                  <span className={styles.apptDetail}>
                    {a.service_name}
                    {user?.role === 'Admin' && ` · ${a.barber_name}`}
                  </span>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
