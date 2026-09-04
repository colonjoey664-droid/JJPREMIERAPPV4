# J&J OS

J&J OS is a tenant-scoped operating-system foundation for service businesses.

## Customers

- Personal/business customer details, types, notes, account numbers, and safe archive
- Multiple properties and pricebook/custom service assignments
- Server-side search, filters, pagination, profile views, and derived financial summaries
- Financial totals calculated from invoices and payments only

## Jobs

- Server-paginated Jobs board with search, status/date/customer/property/service/crew filters
- Customer → Property → Service job creation with one-time/recurring foundation
- Schedule, priority, price, tags, scope, internal/customer-facing notes, and safe cancel/archive workflows
- One-or-more crew assignments tied to real company members
- Job profile with schedule, crew, scope, notes, connections, activity, and attachment-metadata foundation
- Database-backed idempotency for job creation and tenant relationship checks

## Database migrations

Apply migrations in this order for a new V5 environment:

1. `supabase/customer_upgrade.sql` when the legacy payments foundation is absent.
2. `supabase/migrations/202609040001_customers_production.sql`
3. `supabase/migrations/202609040002_fix_property_trigger.sql`
4. `supabase/migrations/202609040003_jobs_production.sql`

The app uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
