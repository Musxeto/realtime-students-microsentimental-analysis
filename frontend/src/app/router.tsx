import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useAppSelector } from './hooks'
import { AppLayout } from '../components/layout/AppLayout'
import { AdminDashboardPage } from '../features/admin/pages/AdminDashboardPage'
import { LoginPage } from '../features/auth/pages/LoginPage'
import { ProtectedRoute } from '../features/auth/ProtectedRoute'
import { LiveSessionPage } from '../features/live-session/pages/LiveSessionPage'
import { SessionStartPage } from '../features/live-session/pages/SessionStartPage'
import { TeacherDashboardPage } from '../features/teacher/pages/TeacherDashboardPage'

function HomeRedirect() {
  const role = useAppSelector((state) => state.auth.role)
  if (role === 'admin') {
    return <Navigate to="/admin" replace />
  }
  if (role === 'teacher') {
    return <Navigate to="/dashboard" replace />
  }
  return <Navigate to="/login" replace />
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <HomeRedirect />,
      },
      {
        path: 'admin',
        element: (
          <ProtectedRoute allow={['admin']}>
            <AdminDashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute allow={['teacher', 'admin']}>
            <TeacherDashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'session/start',
        element: (
          <ProtectedRoute allow={['teacher', 'admin']}>
            <SessionStartPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'session/:id',
        element: (
          <ProtectedRoute allow={['teacher', 'admin']}>
            <LiveSessionPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])
