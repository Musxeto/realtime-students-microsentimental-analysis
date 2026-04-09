import { configureStore } from '@reduxjs/toolkit'
import { apiSlice } from '../services/api/apiSlice'
import authReducer from '../features/auth/authSlice.ts'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiSlice.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
