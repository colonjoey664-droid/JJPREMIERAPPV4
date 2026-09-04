'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
    if (result.error) setError(result.error.message)
    else if (mode === 'signup') router.push('/onboarding')
    else router.push('/')
    setLoading(false)
  }

  return <main className="auth-page"><div className="auth-card"><div className="brand">J&J OS</div><h1>{mode === 'signin' ? 'Welcome back' : 'Create your workspace'}</h1><p className="sub">{mode === 'signin' ? 'Sign in to your business command center.' : 'Start your J&J OS company workspace.'}</p><form onSubmit={submit} className="auth-form"><input type="email" required placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} /><input type="password" required minLength={6} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} /><button className="btn" disabled={loading}>{loading ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>{error && <div className="error">{error}</div>}</form><button className="link-button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? 'Need an account? Create one' : 'Already have an account? Sign in'}</button></div></main>
}
