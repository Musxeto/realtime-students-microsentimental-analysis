import { useState } from 'react'
import type { FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { BaseModal } from './BaseModal'

interface ResetPasswordModalProps {
  isOpen: boolean
  teacherName?: string
  onClose: () => void
  onSubmit: (newPassword: string) => Promise<void>
  isLoading?: boolean
}

export function ResetPasswordModal({ isOpen, teacherName, onClose, onSubmit, isLoading }: ResetPasswordModalProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (password.length < 4) {
      setError('Password must be at least 4 characters')
      return
    }

    try {
      await onSubmit(password)
      setPassword('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
    }
  }

  return (
    <BaseModal isOpen={isOpen} title={`Reset Password${teacherName ? ` - ${teacherName}` : ''}`} onClose={onClose} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded">{error}</p>}
        
        <div>
          <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700 mb-2">
            New Temporary Password
          </label>
          <div className="relative">
            <input
              id="newPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none"
              required
              minLength={4}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">Minimum 4 characters</p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 rounded-lg bg-amber-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:opacity-60"
          >
            {isLoading ? 'Resetting...' : 'Reset Password'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </BaseModal>
  )
}
