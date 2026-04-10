import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { BaseModal } from '../components/modals/BaseModal'

interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

interface ConfirmState {
  title: string
  message: string
  confirmText: string
  cancelText: string
  destructive: boolean
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null)
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const closeWith = useCallback((value: boolean) => {
    if (resolverRef.current) {
      resolverRef.current(value)
      resolverRef.current = null
    }
    setState(null)
  }, [])

  const confirm = useCallback<ConfirmFn>((options) => {
    if (resolverRef.current) {
      resolverRef.current(false)
      resolverRef.current = null
    }

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
      setState({
        title: options.title ?? 'Please confirm',
        message: options.message,
        confirmText: options.confirmText ?? 'Confirm',
        cancelText: options.cancelText ?? 'Cancel',
        destructive: options.destructive ?? false,
      })
    })
  }, [])

  const contextValue = useMemo(() => confirm, [confirm])

  return (
    <ConfirmContext.Provider value={contextValue}>
      {children}
      <BaseModal
        isOpen={!!state}
        title={state?.title ?? 'Please confirm'}
        onClose={() => closeWith(false)}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700">{state?.message}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => closeWith(false)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {state?.cancelText ?? 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => closeWith(true)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold text-white ${state?.destructive ? 'bg-rose-600 hover:bg-rose-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}
            >
              {state?.confirmText ?? 'Confirm'}
            </button>
          </div>
        </div>
      </BaseModal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const value = useContext(ConfirmContext)
  if (!value) {
    throw new Error('useConfirm must be used within ConfirmProvider')
  }
  return value
}
