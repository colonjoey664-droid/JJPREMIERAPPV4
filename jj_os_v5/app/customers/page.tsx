import Link from 'next/link'
import { getCompanyContext } from '../../lib/company'
import CustomerManager from './CustomerManager'

type SearchRow = { id: string; name: string; account_number: string | null; phone: string | null; email: string | null; status: string; customer_type: string; created_at: string; property_count: number; primary_address: string | null; total_count: number }
type FinancialRow = { customer_id: string; total_invoiced: number | string; total_paid: number | string; outstanding_balance: number | string; overdue_balance: number | string }

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; type?: string; page?: string }> }) {
  const params = await searchParams
  const { supabase, user, companyId } = await getCompanyContext()
  if (!user) return <main className="main standalone"><div className="card section"><h1>Customers</h1><p className="sub">Sign in to access your customer database.</p><Link className="btn" href="/login">Sign in</Link></div></main>
  if (!companyId) return <main className="main standalone"><div className="card section"><h1>Customers</h1><p className="sub">Your workspace is not set up yet.</p><Link className="btn" href="/onboarding">Set up workspace</Link></div></main>

  const q = (params.q || '').slice(0, 120)
  const status = ['all', 'lead', 'active', 'inactive'].includes(params.status || '') ? params.status! : 'all'
  const type = ['all', 'residential', 'commercial'].includes(params.type || '') ? params.type! : 'all'
  const page = Math.max(1, Number(params.page) || 1)
  const [{ data: rows, error }, { data: financials }, { count: activeCount }, { count: leadCount }, { data: membership }] = await Promise.all([
    supabase.rpc('search_customers_for_current_user', { search_term: q, status_filter: status, type_filter: type, page_number: page, page_size: 50 }),
    supabase.rpc('customer_financial_summary_for_current_user'),
    supabase.from('customers').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('archived_at', null).eq('status', 'active'),
    supabase.from('customers').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('archived_at', null).eq('status', 'lead'),
    supabase.from('company_members').select('companies(name)').eq('user_id', user.id).eq('company_id', companyId).maybeSingle(),
  ])
  const financialByCustomer = Object.fromEntries(((financials || []) as FinancialRow[]).map(f => [f.customer_id, { invoiced: Number(f.total_invoiced), paid: Number(f.total_paid), owed: Number(f.outstanding_balance), overdue: Number(f.overdue_balance) }]))
  const allFinancials = Object.values(financialByCustomer) as Array<{ invoiced: number; paid: number; owed: number }>
  const company = membership?.companies as unknown as { name?: string } | { name?: string }[] | null
  const companyName = (Array.isArray(company) ? company[0] : company)?.name || 'Your business'
  const customers = (rows || []) as SearchRow[]
  const total = customers[0]?.total_count || 0

  return <div className="shell"><aside className="sidebar"><div className="brand">J&J OS<div className="brand-company">{companyName}</div></div><nav className="nav"><Link href="/">Command Center</Link><Link className="active" href="/customers">Customers</Link><Link href="/jobs">Jobs</Link><Link href="/estimates">Estimates</Link><Link href="/invoices">Invoices</Link><Link href="/settings">Settings</Link></nav></aside><main className="main"><div className="top"><div><div className="eyebrow">CRM / CUSTOMER RELATIONSHIP MANAGEMENT</div><h1 className="h1">Customers</h1><div className="sub">{companyName} · Your complete customer book</div></div></div>{error ? <div className="error">{error.message}</div> : <CustomerManager customers={customers} financialByCustomer={financialByCustomer} activeCount={activeCount || 0} leadCount={leadCount || 0} total={total} query={q} status={status} type={type} page={page} />}</main></div>
}
