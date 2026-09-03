import { createClient } from '../lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">J&J OS</div>
        <nav className="nav">
          <a className="active" href="/">Command Center</a>
          <a href="/customers">Customers</a>
          <a href="/jobs">Jobs</a>
          <a href="/estimates">Estimates</a>
          <a href="/invoices">Invoices</a>
          <a href="/settings">Settings</a>
        </nav>
      </aside>
      <main className="main">
        <div className="top">
          <div><div className="eyebrow">COMMAND CENTER</div><h1 className="h1">Good morning</h1><div className="sub">{user ? `Signed in as ${user.email}` : 'Production foundation'}</div></div>
          <button className="btn">+ New job</button>
        </div>
        <div className="brain">
          <div className="eyebrow" style={{color:'#94a3b8'}}>BUSINESS BRAIN</div>
          <h2>What should J&J OS handle?</h2>
          <input placeholder='“Follow up with every estimate over $1,000”' />
        </div>
        <div className="grid">
          <div className="card"><div className="eyebrow">REVENUE · MTD</div><div className="num">$12,480</div><div className="sub">Live data will come from Postgres</div></div>
          <div className="card"><div className="eyebrow">ACTIVE JOBS</div><div className="num">8</div><div className="sub">Jobs table</div></div>
          <div className="card"><div className="eyebrow">PIPELINE</div><div className="num">$6,850</div><div className="sub">Estimates table</div></div>
          <div className="card"><div className="eyebrow">RECEIVABLES</div><div className="num">$4,840</div><div className="sub">Invoices table</div></div>
        </div>
        <div className="card section">
          <h3>Production architecture is ready</h3>
          <p className="sub">Tenant isolation, roles, customers, properties, jobs, estimates and invoices are defined in the database layer. Next we wire authentication and live CRUD screens.</p>
          <div className="row"><span>Database</span><span className="badge">Supabase/Postgres</span></div>
          <div className="row"><span>Tenant security</span><span className="badge">Row Level Security</span></div>
          <div className="row"><span>Authentication</span><span className="badge">Supabase Auth</span></div>
        </div>
      </main>
    </div>
  )
}
