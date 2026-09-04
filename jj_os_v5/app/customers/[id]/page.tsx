import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCompanyContext } from '../../../lib/company'
import CustomerProfile from './profile'

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, user, companyId } = await getCompanyContext()
  if (!user || !companyId) notFound()
  const [{ data: customer }, { data: properties }, { data: serviceLinks }, { data: pricebook }, { data: finance }, { data: jobs }, { data: estimates }, { data: invoices }, { data: payments }] = await Promise.all([
    supabase.from('customers').select('*').eq('id', id).eq('company_id', companyId).is('archived_at', null).maybeSingle(),
    supabase.from('properties').select('*').eq('customer_id', id).eq('company_id', companyId).order('created_at'),
    supabase.from('customer_services').select('id,custom_name,notes,status,services(id,name)').eq('customer_id', id).eq('company_id', companyId).order('created_at'),
    supabase.from('services').select('id,name').eq('company_id', companyId).eq('active', true).order('name'),
    supabase.rpc('customer_financial_summary_for_current_user', { target_customer_id: id }),
    supabase.from('jobs').select('id,title,status,scheduled_start').eq('customer_id', id).eq('company_id', companyId).order('created_at', { ascending: false }).limit(8),
    supabase.from('estimates').select('id,number,status,total,created_at').eq('customer_id', id).eq('company_id', companyId).order('created_at', { ascending: false }).limit(8),
    supabase.from('invoices').select('id,number,status,total,due_at,created_at').eq('customer_id', id).eq('company_id', companyId).order('created_at', { ascending: false }).limit(8),
    supabase.from('payments').select('id,amount,payment_date,method,reference').eq('customer_id', id).eq('company_id', companyId).order('payment_date', { ascending: false }).limit(8),
  ])
  if (!customer) notFound()
  const f = (finance || [])[0] as { total_invoiced: number | string; total_paid: number | string; outstanding_balance: number | string; overdue_balance: number | string } | undefined
  const financial = { invoiced: Number(f?.total_invoiced || 0), paid: Number(f?.total_paid || 0), owed: Number(f?.outstanding_balance || 0), overdue: Number(f?.overdue_balance || 0) }
  return <div className="shell"><aside className="sidebar"><div className="brand">J&J OS</div><nav className="nav"><Link href="/">Command Center</Link><Link className="active" href="/customers">Customers</Link><Link href="/jobs">Jobs</Link><Link href="/estimates">Estimates</Link><Link href="/invoices">Invoices</Link></nav></aside><main className="main"><Link className="back-link" href="/customers">← All customers</Link><CustomerProfile customer={customer} properties={properties || []} serviceLinks={serviceLinks || []} pricebook={pricebook || []} financial={financial} records={{ jobs: jobs || [], estimates: estimates || [], invoices: invoices || [], payments: payments || [] }} /></main></div>
}
