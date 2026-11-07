# Dr Ovi's Dental Care: Clinic Management System

A clinic administration system for a single-doctor dental clinic, built with Next.js (App Router), React, TypeScript, Better Auth, Prisma and PostgreSQL. Staff manage patients, appointments, clinical records, treatment plans, prescriptions, billing, expenses and reports. A public website lets patients see the clinic and request appointments.

| Document | What it covers |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Folder layout, request flow, roles and permissions, key decisions |
| [DATABASE.md](DATABASE.md) | Tables, relationships, constraints, indexes, migrations |
| [API_DOCUMENTATION.md](API_DOCUMENTATION.md) | Every API route, its permission, input and output |
| [SEEDING.md](SEEDING.md) | Demo data, demo logins and how to run the seed safely |

## Roles

| Role | Access |
| --- | --- |
| `admin` | Everything, including clinical records, prescriptions, treatments, expenses, reports, services, doctor profile, audit log and security. |
| `receptionist` | Front desk: patients (not delete), appointments (not delete), invoices and payments (not void or refund), daily collection, follow-up reminders and read-only access to treatments, services and the doctor profile. No clinical records, prescriptions, expenses, reports or security. |
| `user` | Can sign in but has no clinic access. |

Permissions are enforced on the server for every page and API route (`src/lib/permissions.ts`); hiding a menu item is only a convenience.

## Local setup

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` to a PostgreSQL database you control. Set `BETTER_AUTH_URL` to the app's origin and replace `BETTER_AUTH_SECRET` with a random secret of at least 32 characters.
3. Set `ADMIN_NAME` and `ADMIN_EMAIL` in `.env`. The seed command securely prompts for the initial administrator password in the terminal; the password is not saved in an environment file.
4. Generate the Prisma client, create the database tables, and seed the administrator:

   ```bash
   pnpm db:generate
   pnpm db:migrate
   pnpm db:seed
   ```

5. Start the app with `pnpm dev` and sign in at `/login`.

The seed command creates the administrator with Better Auth and assigns the `admin` role. Public email sign-up is disabled in Better Auth. Existing administrators can change their password from the Security section of the dashboard or run `pnpm admin:reset-password` from an interactive terminal; it prompts for the new password without echoing it and revokes existing sessions.

**Adding staff.** Staff accounts are created by an administrator under **Users & roles** in the dashboard (no self sign-up). Each account gets a role (Administrator, Receptionist, Doctor, Dental assistant, Accountant, or a custom role) that decides what it can do. A client-facing guide is in [docs/handover](docs/handover/).

## Demo data

For a development database that holds no real records:

```bash
pnpm db:seed:demo
```

This creates a fictional clinic with 40 patients, appointments, examinations, dental charts, treatment plans, prescriptions, invoices, payments and expenses. It refuses to run against a database that already contains real records. Details and logins: [SEEDING.md](SEEDING.md).

## Testing

Tests use a dedicated database (default `dr_ovi_test`, derived from `DATABASE_URL`) that is emptied before every run; the test runner refuses any database whose name does not end in `_test`.

```bash
pnpm test:db:prepare   # once: creates dr_ovi_test and applies all migrations
pnpm test              # runs the suite
```

The suite calls the real route handlers with real Better Auth sessions and covers authentication, role permissions, patients, appointments and conflict prevention, clinical records, treatment plans, invoices, partial payments, refunds, expenses, reports and dashboard figures, and invalid input.

## Scripts

- `pnpm dev` — start the Next.js development server
- `pnpm build` — create a production build (runs `prisma generate` first)
- `pnpm lint` — run ESLint
- `pnpm test` / `pnpm test:watch` — run the automated tests
- `pnpm test:db:prepare` — create and migrate the test database
- `pnpm db:generate` — generate the Prisma client
- `pnpm db:migrate` — apply schema changes during development (`prisma migrate dev`)
- `pnpm exec prisma migrate deploy` — apply pending migrations in production
- `pnpm db:seed` — create the configured administrator
- `pnpm db:seed:demo` — load fictional demo data (development databases only)
- `pnpm admin:reset-password` — reset an administrator's password

## Deploying database changes

New migrations are plain SQL under `prisma/migrations/`. In production run `pnpm exec prisma migrate deploy`. The integrity-constraint migration adds its checks as `NOT VALID`, so it never fails on existing data; see [DATABASE.md](DATABASE.md) to validate old rows afterwards. Back up the database before applying migrations.

## Backup and recovery

The application stores everything in PostgreSQL, so a backup is a database backup. Use `pg_dump` on a schedule (and before every migration) and keep copies off the server; to recover, restore into an empty database and run `pnpm exec prisma migrate deploy` to confirm the schema is current. Uploaded files are not stored: gallery entries hold public image URLs only.
