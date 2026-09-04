-- J&J OS customer module upgrade
-- Run this once in Supabase SQL Editor before deploying the upgraded Customers screen.

alter table public.customers
  add column if not exists service_type text,
  add column if not exists lifetime_paid numeric(12,2) not null default 0,
  add column if not exists balance_owed numeric(12,2) not null default 0;

create index if not exists customers_company_status_idx
  on public.customers(company_id, status);

create index if not exists customers_company_name_idx
  on public.customers(company_id, name);
