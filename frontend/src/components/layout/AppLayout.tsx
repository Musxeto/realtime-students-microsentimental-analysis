import { BarChart3, BookOpenCheck, ShieldCheck, Video } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { logout } from '../../features/auth/authSlice'
import { useChangePasswordMutation, useLogoutApiMutation } from '../../services/api/apiSlice'

const navItems = [
  { to: '/admin', label: 'Admin', icon: ShieldCheck },
  { to: '/dashboard', label: 'Teacher', icon: BookOpenCheck },
  { to: '/session/start', label: 'Start Session', icon: Video },
]

export function AppLayout() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [logoutApi] = useLogoutApiMutation()
  const [changePassword, { isLoading: isChangingPassword }] = useChangePasswordMutation()
  const role = useAppSelector((state) => state.auth.role)
  const refreshToken = useAppSelector((state) => state.auth.refreshToken)
  const visibleItems = navItems.filter((item) => item.to !== '/admin' || role === 'admin')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null)

  async function onLogout() {
    try {
      await logoutApi({ refresh_token: refreshToken ?? undefined }).unwrap()
    } catch {
      // Even if server logout fails, clear local auth.
    }
    dispatch(logout())
    navigate('/login', { replace: true })
  }

  async function onChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordMsg(null)
    try {
      await changePassword({ current_password: currentPassword, new_password: newPassword }).unwrap()
      setPasswordMsg('Password updated. Please log in again.')
      dispatch(logout())
      navigate('/login', { replace: true })
    } catch {
      setPasswordMsg('Password update failed. Check current password and try again.')
    }
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

        <main className="fade-in-up space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-card">
            <h2 className="text-sm font-semibold text-slate-900">Account Security</h2>
            <form className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={onChangePassword}>
              <input
                type="password"
                className="rounded-lg border px-3 py-2 text-sm"
                placeholder="Current password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
              <input
                type="password"
                className="rounded-lg border px-3 py-2 text-sm"
                placeholder="New password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
              <button
                type="submit"
                disabled={isChangingPassword}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isChangingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </form>
            {passwordMsg ? <p className="mt-2 text-xs text-slate-600">{passwordMsg}</p> : null}
          </section>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
