# Architecture

## Overview

A single-clinic, single-doctor system. One Next.js application serves the public website, the staff dashboard and a JSON API. All state lives in PostgreSQL, accessed through Prisma with the `pg` driver adapter. Authentication uses Better Auth with e-mail and password.

```text
Browser ──► Next.js App Router
             ├─ (public) / and public_website/   public site, booking and review forms
             ├─ (auth)/login                     staff sign-in (password or QR approval)
             ├─ (dashboard)/…                    staff pages (server-guarded per role)
             └─ api/…                            JSON API, one route file per resource
                    │
                    ▼
        authorize(permission) ─► route handler ─► module service ─► Prisma ─► PostgreSQL
                                        │
                                        └─► writeAuditEvent (same transaction as the change)
```

## Folder layout

```text
src/
├── app/
│   ├── (public)/ (auth)/ (dashboard)/   pages; dashboard pages call requireSection()
│   ├── api/                              API routes (see API_DOCUMENTATION.md)
│   └── public_website/                   public site: components, queries, public API routes
├── modules/                              feature code; each folder holds what it needs
│   ├── appointments/  patients/  treatments/  clinical/  expenses/  billing/
│   ├── dashboard/  clinic/  auth/
│   └── …/{schemas,services,queries,components}
├── lib/                                  cross-cutting code
│   ├── permissions.ts      roles, permissions, page-to-permission map
│   ├── admin-session.ts    getStaffSession() and authorize()
│   ├── section-access.ts   requireSection() page guard
│   ├── api.ts              apiError, parseBody, parseQuery, isPrismaError
│   ├── audit.ts            writeAuditEvent (optionally inside a transaction)
│   ├── rate-limit.ts       fixed-window limiter for public endpoints
│   └── clinic-date.ts      Asia/Dhaka date helpers
├── components/shared/      Modal, PatientSelect, session provider …
└── generated/prisma/       Prisma client (generated; not committed)
prisma/                     schema, migrations, seed scripts
tests/                      Vitest suites (real handlers, real sessions, test database)
scripts/                    operational scripts
```

## Request flow and layering

1. **Authorization first.** Every protected route starts with `authorize(request.headers, "<permission>")`. It checks the Better Auth session, that the account has a staff role, and that the role holds the permission. Failures are `401` (no session) or `403` (no permission).
2. **Validation.** Input is parsed with zod (or the existing hand-written appointment parser). New routes use `parseBody` / `parseQuery` from `src/lib/api.ts`, which give one consistent `{ error }` response with status `400`.
3. **Service layer.** Business rules that more than one route needs, or that need a transaction, live in `modules/*/services` (appointment scheduling, patient creation, treatment plans, clinical records). Small single-purpose routes keep their query inline rather than add a pass-through layer.
4. **Audit.** State changes write an `AuditEvent`. For money and clinical records the audit row is written inside the same database transaction, so a change can never be committed without its audit entry.

## Roles and permissions

`src/lib/permissions.ts` is the single source of truth. Roles are `admin`, `receptionist` and the default `user` (no access). Each API route and dashboard page names one permission; the sidebar shows only pages the role may open. See the table in [README.md](README.md#roles).

Decisions:

- **Role as a string on the Better Auth user**, constrained by a database `CHECK`. A separate roles table would add joins and screens for two fixed roles.
- **No `doctor` role.** The clinic has one doctor, who uses the administrator account. Clinical data is therefore administrator-only; the receptionist cannot read diagnoses, prescriptions, dental charts or examination notes. The follow-up reminder endpoint deliberately returns contact details only.
- **Page guards plus API guards.** `requireSection()` redirects a role away from a page it may not open; the API still rejects the same role if it calls the endpoint directly.

## Concurrency and money

- Appointment, payment, void and refund operations take the same PostgreSQL advisory lock (`pg_advisory_xact_lock`), so two simultaneous requests cannot both claim a slot or overpay an invoice.
- All money arithmetic is in integer cents (`src/modules/billing/services/invoice-math.ts`); amounts are stored as `DECIMAL(12,2)`. Invoice totals are not stored: they are always derived from subtotal, discount and tax, so they cannot disagree with the line items.
- Patient codes (`PID-00001`) and invoice numbers (`INV-000001`) come from PostgreSQL sequences, so they are unique and never reused.

## Caching

The public website and its read-only endpoints are cached (`cacheComponents`, tagged invalidation in `src/lib/public-cache.ts`). Everything in the staff dashboard is dynamic: clinical and financial data is never cached. Staff screens refresh through a Server-Sent Events stream (`/api/realtime`) fed by PostgreSQL `LISTEN`/`NOTIFY`; database triggers publish table and operation names only, never record contents. There is no Redis; the load of a single clinic does not justify it.

## Public website

The public site (`/`, `src/app/public_website`) shows clinic information, services, a gallery of image URLs and moderated reviews, and accepts appointment requests. Requests are saved as `PENDING` with their booking channel (website or WhatsApp; WhatsApp requests are saved before the prefilled message opens). Public POST endpoints are rate limited per client IP in the shared `rateLimit` table, which requires the reverse proxy to overwrite `x-forwarded-for`.

## Security notes

- Public sign-up is disabled; accounts are created by an administrator.
- Sessions use Better Auth cookies; sign-in is rate limited by Better Auth (database storage).
- Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) are set in `next.config.ts`. A Content-Security-Policy is not set: Next.js inline scripts need a nonce-based policy, which is a separate piece of work.
- IDOR: the system is single-tenant, so object ownership is not a boundary; the boundary is the role. Every object route re-checks the role, and tests assert both the allowed and the refused cases.
- Patient privacy: receptionists can read the patient profile (including medical history and allergies, which front-desk staff need for safety alerts) but not clinical records.

## Backup and recovery

See [README.md](README.md#backup-and-recovery). Because financial history must stay reconstructable, invoices are voided and expenses are voided (with a reason) instead of deleted, and patients with any history can only be disabled.

## Breaking changes in this version

- Non-admin staff can now sign in; the login screen and dashboard accept `receptionist` as well as `admin`.
- New invoices are numbered `INV-000123` from a sequence (older `INV-XXXXXXXX` codes are unchanged).
- Completed and cancelled appointments can no longer be edited (create a new appointment instead).
- Forbidden API calls now return `403` with "You do not have permission to perform this action." (previously a bare "Unauthorized" for non-admins).
- New tables and constraints: see [DATABASE.md](DATABASE.md). Apply with `pnpm exec prisma migrate deploy`.
