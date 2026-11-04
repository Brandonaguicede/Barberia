import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom'
import { CalendarDays, LayoutDashboard, LogOut, MoreHorizontal, Scissors, Settings, UserRound, UsersRound } from 'lucide-react'
import { useState } from 'react'
import toast from '../../services/toast'
import { useAuth } from '../../context/AuthContext'
import styles from './AdminLayout.module.css'
import NotificationCenter from './NotificationCenter'
const logo = '/images/tenorio_barber.svg'

export default function AdminLayout() {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)

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
    { to: '/admin/configuracion', icon: CalendarDays, label: isAdmin ? 'Agenda y horarios' : 'Mi disponibilidad', end: false, adminOnly: false },
    { to: '/admin/usuarios', icon: UsersRound, label: 'Usuarios', end: false, adminOnly: true },
  ].filter(item => !item.adminOnly || isAdmin)

  const displayName = user?.username || user?.email || 'Usuario'
  const mobilePrimaryItems = navItems.filter(item => item.to === '/admin/citas' || item.to === '/admin/configuracion' || (isAdmin && item.to === '/admin'))
  const mobileExtraItems = navItems.filter(item => !mobilePrimaryItems.some(primary => primary.to === item.to))

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

      <nav className={styles.mobileNav} aria-label="Navegación administrativa">
        {mobilePrimaryItems.map(item => {
          const Icon = item.icon
          return <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMobileMoreOpen(false)} className={({ isActive }) => `${styles.mobileNavItem} ${isActive ? styles.mobileNavActive : ''}`}><Icon size={19} strokeWidth={1.8} aria-hidden="true" /><span>{item.to === '/admin/citas' ? 'Citas' : item.to === '/admin/configuracion' ? 'Agenda' : 'Inicio'}</span></NavLink>
        })}
        <div className={styles.mobileMore}>
          <button type="button" className={`${styles.mobileNavItem} ${mobileMoreOpen ? styles.mobileNavActive : ''}`} aria-expanded={mobileMoreOpen} onClick={() => setMobileMoreOpen(value => !value)}><MoreHorizontal size={20} strokeWidth={1.8} aria-hidden="true" /><span>Más</span></button>
          {mobileMoreOpen && <div className={styles.mobileMorePanel}>
            <div className={styles.mobileProfile}><span className={styles.userAvatar}><UserRound size={17} aria-hidden="true" /></span><span><strong>{displayName}</strong><small>{user?.role === 'Admin' ? 'Administrador' : 'Barbero'}</small></span></div>
            {mobileExtraItems.map(item => { const Icon = item.icon; return <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMobileMoreOpen(false)} className={({ isActive }) => `${styles.mobileExtraLink} ${isActive ? styles.mobileNavActive : ''}`}><Icon size={17} aria-hidden="true" />{item.label}</NavLink> })}
            {isAdmin && <Link to="/" className={styles.mobileExtraLink} onClick={() => setMobileMoreOpen(false)}>Vista cliente</Link>}
            <button className={styles.mobileExtraLink} onClick={() => { setMobileMoreOpen(false); void handleLogout() }}><LogOut size={17} aria-hidden="true" />Cerrar sesión</button>
          </div>}
        </div>
      </nav>

      <main className={styles.main}>
        <NotificationCenter />
        <Outlet />
      </main>
    </div>
  )
}
