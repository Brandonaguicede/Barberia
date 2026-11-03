import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import toast from '../../services/toast'
import { servicesApi } from '../../services/api'
import type { Service } from '../../types'
import Modal from '../../components/shared/Modal'
import { FormField, Input, Select, TextArea } from '../../components/shared/FormField'
import styles from './AdminServices.module.css'

const CATEGORIES = [
  { value: 'corte', label: '✂ Corte' },
  { value: 'barba', label: '🪒 Barba' },
  { value: 'combo', label: '⭐ Combo' },
  { value: 'color', label: '🎨 Color' },
  { value: 'general', label: '◎ General' },
]

interface ServiceForm {
  name: string; description: string; duration: string
  price: string; category: string; active: number
}

const emptyForm = (): ServiceForm => ({
  name: '', description: '', duration: '30', price: '', category: 'general', active: 1
})

export default function AdminServices() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [form, setForm] = useState<ServiceForm>(emptyForm())
  const [saving, setSaving] = useState(false)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const data = await servicesApi.getAllAdmin()
      setServices(data)
    } catch { toast.error('Error al cargar servicios') }
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const set = (k: keyof ServiceForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setShowModal(true) }
  const openEdit = (s: Service) => {
    setEditing(s)
    setForm({
      name: s.name, description: s.description || '', duration: String(s.duration),
      price: String(s.price), category: s.category, active: s.active
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.duration || !form.price)
      return toast.error('Nombre, duración y precio son requeridos')
    setSaving(true)
    try {
      const payload = {
        ...form,
        duration: Number(form.duration),
        price: Number(form.price),
      }
      if (editing) {
        await servicesApi.update(editing.id, payload)
        toast.success('Servicio actualizado')
      } else {
        await servicesApi.create(payload)
        toast.success('Servicio creado')
      }
      setShowModal(false)
      fetchAll()
    } catch (err: any) {
      toast.error(err.message)
    } finally { setSaving(false) }
  }

  const handleToggle = async (s: Service) => {
    try {
      await servicesApi.update(s.id, { ...s, active: s.active === 1 ? 0 : 1 })
      toast.success(s.active === 1 ? 'Servicio desactivado' : 'Servicio activado')
      fetchAll()
    } catch { toast.error('Error al actualizar') }
  }

  const formatPrice = (p: number) =>
    new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(p)

  const servicesByCategory = services.reduce<Record<string, Service[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = []
    acc[s.category].push(s)
    return acc
  }, {})

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Servicios</h1>
        <button className={styles.btnNew} onClick={openCreate}>+ Agregar servicio</button>
      </div>
      <p className="muted">Después de crear un servicio, asígnalo a un barbero y guarda su horario en <Link to="/admin/configuracion" style={{ color: 'var(--accent-light)', textDecoration: 'underline' }}>Agenda y horarios</Link> para habilitar las reservas.</p>

      {loading ? (
        <div className={styles.loader}><div className="spinner" /></div>
      ) : (
        <div className={styles.content}>
          {Object.entries(servicesByCategory).map(([cat, svcs]) => {
            const catDef = CATEGORIES.find(c => c.value === cat)
            return (
              <div key={cat} className={styles.group}>
                <h2 className={styles.groupTitle}>{catDef?.label || cat}</h2>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Servicio</th>
                        <th>Duración</th>
                        <th>Precio</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {svcs.map(s => (
                        <tr key={s.id} className={!s.active ? styles.rowInactive : ''}>
                          <td>
                            <span className={styles.svcName}>{s.name}</span>
                            {s.description && <span className={styles.svcDesc}>{s.description}</span>}
                          </td>
                          <td>{s.duration} min</td>
                          <td className={styles.price}>{formatPrice(s.price)}</td>
                          <td>
                            <button
                              className={`${styles.toggleBtn} ${s.active ? styles.toggleActive : styles.toggleInactive}`}
                              onClick={() => handleToggle(s)}
                            >
                              {s.active ? 'Activo' : 'Inactivo'}
                            </button>
                          </td>
                          <td>
                            <button className={styles.btnEdit} onClick={() => openEdit(s)}>✎ Editar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <Modal
          title={editing ? 'Editar servicio' : 'Nuevo servicio'}
          onClose={() => setShowModal(false)}
          size="md"
        >
          <div className={styles.formGrid}>
            <FormField label="Nombre del servicio" required>
              <Input placeholder="Ej: Corte Clásico" value={form.name} onChange={set('name')} />
            </FormField>
            <FormField label="Categoría" required>
              <Select value={form.category} onChange={set('category')}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
            </FormField>
            <FormField label="Duración (minutos)" required>
              <Input type="number" min="5" step="5" placeholder="30" value={form.duration} onChange={set('duration')} />
            </FormField>
            <FormField label="Precio (CRC)" required>
              <Input type="number" min="0" step="500" placeholder="8000" value={form.price} onChange={set('price')} />
            </FormField>
            <div className={styles.fullCol}>
              <FormField label="Descripción">
                <TextArea
                  placeholder="Descripción del servicio..."
                  value={form.description}
                  onChange={set('description')}
                />
              </FormField>
            </div>
            {editing && (
              <FormField label="Estado">
                <Select value={form.active} onChange={e => setForm(f => ({ ...f, active: Number(e.target.value) }))}>
                  <option value={1}>Activo</option>
                  <option value={0}>Inactivo</option>
                </Select>
              </FormField>
            )}
          </div>
          <div className={styles.modalActions}>
            <button className={styles.btnCancel} onClick={() => setShowModal(false)}>Cancelar</button>
            <button className={styles.btnSave} onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear servicio'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
