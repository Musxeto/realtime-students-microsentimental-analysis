import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export type ThemeMode = 'light' | 'dark'

const THEME_STORAGE_KEY = 'classpulse_theme'

function getInitialTheme(): ThemeMode {
  const persistedRaw = localStorage.getItem(THEME_STORAGE_KEY)
  const persisted = persistedRaw ? String(persistedRaw).trim().toLowerCase() : null
  if (persisted === 'light' || persisted === 'dark') {
    return persisted as ThemeMode
  }

  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

interface ThemeState {
  mode: ThemeMode
}

const initialState: ThemeState = {
  mode: getInitialTheme(),
}

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<ThemeMode>) => {
      state.mode = action.payload
    },
    toggleTheme: (state) => {
      state.mode = state.mode === 'dark' ? 'light' : 'dark'
    },
  },
})

export const { setTheme, toggleTheme } = themeSlice.actions
export { THEME_STORAGE_KEY }
export default themeSlice.reducer
