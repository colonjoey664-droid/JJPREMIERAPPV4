-- Follow-up to the Customers migration. Properties does not have service_id,
-- so property and customer-service tenant checks must use separate triggers.

create or replace function public.enforce_property_company()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.customers where id = new.customer_id and company_id = new.company_id) then
    raise exception 'Customer does not belong to this company';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_customer_service_company()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.customers where id = new.customer_id and company_id = new.company_id) then
    raise exception 'Customer does not belong to this company';
  end if;
  if new.service_id is not null and not exists (select 1 from public.services where id = new.service_id and company_id = new.company_id) then
    raise exception 'Service does not belong to this company';
  end if;
  return new;
end;
$$;

drop trigger if exists properties_enforce_company on public.properties;
create trigger properties_enforce_company before insert or update on public.properties for each row execute function public.enforce_property_company();
drop trigger if exists customer_services_enforce_company on public.customer_services;
create trigger customer_services_enforce_company before insert or update on public.customer_services for each row execute function public.enforce_customer_service_company();
