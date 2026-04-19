import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Activity, BookOpenText, GraduationCap, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { useLoginMutation } from '../../../services/api/apiSlice'
import { setCredentials } from '../authSlice'
import { ThemeToggle } from '../../theme/ThemeToggle'
import { extractRoleFromToken } from '../token'
import type { UserRole } from '../../../types/auth'

export function LoginPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const role = useAppSelector((state) => state.auth.role)
  const [login, { isLoading }] = useLoginMutation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (role === 'admin') {
      navigate('/admin', { replace: true })
      return
    }
    if (role === 'teacher') {
      navigate('/dashboard', { replace: true })
    }
  }, [navigate, role])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    try {
      const result = await login({ email, password }).unwrap()
      const roleFromUser = result.user?.role?.toLowerCase()
      const normalizedRole: UserRole | null =
        roleFromUser === 'admin' || roleFromUser === 'teacher'
          ? roleFromUser
          : extractRoleFromToken(result.access_token)

      dispatch(
        setCredentials({
          accessToken: result.access_token,
          refreshToken: result.refresh_token,
          role: normalizedRole,
          user: result.user ?? null,
        }),
      )

      if (normalizedRole === 'admin') {
        navigate('/admin')
        return
      }

      navigate('/dashboard')
    } catch {
      setError('Invalid credentials. Please try again.')
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-8 md:px-8 lg:py-12">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="panel-glow rounded-3xl border border-border/70 bg-card/90 p-6 shadow-card backdrop-blur md:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            ClassPulse
          </div>
          <h1 className="mt-6 text-3xl font-bold leading-tight text-foreground md:text-5xl">
            Live classroom focus intelligence for every session.
          </h1>
          <p className="mt-4 max-w-xl text-sm text-foreground/75 md:text-base">
            Track engagement trends in real time, review class behavior summaries, and keep your teaching decisions data-driven.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <Activity className="h-5 w-5 text-primary" />
              <p className="mt-2 text-sm font-semibold text-foreground">Live Session Analytics</p>
              <p className="mt-1 text-xs text-foreground/70">Monitor engagement and distraction signals frame by frame.</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <BookOpenText className="h-5 w-5 text-success" />
              <p className="mt-2 text-sm font-semibold text-foreground">Course Insights</p>
              <p className="mt-1 text-xs text-foreground/70">See performance by course, section, and session history.</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <GraduationCap className="h-5 w-5 text-warning" />
              <p className="mt-2 text-sm font-semibold text-foreground">Teacher Performance</p>
              <p className="mt-1 text-xs text-foreground/70">Understand trends and improve classroom outcomes.</p>
            </div>
          </div>
        </section>

        <section className="fade-in-up rounded-3xl border border-border/80 bg-card p-6 shadow-card md:p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Welcome back</p>
              <h2 className="mt-1 text-2xl font-bold text-foreground">Sign in to ClassPulse</h2>
            </div>
            <ThemeToggle />
          </div>

          <form onSubmit={handleSubmit} className="mt-8">
            <label className="block text-sm font-medium text-foreground/85" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none ring-primary focus:ring-2"
              autoComplete="email"
              placeholder="you@school.edu"
              required
            />

            <label className="mt-4 block text-sm font-medium text-foreground/85" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none ring-primary focus:ring-2"
              autoComplete="current-password"
              placeholder="Enter your password"
              required
            />

            {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

            <button
              type="submit"
              className="mt-6 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-foreground/65">Secure access for Admin and Teacher accounts.</p>
        </section>
      </div>
    </div>
  )
}
