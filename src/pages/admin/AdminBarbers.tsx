import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import toast from '../../services/toast'
import { barbersApi } from '../../services/api'
import type { Barber } from '../../types'
import Modal from '../../components/shared/Modal'
import { FormField, Input } from '../../components/shared/FormField'
import styles from './AdminBarbers.module.css'

interface BarberForm {
  name: string; specialty: string; phone: string; email: string; active: number
}

const emptyForm = (): BarberForm => ({ name: '', specialty: '', phone: '', email: '', active: 1 })

export default function AdminBarbers() {
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Barber | null>(null)
  const [form, setForm] = useState<BarberForm>(emptyForm())
  const [saving, setSaving] = useState(false)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const data = await barbersApi.getAllAdmin()
      setBarbers(data)
    } catch { toast.error('Error al cargar barberos') }
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const set = (k: keyof BarberForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setShowModal(true) }
  const openEdit = (b: Barber) => {
    setEditing(b)
    setForm({ name: b.name, specialty: b.specialty || '', phone: b.phone || '', email: b.email || '', active: b.active })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('El nombre es requerido')
    setSaving(true)
    try {
      if (editing) {
        await barbersApi.update(editing.id, form)
        toast.success('Barbero actualizado')
      } else {
        await barbersApi.create(form)
        toast.success('Barbero creado')
      }
      setShowModal(false)
      fetchAll()
    } catch (err: any) {
      toast.error(err.message)
    } finally { setSaving(false) }
  }

  const handleDelete = async (b: Barber) => {
    if (!confirm(`¿Desactivar a ${b.name}?`)) return
    try {
      await barbersApi.remove(b.id)
      toast.success('Barbero desactivado')
      fetchAll()
    } catch (err: any) { toast.error(err.message) }
  }

  const initials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Barberos</h1>
        <button className={styles.btnNew} onClick={openCreate}>+ Agregar barbero</button>
      </div>

      {loading ? (
        <div className={styles.loader}><div className="spinner" /></div>
      ) : (
        <div className={styles.grid}>
          {barbers.map(b => (
            <div key={b.id} className={`${styles.card} ${!b.active ? styles.inactive : ''}`}>
              <div className={styles.cardTop}>
                <div className={styles.avatar}>{initials(b.name)}</div>
                <div className={styles.info}>
                  <span className={styles.name}>{b.name}</span>
                  {b.specialty && <span className={styles.specialty}>{b.specialty}</span>}
                </div>
                <span className={`${styles.activeBadge} ${b.active ? styles.active : styles.inactiveBadge}`}>
                  {b.active ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              <div className={styles.contacts}>
                {b.phone && (
                  <div className={styles.contact}>
                    <span className={styles.contactIcon}>📞</span>
                    <span>{b.phone}</span>
                  </div>
                )}
                {b.email && (
                  <div className={styles.contact}>
                    <span className={styles.contactIcon}>✉</span>
                    <span>{b.email}</span>
                  </div>
                )}
              </div>

              <div className={styles.cardActions}>
                <button className={styles.btnEdit} onClick={() => openEdit(b)}>✎ Editar</button>
                <Link className={styles.btnEdit} to={`/admin/configuracion?barbero=${b.id}`} aria-label={`Configurar agenda de ${b.name.trim()}`}><CalendarDays size={15} aria-hidden="true" /> Agenda</Link>
                {b.active === 1 && (
                  <button className={styles.btnDeactivate} onClick={() => handleDelete(b)}>Desactivar</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal
          title={editing ? 'Editar barbero' : 'Nuevo barbero'}
          onClose={() => setShowModal(false)}
          size="sm"
        >
          <div className={styles.formGrid}>
            <FormField label="Nombre completo" required>
              <Input placeholder="Ej: Carlos Mendoza" value={form.name} onChange={set('name')} />
            </FormField>
            <FormField label="Especialidad">
              <Input placeholder="Ej: Cortes clásicos & fade" value={form.specialty} onChange={set('specialty')} />
            </FormField>
            <FormField label="Teléfono">
              <Input type="tel" placeholder="8888-1234" value={form.phone} onChange={set('phone')} />
            </FormField>
            <FormField label="Correo electrónico">
              <Input type="email" placeholder="carlos@email.com" value={form.email} onChange={set('email')} />
            </FormField>
            {editing && (
              <FormField label="Estado">
                <select
                  className={styles.stateSelect}
                  value={form.active}
                  onChange={e => setForm(f => ({ ...f, active: Number(e.target.value) }))}
                >
                  <option value={1}>Activo</option>
                  <option value={0}>Inactivo</option>
                </select>
              </FormField>
            )}
          </div>
          <div className={styles.modalActions}>
            <button className={styles.btnCancel} onClick={() => setShowModal(false)}>Cancelar</button>
            <button className={styles.btnSave} onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear barbero'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
