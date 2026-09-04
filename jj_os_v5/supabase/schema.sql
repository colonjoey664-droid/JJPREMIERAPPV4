create extension if not exists pgcrypto;

create type public.member_role as enum ('owner','admin','manager','field_technician');
create type public.job_status as enum ('draft','scheduled','in_progress','completed','cancelled');
create type public.estimate_status as enum ('draft','sent','awaiting_approval','approved','declined','expired');
create type public.invoice_status as enum ('draft','sent','due','paid','void');

create table public.companies (id uuid primary key default gen_random_uuid(), name text not null, industry text, logo_url text, primary_color text, settings jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, full_name text, created_at timestamptz not null default now());
create table public.company_members (company_id uuid not null references public.companies(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade, role public.member_role not null default 'field_technician', created_at timestamptz not null default now(), primary key(company_id,user_id));
create table public.customers (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade, name text not null, account_number text, phone text, email text, status text not null default 'lead', service_type text, notes text, created_at timestamptz not null default now());
create table public.properties (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade, customer_id uuid not null references public.customers(id) on delete cascade, address_line1 text not null, city text, state text, postal_code text, latitude double precision, longitude double precision, created_at timestamptz not null default now());
create table public.services (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade, name text not null, description text, active boolean not null default true, pricing jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create table public.jobs (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade, customer_id uuid references public.customers(id) on delete set null, property_id uuid references public.properties(id) on delete set null, service_id uuid references public.services(id) on delete set null, title text not null, status public.job_status not null default 'draft', scheduled_start timestamptz, scheduled_end timestamptz, assigned_user_ids uuid[] not null default '{}', progress integer not null default 0 check(progress between 0 and 100), notes text, completion_data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create table public.estimates (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade, customer_id uuid references public.customers(id) on delete set null, property_id uuid references public.properties(id) on delete set null, number text not null, status public.estimate_status not null default 'draft', subtotal numeric(12,2) not null default 0, tax numeric(12,2) not null default 0, total numeric(12,2) not null default 0, scope text, created_at timestamptz not null default now());
create table public.invoices (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade, customer_id uuid references public.customers(id) on delete set null, estimate_id uuid references public.estimates(id) on delete set null, number text not null, status public.invoice_status not null default 'draft', subtotal numeric(12,2) not null default 0, tax numeric(12,2) not null default 0, total numeric(12,2) not null default 0, due_at timestamptz, paid_at timestamptz, created_at timestamptz not null default now());
create table public.payments (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade, customer_id uuid references public.customers(id) on delete set null, invoice_id uuid references public.invoices(id) on delete set null, amount numeric(12,2) not null check(amount > 0), payment_date timestamptz not null default now(), method text, reference text, notes text, created_at timestamptz not null default now());

create index customers_company_idx on public.customers(company_id);
create index customers_company_status_idx on public.customers(company_id, status);
create index customers_company_name_idx on public.customers(company_id, name);
create unique index customers_company_account_number_uidx on public.customers(company_id, account_number) where account_number is not null;
create index payments_company_idx on public.payments(company_id);
create index payments_customer_idx on public.payments(company_id, customer_id);
create index payments_invoice_idx on public.payments(company_id, invoice_id);
create index properties_company_idx on public.properties(company_id);
create index jobs_company_idx on public.jobs(company_id);
create index estimates_company_idx on public.estimates(company_id);
create index invoices_company_idx on public.invoices(company_id);

create or replace function public.is_company_member(target_company uuid) returns boolean language sql security definer set search_path=public stable as $$ select exists(select 1 from public.company_members where company_id=target_company and user_id=auth.uid()); $$;

create or replace function public.create_company_for_current_user(company_name text, company_industry text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare new_company uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into public.profiles(id) values(auth.uid()) on conflict (id) do nothing;
  insert into public.companies(name, industry) values(company_name, company_industry) returning id into new_company;
  insert into public.company_members(company_id, user_id, role) values(new_company, auth.uid(), 'owner');
  return new_company;
end;
$$;
revoke all on function public.create_company_for_current_user(text,text) from public;
grant execute on function public.create_company_for_current_user(text,text) to authenticated;

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.company_members enable row level security;
alter table public.customers enable row level security;
alter table public.properties enable row level security;
alter table public.services enable row level security;
alter table public.jobs enable row level security;
alter table public.estimates enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;

create policy "members can read companies" on public.companies for select using (public.is_company_member(id));
create policy "users read own profile" on public.profiles for select using (id=auth.uid());
create policy "members read membership" on public.company_members for select using (user_id=auth.uid() or public.is_company_member(company_id));
create policy "company members customers" on public.customers for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy "company members properties" on public.properties for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy "company members services" on public.services for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy "company members jobs" on public.jobs for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy "company members estimates" on public.estimates for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy "company members invoices" on public.invoices for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy "company members payments" on public.payments for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
