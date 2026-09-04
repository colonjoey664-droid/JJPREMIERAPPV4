-- Production customer foundation. Safe to apply to an existing V5 database.
-- Customer balances remain derived from invoices + payments and are never stored here.

alter table public.customers
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists business_name text,
  add column if not exists customer_type text not null default 'residential' check (customer_type in ('residential', 'commercial')),
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.properties
  add column if not exists notes text,
  add column if not exists status text not null default 'active' check (status in ('active', 'inactive')),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.customer_services (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  custom_name text,
  notes text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (service_id is not null or nullif(btrim(custom_name), '') is not null)
);

-- Cross-tenant UUID references are blocked even if an ID is guessed.
create or replace function public.enforce_customer_related_company()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from customers where id = new.customer_id and company_id = new.company_id) then
    raise exception 'Customer does not belong to this company';
  end if;
  if tg_table_name = 'customer_services' and new.service_id is not null
    and not exists (select 1 from services where id = new.service_id and company_id = new.company_id) then
    raise exception 'Service does not belong to this company';
  end if;
  return new;
end;
$$;
drop trigger if exists properties_enforce_company on public.properties;
create trigger properties_enforce_company before insert or update on public.properties for each row execute function public.enforce_customer_related_company();
drop trigger if exists customer_services_enforce_company on public.customer_services;
create trigger customer_services_enforce_company before insert or update on public.customer_services for each row execute function public.enforce_customer_related_company();

create index if not exists customers_company_active_created_idx on public.customers(company_id, archived_at, created_at desc);
create index if not exists customers_company_type_idx on public.customers(company_id, customer_type) where archived_at is null;
create index if not exists properties_customer_idx on public.properties(company_id, customer_id);
create index if not exists customer_services_customer_idx on public.customer_services(company_id, customer_id);
create index if not exists invoices_customer_idx on public.invoices(company_id, customer_id) where status <> 'void';
create index if not exists customers_name_search_idx on public.customers using gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(business_name, '') || ' ' || coalesce(email, '') || ' ' || coalesce(phone, '') || ' ' || coalesce(account_number, '')));
create index if not exists properties_address_search_idx on public.properties using gin (to_tsvector('simple', coalesce(address_line1, '') || ' ' || coalesce(city, '') || ' ' || coalesce(state, '') || ' ' || coalesce(postal_code, '')));

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at before update on public.customers for each row execute function public.set_updated_at();
drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at before update on public.properties for each row execute function public.set_updated_at();
drop trigger if exists customer_services_set_updated_at on public.customer_services;
create trigger customer_services_set_updated_at before update on public.customer_services for each row execute function public.set_updated_at();

alter table public.customer_services enable row level security;
drop policy if exists "company members customer services" on public.customer_services;
create policy "company members customer services" on public.customer_services for all
  using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));

-- Server pagination/search does not expose a company id to the browser. The function
-- explicitly verifies membership before returning any tenant row.
create or replace function public.search_customers_for_current_user(
  search_term text default '', status_filter text default 'all', type_filter text default 'all', page_number integer default 1, page_size integer default 50
)
returns table(id uuid, name text, account_number text, phone text, email text, status text, customer_type text, created_at timestamptz, property_count bigint, primary_address text, total_count bigint)
language sql security definer set search_path = public stable as $$
  with current_company as (
    select company_id from company_members where user_id = auth.uid() order by created_at limit 1
  ), matches as (
    select c.*, count(*) over() as count_all,
      (select count(*) from properties p where p.company_id = c.company_id and p.customer_id = c.id) as properties_total,
      (select concat_ws(', ', p.address_line1, p.city, p.state, p.postal_code) from properties p where p.company_id = c.company_id and p.customer_id = c.id order by p.created_at limit 1) as address
    from customers c join current_company cc on cc.company_id = c.company_id
    where c.archived_at is null
      and (status_filter = 'all' or c.status = status_filter)
      and (type_filter = 'all' or c.customer_type = type_filter)
      and (coalesce(search_term, '') = '' or concat_ws(' ', c.name, c.business_name, c.phone, c.email, c.account_number,
        coalesce((select string_agg(concat_ws(' ', p.address_line1,p.city,p.state,p.postal_code), ' ') from properties p where p.company_id=c.company_id and p.customer_id=c.id), '')) ilike '%' || search_term || '%')
  )
  select id, name, account_number, phone, email, status, customer_type, created_at, properties_total, address, count_all
  from matches order by created_at desc offset greatest(page_number - 1, 0) * least(greatest(page_size, 1), 100) limit least(greatest(page_size, 1), 100);
$$;
revoke all on function public.search_customers_for_current_user(text,text,text,integer,integer) from public;
grant execute on function public.search_customers_for_current_user(text,text,text,integer,integer) to authenticated;

create or replace function public.customer_financial_summary_for_current_user(target_customer_id uuid default null)
returns table(customer_id uuid, total_invoiced numeric, total_paid numeric, outstanding_balance numeric, overdue_balance numeric)
language sql security definer set search_path = public stable as $$
  with current_company as (select company_id from company_members where user_id=auth.uid() order by created_at limit 1),
  invoice_totals as (
    select i.customer_id, coalesce(sum(i.total), 0) invoiced,
      coalesce(sum(case when i.due_at < now() then greatest(i.total - coalesce((select sum(p.amount) from payments p where p.company_id=i.company_id and p.invoice_id=i.id),0),0) else 0 end),0) overdue
    from invoices i join current_company cc on cc.company_id=i.company_id
    where i.status <> 'void' and i.customer_id is not null and (target_customer_id is null or i.customer_id=target_customer_id) group by i.customer_id
  ), payment_totals as (
    -- A payment may be attached directly to a customer or only to its invoice.
    select coalesce(p.customer_id, i.customer_id) as customer_id, coalesce(sum(p.amount),0) paid
    from payments p left join invoices i on i.id=p.invoice_id and i.company_id=p.company_id
      join current_company cc on cc.company_id=p.company_id
    where coalesce(p.customer_id, i.customer_id) is not null
      and (target_customer_id is null or coalesce(p.customer_id, i.customer_id)=target_customer_id)
    group by coalesce(p.customer_id, i.customer_id)
  )
  select coalesce(i.customer_id,p.customer_id), coalesce(i.invoiced,0), coalesce(p.paid,0), greatest(coalesce(i.invoiced,0)-coalesce(p.paid,0),0), least(coalesce(i.overdue,0), greatest(coalesce(i.invoiced,0)-coalesce(p.paid,0),0))
  from invoice_totals i full outer join payment_totals p on p.customer_id=i.customer_id;
$$;
revoke all on function public.customer_financial_summary_for_current_user(uuid) from public;
grant execute on function public.customer_financial_summary_for_current_user(uuid) to authenticated;

-- An idempotency key makes a double-click or network retry return the first customer.
create table if not exists public.customer_creation_requests (
  company_id uuid not null references public.companies(id) on delete cascade,
  request_id uuid not null,
  customer_id uuid not null references public.customers(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(company_id, request_id)
);
alter table public.customer_creation_requests enable row level security;

create or replace function public.create_customer_for_current_user(payload jsonb, request_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; created_customer uuid; account text;
begin
  select company_id into cid from company_members where user_id=auth.uid() order by created_at limit 1;
  if cid is null then raise exception 'No company membership'; end if;
  select customer_id into created_customer from customer_creation_requests where company_id=cid and request_id=create_customer_for_current_user.request_id;
  if created_customer is not null then return created_customer; end if;
  if nullif(btrim(coalesce(payload->>'name','')), '') is null then raise exception 'Customer name is required'; end if;
  account := nullif(btrim(coalesce(payload->>'account_number','')), '');
  insert into customers(company_id,name,first_name,last_name,business_name,account_number,phone,email,status,customer_type,notes)
  values (cid, btrim(payload->>'name'), nullif(btrim(payload->>'first_name'),''), nullif(btrim(payload->>'last_name'),''), nullif(btrim(payload->>'business_name'),''), account, nullif(btrim(payload->>'phone'),''), nullif(btrim(payload->>'email'),''), coalesce(nullif(payload->>'status',''),'lead'), coalesce(nullif(payload->>'customer_type',''),'residential'), nullif(btrim(payload->>'notes'),'')) returning id into created_customer;
  insert into customer_creation_requests(company_id,request_id,customer_id) values(cid,request_id,created_customer);
  if nullif(btrim(coalesce(payload->>'address_line1','')), '') is not null then
    insert into properties(company_id,customer_id,address_line1,city,state,postal_code,notes,status) values(cid,created_customer,btrim(payload->>'address_line1'),nullif(btrim(payload->>'city'),''),nullif(btrim(payload->>'state'),''),nullif(btrim(payload->>'postal_code'),''),nullif(btrim(payload->>'property_notes'),''),coalesce(nullif(payload->>'property_status',''),'active'));
  end if;
  return created_customer;
exception when unique_violation then
  select customer_id into created_customer from customer_creation_requests where company_id=cid and request_id=create_customer_for_current_user.request_id;
  if created_customer is not null then return created_customer; end if;
  raise;
end;
$$;
revoke all on function public.create_customer_for_current_user(jsonb,uuid) from public;
grant execute on function public.create_customer_for_current_user(jsonb,uuid) to authenticated;
