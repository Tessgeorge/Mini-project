import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import supabase from '../config/supabaseClient'
import { useAuth } from '../context/AuthContext'

const ACCENT_COLOR = '#00D2C4'

const ROLE_ROUTES = {
  student: '/student/dashboard',
  mentor: '/mentor',
  admin: '/admin',
}

export default function SignIn() {
  const navigate = useNavigate()
  const { user, role, loading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [authError, setAuthError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [pendingRedirect, setPendingRedirect] = useState(false)

  useEffect(() => {
    if (!pendingRedirect) return
    if (authLoading) return

    if (user && role) {
      const destination = ROLE_ROUTES[String(role).toLowerCase()]
      if (destination) {
        navigate(destination, { replace: true })
        return
      }
    }

    setAuthError('Your role is not assigned yet. Please contact support.')
    setPendingRedirect(false)
    setIsLoading(false)
  }, [authLoading, navigate, pendingRedirect, role, user])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setAuthError('')
    setIsLoading(true)
    setPendingRedirect(false)

    try {
      const {
        data: authData,
        error: signInError,
      } = await supabase.auth.signInWithPassword({ email, password })

      if (signInError) {
        throw signInError
      }

      const userId = authData?.user?.id

      if (!userId) {
        throw new Error('Unable to determine user identity. Please try again.')
      }

      setPendingRedirect(true)
    } catch (error) {
      setAuthError(error.message ?? 'Unable to sign in right now.')
      setPendingRedirect(false)
      setIsLoading(false)
      console.error('Sign-in failed:', error)
    }
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-[#F4F8F8] text-slate-900">
      {/* Left Panel: Branding & Imagery */}
      <div className="relative hidden lg:flex lg:w-1/2 xl:w-7/12 bg-[#0F2322] items-center justify-center p-12 overflow-hidden">
        {/* Background Image with Overlay */}
        <div
          className="absolute inset-0 z-0 opacity-25 bg-cover bg-center"
          style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDerO4nzzt1v0pAMHtJiTrjuB8kBs2fMFMLbjrGkjdgCha8UJvgglW4emgfOA4GEP5sL4gZaZais8RqNq_C4UyYnmFLX-Jdbe5xN1YOu8bLl6_GTReGi3tIDgd4UmniIz9lUSiaVwwGbsggeE5SrDft1KkYTd_nm51aFDzDVplP_mLGQBEiZYg4ICQAM1hCpTvoGqevlNxLNuqgsMU7kIX3nAeJVcSNnMQnNUX8PDIoevLjEDPPPn6Vw-rj1ytRBTbbxDCz_VdwXqY')" }}
        ></div>

        {/* Teal Gradient Overlay */}
        <div className="absolute inset-0 z-10 bg-gradient-to-br from-[#0F2322]/95 via-[#0F2322]/80 to-[#00E6D6]/30"></div>

        {/* Subtle Gradient Tint */}
        <div className="absolute inset-0 z-20 bg-gradient-to-b from-black/10 via-transparent to-black/20"></div>

        {/* Wave Divider */}
        <svg
          className="absolute right-0 top-0 h-full w-28 z-20 text-[#F4F8F8] pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path d="M100 0 C 40 20, 40 80, 100 100 L 100 0 Z" fill="#F4F8F8" />
        </svg>

        <div className="relative z-30 max-w-xl text-white">
          <div className="flex items-center gap-3 mb-10 ">
            <div
              className="size-12  rounded-xl flex items-center justify-center text-black"
              style={{ backgroundColor: ACCENT_COLOR }}
            >
              <span className="material-symbols-outlined text-3xl font-bold">account_balance</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight">Etnova</h1>
          </div>

          <h2 className="text-5xl font-black leading-tight mb-6">
            Empowering Academic <span style={{ color: ACCENT_COLOR }}>Excellence</span>
          </h2>

          <p className="text-lg text-white/70 mb-8 leading-relaxed max-w-md">
            The next-generation project evaluation system designed for forward-thinking universities and ambitious students.
          </p>

          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4 bg-white/8 border border-white/12 p-4 rounded-xl backdrop-blur-sm">
              <span className="material-symbols-outlined text-primary">verified_user</span>
              <p className="text-sm font-medium text-white/90">Secure academic data management</p>
            </div>
            <div className="flex items-center gap-4 bg-white/8 border border-white/12 p-4 rounded-xl backdrop-blur-sm">
              <span className="material-symbols-outlined text-primary">analytics</span>
              <p className="text-sm font-medium text-white/90">Real-time performance analytics</p>
            </div>
          </div>
        </div>

        {/* Footer Branding */}
        <div className="absolute bottom-10 left-12 z-30">
          <p className="text-white/45 text-sm">©Etnova Project. All rights reserved.</p>
        </div>
      </div>

      {/* Right Panel: Login Form */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-12 lg:p-20 bg-[#F4F8F8]">
        <div className="w-full max-w-110">
          {/* Mobile Header */}
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <div
              className="size-10 rounded-lg flex items-center justify-center text-black"
              style={{ backgroundColor: ACCENT_COLOR }}
            >
              <span className="material-symbols-outlined font-bold">account_balance</span>
            </div>
            <h2 className="text-2xl font-bold text-ink">Etnova</h2>
          </div>

          <div className="mb-10">
            <h3 className="text-3xl font-bold text-ink mb-2">Welcome back</h3>
            <p className="text-muted">
              Please enter your credentials to access the portal.
            </p>
          </div>

          {authError && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert" aria-live="polite">
              {authError}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-ink mb-2">
                Username
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  alternate_email
                </span>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-white border border-transparent rounded-xl focus:ring-1 focus:ring-muted/50 focus:border-muted outline-none transition-all text-ink placeholder:text-muted"
                  placeholder="Username"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="password" className="text-sm font-semibold text-ink">
                  Password
                </label>
                <a href="#" className="text-sm font-medium text-teal-600 hover:underline">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  lock
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3.5 bg-white border border-transparent rounded-xl focus:ring-1 focus:ring-muted/50 focus:border-muted outline-none transition-all text-ink placeholder:text-muted"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="size-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
              />
              <label htmlFor="remember" className="text-sm text-muted cursor-pointer select-none">
                Keep me logged in
              </label>
              
            </div>

            <button
              type="submit"
              className="w-full py-4 text-bg-left font-bold rounded-xl border border-transparent focus:ring-1 focus:ring-muted/50 focus:border-muted transition-all shadow-primary flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: ACCENT_COLOR }}
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
              {!isLoading && <span className="material-symbols-outlined">arrow_forward</span>}
            </button>
          </form>

          {/* Help Link */}
          <div className="mt-10 pt-8 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted">Need assistance?</p>
            <div className="flex gap-6">
              <a href="#" className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-base">help_center</span>
                Support Center
              </a>
              <a href="#" className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-base">info</span>
                About Project
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
