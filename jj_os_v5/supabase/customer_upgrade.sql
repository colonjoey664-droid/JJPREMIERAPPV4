-- J&J OS customer + financial foundation upgrade
-- Run once in Supabase SQL Editor.

alter table public.customers
  add column if not exists account_number text,
  add column if not exists service_type text;

-- These were used by the prototype as manual numbers. They are intentionally removed
-- so customer financials can only come from the financial system.
alter table public.customers drop column if exists lifetime_paid;
alter table public.customers drop column if exists balance_owed;

create unique index if not exists customers_company_account_number_uidx
  on public.customers(company_id, account_number)
  where account_number is not null;

create index if not exists customers_company_account_idx
  on public.customers(company_id, account_number);

-- Payments are the source of truth for money actually received.
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  payment_date timestamptz not null default now(),
  method text,
  reference text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists payments_company_idx on public.payments(company_id);
create index if not exists payments_customer_idx on public.payments(company_id, customer_id);
create index if not exists payments_invoice_idx on public.payments(company_id, invoice_id);

alter table public.payments enable row level security;
drop policy if exists "company members payments" on public.payments;
create policy "company members payments" on public.payments
  for all using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));
