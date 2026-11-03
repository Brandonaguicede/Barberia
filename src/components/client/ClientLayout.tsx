import { Outlet, Link, useLocation } from 'react-router-dom'
import { Scissors, UserRound } from 'lucide-react'
import styles from './ClientLayout.module.css'

export default function ClientLayout() {
  const location = useLocation()
  const isBooking = location.pathname === '/'

  return <div className={styles.root}>
    <a className={styles.skipLink} href="#contenido">Ir al contenido</a>
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link to="/" className={styles.logo} aria-label="Tenorio Barber, inicio"><img src="/images/tenorio_barber.svg" alt="Tenorio Barber" className={styles.logoImage} /></Link>
        <Link to="/login" className={styles.adminLink} aria-label="Iniciar sesión del personal"><UserRound size={20} strokeWidth={1.8} aria-hidden="true" /><span>Iniciar sesión</span></Link>
      </div>
    </header>
    <main id="contenido" className={`${styles.main} ${!isBooking ? styles.receiptMain : ''}`}><Outlet /></main>
    <footer className={styles.footer}><span><Scissors size={13} aria-hidden="true" />TENORIO BARBER</span><p>© {new Date().getFullYear()} · Todos los derechos reservados</p></footer>
  </div>
}
