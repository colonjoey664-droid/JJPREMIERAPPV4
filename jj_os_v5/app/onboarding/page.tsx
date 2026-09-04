'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function OnboardingPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [industry, setIndustry] = useState('Landscaping & Property Services')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!)

  async function createWorkspace(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    const { error } = await supabase.rpc('create_company_for_current_user', { company_name: name, company_industry: industry })
    if (error) setError(error.message)
    else router.push('/customers')
    setLoading(false)
  }

  return <main className="auth-page"><div className="auth-card"><div className="brand">J&J OS</div><h1>Set up your business</h1><p className="sub">This takes less than a minute. We can import the rest later.</p><form onSubmit={createWorkspace} className="auth-form"><input required placeholder="Business name" value={name} onChange={e => setName(e.target.value)} /><input placeholder="Industry" value={industry} onChange={e => setIndustry(e.target.value)} /><button className="btn" disabled={loading}>{loading ? 'Creating…' : 'Create workspace'}</button>{error && <div className="error">{error}</div>}</form></div></main>
}
