import Link from 'next/link'
import { createClient } from '../../lib/supabase/server'
import CustomerManager from './CustomerManager'

export default async function CustomersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <main className="main standalone"><div className="card section"><h1>Customers</h1><p className="sub">Sign in to access your customer database.</p><Link className="btn" href="/login">Sign in</Link></div></main>

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, companies(name)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership?.company_id) return <main className="main standalone"><div className="card section"><h1>Customers</h1><p className="sub">Your workspace is not set up yet.</p><Link className="btn" href="/onboarding">Set up workspace</Link></div></main>

  const { data: customers, error } = await supabase
    .from('customers')
    .select('id,name,phone,email,status,service_type,notes,lifetime_paid,balance_owed,created_at,properties(id,address_line1,city,state,postal_code)')
    .eq('company_id', membership.company_id)
    .order('created_at', { ascending: false })

  const companyRelation = membership.companies as unknown
  const company = Array.isArray(companyRelation) ? companyRelation[0] as { name?: string } | undefined : companyRelation as { name?: string } | null
  const companyName = company?.name || 'Your business'

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand">J&J OS<div className="brand-company">{companyName}</div></div>
      <nav className="nav"><Link href="/">Command Center</Link><Link className="active" href="/customers">Customers</Link><Link href="/jobs">Jobs</Link><Link href="/estimates">Estimates</Link><Link href="/invoices">Invoices</Link><Link href="/settings">Settings</Link></nav>
    </aside>
    <main className="main">
      <div className="top"><div><div className="eyebrow">CRM / CUSTOMER RELATIONSHIP MANAGEMENT</div><h1 className="h1">Customers</h1><div className="sub">{companyName} · Your complete customer book</div></div></div>
      {error ? <div className="error">{error.message}</div> : <CustomerManager customers={(customers || []) as any} />}
    </main>
  </div>
}
