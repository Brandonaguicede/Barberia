import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom'
import { CalendarDays, LayoutDashboard, LogOut, Scissors, Settings, UserRound, UsersRound } from 'lucide-react'
import toast from '../../services/toast'
import { useAuth } from '../../context/AuthContext'
import styles from './AdminLayout.module.css'
import NotificationCenter from './NotificationCenter'
const logo = '/images/tenorio_barber.svg'

export default function AdminLayout() {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch {
      toast.error('Error al cerrar sesion')
    }
  }

  const navItems = [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true, adminOnly: true },
    { to: '/admin/citas', icon: CalendarDays, label: isAdmin ? 'Citas' : 'Mis citas', end: false, adminOnly: false },
    { to: '/admin/barberos', icon: Scissors, label: 'Barberos', end: false, adminOnly: true },
    { to: '/admin/servicios', icon: Settings, label: 'Servicios', end: false, adminOnly: true },
    { to: '/admin/configuracion', icon: Settings, label: 'Configuración', end: false, adminOnly: false },
    { to: '/admin/usuarios', icon: UsersRound, label: 'Usuarios', end: false, adminOnly: true },
  ].filter(item => !item.adminOnly || isAdmin)

  const displayName = user?.username || user?.email || 'Usuario'

  return (
    <div className={styles.root}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <Link to={isAdmin ? '/admin' : '/admin/citas'} className={styles.logo}>
            <picture><source media="(max-width: 820px)" srcSet="/icons/tenorio.svg" /><img src={logo} alt="Tenorio Barber" className={styles.logoImg} /></picture>
            <span className={styles.logoText}>Control</span>
          </Link>

          <nav className={styles.nav}>
            {navItems.map(item => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  aria-label={item.label}
                  className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
                >
                  <span className={styles.navIcon}><Icon size={18} strokeWidth={2} /></span>
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>
        </div>

        <div className={styles.sidebarBottom}>
          <div className={styles.userInfo}>
            <div className={styles.userAvatar}><UserRound size={17} strokeWidth={2} /></div>
            <div className={styles.userMeta}>
              <span className={styles.userName}>{displayName}</span>
              <span className={styles.userRole}>{user?.role === 'Admin' ? 'Administrador' : 'Barbero'}</span>
            </div>
          </div>

          <div className={styles.sidebarActions}>
            {isAdmin && <Link to="/" className={styles.clientLink}>Vista cliente</Link>}
            <button className={styles.logoutBtn} onClick={handleLogout}>
              <LogOut size={15} strokeWidth={2} />
              <span>Salir</span>
            </button>
          </div>
        </div>
      </aside>

      <main className={styles.main}>
        <NotificationCenter />
        <Outlet />
      </main>
    </div>
  )
}
