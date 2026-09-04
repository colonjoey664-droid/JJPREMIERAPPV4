'use server'

import { revalidatePath } from 'next/cache'
import { getCompanyContext } from '../../lib/company'

const clean = (value: FormDataEntryValue | null) => String(value ?? '').trim()
const customerFields = ['name', 'first_name', 'last_name', 'business_name', 'account_number', 'phone', 'email', 'status', 'customer_type', 'notes']

function payload(formData: FormData) {
  return Object.fromEntries([...customerFields, 'address_line1', 'city', 'state', 'postal_code', 'property_notes', 'property_status']
    .map(key => [key, clean(formData.get(key))]))
}

function invalidate(id?: string) {
  revalidatePath('/customers')
  if (id) revalidatePath(`/customers/${id}`)
  revalidatePath('/')
}

export async function addCustomer(formData: FormData) {
  const { supabase, user, companyId } = await getCompanyContext()
  if (!user || !companyId) return { ok: false, error: 'You are not signed in to a workspace.' }
  const requestId = clean(formData.get('request_id'))
  if (!requestId) return { ok: false, error: 'Please try submitting again.' }
  const { data, error } = await supabase.rpc('create_customer_for_current_user', { payload: payload(formData), request_id: requestId })
  if (error) return { ok: false, error: error.code === '23505' ? 'That account number is already in use.' : error.message }
  invalidate(data || undefined)
  return { ok: true, id: data as string }
}

export async function updateCustomer(formData: FormData) {
  const { supabase, user, companyId } = await getCompanyContext()
  const id = clean(formData.get('id'))
  if (!user || !companyId || !id) return { ok: false, error: 'Customer not found in this workspace.' }
  const values = payload(formData)
  if (!values.name) return { ok: false, error: 'Customer name is required.' }
  if (!['lead', 'active', 'inactive'].includes(values.status)) return { ok: false, error: 'Customer status is invalid.' }
  if (!['residential', 'commercial'].includes(values.customer_type)) return { ok: false, error: 'Customer type is invalid.' }
  const fields = Object.fromEntries(customerFields.map(key => [key, values[key as keyof typeof values] || null]))
  const { error } = await supabase.from('customers').update(fields).eq('id', id).eq('company_id', companyId).is('archived_at', null)
  if (error) return { ok: false, error: error.code === '23505' ? 'That account number is already in use.' : error.message }
  invalidate(id)
  return { ok: true }
}

export async function archiveCustomer(formData: FormData) {
  const { supabase, user, companyId } = await getCompanyContext()
  const id = clean(formData.get('id'))
  if (!user || !companyId || !id) return { ok: false, error: 'Customer not found in this workspace.' }
  const { data, error } = await supabase.from('customers').update({ archived_at: new Date().toISOString(), status: 'inactive' }).eq('id', id).eq('company_id', companyId).is('archived_at', null).select('id').maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'Customer not found in this workspace.' }
  invalidate(id)
  return { ok: true }
}

export async function addProperty(formData: FormData) {
  const { supabase, user, companyId } = await getCompanyContext()
  const customerId = clean(formData.get('customer_id'))
  const address = clean(formData.get('address_line1'))
  if (!user || !companyId || !customerId || !address) return { ok: false, error: 'A customer and street address are required.' }
  const { data: customer } = await supabase.from('customers').select('id').eq('id', customerId).eq('company_id', companyId).is('archived_at', null).maybeSingle()
  if (!customer) return { ok: false, error: 'Customer not found in this workspace.' }
  const { error } = await supabase.from('properties').insert({ company_id: companyId, customer_id: customerId, address_line1: address, city: clean(formData.get('city')) || null, state: clean(formData.get('state')) || null, postal_code: clean(formData.get('postal_code')) || null, notes: clean(formData.get('notes')) || null, status: clean(formData.get('status')) || 'active' })
  if (error) return { ok: false, error: error.message }
  invalidate(customerId)
  return { ok: true }
}

export async function addCustomerService(formData: FormData) {
  const { supabase, user, companyId } = await getCompanyContext()
  const customerId = clean(formData.get('customer_id'))
  const serviceId = clean(formData.get('service_id'))
  const customName = clean(formData.get('custom_name'))
  if (!user || !companyId || !customerId || (!serviceId && !customName)) return { ok: false, error: 'Choose a service or enter a custom service name.' }
  const [{ data: customer }, { data: service }] = await Promise.all([
    supabase.from('customers').select('id').eq('id', customerId).eq('company_id', companyId).is('archived_at', null).maybeSingle(),
    serviceId ? supabase.from('services').select('id').eq('id', serviceId).eq('company_id', companyId).maybeSingle() : Promise.resolve({ data: { id: null } }),
  ])
  if (!customer || (serviceId && !service)) return { ok: false, error: 'Customer or service not found in this workspace.' }
  const { error } = await supabase.from('customer_services').insert({ company_id: companyId, customer_id: customerId, service_id: serviceId || null, custom_name: customName || null, notes: clean(formData.get('notes')) || null })
  if (error) return { ok: false, error: error.message }
  invalidate(customerId)
  return { ok: true }
}
