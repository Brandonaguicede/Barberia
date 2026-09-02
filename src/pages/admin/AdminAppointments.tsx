import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { appointmentsApi, barbersApi, servicesApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import type { Appointment, Barber, Service, AppointmentStatus } from '../../types'
import Modal from '../../components/shared/Modal'
import StatusBadge from '../../components/shared/StatusBadge'
import { FormField, Input, Select, TextArea } from '../../components/shared/FormField'
import styles from './AdminAppointments.module.css'

const STATUS_OPTIONS: { value: AppointmentStatus; label: string }[] = [
  { value: 'pending',   label: 'Pendiente'  },
  { value: 'confirmed', label: 'Confirmada' },
  { value: 'completed', label: 'Completada' },
  { value: 'cancelled', label: 'Cancelada'  },
]

interface ApptForm {
  client_name: string; client_phone: string; client_email: string
  barber_id: string; service_id: string
  appointment_date: string; appointment_time: string
  status: AppointmentStatus; notes: string
}

const emptyForm = (): ApptForm => ({
  client_name: '', client_phone: '', client_email: '',
  barber_id: '', service_id: '',
  appointment_date: '', appointment_time: '',
  status: 'pending', notes: '',
})

export default function AdminAppointments() {
  const { user, isAdmin } = useAuth()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [barbers,      setBarbers]      = useState<Barber[]>([])
  const [services,     setServices]     = useState<Service[]>([])
  const [slots,        setSlots]        = useState<string[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showModal,    setShowModal]    = useState(false)
  const [editing,      setEditing]      = useState<Appointment | null>(null)
  const [form,         setForm]         = useState<ApptForm>(emptyForm())
  const [saving,       setSaving]       = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDate,   setFilterDate]   = useState('')
  const [filterBarber, setFilterBarber] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (filterStatus) params.status    = filterStatus
    if (filterDate)   params.date      = filterDate
    // Barbers: backend already filters by their barber_id via session
    // Admin can additionally filter by barber
    if (isAdmin && filterBarber) params.barber_id = filterBarber
    try {
      const data = await appointmentsApi.getAll(params)
      setAppointments(data)
    } catch { toast.error('Error al cargar citas') }
    setLoading(false)
  }, [filterStatus, filterDate, filterBarber, isAdmin])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    Promise.all([barbersApi.getAll(), servicesApi.getAll()])
      .then(([b, s]) => { setBarbers(b); setServices(s) })
  }, [])

  useEffect(() => {
    if (form.barber_id && form.appointment_date && form.service_id) {
      appointmentsApi.getAvailableSlots({
        barber_id:  form.barber_id,
        date:       form.appointment_date,
        service_id: form.service_id,
      }).then(setSlots).catch(() => setSlots([]))
    }
  }, [form.barber_id, form.appointment_date, form.service_id])

  const set = (k: keyof ApptForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))

  const openCreate = () => {
    setEditing(null)
    // Pre-select barber if user is a barber
    const preBarber = !isAdmin && user?.barber_id ? user.barber_id : ''
    setForm({ ...emptyForm(), barber_id: preBarber })
    setShowModal(true)
  }

  const openEdit = (a: Appointment) => {
    setEditing(a)
    setForm({
      client_name:      a.client_name,
      client_phone:     a.client_phone,
      client_email:     a.client_email || '',
      barber_id:        a.barber_id,
      service_id:       a.service_id,
      appointment_date: a.appointment_date,
      appointment_time: a.appointment_time.substring(0, 5),
      status:           a.status,
      notes:            a.notes || '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.client_name || !form.client_phone || !form.barber_id || !form.service_id || !form.appointment_date || !form.appointment_time)
      return toast.error('Completa todos los campos obligatorios')
    setSaving(true)
    try {
      if (editing) {
        await appointmentsApi.update(editing.id, form)
        toast.success('Cita actualizada')
      } else {
        await appointmentsApi.create(form)
        toast.success('Cita creada')
      }
      setShowModal(false)
      fetchAll()
    } catch (err: any) {
      toast.error(err.message)
    } finally { setSaving(false) }
  }

  const handleCancel = async (id: string) => {
    if (!confirm('¿Cancelar esta cita?')) return
    try {
      await appointmentsApi.cancel(id)
      toast.success('Cita cancelada')
      fetchAll()
    } catch { toast.error('Error al cancelar') }
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await appointmentsApi.updateStatus(id, status)
      toast.success('Estado actualizado')
      fetchAll()
    } catch { toast.error('Error al actualizar estado') }
  }

  const formatDate = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' })

  const formatTime = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    const suffix = h >= 12 ? 'pm' : 'am'
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
    return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`
  }

  const formatPrice = (p: number) =>
    new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(p)

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{isAdmin ? 'Citas' : 'Mis Citas'}</h1>
        <button className={styles.btnNew} onClick={openCreate}>+ Nueva cita</button>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <input
          type="date" className={styles.filterInput}
          value={filterDate} onChange={e => setFilterDate(e.target.value)}
        />
        <select className={styles.filterInput} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {isAdmin && (
          <select className={styles.filterInput} value={filterBarber} onChange={e => setFilterBarber(e.target.value)}>
            <option value="">Todos los barberos</option>
            {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        {(filterDate || filterStatus || filterBarber) && (
          <button className={styles.clearBtn} onClick={() => { setFilterDate(''); setFilterStatus(''); setFilterBarber('') }}>
            ✕ Limpiar
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className={styles.loader}><div className="spinner" /></div>
      ) : appointments.length === 0 ? (
        <div className={styles.empty}>No se encontraron citas.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Cliente</th>
                {isAdmin && <th>Barbero</th>}
                <th>Servicio</th>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Precio</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map(a => (
                <tr key={a.id}>
                  <td>
                    <span className={styles.clientName}>{a.client_name}</span>
                    <span className={styles.clientPhone}>{a.client_phone}</span>
                  </td>
                  {isAdmin && <td>{a.barber_name}</td>}
                  <td>{a.service_name}</td>
                  <td>{formatDate(a.appointment_date)}</td>
                  <td>{formatTime(a.appointment_time)}</td>
                  <td className={styles.price}>{formatPrice(a.service_price!)}</td>
                  <td>
                    {isAdmin ? (
                      <select
                        className={styles.statusSelect}
                        value={a.status}
                        onChange={e => handleStatusChange(a.id, e.target.value)}
                      >
                        {STATUS_OPTIONS.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    ) : (
                      <StatusBadge status={a.status} />
                    )}
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      {isAdmin && (
                        <button className={styles.btnEdit} onClick={() => openEdit(a)} title="Editar">✎</button>
                      )}
                      {isAdmin && a.status !== 'cancelled' && (
                        <button className={styles.btnCancel} onClick={() => handleCancel(a.id)} title="Cancelar">✕</button>
                      )}
                      {!isAdmin && (
                        <StatusBadge status={a.status} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal — only admin can open it via table; barbers can create new */}
      {showModal && (
        <Modal
          title={editing ? 'Editar cita' : 'Nueva cita'}
          onClose={() => setShowModal(false)}
          size="lg"
        >
          <div className={styles.modalGrid}>
            <FormField label="Nombre del cliente" required>
              <Input placeholder="Ej: Juan Pérez" value={form.client_name} onChange={set('client_name')} />
            </FormField>
            <FormField label="Teléfono" required>
              <Input type="tel" placeholder="8888-1234" value={form.client_phone} onChange={set('client_phone')} />
            </FormField>
            <FormField label="Correo electrónico">
              <Input type="email" placeholder="juan@email.com" value={form.client_email} onChange={set('client_email')} />
            </FormField>
            <FormField label="Barbero" required>
              {isAdmin ? (
                <Select value={form.barber_id} onChange={set('barber_id')}>
                  <option value="">Seleccionar barbero</option>
                  {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              ) : (
                <Input value={user?.barber_name || 'Mi perfil'} disabled />
              )}
            </FormField>
            <FormField label="Servicio" required>
              <Select value={form.service_id} onChange={set('service_id')}>
                <option value="">Seleccionar servicio</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration} min)</option>)}
              </Select>
            </FormField>
            <FormField label="Fecha" required>
              <Input type="date" min={today} value={form.appointment_date} onChange={set('appointment_date')} />
            </FormField>
            <FormField label="Hora" required>
              {slots.length > 0 ? (
                <Select value={form.appointment_time} onChange={set('appointment_time')}>
                  <option value="">Seleccionar hora</option>
                  {slots.map(s => <option key={s} value={s}>{formatTime(s)}</option>)}
                  {editing && form.appointment_time && !slots.includes(form.appointment_time) && (
                    <option value={form.appointment_time}>{formatTime(form.appointment_time)} (actual)</option>
                  )}
                </Select>
              ) : (
                <Input type="time" value={form.appointment_time} onChange={set('appointment_time')} />
              )}
            </FormField>
            {isAdmin && editing && (
              <FormField label="Estado">
                <Select value={form.status} onChange={set('status')}>
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
              </FormField>
            )}
            <div className={styles.fullCol}>
              <FormField label="Notas">
                <TextArea placeholder="Observaciones adicionales..." value={form.notes} onChange={set('notes')} />
              </FormField>
            </div>
          </div>
          <div className={styles.modalActions}>
            <button className={styles.btnCancel2} onClick={() => setShowModal(false)}>Cancelar</button>
            <button className={styles.btnSave} onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : editing ? 'Actualizar cita' : 'Crear cita'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
