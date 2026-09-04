import Link from 'next/link'
import { getCompanyContext } from '../../lib/company'
import JobManager from './JobManager'

type JobRow = { id: string; job_number: string | null; title: string; status: string; priority: string; value: number | string; scheduled_start: string | null; scheduled_end: string | null; customer_name: string | null; property_address: string | null; service_name: string | null; crew_names: string; total_count: number }
const uuid = (value?: string) => value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; date?: string; customer?: string; property?: string; service?: string; crew?: string; page?: string }> }) {
  const params = await searchParams; const { supabase, user, companyId } = await getCompanyContext()
  if (!user) return <main className="main standalone"><div className="card section"><h1>Jobs</h1><p className="sub">Sign in to manage work.</p><Link className="btn" href="/login">Sign in</Link></div></main>
  if (!companyId) return <main className="main standalone"><div className="card section"><h1>Jobs</h1><p className="sub">Your workspace is not set up yet.</p><Link className="btn" href="/onboarding">Set up workspace</Link></div></main>
  const q = (params.q || '').slice(0, 120); const status = ['all', 'unscheduled', 'scheduled', 'in_progress', 'completed', 'cancelled'].includes(params.status || '') ? params.status! : 'all'; const date = ['all', 'unscheduled', 'today', 'week'].includes(params.date || '') ? params.date! : 'all'; const page = Math.max(1, Number(params.page) || 1)
  const [{ data: rows, error }, { data: customers }, { data: services }, { data: memberships }, { count: scheduledCount }, { count: inProgressCount }, { count: unscheduledCount }] = await Promise.all([
    supabase.rpc('search_jobs_for_current_user', { search_term: q, status_filter: status, date_filter: date, customer_filter: uuid(params.customer), property_filter: uuid(params.property), service_filter: uuid(params.service), assignee_filter: uuid(params.crew), page_number: page, page_size: 50 }),
    supabase.from('customers').select('id,name').eq('company_id', companyId).is('archived_at', null).order('name').limit(250),
    supabase.from('services').select('id,name').eq('company_id', companyId).eq('active', true).order('name').limit(250),
    supabase.from('company_members').select('user_id,role,profiles(full_name)').eq('company_id', companyId).order('created_at').limit(100),
    supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('archived_at', null).eq('status', 'scheduled'),
    supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('archived_at', null).eq('status', 'in_progress'),
    supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('archived_at', null).eq('status', 'draft'),
  ])
  const members = (memberships || []).map((member: any) => ({ user_id: member.user_id, role: member.role, full_name: Array.isArray(member.profiles) ? member.profiles[0]?.full_name : member.profiles?.full_name }))
  const jobs = (rows || []) as JobRow[]; const total = jobs[0]?.total_count || 0
  return <div className="shell"><aside className="sidebar"><div className="brand">J&J OS</div><nav className="nav"><Link href="/">Command Center</Link><Link href="/customers">Customers</Link><Link className="active" href="/jobs">Jobs</Link><Link href="/estimates">Estimates</Link><Link href="/invoices">Invoices</Link></nav></aside><main className="main"><div className="top"><div><div className="eyebrow">OPERATIONS / JOB MANAGEMENT</div><h1 className="h1">Jobs</h1><div className="sub">Schedule, assign, and track customer work.</div></div></div>{error ? <div className="error">{error.message}</div> : <JobManager jobs={jobs} customers={customers || []} services={services || []} members={members} counts={{ scheduled: scheduledCount || 0, inProgress: inProgressCount || 0, unscheduled: unscheduledCount || 0 }} total={total} filters={{ q, status, date, customer: params.customer || '', property: params.property || '', service: params.service || '', crew: params.crew || '' }} page={page} />}</main></div>
}
