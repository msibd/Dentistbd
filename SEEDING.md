# Demo data

`prisma/seed-demo.ts` loads a fictional clinic so the dashboard, reports and every module have realistic content. All names, phone numbers, e-mail addresses and amounts are invented. It never reads or copies real data.

```bash
pnpm db:seed:demo
```

Use it on an empty development database. For example:

```bash
# create a database and apply the schema, then seed it
createdb dr_ovi_demo
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/dr_ovi_demo" pnpm exec prisma migrate deploy
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/dr_ovi_demo" pnpm db:seed:demo
```

## Demo logins (development only)

| Role | E-mail | Password |
| --- | --- | --- |
| Administrator | `admin@demo.example` | `Demo-Admin#2026` |
| Receptionist | `reception@demo.example` | `Demo-Front#2026` |

These are public, throwaway credentials for a development database. Never create them on a database that real people can reach. Override them with `DEMO_ADMIN_PASSWORD` and `DEMO_RECEPTIONIST_PASSWORD` in the environment before the first run. Passwords are stored hashed (scrypt, the same as Better Auth); the script sets a password only when it creates the account, so re-running never overwrites one you changed.

## What is created

| Data | Amount |
| --- | --- |
| Clinic doctor (`primary`) and weekly hours (Saturday to Thursday, 09:00–18:00; an existing profile and schedule are left untouched) | 1 |
| Staff accounts | 2 |
| Services with prices | 12 |
| Patients (codes `DEMO-001`…`DEMO-040`), with medical histories, allergies and dental histories | 40 |
| Appointments: 14 completed, 6 confirmed, 6 pending (website and WhatsApp requests), 3 cancelled | 29 |
| Examination records for completed visits (some with follow-up dates) | 14 |
| Dental chart entries (12 patients) | about 54 |
| Treatment plans (planned, in progress, on hold, completed, cancelled) and their sessions | 10 plans, 12 sessions |
| Prescriptions with medicines (some with follow-up dates) | 12 |
| Invoices: 11 paid, 4 partially paid, 3 issued and unpaid, 1 void | 19 |
| Payments across cash, card, mobile banking and bank transfer, including one refund | 21 |
| Expenses over about 90 days (rent, salaries, utilities, supplies, lab fees, equipment, maintenance, marketing, one voided) | 21 |

Dates are relative to the day you run the script, so the dashboard always has "today", "this week" and "this month" figures. With the default amounts the last 90 days show about ৳150,000 collected against about ৳144,000 of expenses.

## Repeatable and safe

- **Idempotent.** Every row the script owns has an id starting with `demo-`. A re-run deletes exactly those rows and recreates them in one transaction, so there are never duplicates and the dates move with today. Rows without that prefix are never modified or deleted. Building the demo rows is a single transaction, so a failure part-way leaves them as they were.
- **Refuses real data.** If the database already holds patients, appointments or invoices that are not demo rows, the script stops with a message. Pass `--allow-existing-data` only if you really want demo rows added next to real ones.
- **Refuses production.** It exits when `NODE_ENV=production`.
- **Self-checking.** After seeding it re-reads every invoice and verifies that line items add up to the subtotal, payments never exceed the total, each invoice's status matches its payments, and no confirmed appointments overlap. Any failure aborts with the details.
- **Valid relations.** Foreign keys are real; the script uses the same invoice arithmetic as the application (`invoice-math.ts`).

## Resetting

To return to a clean state, drop and recreate the demo database, or simply run the script again (it rebuilds its own rows). To remove the demo data from a database without dropping it, delete rows whose `id` starts with `demo-` (patients, appointments, invoices and so on) and the two `demo-user-*` accounts.

## Other seed

`pnpm db:seed` (prisma/seed.ts) is a different, interactive script that creates the first real administrator and prompts for the password. It does not create any demo data.

## Website content

`pnpm db:seed:website` loads the clinic's own wording (headline, intro, equipment line, booking note, closing message, doctor credentials) in English and Bangla, and makes sure the seven standard services exist with Bangla names. It only fills fields that are still empty, so it never overwrites edits made in the admin panel (Website content); pass `--force` to overwrite. Prices and doctor details are never touched. The seeding writes to the database directly, so save once in the admin panel, or restart the server, for the public site to pick it up.
