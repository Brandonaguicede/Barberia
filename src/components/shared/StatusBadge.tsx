import styles from './StatusBadge.module.css'
import type { AppointmentStatus } from '../../types'

const labels: Record<AppointmentStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No asistió',
}

export default function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span className={`${styles.badge} ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}
