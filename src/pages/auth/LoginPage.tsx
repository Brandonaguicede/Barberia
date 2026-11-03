import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, LockKeyhole, LogIn, Mail } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import styles from './LoginPage.module.css'
import logo from '../../imagenes/logo2.png'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username.trim(), password)
      navigate('/admin', { replace: true })
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.root}>
      <section className={styles.card}>
        <div className={styles.logoWrap}>
          <img src={logo} alt="Angel Barber-Shops" className={styles.logo} />
          <h1 className={styles.title}>Acceso administrativo</h1>
          <p className={styles.subtitle}>Ingresa con tus credenciales para gestionar citas, servicios y usuarios.</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="login-email">Correo</label>
            <div className={styles.inputWrap}>
              <Mail size={17} strokeWidth={1.9} className={styles.inputIcon} aria-hidden="true" />
              <input
                className={styles.input}
                type="email"
                id="login-email"
                placeholder="admin@barbershop.test"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="email"
                autoFocus
                required
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="login-password">Contraseña</label>
            <div className={styles.inputWrap}>
              <LockKeyhole size={17} strokeWidth={1.9} className={styles.inputIcon} aria-hidden="true" />
              <input
                className={styles.input}
                type="password"
                id="login-password"
                placeholder="Ingresa tu contrasena"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          {error && (
            <div className={styles.error}>
              <AlertCircle size={18} strokeWidth={2} className={styles.errorIcon} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <button className={styles.btn} type="submit" disabled={loading}>
            <LogIn size={17} strokeWidth={2.2} aria-hidden="true" />
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <a href="/" className={styles.clientLink}>Volver a reservas</a>
      </section>
    </div>
  )
}
