import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { createClient } from '../../lib/supabase/server'

async function addCustomer(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { data: membership } = await supabase.from('company_members').select('company_id').eq('user_id', user.id).limit(1).maybeSingle()
  if (!membership?.company_id) return
  const name = String(formData.get('name') || '').trim()
  if (!name) return
  await supabase.from('customers').insert({ company_id: membership.company_id, name, phone: String(formData.get('phone') || '').trim() || null, email: String(formData.get('email') || '').trim() || null, status: String(formData.get('status') || 'lead') })
  revalidatePath('/customers')
}

export default async function CustomersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <main className="main standalone"><div className="card section"><h1>Customers</h1><p className="sub">Sign in to access your customer database.</p><Link className="btn" href="/login">Sign in</Link></div></main>

  const { data: membership } = await supabase.from('company_members').select('company_id, companies(name)').eq('user_id', user.id).limit(1).maybeSingle()
  if (!membership?.company_id) return <main className="main standalone"><div className="card section"><h1>Customers</h1><p className="sub">Your workspace is not set up yet.</p><Link className="btn" href="/onboarding">Set up workspace</Link></div></main>

  const { data: customers, error } = await supabase.from('customers').select('id,name,phone,email,status,created_at').eq('company_id', membership.company_id).order('created_at', { ascending: false })
  return <div className="shell"><aside className="sidebar"><div className="brand">J&J OS</div><nav className="nav"><Link href="/">Command Center</Link><Link className="active" href="/customers">Customers</Link><Link href="/jobs">Jobs</Link><Link href="/estimates">Estimates</Link><Link href="/invoices">Invoices</Link><Link href="/settings">Settings</Link></nav></aside><main className="main"><div className="top"><div><div className="eyebrow">CRM</div><h1 className="h1">Customers</h1><div className="sub">{customers?.length ?? 0} customer records</div></div></div><div className="card section"><h3>Add customer</h3><form action={addCustomer} className="customer-form"><input name="name" required placeholder="Customer name" /><input name="phone" placeholder="Phone" /><input name="email" type="email" placeholder="Email" /><select name="status" defaultValue="lead"><option value="lead">Lead</option><option value="active">Active</option><option value="inactive">Inactive</option></select><button className="btn">Add customer</button></form></div><div className="card section"><h3>Customer list</h3>{error ? <div className="error">{error.message}</div> : customers?.length ? <div className="customer-list">{customers.map(c => <div className="customer-row" key={c.id}><div><strong>{c.name}</strong><div className="sub">{c.email || 'No email'} · {c.phone || 'No phone'}</div></div><span className="badge">{c.status}</span></div>)}</div> : <p className="sub">No customers yet. Add your first one above.</p>}</div></main></div>
}
