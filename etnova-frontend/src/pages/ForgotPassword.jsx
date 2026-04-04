import { useState } from 'react'
import { Link } from 'react-router-dom'
import supabase from '../config/supabaseClient'
import { resolveAuthEmail } from '../utils/authEmailResolution'

const ACCENT_COLOR = '#00D2C4'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setSubmitting(true)

    try {
      const resolvedEmail = await resolveAuthEmail(email)
      const redirectTo = `${window.location.origin}/reset-password`
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(resolvedEmail.authEmail, {
        redirectTo,
      })

      if (resetError) throw resetError

      setNotice('Password reset link sent. Please check your email and open the ETNOVA reset link.')
    } catch (nextError) {
      setError(nextError.message || 'Unable to send reset link right now.')
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
              <span className="material-symbols-outlined">lock_reset</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>
              <p className="text-sm text-slate-500">We will send a secure password reset link to the email linked with your ETNOVA account.</p>
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

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-800">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-400 focus:bg-white"
                autoComplete="email"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl px-4 py-3 font-semibold text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: ACCENT_COLOR }}
              disabled={submitting}
            >
              {submitting ? 'Sending reset link...' : 'Send Reset Link'}
            </button>
          </form>

          <div className="mt-6 text-sm text-slate-500">
            Remembered your password?{' '}
            <Link to="/signin" className="font-medium text-teal-600 hover:underline">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
