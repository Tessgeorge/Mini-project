import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import supabase from '../config/supabaseClient'

const ACCENT_COLOR = '#00D2C4'

export default function DashboardShell({ badgeLabel, title, description, children }) {
  const navigate = useNavigate()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await supabase.auth.signOut()
      navigate('/signin', { replace: true })
    } catch (error) {
      console.error('Sign-out failed:', error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#F4F8F8] flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-white rounded-3xl shadow-lg border border-line p-10 text-center">
        <p className="text-xs font-semibold text-muted uppercase tracking-[0.2em] mb-4">{badgeLabel}</p>
        <h1 className="text-3xl font-bold text-ink mb-3">{title}</h1>
        <p className="text-muted mb-8">{description}</p>
        {children ? <div className="mb-8 text-left">{children}</div> : null}
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full py-3 text-ink font-semibold rounded-2xl border border-line transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ backgroundColor: ACCENT_COLOR, color: '#0F172A' }}
        >
          {isLoggingOut ? 'Signing out...' : 'Sign out'}
        </button>
      </div>
    </main>
  )
}
