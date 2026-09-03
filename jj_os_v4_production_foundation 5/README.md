# J&J OS V4 — production foundation

This is the first structured foundation for the real J&J OS application.

## Stack
- Next.js App Router + TypeScript
- Supabase/Postgres for authentication + database
- Row Level Security for tenant isolation
- Tailwind-ready component structure

## What is included
- Multi-tenant company model
- User membership + roles
- Customers + properties
- Jobs
- Estimates
- Invoices
- Database indexes and RLS policies
- Typed data-access helpers
- Starter dashboard route

## Setup
1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env.local`.
4. Add your Supabase URL and anon/publishable key.
5. Run `npm install` and `npm run dev`.

The existing GitHub Pages HTML prototype is intentionally not copied into this structure. V4 is the production foundation, not another single-file mockup.
