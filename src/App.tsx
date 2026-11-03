import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from './services/toast'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/shared/ProtectedRoute'

import ClientLayout    from './components/client/ClientLayout'
import AdminLayout     from './components/admin/AdminLayout'

import BookingPage      from './pages/client/BookingPage'
import ConfirmationPage from './pages/client/ConfirmationPage'
import PrivateBookingPage from './pages/client/PrivateBookingPage'
const BookingSettingsPage = lazy(() => import('./pages/admin/BookingSettingsPage'))
import { configured } from './services/supabase'
import LoginPage        from './pages/auth/LoginPage'

import AdminDashboard   from './pages/admin/AdminDashboard'
import AdminAppointments from './pages/admin/AdminAppointments'
import AdminBarbers     from './pages/admin/AdminBarbers'
import AdminServices    from './pages/admin/AdminServices'
import AdminUsers       from './pages/admin/AdminUsers'

export default function App() {
  if (!configured) return <main className="setup-message"><h1>Configurar Supabase</h1><p>Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.local para usar las reservas. Consulta docs/setup.md.</p></main>
  return (
    <AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-elevated)',
            color: 'var(--text)',
            border: '1px solid var(--border-light)',
            fontFamily: 'var(--font-body)',
          },
          success: { iconTheme: { primary: 'var(--green)', secondary: 'var(--bg)' } },
          error:   { iconTheme: { primary: '#e05555', secondary: '#0a0a0a' } },
        }}
      />
      <Routes>
        {/* Public client routes */}
        <Route path="/" element={<ClientLayout />}>
          <Route index element={<BookingPage />} />
          <Route path="mi-cita/:token" element={<PrivateBookingPage />} />
          <Route path="confirmacion" element={<ConfirmationPage />} />
        </Route>

        {/* Login */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected admin routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          {/* Dashboard — admin only, barbers redirect to /admin/citas */}
          <Route index element={
            <ProtectedRoute adminOnly>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="configuracion" element={<Suspense fallback={<p role="status" className="muted">Cargando agenda…</p>}><BookingSettingsPage /></Suspense>} />
          <Route path="citas"     element={<AdminAppointments />} />
          <Route path="barberos"  element={
            <ProtectedRoute adminOnly><AdminBarbers /></ProtectedRoute>
          } />
          <Route path="servicios" element={
            <ProtectedRoute adminOnly><AdminServices /></ProtectedRoute>
          } />
          <Route path="usuarios"  element={
            <ProtectedRoute adminOnly><AdminUsers /></ProtectedRoute>
          } />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
