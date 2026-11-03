import { useState, useEffect } from 'react'
import { CalendarClock, Edit3, Plus, Power, ShieldCheck } from 'lucide-react'
import toast from '../../services/toast'
import { authApi, barbersApi } from '../../services/api'
import type { User, Barber } from '../../types'
import Modal from '../../components/shared/Modal'
import { FormField, Input, Select } from '../../components/shared/FormField'
import styles from './AdminUsers.module.css'

interface UserForm {
  username: string
  password: string
  role: 'Admin' | 'Barber'
  active: number
  subscriptionExpirationDate: string
  barber_id: string
}

const emptyForm = (): UserForm => ({
  username: '',
  password: '',
  role: 'Barber',
  active: 1,
  subscriptionExpirationDate: '',
  barber_id: '',
})

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  useEffect(() => { barbersApi.getAllAdmin().then(setBarbers).catch(() => toast.error('No se pudieron cargar los barberos')) }, [])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [form, setForm] = useState<UserForm>(emptyForm())
  const [saving, setSaving] = useState(false)

  const fetchAll = async () => {
    setLoading(true)
    try {
      setUsers(await authApi.getUsers())
    } catch {
      toast.error('Error al cargar usuarios')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const set = (k: keyof UserForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setShowModal(true)
  }

  const openEdit = (u: User) => {
    setEditing(u)
    setForm({
      username: u.username,
      password: '',
      role: u.role,
      active: u.active ?? 1,
      subscriptionExpirationDate: u.subscriptionExpirationDate ? u.subscriptionExpirationDate.slice(0, 10) : '',
      barber_id: u.barber_id || '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.username.trim()) return toast.error('El correo es requerido')
    if (!editing && !form.password.trim()) return toast.error('La contrasena es requerida')
    setSaving(true)
    try {
      if (editing) {
        await authApi.updateUser(editing.id, { active: Number(form.active), barber_id: form.barber_id || null })
        await authApi.updateSubscriptionExpiration(editing.id, form.subscriptionExpirationDate ? `${form.subscriptionExpirationDate}T23:59:59-06:00` : '')
        toast.success('Usuario actualizado')
      } else {
        await authApi.createUser({
          username: form.username.trim(),
          password: form.password,
          role: form.role,
          barber_id: form.barber_id || null,
        } as any)
        toast.success(form.role === 'Admin' ? 'Administrador creado' : 'Usuario Barber creado')
      }
      setShowModal(false)
      fetchAll()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (u: User) => {
    if (!confirm(`Desactivar al usuario "${u.username}"?`)) return
    try {
      await authApi.deleteUser(u.id)
      toast.success('Usuario desactivado')
      fetchAll()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const roleLabel = (role: string) => role === 'Admin' ? 'Administrador' : 'Barber'

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Usuarios</h1>
          <p className={styles.sub}>Gestiona roles de creacion, actividad y expiracion de suscripciones.</p>
        </div>
        <button className={styles.btnNew} onClick={openCreate}>
          <Plus size={16} strokeWidth={2.2} />
          Nuevo usuario
        </button>
      </div>

      {loading ? (
        <div className={styles.loader}><div className="spinner" /></div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Expiracion</th>
                <th>Creado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className={!u.active ? styles.rowInactive : ''}>
                  <td>
                    <div className={styles.userCell}>
                      <div className={styles.avatar}>{u.username.charAt(0).toUpperCase()}</div>
                      <span className={styles.username}>{u.username}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`${styles.roleBadge} ${u.role === 'Admin' ? styles.roleAdmin : styles.roleBarber}`}>
                      {roleLabel(u.role)}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${u.active ? styles.statusActive : styles.statusInactive}`}>
                      {u.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className={styles.dateCell}>
                    {u.subscriptionExpirationDate ? new Date(u.subscriptionExpirationDate).toLocaleDateString('es-CR') : <span className={styles.none}>Sin fecha</span>}
                  </td>
                  <td className={styles.dateCell}>
                    {new Date((u as any).created_at).toLocaleDateString('es-CR')}
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <button className={styles.btnEdit} onClick={() => openEdit(u)} title="Editar actividad y expiracion">
                        <Edit3 size={14} strokeWidth={2} />
                      </button>
                      {u.active ? (
                        <button className={styles.btnDelete} onClick={() => handleDeactivate(u)} title="Desactivar">
                          <Power size={14} strokeWidth={2} />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.infoBox}>
        <span className={styles.infoIcon}><ShieldCheck size={18} strokeWidth={2} /></span>
        <div>
          <p className={styles.infoTitle}>Reglas de acceso</p>
          <p className={styles.infoText}>
            <strong>Administrador</strong> — acceso completo al panel. <br />
            <strong>Barber</strong> — usuario autenticado sujeto a actividad y expiracion.
          </p>
        </div>
      </div>

      {showModal && (
        <Modal title={editing ? 'Editar usuario' : 'Nuevo usuario'} onClose={() => setShowModal(false)} size="sm">
          <div className={styles.formGrid}>
            <FormField label="Correo" required>
              <Input placeholder="usuario@barbershop.test" value={form.username} onChange={set('username')} autoComplete="off" disabled={!!editing} />
            </FormField>

            {!editing && (
              <FormField label="Contrasena" required>
              <Input type="password" minLength={12} placeholder="Mínimo 12 caracteres" value={form.password} onChange={set('password')} autoComplete="new-password" />
              </FormField>
            )}

            {!editing && (
              <FormField label="Rol de creacion" required>
                <Select value={form.role} onChange={set('role')}>
                  <option value="Barber">Barber</option>
                  <option value="Admin">Administrador</option>
                </Select>
              </FormField>
            )}

            {form.role === 'Barber' && <FormField label="Perfil de barbero"><Select value={form.barber_id} onChange={set('barber_id')}><option value="">Sin asignar</option>{barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></FormField>}
            {editing && (
              <FormField label="Estado">
                <Select value={form.active} onChange={e => setForm(f => ({ ...f, active: Number(e.target.value) }))}>
                  <option value={1}>Activo</option>
                  <option value={0}>Inactivo</option>
                </Select>
              </FormField>
            )}

            {editing && (
              <FormField label="Expiracion de suscripcion">
                <div className={styles.dateInputWrap}>
                  <CalendarClock size={16} strokeWidth={2} />
                  <Input type="date" value={form.subscriptionExpirationDate} onChange={set('subscriptionExpirationDate')} />
                </div>
              </FormField>
            )}
          </div>

          <div className={styles.modalActions}>
            <button className={styles.btnCancel} onClick={() => setShowModal(false)}>Cancelar</button>
            <button className={styles.btnSave} onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear usuario'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
