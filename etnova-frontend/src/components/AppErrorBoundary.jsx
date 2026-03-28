import React from 'react'

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || 'Something went wrong while rendering this page.',
    }
  }

  componentDidCatch(error, info) {
    console.error('AppErrorBoundary caught an error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
          <div className="w-full max-w-xl rounded-3xl border border-rose-200 bg-white p-8 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-rose-500">Application Error</p>
            <h1 className="mt-3 text-2xl font-extrabold text-slate-900">This page could not be loaded.</h1>
            <p className="mt-3 text-sm text-slate-600">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800"
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
