import type { UserRole } from '../../types/auth'

const ACCESS_TOKEN_KEY = 'fyp_access_token'

export function saveAccessToken(token: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, token)
}

export function readAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function clearAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
}

export function extractRoleFromToken(token: string): UserRole | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) {
      return null
    }

    const decoded = JSON.parse(atob(payload)) as { role?: string }
    if (decoded.role === 'admin' || decoded.role === 'teacher') {
      return decoded.role
    }

    return null
  } catch {
    return null
  }
}
