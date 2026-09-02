import { useLocation, Link } from 'react-router-dom'
import type { Appointment } from '../../types'
import styles from './ConfirmationPage.module.css'

export default function ConfirmationPage() {
  const { state } = useLocation()
  const appt: Appointment | null = state?.appointment || null

  if (!appt) {
    return (
      <div className={styles.center}>
        <p className={styles.muted}>No se encontró información de la cita.</p>
        <Link to="/" className={styles.btn}>← Volver al inicio</Link>
      </div>
    )
  }

  const formatPrice = (p: number) =>
    new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(p)

  const formatDate = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('es-CR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })

  const formatTime = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    const suffix = h >= 12 ? 'pm' : 'am'
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
    return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`
  }

  return (
    <div className={styles.page}>
      <div className={styles.icon}>✓</div>
      <h1 className={styles.title}>¡Cita confirmada!</h1>
      <p className={styles.sub}>Tu cita ha sido agendada con éxito. Te esperamos.</p>
      {appt.client_email && (
        <div className={styles.notice}>
          La confirmacion sera enviada al correo {appt.client_email}.
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardId}>Cita #{appt.id.slice(0, 8).toUpperCase()}</span>
          <span className={styles.badge}>Pendiente</span>
        </div>

        <div className={styles.rows}>
          <div className={styles.row}><span>Barbero</span><strong>{appt.barber_name}</strong></div>
          <div className={styles.row}><span>Servicio</span><strong>{appt.service_name}</strong></div>
          <div className={styles.row}><span>Duración</span><strong>{appt.service_duration} min</strong></div>
          <div className={styles.row}><span>Precio</span><strong className={styles.gold}>{formatPrice(appt.service_price!)}</strong></div>
          <div className={styles.divider} />
          <div className={styles.row}><span>Fecha</span><strong>{formatDate(appt.appointment_date)}</strong></div>
          <div className={styles.row}><span>Hora</span><strong>{formatTime(appt.appointment_time)}</strong></div>
          <div className={styles.divider} />
          <div className={styles.row}><span>Cliente</span><strong>{appt.client_name}</strong></div>
          <div className={styles.row}><span>Teléfono</span><strong>{appt.client_phone}</strong></div>
          {appt.client_email && <div className={styles.row}><span>Correo</span><strong>{appt.client_email}</strong></div>}
          {appt.notes && <div className={styles.row}><span>Notas</span><strong>{appt.notes}</strong></div>}
        </div>
      </div>

      <div className={styles.actions}>
        <Link to="/" className={styles.btnPrimary}>Agendar otra cita</Link>
      </div>
    </div>
  )
}
