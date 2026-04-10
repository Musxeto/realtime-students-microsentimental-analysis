import { useState } from 'react'
import type { FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { BaseModal } from './BaseModal'

interface ChangePasswordModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { current_password: string; new_password: string }) => Promise<void>
  isLoading?: boolean
}

export function ChangePasswordModal({ isOpen, onClose, onSubmit, isLoading }: ChangePasswordModalProps) {
  const [formData, setFormData] = useState({ current_password: '', new_password: '', confirmPassword: '' })
  const [error, setError] = useState<string | null>(null)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (formData.new_password !== formData.confirmPassword) {
      setError('New passwords do not match')
      return
    }

    if (formData.new_password.length < 4) {
      setError('Password must be at least 4 characters')
      return
    }

    try {
      await onSubmit({
        current_password: formData.current_password,
        new_password: formData.new_password,
      })
      setFormData({ current_password: '', new_password: '', confirmPassword: '' })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password')
    }
  }

  return (
    <BaseModal isOpen={isOpen} title="Change Password" onClose={onClose} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded">{error}</p>}
        
        <div>
          <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-700 mb-2">
            Current Password
          </label>
          <div className="relative">
            <input
              id="currentPassword"
              type={showCurrentPassword ? 'text' : 'password'}
              placeholder="Enter current password"
              value={formData.current_password}
              onChange={(e) => setFormData({ ...formData, current_password: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none"
              required
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition"
            >
              {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700 mb-2">
            New Password
          </label>
          <div className="relative">
            <input
              id="newPassword"
              type={showNewPassword ? 'text' : 'password'}
              placeholder="Enter new password"
              value={formData.new_password}
              onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none"
              required
              minLength={4}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition"
            >
              {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-2">
            Confirm New Password
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Re-enter new password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none"
              required
              minLength={4}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition"
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">Minimum 4 characters</p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {isLoading ? 'Updating...' : 'Update Password'}
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
