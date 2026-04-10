import { X } from 'lucide-react'
import type { ReactNode } from 'react'

interface BaseModalProps {
  isOpen: boolean
  title: string
  onClose: () => void
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function BaseModal({ isOpen, title, onClose, children, size = 'md' }: BaseModalProps) {
  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className={`w-full ${sizeClasses[size]} rounded-lg border border-slate-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-slate-100 transition"
            aria-label="Close modal"
          >
            <X className="h-5 w-5 text-slate-600" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
