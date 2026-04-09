import { BarChart3, BookOpenCheck, ShieldCheck, Video } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAppSelector } from '../../app/hooks'

const navItems = [
  { to: '/admin', label: 'Admin', icon: ShieldCheck },
  { to: '/dashboard', label: 'Teacher', icon: BookOpenCheck },
  { to: '/session/start', label: 'Start Session', icon: Video },
]

export function AppLayout() {
  const role = useAppSelector((state) => state.auth.role)

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 text-slate-900">
            <BarChart3 className="size-5 text-indigo-600" />
            <span className="text-sm font-semibold tracking-wide">ClassPulse Analytics</span>
          </Link>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium uppercase text-indigo-700">
            {role ?? 'guest'}
          </span>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[230px_1fr]">
        <aside className="rounded-xl border bg-white p-3 shadow-card">
          <nav className="space-y-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-700 hover:bg-slate-100',
                  ].join(' ')
                }
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
