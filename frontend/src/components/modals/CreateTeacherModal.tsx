import { useState } from 'react'
import type { FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { BaseModal } from './BaseModal'

interface CreateTeacherModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { name: string; email: string; password: string; courseNames: string }) => Promise<void>
  isLoading?: boolean
}

export function CreateTeacherModal({ isOpen, onClose, onSubmit, isLoading }: CreateTeacherModalProps) {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', courseNames: '' })
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    try {
      await onSubmit(formData)
      setFormData({ name: '', email: '', password: '', courseNames: '' })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create teacher')
    }
  }

  return (
    <BaseModal isOpen={isOpen} title="Add New Teacher" onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded">{error}</p>}
        
        <input
          type="text"
          placeholder="Full name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
          required
        />
        
        <input
          type="email"
          placeholder="Email address"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
          required
        />
        
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Temporary password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        
        <input
          type="text"
          placeholder="Initial courses (comma-separated)"
          value={formData.courseNames}
          onChange={(e) => setFormData({ ...formData, courseNames: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {isLoading ? 'Creating...' : 'Create Teacher'}
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
