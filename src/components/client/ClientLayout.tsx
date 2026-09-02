import { Outlet, Link, useLocation } from 'react-router-dom'
import { UserRound } from 'lucide-react'
import styles from './ClientLayout.module.css'
import logo from "../../imagenes/logo2.png";

export default function ClientLayout() {
  const location = useLocation()
  const isConfirmation = location.pathname === '/confirmacion'

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.logo}>
           <div className={styles.logoContainer}>
  <img src={logo} alt="logo"  width={90}/>
</div>
          </Link>
          <nav className={styles.nav}>
            {!isConfirmation && (
              <Link to="/admin" className={styles.adminLink}>
                 <UserRound size={18} strokeWidth={2} aria-hidden="true" />
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
