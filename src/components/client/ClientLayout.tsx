import { useEffect, useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { Menu, Scissors, UserRound, X } from 'lucide-react'
import styles from './ClientLayout.module.css'

export default function ClientLayout() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const isBooking = location.pathname === '/'
  useEffect(() => { setMenuOpen(false) }, [location.pathname, location.hash])
  useEffect(() => {
    if (!menuOpen) return
    const dismiss = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuOpen(false); document.getElementById('client-menu-toggle')?.focus() } }
    document.addEventListener('keydown', dismiss)
    return () => document.removeEventListener('keydown', dismiss)
  }, [menuOpen])

  return <div className={styles.root}>
    <a className={styles.skipLink} href="#contenido">Ir al contenido</a>
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <button id="client-menu-toggle" className={styles.menuToggle} aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuOpen} aria-controls="client-navigation" onClick={() => setMenuOpen(open => !open)}>{menuOpen ? <X size={25} /> : <Menu size={25} />}</button>
        <Link to="/" className={styles.logo} aria-label="Tenorio Barber, inicio"><img src="/images/tenorio_barber.svg" alt="Tenorio Barber" className={styles.logoImage} /></Link>
        <nav id="client-navigation" className={`${styles.nav} ${menuOpen ? styles.navOpen : ''}`} aria-label="Navegación principal">
          <Link to="/" onClick={() => setMenuOpen(false)} className={styles.navLink}>Inicio</Link>
          <Link to="/#reservar" onClick={() => setMenuOpen(false)} className={`${styles.navLink} ${isBooking && (!location.hash || location.hash === '#reservar') ? styles.activeLink : ''}`}>Reservar cita</Link>
          <Link to="/#servicios" onClick={() => setMenuOpen(false)} className={`${styles.navLink} ${location.hash === '#servicios' ? styles.activeLink : ''}`}>Servicios</Link>
          <Link to="/#barberos" onClick={() => setMenuOpen(false)} className={`${styles.navLink} ${location.hash === '#barberos' ? styles.activeLink : ''}`}>Barberos</Link>
        </nav>
        <Link to="/login" className={styles.adminLink} aria-label="Iniciar sesión del personal"><UserRound size={20} strokeWidth={1.8} aria-hidden="true" /><span>Iniciar sesión</span></Link>
      </div>
    </header>
    <main id="contenido" className={`${styles.main} ${!isBooking ? styles.receiptMain : ''}`}><Outlet /></main>
    <footer className={styles.footer}><span><Scissors size={13} aria-hidden="true" />TENORIO BARBER</span><p>© {new Date().getFullYear()} · Todos los derechos reservados</p></footer>
  </div>
}
