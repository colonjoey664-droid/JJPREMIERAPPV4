'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../lib/supabase/server'

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, companyId: null as string | null }

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  return { supabase, user, companyId: membership?.company_id ?? null }
}

const clean = (value: FormDataEntryValue | null) => String(value ?? '').trim()
const money = (value: FormDataEntryValue | null) => {
  const parsed = Number(String(value ?? '').replace(/[$,]/g, ''))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

export async function addCustomer(formData: FormData) {
  const { supabase, user, companyId } = await getContext()
  if (!user || !companyId) return { ok: false, error: 'You are not signed in to a workspace.' }

  const name = clean(formData.get('name'))
  if (!name) return { ok: false, error: 'Customer name is required.' }

  const { data: customer, error } = await supabase
    .from('customers')
    .insert({
      company_id: companyId,
      name,
      phone: clean(formData.get('phone')) || null,
      email: clean(formData.get('email')) || null,
      status: clean(formData.get('status')) || 'lead',
      service_type: clean(formData.get('service_type')) || null,
      notes: clean(formData.get('notes')) || null,
      lifetime_paid: money(formData.get('lifetime_paid')),
      balance_owed: money(formData.get('balance_owed')),
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }

  const address = clean(formData.get('address_line1'))
  if (address && customer) {
    const { error: propertyError } = await supabase.from('properties').insert({
      company_id: companyId,
      customer_id: customer.id,
      address_line1: address,
      city: clean(formData.get('city')) || null,
      state: clean(formData.get('state')) || null,
      postal_code: clean(formData.get('postal_code')) || null,
    })
    if (propertyError) return { ok: false, error: propertyError.message }
  }

  revalidatePath('/customers')
  revalidatePath('/')
  return { ok: true }
}

export async function updateCustomer(formData: FormData) {
  const { supabase, user, companyId } = await getContext()
  if (!user || !companyId) return { ok: false, error: 'You are not signed in to a workspace.' }

  const id = clean(formData.get('id'))
  const name = clean(formData.get('name'))
  if (!id || !name) return { ok: false, error: 'Customer and name are required.' }

  const { error } = await supabase
    .from('customers')
    .update({
      name,
      phone: clean(formData.get('phone')) || null,
      email: clean(formData.get('email')) || null,
      status: clean(formData.get('status')) || 'lead',
      service_type: clean(formData.get('service_type')) || null,
      notes: clean(formData.get('notes')) || null,
      lifetime_paid: money(formData.get('lifetime_paid')),
      balance_owed: money(formData.get('balance_owed')),
    })
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) return { ok: false, error: error.message }

  const addressId = clean(formData.get('property_id'))
  const address = clean(formData.get('address_line1'))
  const property = {
    company_id: companyId,
    customer_id: id,
    address_line1: address,
    city: clean(formData.get('city')) || null,
    state: clean(formData.get('state')) || null,
    postal_code: clean(formData.get('postal_code')) || null,
  }

  if (addressId) {
    if (address) {
      const { error: propertyError } = await supabase.from('properties').update(property).eq('id', addressId).eq('company_id', companyId)
      if (propertyError) return { ok: false, error: propertyError.message }
    } else {
      const { error: propertyError } = await supabase.from('properties').delete().eq('id', addressId).eq('company_id', companyId)
      if (propertyError) return { ok: false, error: propertyError.message }
    }
  } else if (address) {
    const { error: propertyError } = await supabase.from('properties').insert(property)
    if (propertyError) return { ok: false, error: propertyError.message }
  }

  revalidatePath('/customers')
  revalidatePath('/')
  return { ok: true }
}

export async function deleteCustomer(formData: FormData) {
  const { supabase, user, companyId } = await getContext()
  if (!user || !companyId) return { ok: false, error: 'You are not signed in to a workspace.' }

  const id = clean(formData.get('id'))
  if (!id) return { ok: false, error: 'Customer ID is missing.' }

  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/customers')
  revalidatePath('/')
  return { ok: true }
}
