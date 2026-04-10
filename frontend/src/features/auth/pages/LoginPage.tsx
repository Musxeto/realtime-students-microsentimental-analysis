import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { useLoginMutation } from '../../../services/api/apiSlice'
import { setCredentials } from '../authSlice'
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
    <div className="flex min-h-[80vh] items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-card"
      >
        <h1 className="text-2xl font-semibold text-slate-900">Welcome Back</h1>
        <p className="mt-1 text-sm text-slate-600">Sign in to continue to your classroom dashboard.</p>

        <label className="mt-6 block text-sm font-medium text-slate-700" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
          autoComplete="email"
          required
        />

        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
          autoComplete="current-password"
          required
        />

        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

        <button
          type="submit"
          className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
          disabled={isLoading}
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}
