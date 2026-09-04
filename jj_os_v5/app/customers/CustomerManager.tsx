'use client'

import { useMemo, useState, useTransition } from 'react'
import { addCustomer, deleteCustomer, updateCustomer } from './actions'

type Customer = {
  id: string
  name: string
  phone: string | null
  email: string | null
  status: string
  service_type: string | null
  notes: string | null
  lifetime_paid: number | string | null
  balance_owed: number | string | null
  created_at: string
  properties?: Array<{
    id: string
    address_line1: string
    city: string | null
    state: string | null
    postal_code: string | null
  }>
}

const money = (value: number | string | null | undefined) => `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const statusLabel = (status: string) => status.charAt(0).toUpperCase() + status.slice(1)

function CustomerForm({ customer, onDone, onCancel }: { customer?: Customer; onDone: () => void; onCancel?: () => void }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const property = customer?.properties?.[0]

  const submit = (formData: FormData) => {
    setError('')
    startTransition(async () => {
      const result = customer ? await updateCustomer(formData) : await addCustomer(formData)
      if (!result.ok) {
        setError(result.error || 'Something went wrong.')
        return
      }
      onDone()
    })
  }

  return (
    <form action={submit} className="customer-editor">
      {customer && <input type="hidden" name="id" value={customer.id} />}
      {property && <input type="hidden" name="property_id" value={property.id} />}
      <div className="editor-section">
        <div className="editor-heading"><div><div className="eyebrow">Customer details</div><h3>{customer ? 'Edit customer' : 'New customer'}</h3></div></div>
        <div className="form-grid two">
          <label><span>Name *</span><input name="name" required defaultValue={customer?.name || ''} placeholder="John Smith" /></label>
          <label><span>Status</span><select name="status" defaultValue={customer?.status || 'lead'}><option value="lead">Lead</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          <label><span>Phone</span><input name="phone" defaultValue={customer?.phone || ''} placeholder="(973) 555-0123" /></label>
          <label><span>Email</span><input name="email" type="email" defaultValue={customer?.email || ''} placeholder="john@example.com" /></label>
          <label><span>Primary service</span><input name="service_type" defaultValue={customer?.service_type || ''} placeholder="Lawn maintenance" /></label>
          <label><span>Notes</span><input name="notes" defaultValue={customer?.notes || ''} placeholder="Gate code, preferences, etc." /></label>
        </div>
      </div>

      <div className="editor-section">
        <div className="editor-heading"><div><div className="eyebrow">Property</div><h3>Primary service address</h3></div></div>
        <div className="form-grid two">
          <label className="full"><span>Street address</span><input name="address_line1" defaultValue={property?.address_line1 || ''} placeholder="123 Main Street" /></label>
          <label><span>City</span><input name="city" defaultValue={property?.city || ''} placeholder="Wayne" /></label>
          <label><span>State</span><input name="state" defaultValue={property?.state || 'NJ'} placeholder="NJ" /></label>
          <label><span>ZIP</span><input name="postal_code" defaultValue={property?.postal_code || ''} placeholder="07470" /></label>
        </div>
      </div>

      <div className="editor-section">
        <div className="editor-heading"><div><div className="eyebrow">Financial snapshot</div><h3>Starting customer balance</h3><p className="field-help">These are starting values for now. Later, invoices and payments will calculate these automatically.</p></div></div>
        <div className="form-grid two">
          <label><span>Total paid to date</span><div className="money-input"><span>$</span><input name="lifetime_paid" inputMode="decimal" defaultValue={customer?.lifetime_paid ? Number(customer.lifetime_paid).toFixed(2) : ''} placeholder="0.00" /></div></label>
          <label><span>Currently owed</span><div className="money-input"><span>$</span><input name="balance_owed" inputMode="decimal" defaultValue={customer?.balance_owed ? Number(customer.balance_owed).toFixed(2) : ''} placeholder="0.00" /></div></label>
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      <div className="editor-actions">
        {onCancel && <button type="button" className="btn secondary" onClick={onCancel} disabled={pending}>Cancel</button>}
        <button className="btn" type="submit" disabled={pending}>{pending ? 'Saving…' : customer ? 'Save changes' : 'Create customer'}</button>
      </div>
    </form>
  )
}

export default function CustomerManager({ customers }: { customers: Customer[] }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [selected, setSelected] = useState<Customer | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [pending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return customers.filter(c => {
      const matchesStatus = status === 'all' || c.status === status
      const haystack = [c.name, c.phone, c.email, c.service_type, c.properties?.[0]?.address_line1, c.properties?.[0]?.city].filter(Boolean).join(' ').toLowerCase()
      return matchesStatus && (!q || haystack.includes(q))
    })
  }, [customers, query, status])

  const totals = useMemo(() => ({
    count: customers.length,
    active: customers.filter(c => c.status === 'active').length,
    leads: customers.filter(c => c.status === 'lead').length,
    owed: customers.reduce((sum, c) => sum + Number(c.balance_owed || 0), 0),
  }), [customers])

  const remove = (customer: Customer) => {
    if (!window.confirm(`Delete ${customer.name}? This will also remove their properties. This cannot be undone.`)) return
    setDeleteError('')
    const fd = new FormData()
    fd.set('id', customer.id)
    startTransition(async () => {
      const result = await deleteCustomer(fd)
      if (!result.ok) {
        setDeleteError(result.error || 'Could not delete customer.')
        return
      }
      setSelected(null)
    })
  }

  return (
    <>
      <div className="customer-stats">
        <div className="stat-card"><span>Total customers</span><strong>{totals.count}</strong></div>
        <div className="stat-card"><span>Active</span><strong>{totals.active}</strong></div>
        <div className="stat-card"><span>Leads</span><strong>{totals.leads}</strong></div>
        <div className="stat-card"><span>Outstanding</span><strong>{money(totals.owed)}</strong></div>
      </div>

      <div className="customer-toolbar">
        <div className="search-wrap"><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search customers, phone, email, address…" /></div>
        <select value={status} onChange={e => setStatus(e.target.value)} aria-label="Filter customers"><option value="all">All customers</option><option value="lead">Leads</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
        <button className="btn" onClick={() => { setCreating(true); setSelected(null); setEditing(false) }}>+ New customer</button>
      </div>

      {deleteError && <div className="error section-error">{deleteError}</div>}

      {creating && <div className="card section"><CustomerForm onDone={() => setCreating(false)} onCancel={() => setCreating(false)} /></div>}

      <div className="customer-content">
        <div className="card customer-table-card">
          <div className="table-head"><div><div className="eyebrow">CRM</div><h2>Customer directory</h2></div><span className="result-count">{filtered.length} shown</span></div>
          {filtered.length ? <div className="customer-table">
            {filtered.map(c => {
              const property = c.properties?.[0]
              return <button className="customer-item" key={c.id} onClick={() => { setSelected(c); setEditing(false); setCreating(false) }}>
                <div className="avatar">{c.name.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase()}</div>
                <div className="customer-main"><strong>{c.name}</strong><span>{c.service_type || 'Service not set'} {property ? `· ${property.city || property.address_line1}` : ''}</span></div>
                <div className="customer-contact"><span>{c.phone || 'No phone'}</span><span>{c.email || 'No email'}</span></div>
                <div className="customer-money"><span>Owed</span><strong>{money(c.balance_owed)}</strong></div>
                <span className={`status ${c.status}`}>{statusLabel(c.status)}</span><span className="chevron">›</span>
              </button>
            })}
          </div> : <div className="empty-state"><div className="empty-icon">◎</div><h3>{query || status !== 'all' ? 'No customers match that filter' : 'Your customer book is empty'}</h3><p>{query || status !== 'all' ? 'Try a different search or filter.' : 'Add your first customer and start building their complete service history.'}</p>{!query && status === 'all' && <button className="btn" onClick={() => setCreating(true)}>Add your first customer</button>}</div>}
        </div>

        {selected && <aside className="card customer-profile">
          <div className="profile-top"><button className="icon-btn" onClick={() => setSelected(null)} aria-label="Close">×</button><div className="profile-avatar">{selected.name.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase()}</div><h2>{selected.name}</h2><span className={`status ${selected.status}`}>{statusLabel(selected.status)}</span></div>
          {editing ? <CustomerForm customer={selected} onDone={() => { setEditing(false); setSelected(null) }} onCancel={() => setEditing(false)} /> : <>
            <div className="profile-actions"><button className="btn" onClick={() => setEditing(true)}>Edit customer</button><button className="btn danger" onClick={() => remove(selected)} disabled={pending}>Delete</button></div>
            <div className="profile-section"><h4>Contact</h4><div className="detail"><span>Phone</span><strong>{selected.phone || 'Not provided'}</strong></div><div className="detail"><span>Email</span><strong>{selected.email || 'Not provided'}</strong></div></div>
            <div className="profile-section"><h4>Service</h4><div className="detail"><span>Primary service</span><strong>{selected.service_type || 'Not set'}</strong></div><div className="detail"><span>Property</span><strong>{selected.properties?.[0] ? [selected.properties[0].address_line1, selected.properties[0].city, selected.properties[0].state, selected.properties[0].postal_code].filter(Boolean).join(', ') : 'Not provided'}</strong></div></div>
            <div className="profile-section financial"><h4>Financial snapshot</h4><div className="finance-grid"><div><span>Paid to date</span><strong>{money(selected.lifetime_paid)}</strong></div><div><span>Currently owed</span><strong>{money(selected.balance_owed)}</strong></div></div></div>
            {selected.notes && <div className="profile-section"><h4>Notes</h4><p className="notes">{selected.notes}</p></div>}
            <div className="profile-section next-up"><h4>Customer timeline</h4><p>Jobs, estimates, invoices, payments, messages, and photos will appear here as those modules come online.</p></div>
          </>}
        </aside>}
      </div>
    </>
  )
}
