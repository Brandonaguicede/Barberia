import styles from './StatusBadge.module.css'
import type { AppointmentStatus } from '../../types'

const labels: Record<AppointmentStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  completed: 'Completada',
  cancelled: 'Cancelada',
}

export default function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span className={`${styles.badge} ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}
