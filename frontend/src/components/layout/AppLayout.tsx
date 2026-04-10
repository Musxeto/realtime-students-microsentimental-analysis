import { BarChart3, BookOpenCheck, ClipboardList, LineChart, ShieldCheck, User, Video } from 'lucide-react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { logout } from '../../features/auth/authSlice'
import { useLogoutApiMutation } from '../../services/api/apiSlice'

type AppRole = 'admin' | 'teacher'

interface NavItem {
  to: string
  label: string
  icon: typeof ShieldCheck
  roles: AppRole[]
}

const navItems: NavItem[] = [
  { to: '/admin', label: 'Admin', icon: ShieldCheck, roles: ['admin'] },
  { to: '/dashboard', label: 'Teacher Home', icon: BookOpenCheck, roles: ['teacher', 'admin'] },
  { to: '/teacher/courses', label: 'My Courses', icon: BookOpenCheck, roles: ['teacher', 'admin'] },
  { to: '/teacher/sessions', label: 'My Sessions', icon: ClipboardList, roles: ['teacher', 'admin'] },
  { to: '/teacher/analytics', label: 'My Analytics', icon: LineChart, roles: ['teacher', 'admin'] },
  { to: '/session/start', label: 'Start Session', icon: Video, roles: ['teacher', 'admin'] },
]

export function AppLayout() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [logoutApi] = useLogoutApiMutation()
  const role = useAppSelector((state) => state.auth.role)
  const refreshToken = useAppSelector((state) => state.auth.refreshToken)
  const visibleItems = navItems.filter((item) => !!role && item.roles.includes(role))

  async function onLogout() {
    try {
      await logoutApi({ refresh_token: refreshToken ?? undefined }).unwrap()
    } catch {
      // Even if server logout fails, clear local auth.
    }
    dispatch(logout())
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/75 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 text-slate-900">
            <BarChart3 className="size-5 text-primary" />
            <span className="text-sm font-semibold tracking-wide">ClassPulse Command Center</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium uppercase text-primary">
              {role ?? 'guest'}
            </span>
            <Link
              to="/profile"
              className="rounded-lg border border-slate-300 p-1.5 text-slate-700 transition hover:bg-white"
              title="Profile"
            >
              <User className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[230px_1fr]">
        <aside className="panel-glow fade-in-up rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-card">
          <nav className="space-y-1">
            {visibleItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-slate-700 hover:bg-primary/5',
                  ].join(' ')
                }
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="fade-in-up">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
