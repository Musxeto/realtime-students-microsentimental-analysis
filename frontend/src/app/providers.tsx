import { useEffect } from 'react'
import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAppSelector } from './hooks'
import { ConfirmProvider } from './confirm'
import { store } from './store'
import { router } from './router'
import { THEME_STORAGE_KEY } from '../features/theme/themeSlice'

function ThemeSynchronizer() {
  const mode = useAppSelector((state) => state.theme.mode)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark')
    localStorage.setItem(THEME_STORAGE_KEY, mode)
  }, [mode])

  return null
}

export function AppProviders() {
  return (
    <Provider store={store}>
      <ThemeSynchronizer />
      <ConfirmProvider>
        <RouterProvider router={router} />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#0f172a',
              color: '#f8fafc',
              border: '1px solid #1e293b',
            },
          }}
        />
      </ConfirmProvider>
    </Provider>
  )
}
