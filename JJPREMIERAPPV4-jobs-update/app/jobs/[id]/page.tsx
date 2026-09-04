import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCompanyContext } from '../../../lib/company'
import JobProfile from './profile'

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { supabase, user, companyId } = await getCompanyContext()
  if (!user || !companyId) notFound()
  const { data: job } = await supabase.from('jobs').select('*').eq('id', id).eq('company_id', companyId).is('archived_at', null).maybeSingle()
  if (!job) notFound()
  const [{ data: customers }, { data: services }, { data: memberships }, { data: properties }, { data: assignments }, { data: activities }, { data: attachments }, { data: estimate }, { data: invoice }] = await Promise.all([
    supabase.from('customers').select('id,name').eq('company_id', companyId).is('archived_at', null).order('name').limit(250),
    supabase.from('services').select('id,name').eq('company_id', companyId).eq('active', true).order('name').limit(250),
    supabase.from('company_members').select('user_id,role,profiles(full_name)').eq('company_id', companyId).order('created_at'),
    supabase.from('properties').select('id,address_line1,city,state,postal_code').eq('company_id', companyId).eq('customer_id', job.customer_id || '00000000-0000-0000-0000-000000000000').order('created_at'),
    supabase.from('job_assignments').select('user_id,assignment_role,profiles(full_name)').eq('job_id', id).eq('company_id', companyId).order('created_at'),
    supabase.from('job_activity').select('id,event_type,summary,created_at,profiles(full_name)').eq('job_id', id).eq('company_id', companyId).order('created_at', { ascending: false }).limit(40),
    supabase.from('job_attachments').select('id,file_name,mime_type,byte_size,created_at').eq('job_id', id).eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('estimates').select('id,number,status,total').eq('company_id', companyId).eq('id', job.estimate_id || '00000000-0000-0000-0000-000000000000').maybeSingle(),
    supabase.from('invoices').select('id,number,status,total,due_at').eq('company_id', companyId).eq('id', job.invoice_id || '00000000-0000-0000-0000-000000000000').maybeSingle(),
  ])
  const members = (memberships || []).map((member: any) => ({ user_id: member.user_id, role: member.role, full_name: Array.isArray(member.profiles) ? member.profiles[0]?.full_name : member.profiles?.full_name }))
  const customer = (customers || []).find((item: any) => item.id === job.customer_id)
  const service = (services || []).find((item: any) => item.id === job.service_id)
  const property = (properties || []).find((item: any) => item.id === job.property_id)
  const crew = (assignments || []).map((assignment: any) => ({ user_id: assignment.user_id, assignment_role: assignment.assignment_role, full_name: Array.isArray(assignment.profiles) ? assignment.profiles[0]?.full_name : assignment.profiles?.full_name }))
  return <div className="shell"><aside className="sidebar"><div className="brand">J&J OS</div><nav className="nav"><Link href="/">Command Center</Link><Link href="/customers">Customers</Link><Link className="active" href="/jobs">Jobs</Link><Link href="/estimates">Estimates</Link><Link href="/invoices">Invoices</Link></nav></aside><main className="main"><Link className="back-link" href="/jobs">← All jobs</Link><JobProfile job={{ ...job, job_assignments: crew }} customers={customers || []} services={services || []} members={members} properties={properties || []} customer={customer} property={property} service={service} crew={crew} activities={activities || []} attachments={attachments || []} estimate={estimate} invoice={invoice} /></main></div>
}
