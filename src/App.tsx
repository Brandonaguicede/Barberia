import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/shared/ProtectedRoute'

import ClientLayout    from './components/client/ClientLayout'
import AdminLayout     from './components/admin/AdminLayout'

import BookingPage      from './pages/client/BookingPage'
import ConfirmationPage from './pages/client/ConfirmationPage'
import LoginPage        from './pages/auth/LoginPage'

import AdminDashboard   from './pages/admin/AdminDashboard'
import AdminAppointments from './pages/admin/AdminAppointments'
import AdminBarbers     from './pages/admin/AdminBarbers'
import AdminServices    from './pages/admin/AdminServices'
import AdminUsers       from './pages/admin/AdminUsers'

export default function App() {
  return (
    <AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a1a1a',
            color: '#f0ece4',
            border: '1px solid #2a2a2a',
            fontFamily: 'DM Sans, sans-serif',
          },
          success: { iconTheme: { primary: '#c9a84c', secondary: '#0a0a0a' } },
          error:   { iconTheme: { primary: '#e05555', secondary: '#0a0a0a' } },
        }}
      />
      <Routes>
        {/* Public client routes */}
        <Route path="/" element={<ClientLayout />}>
          <Route index element={<BookingPage />} />
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
