import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch } from '../../../app/hooks'
import { useLoginMutation } from '../../../services/api/apiSlice'
import { setCredentials } from '../authSlice'
import { extractRoleFromToken } from '../token'

export function LoginPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [login, { isLoading }] = useLoginMutation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    try {
      const result = await login({ username, password }).unwrap()
      const role = extractRoleFromToken(result.access_token)

      dispatch(setCredentials({ accessToken: result.access_token, role }))

      if (role === 'admin') {
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

        <label className="mt-6 block text-sm font-medium text-slate-700" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
          autoComplete="username"
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
