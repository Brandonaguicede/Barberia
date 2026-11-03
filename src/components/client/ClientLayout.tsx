import { Outlet, Link, useLocation } from 'react-router-dom'
import { UserRound } from 'lucide-react'
import styles from './ClientLayout.module.css'
import logo from "../../imagenes/logo2.png";

export default function ClientLayout() {
  const location = useLocation()
  const isConfirmation = location.pathname === '/confirmacion' || location.pathname.startsWith('/mi-cita/')

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.logo}>
            <img src={logo} alt="" className={styles.logoImage} />
            <span className={styles.brandName}>ANGEL<span>BARBER SHOP</span></span>
          </Link>
          <nav className={styles.nav} aria-label="Navegaci?n principal">
            {!isConfirmation && (
              <Link to="/admin" className={styles.adminLink} aria-label="Acceso del personal">
                 <UserRound size={17} strokeWidth={2} aria-hidden="true" /><span>Personal</span>
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <p>© 2024 ANGEL BARBER-SHOPS  · Todos los derechos reservados</p>
      </footer>
    </div>
  )
}
