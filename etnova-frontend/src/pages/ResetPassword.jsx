import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import supabase from '../config/supabaseClient'
import { apiRequest } from '../config/apiClient'

const ACCENT_COLOR = '#00D2C4'
const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/
const PASSWORD_HELPER_TEXT = 'Use at least 8 characters with uppercase, lowercase, and a number.'

function buildPasswordChecks(password) {
  const value = String(password || '')
  return [
    { key: 'length', label: 'At least 8 characters', met: value.length >= 8 },
    { key: 'uppercase', label: 'One uppercase letter', met: /[A-Z]/.test(value) },
    { key: 'lowercase', label: 'One lowercase letter', met: /[a-z]/.test(value) },
    { key: 'number', label: 'One number', met: /\d/.test(value) },
  ]
}

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const passwordChecks = buildPasswordChecks(password)

  useEffect(() => {
    let mounted = true

    const hydrateRecoverySession = async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError

        if (mounted) {
          setReady(Boolean(data?.session?.user))
          setChecking(false)
        }
      } catch (nextError) {
        if (mounted) {
          setError(nextError.message || 'Unable to validate the reset link.')
          setChecking(false)
        }
      }
    }

    hydrateRecoverySession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!['PASSWORD_RECOVERY', 'SIGNED_IN', 'INITIAL_SESSION', 'USER_UPDATED'].includes(event)) {
        return
      }

      if (mounted) {
        setReady(Boolean(session?.user))
        setChecking(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!PASSWORD_RULE.test(password)) {
      setError(PASSWORD_HELPER_TEXT)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError

      try {
        await apiRequest('/profile', {
          method: 'PUT',
          body: {
            account_status: 'active',
            is_active: true,
          },
        })
      } catch (profileError) {
        console.error('Failed to update account status after password reset:', profileError)
      }

      setNotice('Password updated successfully. Redirecting to sign in...')
      await supabase.auth.signOut({ scope: 'local' })
      setTimeout(() => navigate('/signin?reset=success', { replace: true }), 900)
    } catch (nextError) {
      setError(nextError.message || 'Unable to update password right now.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F8F8] px-6 py-10 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center justify-center">
        <div className="w-full rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_-30px_rgba(15,35,34,0.25)] sm:p-10">
          <div className="mb-8 flex items-center gap-3">
            <div
              className="flex size-11 items-center justify-center rounded-xl text-black"
              style={{ backgroundColor: ACCENT_COLOR }}
            >
              <span className="material-symbols-outlined">password</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Set a new password</h1>
              <p className="text-sm text-slate-500">Use the secure link from your email to create or reset your ETNOVA password.</p>
            </div>
          </div>

          {notice && (
            <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {notice}
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {checking ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
              Validating your reset link...
            </div>
          ) : ready ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-800">
                  New password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 outline-none transition focus:border-teal-400 focus:bg-white"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <span className="material-symbols-outlined">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  {passwordChecks.map((rule) => (
                    <div key={rule.key} className="flex items-center gap-2 text-xs">
                      <span
                        className={`material-symbols-outlined text-sm ${rule.met ? 'text-emerald-600' : 'text-slate-400'}`}
                      >
                        {rule.met ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                      <span className={rule.met ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                        {rule.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="mb-2 block text-sm font-semibold text-slate-800">
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 outline-none transition focus:border-teal-400 focus:bg-white"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    <span className="material-symbols-outlined">
                      {showConfirmPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl px-4 py-3 font-semibold text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: ACCENT_COLOR }}
                disabled={submitting}
              >
                {submitting ? 'Updating password...' : 'Save Password'}
              </button>
            </form>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-800">
              This reset link is no longer valid or the recovery session could not be established. Please request a new password reset link from the sign-in page.
            </div>
          )}

          <div className="mt-6 text-sm text-slate-500">
            <Link to="/signin" className="font-medium text-teal-600 hover:underline">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
