import Link from 'next/link'
import { createClient } from '../lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let companyName = 'Production foundation'
  let customerCount = 0

  if (user) {
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id, companies(name)')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (membership?.companies) {
      const company = Array.isArray(membership.companies)
        ? membership.companies[0]
        : membership.companies
      if (company?.name) companyName = company.name
    }
    if (membership?.company_id) {
      const { count } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', membership.company_id)
      customerCount = count ?? 0
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">J&J OS</div>
        <nav className="nav">
          <Link className="active" href="/">Command Center</Link>
          <Link href="/customers">Customers</Link>
          <Link href="/jobs">Jobs</Link>
          <Link href="/estimates">Estimates</Link>
          <Link href="/invoices">Invoices</Link>
          <Link href="/settings">Settings</Link>
        </nav>
      </aside>
      <main className="main">
        <div className="top">
          <div><div className="eyebrow">COMMAND CENTER</div><h1 className="h1">Good morning</h1><div className="sub">{user ? companyName : 'Production foundation'}</div></div>
          <Link className="btn" href="/customers">+ New customer</Link>
        </div>
        <div className="brain">
          <div className="eyebrow" style={{ color: '#94a3b8' }}>BUSINESS BRAIN</div>
          <h2>What should J&J OS handle?</h2>
          <input placeholder='“Follow up with every estimate over $1,000”' />
        </div>
        <div className="grid">
          <div className="card"><div className="eyebrow">CUSTOMERS</div><div className="num">{customerCount}</div><div className="sub">Live from Supabase</div></div>
          <div className="card"><div className="eyebrow">ACTIVE JOBS</div><div className="num">—</div><div className="sub">Jobs module next</div></div>
          <div className="card"><div className="eyebrow">PIPELINE</div><div className="num">—</div><div className="sub">Estimates module next</div></div>
          <div className="card"><div className="eyebrow">RECEIVABLES</div><div className="num">—</div><div className="sub">Invoices module next</div></div>
        </div>
        <div className="card section">
          <h3>Customers are now the first live module</h3>
          <p className="sub">Add, search, edit and manage real customer records in Supabase. Every record is scoped to the signed-in company.</p>
          <Link className="btn" href="/customers">Open Customers →</Link>
        </div>
        {!user && <div className="card section"><h3>Connect your account</h3><p className="sub">Sign in to create your company workspace and start adding real data.</p><Link className="btn" href="/login">Sign in</Link></div>}
      </main>
    </div>
  )
}
