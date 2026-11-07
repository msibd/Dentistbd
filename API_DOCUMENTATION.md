# API

JSON over HTTP, served by Next.js route handlers under `src/app/api` (staff) and `src/app/public_website/api` (public). Authentication is the Better Auth session cookie set at sign-in (`POST /api/auth/sign-in/email`); there are no API keys.

## Conventions

- **Authorization.** Each route needs one permission (column "Permission"). `401` = no valid session. `403` = signed in but the role lacks the permission (`{ "error": "You do not have permission to perform this action." }`) or the account has no staff role. Roles and permissions: `src/lib/permissions.ts`; `admin` holds all, `receptionist` holds the ones marked **R**.
- **Errors.** Always `{ "error": "message" }` with the status: `400` invalid input, `404` not found, `409` conflict with current state (overlap, wrong status, history exists), `429` rate limited, `503` unavailable.
- **Money** is returned as decimal strings (`"1250.50"`), accepted as numbers with at most two decimals.
- **Dates.** Timestamps are ISO 8601 with an offset (`2026-11-06T10:00:00+06:00`); calendar dates are `YYYY-MM-DD`. Clinic days use Asia/Dhaka.
- **Lists** use `cursor` paging (`nextCursor` in the response) or `page`/`pageSize`, as noted.
- **Audit.** Every write is recorded in the audit log with the acting user.

## Staff API

### Dashboard and reports

| Method and path | Permission | Notes |
| --- | --- | --- |
| `GET /api/dashboard/summary` | `dashboard:read` (R) | Patients, today's and pending appointments, completed this month, revenue (today/week/month), outstanding, weekly chart, overview lists. |
| `GET /api/reports?from&to` | `reports:read` | Range ≤ 366 days. Appointments by status, registrations, treatments, `revenue`, `outstanding`, `dailyRevenue`, `revenueByMethod`, `expenses` (`total`, `byCategory`), `netIncome`. |
| `GET /api/billing/daily-collection?date` | `billing:read` (R) | Collections on one clinic day by payment method, plus refunds that day. Defaults to today. |
| `GET /api/follow-ups?days` | `appointments:read` (R) | Upcoming follow-up dates (1–90 days, default 14) from prescriptions and examinations. Contact details only; no clinical text. |
| `GET /api/realtime` | `dashboard:read` (R) | Server-Sent Events stream of change notifications (table and operation only). |

### Patients

| Method and path | Permission | Notes |
| --- | --- | --- |
| `GET /api/patients?page&pageSize&search&status&fields` | `patients:read` (R) | Server-side paging and search (name, phone, code, e-mail). `fields=picker` returns a light list. |
| `POST /api/patients` | `patients:write` (R) | Body: `name`, `phone`, optional `email`, `dateOfBirth`, `address`, emergency contact, `medicalHistory`, `allergies`, `dentalHistory`, `notes`. Returns `201` with a generated `PID-nnnnn`. |
| `GET /api/patients/count` | `patients:read` (R) | `{ total }`. |
| `GET /api/patients/{id}` | `patients:read` (R) | Profile with appointment count and latest appointment. |
| `PATCH /api/patients/{id}` | `patients:write` (R) | Full details, or `{ "isActive": boolean }` to disable or re-enable. |
| `DELETE /api/patients/{id}` | `patients:delete` | `409` if the patient has appointments, treatments or any other history. |

### Appointments

| Method and path | Permission | Notes |
| --- | --- | --- |
| `GET /api/appointments` | `appointments:read` (R) | Filtered, cursor-paged list. |
| `POST /api/appointments` | `appointments:write` (R) | `patientId` or `patientName` + `patientPhone`, `service`, `dateTime` (future, within 365 days, with offset), `notes`. `400` responses also carry `fieldErrors` (`{ patientName?, patientPhone?, patientEmail?, service?, dateTime?, notes? }`, one message per bad field); `error` repeats the first. The same rules (`appointment-rules.ts`) run in the booking form. Phones: Bangladeshi mobile numbers are checked strictly, others need 7–15 digits. `409` outside the doctor's hours or on a working-day conflict. |
| `PATCH /api/appointments/{id}` | `appointments:write` (R) | `{ "status": … }` follows PENDING → CONFIRMED → COMPLETED, and CANCELLED from PENDING or CONFIRMED (anything else is `409`). Confirming checks for overlap with other confirmed appointments. Or a full body to reschedule or edit; completed and cancelled appointments cannot be edited (`409`). |
| `DELETE /api/appointments/{id}` | `appointments:delete` | Only pending or cancelled requests. |

### Clinical records (administrator only)

| Method and path | Permission | Notes |
| --- | --- | --- |
| `GET /api/examinations?patientId&cursor` | `clinical:read` | Newest first, 20 per page. |
| `POST /api/examinations` | `clinical:write` | `patientId`, `chiefComplaint`, `diagnosis`, optional `appointmentId` (must belong to the patient), `findings`, `notes`, `examinedAt`, `followUpDate`. |
| `GET` / `PATCH /api/examinations/{id}` | `clinical:read` / `clinical:write` | Patient and appointment links cannot be changed. |
| `GET /api/patients/{id}/dental-chart` | `clinical:read` | `{ chart: [{ toothNumber, condition, notes, updatedAt, updatedBy }] }`. |
| `PUT /api/patients/{id}/dental-chart` | `clinical:write` | `{ entries: [{ toothNumber, condition, notes? }] }`; FDI numbers (11–48, 51–85) and unique per request; teeth not listed are unchanged. Conditions: `HEALTHY`, `CARIES`, `FILLED`, `CROWN`, `ROOT_CANAL`, `IMPLANT`, `FRACTURED`, `MISSING`, `EXTRACTED`, `OTHER`. |
| `GET /api/treatments` | `treatments:read` (R) | Paged, searchable. |
| `POST /api/treatments` | `treatments:write` | `patientId`, `diagnosis`, `procedureName`, `toothNumbers[]`, `estimatedCost`, `status`, `notes`. |
| `GET /api/treatments/{id}` | `treatments:read` (R) | With sessions. |
| `PATCH /api/treatments/{id}` | `treatments:write` | `{ "status" }` or full body. Completed or cancelled plans are frozen (`409`). |
| `POST /api/treatments/{id}/sessions` | `treatments:write` | `notes`, optional `performedAt`. `409` on a completed or cancelled plan. |
| `GET` / `POST /api/prescriptions` | `prescriptions:read` / `prescriptions:write` | `patientId`, `diagnosis`, `instructions`, `followUpDate`, `medications[]` (`name`, `dosage`, `frequency`, `duration`, `instructions`; 1–30). |

### Billing

| Method and path | Permission | Notes |
| --- | --- | --- |
| `GET /api/billing?search&cursor` | `billing:read` (R) | 100 per page. Each invoice includes items, payments and a derived `total`. |
| `POST /api/billing` | `billing:invoice` (R) | `patientId`, `items[]` (`description`, `quantity` int ≥ 1, `unitPrice`, optional `serviceId`), `discount`, `tax`, `notes`. `400` if discount exceeds subtotal plus tax; `409` for an inactive service. Number: `INV-nnnnnn`. |
| `POST /api/billing/{id}/payments` | `billing:payment` (R) | `amount`, `method` (`CASH`, `CARD`, `MOBILE_BANKING`, `BANK_TRANSFER`), `reference`, `note`. `400` if it exceeds the outstanding balance; `409` on a voided invoice. Status becomes `PARTIALLY_PAID` or `PAID`. |
| `POST /api/billing/{id}/void` | `billing:void` | `{ reason }` (≥ 3 chars). `409` if any payment exists (refund first) or already void. |
| `POST /api/billing/payments/{id}/refund` | `billing:refund` | `{ reason }`. The invoice status is recalculated. `409` if not a posted payment. |

### Expenses

| Method and path | Permission | Notes |
| --- | --- | --- |
| `GET /api/expenses?from&to&category&cursor` | `expenses:read` | Defaults to the current month. Returns `total` (excluding voided) and the entries. |
| `POST /api/expenses` | `expenses:write` | `category` (`RENT`, `UTILITIES`, `SUPPLIES`, `LAB_FEES`, `EQUIPMENT`, `SALARY`, `MARKETING`, `MAINTENANCE`, `OTHER`), `description`, `amount` > 0, `spentAt` (not in the future), `method`, `reference`. |
| `POST /api/expenses/{id}/void` | `expenses:write` | `{ reason }`. Entries are kept, never deleted. |

### Users and roles (administrator only)

A role is a named set of permissions stored in the `Role` table; `user.role` holds the role key. Built-in roles (`admin`, `receptionist`, `doctor`, `assistant`, `accountant`) are created on first use with defaults and can be re-configured, except `admin`, which always holds everything. `users:manage` and `roles:manage` can never be given to another role. Permission changes apply to signed-in users on their next request (the server caches role permissions for at most 10 seconds).

| Method and path | Permission | Notes |
| --- | --- | --- |
| `GET /api/users` | `users:manage` | Staff accounts with role name and last activity, plus the role options. |
| `POST /api/users` | `users:manage` | `{ name, email, role, password }` (password 10+ characters). No public sign-up exists. |
| `PATCH /api/users/{id}` | `users:manage` | `{ name?, role?, isActive? }`. Deactivating signs the person out and blocks sign-in. You cannot change your own role or deactivate yourself, and the last active administrator is protected (`409`). |
| `POST /api/users/{id}/password` | `users:manage` | `{ password }` for another person; signs them out. |
| `GET /api/roles`, `POST /api/roles` | `roles:manage` | List with permissions and member counts; create a custom role `{ name, description, permissions[] }`. |
| `PATCH /api/roles/{id}`, `DELETE /api/roles/{id}` | `roles:manage` | The administrator role is locked; built-in roles cannot be deleted; a role in use cannot be deleted (`409`). |

### E-mail settings (administrator only, `email:manage`)

| Method and path | Notes |
| --- | --- |
| `GET/PUT /api/email/settings` | Provider, host, port, TLS, sender, `enabled`. The SMTP password is write-only (`password` on PUT; blank keeps the saved one) and is stored AES-256-GCM encrypted; responses only say `passwordSet`. E-mail can be switched on only after a successful connection test of the saved settings (`409` otherwise). Private/local hosts are refused. |
| `POST /api/email/test-connection` | Connects and signs in with the saved settings; sends nothing. 10 tests per 10 minutes per administrator. |
| `POST /api/email/test-send` | `{ to }`. Reports whether the mail server accepted the message (not that it reached the inbox). |
| `GET /api/email/history` | The last 50 settings changes and e-mail attempts, with masked addresses. |

### Password recovery (public, rate limited)

Answers never reveal whether an address is registered. Codes: 6 digits, 5 minutes, 5 attempts, one live code per account, 60 s resend cooldown, stored only as an HMAC. A verified code is exchanged once for a 10-minute single-use reset token (stored as a hash); setting the password consumes it, revokes all sessions and cancels leftover codes.

| Method and path | Notes |
| --- | --- |
| `GET /api/password-reset/status` | `{ available }`: whether the clinic turned e-mail on (controls the "Forgot password?" link). |
| `POST /api/password-reset/request` | `{ email }`. Always the same `200` answer. 10/hour per address, 5/hour per e-mail. |
| `POST /api/password-reset/verify` | `{ email, code }` returns `{ token }`. 30 per 10 min per address, 10 per 10 min per e-mail. |
| `POST /api/password-reset/complete` | `{ token, password }` (10+ characters). |

### SMS settings (administrator only, `sms:manage`)

Provider: BulkSMSBD, always over HTTPS (the key goes in the POST body, never in a URL, except the provider's GET-only balance check). The API key is stored AES-256-GCM encrypted (`EMAIL_ENCRYPTION_KEY`) and never returned. SMS can be switched on only after a successful connection test of the saved key.

| Method and path | Notes |
| --- | --- |
| `GET/PUT /api/sms/settings` | `apiKey` (write-only; blank keeps the saved one), `senderId`, `appointmentTemplate` (placeholders `{name} {date} {time} {clinic}`), `perNumberDailyLimit` (1-20), `dailyLimit` (1-10000), `enabled`. |
| `POST /api/sms/test-connection` | Reads the account balance with the saved key; sends nothing. |
| `POST /api/sms/test-send` | `{ to }`: one test SMS to a Bangladeshi mobile number. 10 tests per 10 minutes per administrator. |
| `GET /api/sms/history` | Last 50 attempts and settings changes; numbers masked, no message text. |

When an appointment is booked (website or staff; not walk-ins) and SMS is on, the patient's number gets the message after the response is sent. A booking never fails because of SMS. Per-number and daily caps stop the public form being used to flood numbers or run up cost; every outcome (sent, failed, skipped) is logged.

### Inventory

Reception has `inventory:read`; every change needs `inventory:write` (administrator). Stock only changes through purchases, use and adjustments, each in one transaction with a `StockMovement`; stock is used oldest expiry first and never goes below zero (`409`).

| Method and path | Permission | Notes |
| --- | --- | --- |
| `GET /api/inventory/items?includeInactive` | `inventory:read` | Items with stock status (`OK`, `LOW`, `OUT`), expiring/expired quantities, batches, and the summary counts and stock value. |
| `POST /api/inventory/items`, `PATCH /api/inventory/items/{id}` | `inventory:write` | `name`, `category`, `unit`, `reorderLevel`, `supplierId`, `notes`, `isActive`. Quantity is never set directly. |
| `GET/POST /api/inventory/suppliers`, `PATCH /api/inventory/suppliers/{id}` | read / write | Supplier directory with purchase totals. |
| `GET/POST /api/inventory/purchases` | read / write | A purchase of several lines (`itemId`, `quantity`, `unitCost`, `batchNumber`, `expiryDate`). `recordExpense` (default true) also creates a `SUPPLIES` expense. |
| `GET/POST /api/inventory/movements` | read / write | `kind`: `ISSUE` (use), `ADJUST_IN`, `ADJUST_OUT` (optionally one `batchId`, e.g. an expired lot), with a `reason`. Issuing never uses expired lots. |
| `GET /api/inventory/reports?from&to` | `inventory:read` | Purchases, usage, write-offs and stock value by category. |

### Daily finance and cash closing (administrator only)

| Method and path | Permission | Notes |
| --- | --- | --- |
| `GET /api/finance/daily?date` | `expenses:read` | Income by payment method (received, refunded, net), expenses by category, and the expected cash in the drawer; includes the closing if the day is closed. |
| `GET /api/finance/closings` | `expenses:read` | The last 60 closings. |
| `POST /api/finance/closings` | `finance:close` | `{ businessDate, countedCash, note }`. Expected cash is computed on the server (opening = previous count, plus cash received, minus cash refunds and cash expenses). A difference needs a `note`. A day closes once (`409`). |

### Appointment extras

| Method and path | Permission | Notes |
| --- | --- | --- |
| `POST /api/appointments` with `"walkIn": true` | `appointments:write` | Booked for now, source `WALK_IN`, status `CONFIRMED`; overlap with booked visits is allowed, the doctor's hours still apply. |
| `PATCH /api/appointments/{id}` with `{ "status": "NO_SHOW" }` | `appointments:write` | From `PENDING` or `CONFIRMED`; can be set back to `CONFIRMED`. No-shows cannot be edited. |
| `GET /api/appointments/reminders?days` | `appointments:read` | Upcoming pending/confirmed appointments with contact details. |

### Clinic setup and administration

| Method and path | Permission | Notes |
| --- | --- | --- |
| `GET /api/doctor` | `doctor:read` (R) | The single doctor profile and weekly schedule. |
| `PUT /api/doctor` | `doctor:write` | `409` if the new hours conflict with a confirmed appointment. |
| `GET /api/services` | `services:read` (R) | `?includeInactive=true` for the full catalogue. |
| `POST /api/services`, `PATCH /api/services/{id}` | `services:write` | `code`, `name`, `category`, `description`, `standardPrice`, `durationMinutes`, `isActive`. |
| `GET /api/security/audit` | `security:manage` | Paged audit log. |
| `GET /api/security/sessions`, `DELETE /api/security/sessions/{id}` | `security:manage` | The caller's own sessions. |
| `GET`/`POST`/`PATCH`/`DELETE /public_website/api/gallery/manage` | `website:manage` | Gallery images (public URLs and alt text). |
| `GET`/`PATCH /public_website/api/reviews/moderation` | `website:manage` | Publish or reject reviews. |

## Public API (no sign-in)

| Method and path | Notes |
| --- | --- |
| `POST /public_website/api/appointments` | Creates a `PENDING` request (`DIRECT` or `WHATSAPP`); a visitor cannot choose another source. Same scheduling checks as staff booking. Rate limited to 5 per 10 minutes per IP (`429` with `Retry-After`). |
| `POST /public_website/api/reviews` | Submits a review for moderation (registered patients only, see Patient reviews). 5 per 10 minutes per IP. |
| `GET /public_website/api/reviews`, `/clinic`, `/gallery` | Cached, read-only public content (published reviews only). |

## Authentication

Better Auth endpoints live under `/api/auth/*`. `POST /api/auth/sign-in/email` signs in; self sign-up (`/sign-up/email`) is refused. QR sign-in lets a signed-in staff member approve a desktop sign-in. Sessions can be revoked from the Security page.

### Website content

| Route | Permission | Notes |
| --- | --- | --- |
| `GET /api/website-content` | `website:manage` | The editable public-website text and image links (one record). Empty text means the website uses its built-in wording. |
| `PUT /api/website-content` | `website:manage` | Replaces all fields: `clinicName`, `clinicSubtitle`, and English/Bangla pairs (`heroTitle`, `heroSubtitle`, `technology`, `bookingNote`, `closingMessage`, `doctorHighlights` as a list of up to 8 lines), plus `heroImageUrl` and `doctorImageUrl` (`https://` or empty). `400` carries `fieldErrors` per field. Saving expires the public-site cache. Audited. |

`PUT` also takes `layout`: only the settings the clinic changed, everything else uses the website's built-in wording. Shape: `nav.<home|about|services|gallery|whyUs|reviews|contact>` (`label` and `visible`), `sections.<services|gallery|whyUs|reviews|booking|contact>` (`badge`, `title`, `subtitle` and, for gallery, whyUs and reviews, `visible`), `heroBadge`, `heroChips` (up to 4), `aboutCards` and `whyCards` (up to 6 cards each: `icon`, `title`, `text`), `footerNote` and `facebookUrl` (`https://` or empty). Every text is `{ en, bn }` and either language may be left out. Errors in `fieldErrors` are keyed by path, for example `layout.nav.home.label.en`.

Services also accept optional website fields: `nameBn`, `descriptionBn`, `categoryBn`, `iconKey` (`general`, `smile`, `cosmetic`, `endodontics`, `surgery`, `preventive`, `xray`), `badgeEn`/`badgeBn`, `timeTextEn`/`timeTextBn`, `painTextEn`/`painTextBn` (each up to 80 characters), `feeMax` (the top of a fee range; must be at least `standardPrice`), `detailsEn`/`detailsBn` (up to 3000 characters) and `stepsEn`/`stepsBn` (up to 12 lines of 240 characters). They drive the public service cards and the details window. Also, `nameBn` and `descriptionBn`: Omit them to leave the saved Bangla text unchanged; send an empty string to clear it.

### Patient reviews

| Route | Permission | Notes |
| --- | --- | --- |
| `POST /public_website/api/reviews` | public (rate limited, 5 per 10 minutes per address) | `name`, `phone`, `rating` (1–5), `comment` (5–2000 characters). Only registered patients can review: the number must match a patient record (any way of writing it, such as `01712345678`, `+880 1712-345678`) and the name must share a word with the registered name. `400` has `fieldErrors`; `403` is one message for any mismatch (it does not say whether the number or the name was wrong); `409` when the patient already has a pending or published review. The review is saved as `PENDING` and linked to the patient. **The mobile number is never stored on the review and never returned.** |
| `GET /public_website/api/reviews` | public | Published reviews: `id`, `name`, `rating`, `comment`, `createdAt` only. |
| `GET` and `PATCH /public_website/api/reviews/moderation` | `website:manage` | The clinic's list with `patient: { name, patientCode }` for verified reviews (`null` for those written before verification); never the mobile number. |
