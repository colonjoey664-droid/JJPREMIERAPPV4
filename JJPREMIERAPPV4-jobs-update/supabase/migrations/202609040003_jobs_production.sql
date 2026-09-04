-- Jobs production foundation. Apply after the Customers migrations.

-- `draft` is retained as the persisted compatibility value for an unscheduled
-- job. The application presents it as “Unscheduled”, avoiding an enum rewrite.

alter table public.jobs
  add column if not exists job_number text,
  add column if not exists description text,
  add column if not exists internal_notes text,
  add column if not exists customer_notes text,
  add column if not exists value numeric(12,2) not null default 0 check (value >= 0),
  add column if not exists priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  add column if not exists work_type text not null default 'one_time' check (work_type in ('one_time', 'recurring')),
  add column if not exists recurrence_rule jsonb not null default '{}'::jsonb,
  add column if not exists tags text[] not null default '{}',
  add column if not exists estimate_id uuid references public.estimates(id) on delete set null,
  add column if not exists invoice_id uuid references public.invoices(id) on delete set null,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists jobs_company_job_number_uidx on public.jobs(company_id, job_number) where job_number is not null;
create index if not exists jobs_company_active_schedule_idx on public.jobs(company_id, archived_at, scheduled_start) where archived_at is null;
create index if not exists jobs_company_status_schedule_idx on public.jobs(company_id, status, scheduled_start) where archived_at is null;
create index if not exists jobs_customer_idx on public.jobs(company_id, customer_id) where archived_at is null;
create index if not exists jobs_property_idx on public.jobs(company_id, property_id) where archived_at is null;
create index if not exists jobs_service_idx on public.jobs(company_id, service_id) where archived_at is null;
create index if not exists jobs_search_idx on public.jobs using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(job_number, '') || ' ' || coalesce(description, '')));

create table if not exists public.job_assignments (
  job_id uuid not null references public.jobs(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assignment_role text,
  created_at timestamptz not null default now(),
  primary key(job_id, user_id)
);
create index if not exists job_assignments_company_user_idx on public.job_assignments(company_id, user_id);
alter table public.job_assignments enable row level security;
drop policy if exists "company members job assignments" on public.job_assignments;
create policy "company members job assignments" on public.job_assignments for all
  using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));

-- Metadata-only foundations; files will later live in Supabase Storage rather
-- than the database. Activity records provide an auditable history.
create table if not exists public.job_activity (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists job_activity_job_idx on public.job_activity(company_id, job_id, created_at desc);
alter table public.job_activity enable row level security;
create policy "company members job activity" on public.job_activity for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));

create table if not exists public.job_attachments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  byte_size bigint check (byte_size is null or byte_size >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists job_attachments_job_idx on public.job_attachments(company_id, job_id, created_at desc);
alter table public.job_attachments enable row level security;
create policy "company members job attachments" on public.job_attachments for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));

create or replace function public.enforce_job_related_company()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.customer_id is not null and not exists (select 1 from customers where id=new.customer_id and company_id=new.company_id) then raise exception 'Customer does not belong to this company'; end if;
  if new.property_id is not null and not exists (select 1 from properties where id=new.property_id and company_id=new.company_id and (new.customer_id is null or customer_id=new.customer_id)) then raise exception 'Property does not belong to this customer and company'; end if;
  if new.service_id is not null and not exists (select 1 from services where id=new.service_id and company_id=new.company_id) then raise exception 'Service does not belong to this company'; end if;
  if new.estimate_id is not null and not exists (select 1 from estimates where id=new.estimate_id and company_id=new.company_id) then raise exception 'Estimate does not belong to this company'; end if;
  if new.invoice_id is not null and not exists (select 1 from invoices where id=new.invoice_id and company_id=new.company_id) then raise exception 'Invoice does not belong to this company'; end if;
  return new;
end;
$$;
drop trigger if exists jobs_enforce_related_company on public.jobs;
create trigger jobs_enforce_related_company before insert or update on public.jobs for each row execute function public.enforce_job_related_company();

create or replace function public.enforce_job_assignment_company()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from jobs where id=new.job_id and company_id=new.company_id) then raise exception 'Job does not belong to this company'; end if;
  if not exists (select 1 from company_members where company_id=new.company_id and user_id=new.user_id) then raise exception 'Assignee is not a company member'; end if;
  return new;
end;
$$;
drop trigger if exists job_assignments_enforce_company on public.job_assignments;
create trigger job_assignments_enforce_company before insert or update on public.job_assignments for each row execute function public.enforce_job_assignment_company();

create or replace function public.enforce_job_child_company()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from jobs where id=new.job_id and company_id=new.company_id) then raise exception 'Job does not belong to this company'; end if;
  return new;
end;
$$;
drop trigger if exists job_activity_enforce_company on public.job_activity;
create trigger job_activity_enforce_company before insert or update on public.job_activity for each row execute function public.enforce_job_child_company();
drop trigger if exists job_attachments_enforce_company on public.job_attachments;
create trigger job_attachments_enforce_company before insert or update on public.job_attachments for each row execute function public.enforce_job_child_company();

create or replace function public.set_job_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at before update on public.jobs for each row execute function public.set_job_updated_at();

create table if not exists public.job_creation_requests (
  company_id uuid not null references public.companies(id) on delete cascade,
  request_id uuid not null,
  job_id uuid not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(company_id, request_id)
);
alter table public.job_creation_requests enable row level security;

create or replace function public.create_job_for_current_user(payload jsonb, request_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; created_job uuid; assignee uuid; status_value public.job_status;
begin
  select company_id into cid from company_members where user_id=auth.uid() order by created_at limit 1;
  if cid is null then raise exception 'No company membership'; end if;
  select job_id into created_job from job_creation_requests where company_id=cid and request_id=create_job_for_current_user.request_id;
  if created_job is not null then return created_job; end if;
  if nullif(btrim(coalesce(payload->>'title','')), '') is null then raise exception 'Job title is required'; end if;
  status_value := case coalesce(nullif(payload->>'status',''),'unscheduled')
    when 'unscheduled' then 'draft'::public.job_status
    else (payload->>'status')::public.job_status
  end;
  insert into jobs(company_id,job_number,customer_id,property_id,service_id,title,status,scheduled_start,scheduled_end,description,internal_notes,customer_notes,value,priority,work_type,recurrence_rule,tags)
  values (cid, nullif(btrim(payload->>'job_number'),''), nullif(payload->>'customer_id','')::uuid, nullif(payload->>'property_id','')::uuid, nullif(payload->>'service_id','')::uuid, btrim(payload->>'title'), status_value, nullif(payload->>'scheduled_start','')::timestamptz, nullif(payload->>'scheduled_end','')::timestamptz, nullif(btrim(payload->>'description'),''), nullif(btrim(payload->>'internal_notes'),''), nullif(btrim(payload->>'customer_notes'),''), greatest(coalesce(nullif(payload->>'value','')::numeric,0),0), coalesce(nullif(payload->>'priority',''),'normal'), coalesce(nullif(payload->>'work_type',''),'one_time'), coalesce(payload->'recurrence_rule','{}'::jsonb), coalesce(array(select jsonb_array_elements_text(coalesce(payload->'tags','[]'::jsonb))), '{}'))
  returning id into created_job;
  insert into job_creation_requests(company_id,request_id,job_id) values(cid,request_id,created_job);
  insert into job_activity(company_id,job_id,actor_id,event_type,summary) values(cid,created_job,auth.uid(),'created','Job created');
  for assignee in select value::uuid from jsonb_array_elements_text(coalesce(payload->'assignee_ids','[]'::jsonb)) loop
    insert into job_assignments(job_id,company_id,user_id) values(created_job,cid,assignee) on conflict do nothing;
  end loop;
  return created_job;
exception when unique_violation then
  select job_id into created_job from job_creation_requests where company_id=cid and request_id=create_job_for_current_user.request_id;
  if created_job is not null then return created_job; end if;
  raise;
end;
$$;
revoke all on function public.create_job_for_current_user(jsonb,uuid) from public;
grant execute on function public.create_job_for_current_user(jsonb,uuid) to authenticated;

create or replace function public.search_jobs_for_current_user(search_term text default '', status_filter text default 'all', date_filter text default 'all', customer_filter uuid default null, property_filter uuid default null, service_filter uuid default null, assignee_filter uuid default null, page_number integer default 1, page_size integer default 50)
returns table(id uuid, job_number text, title text, status text, priority text, value numeric, scheduled_start timestamptz, scheduled_end timestamptz, customer_name text, property_address text, service_name text, crew_names text, total_count bigint)
language sql security definer set search_path = public stable as $$
  with current_company as (select company_id from company_members where user_id=auth.uid() order by created_at limit 1), matches as (
    select j.*, count(*) over() count_all, c.name customer_display,
      concat_ws(', ', p.address_line1, p.city, p.state, p.postal_code) property_display, s.name service_display,
      coalesce((select string_agg(coalesce(pr.full_name,'Team member'), ', ' order by pr.full_name) from job_assignments ja left join profiles pr on pr.id=ja.user_id where ja.job_id=j.id), '') crew_display
    from jobs j join current_company cc on cc.company_id=j.company_id
      left join customers c on c.id=j.customer_id and c.company_id=j.company_id
      left join properties p on p.id=j.property_id and p.company_id=j.company_id
      left join services s on s.id=j.service_id and s.company_id=j.company_id
    where j.archived_at is null and (status_filter='all' or (status_filter='unscheduled' and j.status='draft') or j.status::text=status_filter)
      and (customer_filter is null or j.customer_id=customer_filter) and (property_filter is null or j.property_id=property_filter) and (service_filter is null or j.service_id=service_filter)
      and (assignee_filter is null or exists(select 1 from job_assignments ja where ja.job_id=j.id and ja.user_id=assignee_filter))
      and (date_filter='all' or (date_filter='unscheduled' and j.scheduled_start is null) or (date_filter='today' and j.scheduled_start::date=current_date) or (date_filter='week' and j.scheduled_start >= date_trunc('week',now()) and j.scheduled_start < date_trunc('week',now()) + interval '7 days'))
      and (coalesce(search_term,'')='' or concat_ws(' ',j.job_number,j.title,j.description,c.name,p.address_line1,p.city,s.name) ilike '%'||search_term||'%')
  )
  select id, job_number, title, case when status='draft' then 'unscheduled' else status::text end, priority, value, scheduled_start, scheduled_end, customer_display, property_display, service_display, crew_display, count_all
  from matches order by scheduled_start nulls last, created_at desc offset greatest(page_number-1,0)*least(greatest(page_size,1),100) limit least(greatest(page_size,1),100);
$$;
revoke all on function public.search_jobs_for_current_user(text,text,text,uuid,uuid,uuid,uuid,integer,integer) from public;
grant execute on function public.search_jobs_for_current_user(text,text,text,uuid,uuid,uuid,uuid,integer,integer) to authenticated;
