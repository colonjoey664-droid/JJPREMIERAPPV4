'use server'

import { revalidatePath } from 'next/cache'
import { getCompanyContext } from '../../lib/company'

const clean = (value: FormDataEntryValue | null) => String(value ?? '').trim()
const statuses = ['unscheduled', 'scheduled', 'in_progress', 'completed', 'cancelled']
const priorities = ['low', 'normal', 'high', 'urgent']
const workTypes = ['one_time', 'recurring']

function jobPayload(formData: FormData) {
  const tags = clean(formData.get('tags')).split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 12)
  const assigneeIds = formData.getAll('assignee_ids').map(value => clean(value)).filter(Boolean)
  return {
    job_number: clean(formData.get('job_number')), customer_id: clean(formData.get('customer_id')), property_id: clean(formData.get('property_id')),
    service_id: clean(formData.get('service_id')), title: clean(formData.get('title')), status: clean(formData.get('status')) || 'unscheduled',
    scheduled_start: clean(formData.get('scheduled_start')), scheduled_end: clean(formData.get('scheduled_end')), description: clean(formData.get('description')),
    internal_notes: clean(formData.get('internal_notes')), customer_notes: clean(formData.get('customer_notes')), value: clean(formData.get('value')),
    priority: clean(formData.get('priority')) || 'normal', work_type: clean(formData.get('work_type')) || 'one_time',
    recurrence_rule: { frequency: clean(formData.get('recurrence_frequency')) || null }, tags, assignee_ids: assigneeIds,
  }
}

function validate(data: ReturnType<typeof jobPayload>) {
  if (!data.title) return 'Job title is required.'
  if (!statuses.includes(data.status)) return 'Job status is invalid.'
  if (!priorities.includes(data.priority)) return 'Job priority is invalid.'
  if (!workTypes.includes(data.work_type)) return 'Work type is invalid.'
  if (data.scheduled_start && data.scheduled_end && new Date(data.scheduled_end) < new Date(data.scheduled_start)) return 'End time must be after start time.'
  if (data.value && (!Number.isFinite(Number(data.value)) || Number(data.value) < 0)) return 'Job value must be zero or greater.'
  return null
}

function invalidate(id?: string) {
  revalidatePath('/jobs')
  if (id) revalidatePath(`/jobs/${id}`)
  revalidatePath('/customers')
}

async function activity(supabase: any, jobId: string, companyId: string, userId: string, eventType: string, summary: string) {
  await supabase.from('job_activity').insert({ job_id: jobId, company_id: companyId, actor_id: userId, event_type: eventType, summary })
}

export async function getCustomerProperties(customerId: string) {
  const { supabase, user, companyId } = await getCompanyContext()
  if (!user || !companyId || !customerId) return []
  const { data } = await supabase.from('properties').select('id,address_line1,city,state,postal_code').eq('company_id', companyId).eq('customer_id', customerId).eq('status', 'active').order('created_at')
  return data || []
}

export async function addJob(formData: FormData) {
  const { supabase, user, companyId } = await getCompanyContext()
  if (!user || !companyId) return { ok: false, error: 'You are not signed in to a workspace.' }
  const requestId = clean(formData.get('request_id'))
  const data = jobPayload(formData); const validation = validate(data)
  if (!requestId) return { ok: false, error: 'Please try submitting again.' }
  if (validation) return { ok: false, error: validation }
  const { data: id, error } = await supabase.rpc('create_job_for_current_user', { payload: data, request_id: requestId })
  if (error) return { ok: false, error: error.code === '23505' ? 'That job number is already in use.' : error.message }
  invalidate(id || undefined)
  return { ok: true, id: id as string }
}

export async function updateJob(formData: FormData) {
  const { supabase, user, companyId } = await getCompanyContext()
  const id = clean(formData.get('id')); const data = jobPayload(formData); const validation = validate(data)
  if (!user || !companyId || !id) return { ok: false, error: 'Job not found in this workspace.' }
  if (validation) return { ok: false, error: validation }
  const { data: job, error } = await supabase.from('jobs').update({
    job_number: data.job_number || null, customer_id: data.customer_id || null, property_id: data.property_id || null, service_id: data.service_id || null,
    title: data.title, status: data.status === 'unscheduled' ? 'draft' : data.status, scheduled_start: data.scheduled_start || null, scheduled_end: data.scheduled_end || null,
    description: data.description || null, internal_notes: data.internal_notes || null, customer_notes: data.customer_notes || null, value: Number(data.value || 0),
    priority: data.priority, work_type: data.work_type, recurrence_rule: data.recurrence_rule, tags: data.tags,
  }).eq('id', id).eq('company_id', companyId).is('archived_at', null).select('id').maybeSingle()
  if (error) return { ok: false, error: error.code === '23505' ? 'That job number is already in use.' : error.message }
  if (!job) return { ok: false, error: 'Job not found in this workspace.' }
  const { error: removeError } = await supabase.from('job_assignments').delete().eq('job_id', id).eq('company_id', companyId)
  if (removeError) return { ok: false, error: removeError.message }
  if (data.assignee_ids.length) {
    const { error: assignmentsError } = await supabase.from('job_assignments').insert(data.assignee_ids.map(userId => ({ job_id: id, company_id: companyId, user_id: userId })))
    if (assignmentsError) return { ok: false, error: assignmentsError.message }
  }
  await activity(supabase, id, companyId, user.id, 'updated', 'Job details updated')
  invalidate(id)
  return { ok: true }
}

export async function cancelJob(formData: FormData) {
  const { supabase, user, companyId } = await getCompanyContext(); const id = clean(formData.get('id'))
  if (!user || !companyId || !id) return { ok: false, error: 'Job not found in this workspace.' }
  const { data, error } = await supabase.from('jobs').update({ status: 'cancelled' }).eq('id', id).eq('company_id', companyId).is('archived_at', null).select('id').maybeSingle()
  if (error || !data) return { ok: false, error: error?.message || 'Job not found in this workspace.' }
  await activity(supabase, id, companyId, user.id, 'cancelled', 'Job cancelled')
  invalidate(id); return { ok: true }
}

export async function archiveJob(formData: FormData) {
  const { supabase, user, companyId } = await getCompanyContext(); const id = clean(formData.get('id'))
  if (!user || !companyId || !id) return { ok: false, error: 'Job not found in this workspace.' }
  const { data, error } = await supabase.from('jobs').update({ archived_at: new Date().toISOString() }).eq('id', id).eq('company_id', companyId).is('archived_at', null).select('id').maybeSingle()
  if (error || !data) return { ok: false, error: error?.message || 'Job not found in this workspace.' }
  await activity(supabase, id, companyId, user.id, 'archived', 'Job archived')
  invalidate(id); return { ok: true }
}
