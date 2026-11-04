import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import toast from '../../services/toast'
import { servicesApi, barbersApi } from '../../services/api'
import { supabase } from '../../services/supabase'
import type { Service, Barber } from '../../types'
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
const DURATION_PRESETS = [
  { label: 'Corte sencillo', minutes: 30 },
  { label: 'Corte con navaja', minutes: 45 },
  { label: 'Corte + barba', minutes: 60 },
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
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [assignments, setAssignments] = useState<{ service_id: string; barber_id: string }[]>([])
  const [selectedBarbers, setSelectedBarbers] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [form, setForm] = useState<ServiceForm>(emptyForm())
  const [saving, setSaving] = useState(false)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [data, people, links] = await Promise.all([servicesApi.getAllAdmin(), barbersApi.getAllAdmin(), supabase.from('barber_services').select('service_id,barber_id')])
      if (links.error) throw links.error
      setServices(data); setBarbers(people); setAssignments(links.data || [])
    } catch { toast.error('Error al cargar servicios') }
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const set = (k: keyof ServiceForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setSelectedBarbers(barbers.filter(b => b.active).length === 1 ? [barbers.find(b => b.active)!.id] : []); setShowModal(true) }
  const openEdit = (s: Service) => {
    setEditing(s)
    setSelectedBarbers(assignments.filter(link => link.service_id === s.id).map(link => link.barber_id))
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
      await servicesApi.saveWithBarbers(editing?.id || null, payload, selectedBarbers)
      toast.success(selectedBarbers.length ? editing ? 'Servicio actualizado' : 'Servicio creado' : 'Servicio guardado. Asigna un barbero para mostrarlo a los clientes.')
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
                            <span className={styles.svcDesc} style={{ color: assignments.some(link => link.service_id === s.id && barbers.some(b => b.id === link.barber_id && b.active)) ? 'var(--text-dim)' : 'var(--accent-light)' }}>{assignments.some(link => link.service_id === s.id && barbers.some(b => b.id === link.barber_id && b.active)) ? `Barberos: ${assignments.filter(link => link.service_id === s.id).map(link => barbers.find(b => b.id === link.barber_id)?.name.trim()).filter(Boolean).join(', ')}` : 'Sin barbero activo asignado · No visible para reservar'}</span>
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
            <div className={styles.fullCol}>
              <fieldset className={styles.durationPresets} disabled={saving}>
                <legend>Duración rápida</legend>
                <div>{DURATION_PRESETS.map(preset => <button key={preset.minutes} type="button" aria-pressed={form.duration === String(preset.minutes)} className={form.duration === String(preset.minutes) ? styles.durationPresetActive : ''} onClick={() => setForm(current => ({ ...current, duration: String(preset.minutes) }))}><strong>{preset.label}</strong><span>{preset.minutes} min</span></button>)}</div>
                <p>La agenda usa esta duración para calcular cuánto tiempo ocupa cada cita y qué horas quedan disponibles.</p>
              </fieldset>
            </div>
            <FormField label="Precio (CRC)" required>
              <Input type="number" min="0" step="500" placeholder="8000" value={form.price} onChange={set('price')} />
            </FormField>
            <div className={styles.fullCol}>
              <fieldset className="service-assignments" disabled={saving}>
                <legend>Barberos que ofrecen este servicio</legend>
                {barbers.map(barber => <label key={barber.id}><input type="checkbox" checked={selectedBarbers.includes(barber.id)} onChange={() => setSelectedBarbers(current => current.includes(barber.id) ? current.filter(id => id !== barber.id) : [...current, barber.id])} />{barber.name}{!barber.active ? ' (inactivo)' : ''}</label>)}
              </fieldset>
              {barbers.length === 0 ? <p className="muted">Agrega un barbero para que este servicio se pueda reservar.</p> : selectedBarbers.length === 0 && <p className="muted">El servicio se guardará, pero no aparecerá para reservar hasta que selecciones un barbero.</p>}
            </div>
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
