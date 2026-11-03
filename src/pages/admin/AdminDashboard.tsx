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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = localDate()
    const apptParams: Record<string, string> = { date: today }
    if (user?.role === 'Barber' && user.barber_id) {
      apptParams.barber_id = user.barber_id
    }
    Promise.all([
      appointmentsApi.getStats(),
      appointmentsApi.getAll(apptParams),
    ]).then(([s, a]) => {
      setStats(s)
      setTodayAppts(a)
    }).catch(() => toast.error('No se pudo cargar el resumen')).finally(() => setLoading(false))
  }, [user])

  const formatPrice = (p: number) =>
    new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(p)

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
