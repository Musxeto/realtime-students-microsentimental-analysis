import { useState } from 'react'
import type { FormEvent } from 'react'
import { BaseModal } from './BaseModal'

interface UpdateAlertConfigModalProps {
  isOpen: boolean
  courseName?: string
  onClose: () => void
  onSubmit: (data: {
    course_id: number
    threshold: number
    duration: number
    enabled: boolean
  }) => Promise<void>
  isLoading?: boolean
  courseId?: number
}

export function UpdateAlertConfigModal({
  isOpen,
  courseName,
  onClose,
  onSubmit,
  isLoading,
  courseId = 0,
}: UpdateAlertConfigModalProps) {
  const [formData, setFormData] = useState({
    threshold: 50,
    duration: 300,
    enabled: true,
  })
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (formData.threshold < 0 || formData.threshold > 100) {
      setError('Threshold must be between 0 and 100')
      return
    }

    if (formData.duration < 1) {
      setError('Duration must be at least 1 second')
      return
    }

    try {
      await onSubmit({
        course_id: courseId,
        threshold: formData.threshold,
        duration: formData.duration,
        enabled: formData.enabled,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update alert configuration')
    }
  }

  return (
    <BaseModal
      isOpen={isOpen}
      title={`Alert Configuration${courseName ? ` - ${courseName}` : ''}`}
      onClose={onClose}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded">{error}</p>}

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="alertEnabled" className="text-sm font-medium text-slate-700">
              Enable alerts for this course
            </label>
            <input
              id="alertEnabled"
              type="checkbox"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label htmlFor="threshold" className="block text-sm font-medium text-slate-700 mb-2">
            Engagement Threshold
          </label>
          <div className="flex items-center gap-3">
            <input
              id="threshold"
              type="range"
              min="0"
              max="100"
              value={formData.threshold}
              onChange={(e) => setFormData({ ...formData, threshold: parseInt(e.target.value) })}
              className="flex-1"
            />
            <span className="w-12 text-right font-semibold text-slate-900">{formData.threshold}%</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Alert when engagement drops below this value</p>
        </div>

        <div>
          <label htmlFor="duration" className="block text-sm font-medium text-slate-700 mb-2">
            Alert Duration (seconds)
          </label>
          <input
            id="duration"
            type="number"
            min="1"
            value={formData.duration}
            onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 1 })}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
            required
          />
          <p className="mt-1 text-xs text-slate-500">How long to display alerts</p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 rounded-lg bg-amber-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:opacity-60"
          >
            {isLoading ? 'Saving...' : 'Save Configuration'}
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
