import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAppSelector } from '../../app/hooks'
import type { UserRole } from '../../types/auth'

interface ProtectedRouteProps extends PropsWithChildren {
  allow: UserRole[]
}

export function ProtectedRoute({ allow, children }: ProtectedRouteProps) {
  const role = useAppSelector((state) => state.auth.role)
  const location = useLocation()

  if (!role) {
    return <Navigate replace to="/login" state={{ from: location }} />
  }

  if (!allow.includes(role)) {
    const fallback = role === 'admin' ? '/admin' : '/dashboard'
    return <Navigate replace to={fallback} />
  }

  return <>{children}</>
}
