import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

interface Props {
  children: React.ReactNode
  adminOnly?: boolean
}

export default function ProtectedRoute({ children, adminOnly = false }: Props) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'var(--bg)'
      }}>
        <div className="spinner" />
      </div>
    )
  }

  // Not logged in → go to login
  if (!user) return <Navigate to="/login" replace />

  // Barber tries to access admin-only page → redirect to their citas
  if (adminOnly && user.role !== 'Admin') {
    return <Navigate to="/admin/citas" replace />
  }

  return <>{children}</>
}
