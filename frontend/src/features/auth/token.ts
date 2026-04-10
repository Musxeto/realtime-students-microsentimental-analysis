import type { UserRole } from '../../types/auth'

const ACCESS_TOKEN_KEY = 'fyp_access_token'
const REFRESH_TOKEN_KEY = 'fyp_refresh_token'

export function saveAccessToken(token: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, token)
}

export function saveRefreshToken(token: string) {
  localStorage.setItem(REFRESH_TOKEN_KEY, token)
}

export function readAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function readRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function clearAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
}

export function clearRefreshToken() {
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

function parseBase64Url(input: string) {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`
  return atob(padded)
}

export function extractRoleFromToken(token: string): UserRole | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) {
      return null
    }

    const decoded = JSON.parse(parseBase64Url(payload)) as { role?: string }
    const role = decoded.role?.toLowerCase()
    if (role === 'admin' || role === 'teacher') {
      return role
    }

    return null
  } catch {
    return null
  }
}
