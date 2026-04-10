export type UserRole = 'admin' | 'teacher'

export interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  role: UserRole | null
  user: UserSummary | null
}

export interface LoginRequest {
  email?: string
  username?: string
  password: string
}

export interface UserSummary {
  id: number
  name: string
  email: string
  role: string
  is_active?: boolean
}

export interface LoginResponse {
  access_token: string
  refresh_token?: string
  token_type?: string
  user?: UserSummary
}
