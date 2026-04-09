export type UserRole = 'admin' | 'teacher'

export interface AuthState {
  accessToken: string | null
  role: UserRole | null
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  access_token: string
  token_type?: string
}
