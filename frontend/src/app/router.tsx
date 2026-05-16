import { Suspense, lazy } from 'react'
import type { ReactElement } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useAppSelector } from './hooks'
import { AppLayout } from '../components/layout/AppLayout'
import { ProtectedRoute } from '../features/auth/ProtectedRoute'

const LoginPage = lazy(() => import('../features/auth/pages/LoginPage').then((module) => ({ default: module.LoginPage })))
const UserProfilePage = lazy(() => import('../features/auth/pages/UserProfilePage').then((module) => ({ default: module.UserProfilePage })))
const AdminDashboardPage = lazy(() => import('../features/admin/pages/AdminDashboardPage').then((module) => ({ default: module.AdminDashboardPage })))
const TeacherProjectPage = lazy(() => import('../features/admin/pages/TeacherProjectPage').then((module) => ({ default: module.TeacherProjectPage })))
const TeacherDashboardPage = lazy(() => import('../features/teacher/pages/TeacherDashboardPage').then((module) => ({ default: module.TeacherDashboardPage })))
const TeacherCoursesPage = lazy(() => import('../features/teacher/pages/TeacherCoursesPage').then((module) => ({ default: module.TeacherCoursesPage })))
const CourseHistoryPage = lazy(() => import('../features/teacher/pages/CourseHistoryPage').then((module) => ({ default: module.CourseHistoryPage })))
const TeacherSessionsPage = lazy(() => import('../features/teacher/pages/TeacherSessionsPage').then((module) => ({ default: module.TeacherSessionsPage })))
const TeacherAnalyticsPage = lazy(() => import('../features/teacher/pages/TeacherAnalyticsPage').then((module) => ({ default: module.TeacherAnalyticsPage })))
const SessionStartPage = lazy(() => import('../features/live-session/pages/SessionStartPage').then((module) => ({ default: module.SessionStartPage })))
const LiveSessionPage = lazy(() => import('../features/live-session/pages/LiveSessionPage').then((module) => ({ default: module.LiveSessionPage })))
const SessionSummaryPage = lazy(() => import('../features/live-session/pages/SessionSummaryPage').then((module) => ({ default: module.SessionSummaryPage })))

function PageLoader() {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-6 text-sm text-slate-500 shadow-card">
      Loading dashboard...
    </div>
  )
}

function withSuspense(element: ReactElement) {
  return <Suspense fallback={<PageLoader />}>{element}</Suspense>
}

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
    element: withSuspense(<LoginPage />),
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
        path: 'profile',
        element: withSuspense(
          <ProtectedRoute allow={['teacher', 'admin']}>
            <UserProfilePage />
          </ProtectedRoute>,
        ),
      },
      {
        path: 'admin',
        element: withSuspense(
          <ProtectedRoute allow={['admin']}>
            <AdminDashboardPage />
          </ProtectedRoute>,
        ),
      },
      {
        path: 'admin/teachers/:teacherId',
        element: withSuspense(
          <ProtectedRoute allow={['admin']}>
            <TeacherProjectPage />
          </ProtectedRoute>,
        ),
      },
      {
        path: 'dashboard',
        element: withSuspense(
          <ProtectedRoute allow={['teacher', 'admin']}>
            <TeacherDashboardPage />
          </ProtectedRoute>,
        ),
      },
      {
        path: 'teacher/courses',
        element: withSuspense(
          <ProtectedRoute allow={['teacher', 'admin']}>
            <TeacherCoursesPage />
          </ProtectedRoute>,
        ),
      },
      {
        path: 'teacher/courses/:id/history',
        element: withSuspense(
          <ProtectedRoute allow={['teacher', 'admin']}>
            <CourseHistoryPage />
          </ProtectedRoute>,
        ),
      },
      {
        path: 'teacher/sessions',
        element: withSuspense(
          <ProtectedRoute allow={['teacher', 'admin']}>
            <TeacherSessionsPage />
          </ProtectedRoute>,
        ),
      },
      {
        path: 'teacher/analytics',
        element: withSuspense(
          <ProtectedRoute allow={['teacher', 'admin']}>
            <TeacherAnalyticsPage />
          </ProtectedRoute>,
        ),
      },
      {
        path: 'session/start',
        element: withSuspense(
          <ProtectedRoute allow={['teacher']}>
            <SessionStartPage />
          </ProtectedRoute>,
        ),
      },
      {
        path: 'session/:id',
        element: withSuspense(
          <ProtectedRoute allow={['teacher', 'admin']}>
            <LiveSessionPage />
          </ProtectedRoute>,
        ),
      },
      {
        path: 'session/:id/summary',
        element: withSuspense(
          <ProtectedRoute allow={['teacher', 'admin']}>
            <SessionSummaryPage />
          </ProtectedRoute>,
        ),
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])
