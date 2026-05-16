import { useState } from 'react'
import type { FormEvent } from 'react'
import { BaseModal } from './BaseModal'

interface UpdateAISettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { update_interval_seconds: number }) => Promise<void>
  isLoading?: boolean
  initialUpdateIntervalSeconds?: number
}

export function UpdateAISettingsModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  initialUpdateIntervalSeconds = 60,
}: UpdateAISettingsModalProps) {
  const [formData, setFormData] = useState({ updateIntervalSeconds: initialUpdateIntervalSeconds })
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (formData.updateIntervalSeconds < 60) {
      setError('Update interval must be at least 60 seconds')
      return
    }

    try {
      await onSubmit({ update_interval_seconds: formData.updateIntervalSeconds })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update AI settings')
    }
  }

  return (
    <BaseModal isOpen={isOpen} title="AI Update Settings" onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded bg-red-50 p-3 text-sm text-red-600">{error}</p>}

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-900">OpenAI provider</p>
          <p className="mt-1">Pedagogical intervention messages are generated with the server-side OpenAI API key.</p>
        </div>

        <div>
          <label htmlFor="updateIntervalSeconds" className="mb-2 block text-sm font-medium text-slate-700">
            Update interval (seconds)
          </label>
          <input
            id="updateIntervalSeconds"
            type="number"
            min="60"
            step="1"
            value={formData.updateIntervalSeconds}
            onChange={(e) =>
              setFormData({ updateIntervalSeconds: Number.parseInt(e.target.value || '60', 10) || 60 })
            }
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
            required
          />
          <p className="mt-1 text-xs text-slate-500">Minimum 60 seconds. Higher values reduce how often updates are sent.</p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {isLoading ? 'Saving...' : 'Save Settings'}
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
