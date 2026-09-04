# J&J OS — Customers

The Customers module is a tenant-scoped production foundation for J&J OS.

## Included

- Personal/business customer details, status, type, notes and tenant association
- Multiple properties with independent status and notes
- Service assignments linked to the company pricebook or a custom service name
- Server-side search by name, business, account number, phone, email, or property address
- Status/type filters and 50-record pagination
- Customer profile with Overview, Properties, Services, Jobs, Estimates, Invoices, Payments and Notes
- Safe archive: historical records remain attached and intact
- UI and database idempotency protection for customer creation
- Tenant isolation through RLS, membership-derived company context, and authorization in database functions
- Financial summaries calculated only from invoices and payments

## Database migration

Apply `supabase/customer_upgrade.sql` first only if this V5 schema has not already been upgraded. Then apply `supabase/migrations/202609040001_customers_production.sql` in the Supabase SQL Editor (or with the Supabase CLI) before deploying.

The app uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Do not manually enter paid or owed totals on customers. Those figures are derived from invoices and recorded payments.
