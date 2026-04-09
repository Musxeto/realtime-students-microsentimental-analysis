import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { AuthState, UserRole } from '../../types/auth'
import {
  clearAccessToken,
  extractRoleFromToken,
  readAccessToken,
  saveAccessToken,
} from './token'

function buildInitialState(): AuthState {
  const token = readAccessToken()
  return {
    accessToken: token,
    role: token ? extractRoleFromToken(token) : null,
  }
}

const initialState = buildInitialState()

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ accessToken: string; role: UserRole | null }>,
    ) => {
      state.accessToken = action.payload.accessToken
      state.role = action.payload.role
      saveAccessToken(action.payload.accessToken)
    },
    logout: (state) => {
      state.accessToken = null
      state.role = null
      clearAccessToken()
    },
  },
})

export const { setCredentials, logout } = authSlice.actions
export default authSlice.reducer
