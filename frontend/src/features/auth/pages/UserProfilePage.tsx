import { useState } from 'react'
import { Lock, LogOut } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import type { RootState } from '../../../app/store'
import { logout } from '../authSlice'
import { useChangePasswordMutation, useLogoutApiMutation } from '../../../services/api/apiSlice'
import { ChangePasswordModal } from '../../../components/modals/ChangePasswordModal'
import { useNavigate } from 'react-router-dom'

export function UserProfilePage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const user = useAppSelector((state: RootState) => state.auth.user)
  const refreshToken = useAppSelector((state: RootState) => state.auth.refreshToken)

  const [changePassword, { isLoading: isChangingPassword }] = useChangePasswordMutation()
  const [logoutApi, { isLoading: isLoggingOut }] = useLogoutApiMutation()

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleChangePassword = async (data: { current_password: string; new_password: string }) => {
    try {
      await changePassword(data).unwrap()
      setMessage({ type: 'success', text: 'Password changed successfully. Please log in again.' })
      setTimeout(() => {
        dispatch(logout())
        navigate('/login', { replace: true })
      }, 2000)
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to change password. Check your current password.',
      })
    }
  }

  const handleLogout = async () => {
    try {
      await logoutApi({ refresh_token: refreshToken ?? undefined }).unwrap()
    } catch {
      // Even if server logout fails, clear local auth
    }
    dispatch(logout())
    navigate('/login', { replace: true })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Profile</h1>
        <p className="mt-1 text-slate-600">Manage your account and security settings</p>
      </div>

      {message && (
        <div
          className={`rounded-lg p-4 text-sm ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Account Information */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Account Information</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</label>
            <p className="mt-1 text-lg text-slate-900">{user?.name || 'N/A'}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</label>
            <p className="mt-1 text-lg text-slate-900">{user?.email || 'N/A'}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</label>
            <p className="mt-1">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
                  user?.role === 'admin'
                    ? 'bg-red-100 text-red-700'
                    : user?.role === 'teacher'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'N/A'}
              </span>
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</label>
            <p className="mt-1">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
                  user?.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {user?.is_active ? 'Active' : 'Inactive'}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Security</h2>
        <p className="mt-2 text-sm text-slate-600">Manage your password and account security</p>

        <div className="mt-6 space-y-4">
          <button
            onClick={() => setIsPasswordModalOpen(true)}
            className="flex w-full items-center gap-3 rounded-lg border border-slate-300 p-4 transition hover:bg-slate-50"
          >
            <Lock className="h-5 w-5 text-slate-600" />
            <div className="flex-1 text-left">
              <p className="font-semibold text-slate-900">Change Password</p>
              <p className="text-xs text-slate-600">Update your password regularly for security</p>
            </div>
            <span className="text-slate-400">→</span>
          </button>

          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex w-full items-center gap-3 rounded-lg border border-red-300 p-4 transition hover:bg-red-50 disabled:opacity-60"
          >
            <LogOut className="h-5 w-5 text-red-600" />
            <div className="flex-1 text-left">
              <p className="font-semibold text-red-700">Logout</p>
              <p className="text-xs text-red-600">End your session across all devices</p>
            </div>
            <span className="text-red-400">{isLoggingOut ? '...' : '→'}</span>
          </button>
        </div>
      </div>

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onSubmit={handleChangePassword}
        isLoading={isChangingPassword}
      />
    </div>
  )
}
