# Database

PostgreSQL, managed with Prisma (`prisma/schema.prisma`, SQL migrations in `prisma/migrations/`). Money is `DECIMAL(12,2)`; calendar-only values (date of birth, follow-up date, expense date) are `DATE`; everything else that is a moment in time is `TIMESTAMP(3)` stored as UTC. The clinic's time zone, Asia/Dhaka (UTC+6), is applied in application code (`src/lib/clinic-date.ts`).

## Tables

| Area | Table | Purpose |
| --- | --- | --- |
| Auth | `user`, `account`, `session`, `verification`, `rateLimit`, `QrLoginSession` | Better Auth tables, plus rate-limit counters and QR sign-in approvals. `user.role` is `admin`, `receptionist` or `user`. |
| People | `Patient` | Registration, contact details, medical history, allergies, dental history. `patientCode` is `PID-nnnnn` from a sequence. `isActive` disables a patient without deleting history. |
| | `DoctorProfile`, `DoctorSchedule` | The clinic's single doctor (`id = 'primary'`) and the weekly working hours (one row per weekday). |
| Scheduling | `Appointment` | A booking. May be unlinked from a patient (website visitor) and carries its own name/phone for that case. Status: `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`. Source: `DIRECT`, `WHATSAPP`, `ADMIN`. |
| Clinical | `ExaminationRecord` | A dated visit record: complaint, findings, diagnosis, notes, follow-up date, examining user, optional appointment. |
| | `DentalChartEntry` | Current condition of one tooth (FDI number) per patient; one row per patient and tooth. |
| | `TreatmentPlan`, `TreatmentSession` | A planned procedure (diagnosis, teeth, estimated cost, status) and the dated sessions performed under it. |
| | `Prescription`, `PrescriptionMedication` | A prescription and its medicines. |
| Billing | `ClinicService` | Price list: code, name, standard price, duration. |
| | `Invoice`, `InvoiceItem` | An invoice (`INV-nnnnnn` from a sequence) and its lines. Totals are derived, never stored. |
| | `Payment` | A payment against an invoice: method, amount, `POSTED` or `REFUNDED`. |
| | `Expense` | A clinic expense by category; voided, never deleted. |
| | `CashClosing` | The end-of-day cash count, one per day, with the expected cash snapshot. |
| Inventory | `InventoryItem`, `StockBatch` | An item and its received lots (expiry per lot); `quantity` equals the sum of its lots. |
| | `StockMovement`, `StockPurchase`, `Supplier` | Signed stock changes (never edited), purchases (`PUR-nnnnn`) and suppliers. |
| Website | `ClinicReview`, `ClinicGalleryImage` | Moderated reviews and gallery image URLs for the public site. |
| Access | `Role` | A named set of permissions; `user.role` stores its key. `user.isActive` deactivates an account without deleting it. |
| Email | `EmailConfiguration`, `EmailAuditLog` | SMTP settings (password encrypted, key in the environment) and the e-mail history. |
| | `PasswordResetOtp`, `PasswordResetAuthorization` | Hashed one-time codes and single-use reset tokens. |
| Audit | `AuditEvent` | Who did what to which record, and when. |

## Relationships and deletion rules

- Everything clinical or financial that points at a `Patient` uses `ON DELETE RESTRICT`: a patient with any history cannot be deleted (the API also checks, and offers disabling instead).
- `Invoice → InvoiceItem` and `Invoice → Payment` are `RESTRICT`; invoices are voided, not deleted.
- `Prescription → PrescriptionMedication` is `CASCADE` (medicines belong to their prescription).
- Links to a `user` (examiner, creator, actor) and to an `Appointment` or `ClinicService` use `SET NULL`, so removing a user or service never destroys the record that referenced it.
- `Appointment.patientId` is `SET NULL` because an appointment can exist without a registered patient.

## Constraints added by `20261106043000_integrity_constraints_and_invoice_sequence`

These repeat rules the API already enforces, so that a bug or a manual SQL change cannot store impossible data.

| Table | Rule |
| --- | --- |
| `Invoice` | `subtotal`, `discount`, `tax` ≥ 0; `discount` ≤ `subtotal` + `tax` |
| `InvoiceItem` | `quantity` > 0; `unitPrice`, `amount` ≥ 0 |
| `Payment`, `Expense` | `amount` > 0 |
| `ClinicService` | `standardPrice` ≥ 0; `durationMinutes` > 0 |
| `TreatmentPlan`, `DoctorProfile` | `estimatedCost`, `consultationFee` ≥ 0 |
| `Appointment` | `durationMinutes` > 0 |
| `DoctorSchedule` | `dayOfWeek` between 0 and 6 |
| `ClinicReview` | `rating` between 1 and 5 |
| `DentalChartEntry` | `toothNumber` is FDI: 11–48 or 51–85 |
| `user` | `role` is `admin`, `receptionist` or `user` |

They are created `NOT VALID`: PostgreSQL enforces them for every new or changed row immediately but does not scan existing rows, so the migration cannot fail on old data. To check old rows as well, run for each constraint (it errors and names the problem if a row violates it):

```sql
ALTER TABLE "Invoice" VALIDATE CONSTRAINT "Invoice_amounts_nonnegative_chk";
```

The same migration creates `invoice_code_seq`, used for new invoice numbers.

## Indexes

Beyond primary and unique keys, indexes exist for the screens that use them: patient list ordering and search (trigram GIN indexes on name, phone, code and e-mail), appointment lists by date, status, patient, service and source, invoice lists by patient, status and date, payment lookups by invoice and by status and date, examination history by patient and date, follow-up dates, expenses by date and category, and audit lookups by record and by actor. Each is justified by a query in the application; indexes with no query behind them are not added. Trigram indexes on `Appointment` and `Patient` text columns increase write cost slightly and are the price of fast partial-match search.

## Migrations

```bash
pnpm exec prisma migrate deploy      # production and CI: apply pending migrations
pnpm db:migrate                      # development: create and apply a migration
pnpm exec prisma migrate status      # what is applied
pnpm exec prisma validate            # check the schema file
```

A fresh database can be built from scratch by `migrate deploy`; the test database setup does exactly that. This release adds:

1. `20261106042841_clinical_records_and_expenses`: `ExaminationRecord`, `DentalChartEntry`, `Expense`, enums `ToothCondition` and `ExpenseCategory`.
2. `20261106043000_integrity_constraints_and_invoice_sequence`: constraints above and `invoice_code_seq`.
3. `20261107000000_inventory_cash_closing_no_show`: inventory tables, `CashClosing`, appointment status `NO_SHOW` and source `WALK_IN`.
4. `20261107010000_inventory_finance_realtime`: live-update triggers for the new tables.
5. `20261107020000_roles_and_user_status`: the `Role` table, `user.isActive`, and the fixed role list constraint removed.
6. `20261107030000_user_phone`: `user.phone`.
7. `20261107040000_email_settings_and_password_recovery`: e-mail settings, e-mail audit log, OTP and reset-authorization tables.

## Deliberately not modelled

- **Inventory valuation beyond the basics.** Stock is tracked per lot with last-purchase cost; there is no purchase returns, transfer or recipe/usage-per-treatment link.
- **A `Clinic` or settings table.** There is one clinic; its name and contact details are configuration of the public site and the doctor profile, not data with its own lifecycle.
- **Multiple doctors.** `DoctorProfile` is a single row with a fixed id by design.
- **Soft delete on patients and appointments.** Patients are disabled (`isActive`), appointments are cancelled, invoices and expenses are voided. A generic `deletedAt` column on every table would add filtering everywhere for no extra protection.
