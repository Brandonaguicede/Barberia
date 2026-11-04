import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarCheck, CalendarDays, Clock3, DollarSign, Scissors, Settings, UsersRound } from 'lucide-react'
import { appointmentsApi } from '../../services/api'
import toast from '../../services/toast'
import { localDate } from '../../utils/booking'
import { useAuth } from '../../context/AuthContext'
import type { Appointment, AppStats } from '../../types'
import StatusBadge from '../../components/shared/StatusBadge'
import styles from './AdminDashboard.module.css'

export default function AdminDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<AppStats | null>(null)
  const [todayAppts, setTodayAppts] = useState<Appointment[]>([])
  const [completedAppts, setCompletedAppts] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = localDate()
    const [year, month] = today.slice(0, 7).split('-').map(Number)
    const monthStart = `${today.slice(0, 7)}-01`
    const nextMonthStart = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10)
    const apptParams: Record<string, string> = { date: today }
    const completedParams: Record<string, string> = { status: 'completed', from: monthStart, before: nextMonthStart }
    if (user?.role === 'Barber' && user.barber_id) {
      apptParams.barber_id = user.barber_id
      completedParams.barber_id = user.barber_id
    }
    Promise.all([
      appointmentsApi.getStats(),
      appointmentsApi.getAll(apptParams),
      appointmentsApi.getAll(completedParams),
    ]).then(([s, a, completed]) => {
      setStats(s)
      setTodayAppts(a)
      setCompletedAppts(completed.sort((left, right) => (right.starts_at || '').localeCompare(left.starts_at || '')))
    }).catch(() => toast.error('No se pudo cargar el resumen')).finally(() => setLoading(false))
  }, [user])

  const formatPrice = (p: number) =>
    new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(p)
  const monthStart = `${localDate().slice(0, 7)}-01`
  const currentMonthLabel = new Intl.DateTimeFormat('es-CR', { timeZone: 'America/Costa_Rica', month: 'long', year: 'numeric' }).format(new Date(`${monthStart}T12:00:00-06:00`))
  const completedRevenue = completedAppts.reduce((total, appointment) => total + Number(appointment.service_price || 0), 0)
  const formatDate = (value: string) => new Date(`${value}T12:00:00-06:00`).toLocaleDateString('es-CR', { timeZone: 'America/Costa_Rica', day: '2-digit', month: 'short' })

  const formatTime = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    const suffix = h >= 12 ? 'pm' : 'am'
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
    return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`
  }

  if (loading) return <div className={styles.loader}><div className="spinner" /></div>

  const metricCards = [
    { icon: CalendarCheck, value: stats?.today ?? 0, label: 'Citas hoy' },
    { icon: Clock3, value: stats?.pending ?? 0, label: 'Pendientes' },
    { icon: CalendarDays, value: stats?.upcoming ?? 0, label: 'Proximas' },
    { icon: DollarSign, value: formatPrice(stats?.monthlyRevenue ?? 0), label: 'Ingresos del mes', gold: true },
  ]

  const quickLinks = [
    { to: '/admin/citas', icon: CalendarDays, label: 'Gestionar citas' },
    { to: '/admin/barberos', icon: Scissors, label: 'Gestionar barberos' },
    { to: '/admin/servicios', icon: Settings, label: 'Gestionar servicios' },
    { to: '/admin/usuarios', icon: UsersRound, label: 'Gestionar usuarios' },
  ]

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
