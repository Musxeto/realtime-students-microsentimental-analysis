import { Moon, Sun } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { toggleTheme } from './themeSlice'

interface ThemeToggleProps {
  compact?: boolean
}

export function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const dispatch = useAppDispatch()
  const mode = useAppSelector((state) => state.theme.mode)
  const isDark = mode === 'dark'

  return (
    <button
      type="button"
      onClick={() => dispatch(toggleTheme())}
      className={[
        'inline-flex items-center gap-2 rounded-lg border border-border bg-card text-card-foreground transition hover:bg-primary/10',
        compact ? 'px-2.5 py-1.5 text-xs font-medium' : 'px-3 py-2 text-sm font-semibold',
      ].join(' ')}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span>{isDark ? 'Light' : 'Dark'}</span>
    </button>
  )
}
