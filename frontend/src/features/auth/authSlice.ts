import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { AuthState, UserRole, UserSummary } from '../../types/auth'
import {
  clearAccessToken,
  clearRefreshToken,
  extractRoleFromToken,
  readAccessToken,
  readRefreshToken,
  saveAccessToken,
  saveRefreshToken,
} from './token'

function buildInitialState(): AuthState {
  const accessToken = readAccessToken()
  const refreshToken = readRefreshToken()
  return {
    accessToken,
    refreshToken,
    role: accessToken ? extractRoleFromToken(accessToken) : null,
    user: null,
  }
}

const initialState = buildInitialState()

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ accessToken: string; refreshToken?: string | null; role: UserRole | null; user?: UserSummary | null }>,
    ) => {
      state.accessToken = action.payload.accessToken
      state.refreshToken = action.payload.refreshToken ?? state.refreshToken
      state.role = action.payload.role
      state.user = action.payload.user ?? state.user
      saveAccessToken(action.payload.accessToken)
      if (action.payload.refreshToken) {
        saveRefreshToken(action.payload.refreshToken)
      }
    },
    setCurrentUser: (state, action: PayloadAction<UserSummary | null>) => {
      state.user = action.payload
    },
    logout: (state) => {
      state.accessToken = null
      state.refreshToken = null
      state.role = null
      state.user = null
      clearAccessToken()
      clearRefreshToken()
      sessionStorage.clear()
    },
  },
})

export const { setCredentials, setCurrentUser, logout } = authSlice.actions
export default authSlice.reducer
