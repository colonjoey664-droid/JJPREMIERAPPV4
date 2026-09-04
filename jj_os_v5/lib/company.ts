import { createClient } from './supabase/server'

/** The active company is always resolved from the authenticated membership, never input. */
export async function getCompanyContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, companyId: null as string | null }

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  return { supabase, user, companyId: membership?.company_id ?? null }
}
