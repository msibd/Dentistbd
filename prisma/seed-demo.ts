// Demo data for a fictional dental clinic: repeatable and safe to run more than once.
//
//   pnpm db:seed:demo
//
// Every record this script owns has an id starting with "demo-", so a re-run first removes exactly
// those rows and recreates them (dates are relative to today). Nothing else is touched. All people,
// phone numbers and e-mail addresses are fictional. See SEEDING.md for the demo logins.
import { hashPassword } from "better-auth/crypto";
import { prisma } from "../src/lib/prisma";
import { addClinicDays, getClinicDateKey } from "../src/lib/clinic-date";
import {
  computeInvoiceTotals,
  invoiceTotalCents,
  paidCents,
  statusForPayments,
} from "../src/modules/billing/services/invoice-math";
import type {
  AppointmentSource,
  AppointmentStatus,
  ExpenseCategory,
  PaymentMethod,
  ToothCondition,
  TreatmentPlanStatus,
} from "../src/generated/prisma/client";

const DEMO_ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD ?? "Demo-Admin#2026";
const DEMO_RECEPTION_PASSWORD = process.env.DEMO_RECEPTIONIST_PASSWORD ?? "Demo-Front#2026";

// ---------------------------------------------------------------- helpers

// Small deterministic generator so every run picks the same "random" values.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(20261106);
const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)];
const pad = (value: number, width = 2) => String(value).padStart(width, "0");

const today = getClinicDateKey(new Date());
const dayKey = (offset: number) => addClinicDays(today, offset);
/** A clinic-local (Asia/Dhaka) wall-clock time on a day `offset` days from today. */
const at = (offset: number, hhmm: string) => new Date(`${dayKey(offset)}T${hhmm}:00+06:00`);
const dateOnly = (offset: number) => new Date(`${dayKey(offset)}T00:00:00.000Z`);

// ---------------------------------------------------------------- fictional reference data

const services = [
  { code: "CONS", name: "Consultation", category: "General", price: 500, minutes: 30 },
  { code: "XRAY", name: "Dental X-ray (IOPA)", category: "Diagnostics", price: 300, minutes: 15 },
  { code: "SCALE", name: "Scaling & Polishing", category: "Preventive", price: 1500, minutes: 45 },
  { code: "FILL", name: "Composite Filling", category: "Restorative", price: 1200, minutes: 45 },
  { code: "RCT", name: "Root Canal Treatment (single canal)", category: "Endodontics", price: 6000, minutes: 60 },
  { code: "RCT-M", name: "Root Canal Treatment (molar)", category: "Endodontics", price: 9500, minutes: 90 },
  { code: "EXT", name: "Simple Extraction", category: "Surgical", price: 1000, minutes: 30 },
  { code: "EXT-S", name: "Surgical Extraction", category: "Surgical", price: 3500, minutes: 60 },
  { code: "CROWN", name: "Porcelain Crown", category: "Prosthetics", price: 7000, minutes: 60 },
  { code: "WHITE", name: "Teeth Whitening", category: "Cosmetic", price: 8000, minutes: 60 },
  { code: "ORTHO", name: "Orthodontic Consultation", category: "Orthodontics", price: 800, minutes: 30 },
  { code: "IMPL", name: "Dental Implant", category: "Prosthetics", price: 45000, minutes: 90 },
] as const;
type ServiceCode = (typeof services)[number]["code"];
const serviceByCode = Object.fromEntries(services.map((service) => [service.code, service])) as Record<ServiceCode, (typeof services)[number]>;

const maleNames = ["Rahim Uddin", "Karim Hossain", "Jamal Chowdhury", "Imran Ahmed", "Sabbir Rahman", "Tanvir Islam", "Mahfuz Alam", "Nayeem Khan", "Fahim Sarker", "Arif Mahmud", "Shakil Mia", "Rakib Hasan", "Zahid Karim", "Hasan Mahmud", "Sohel Rana", "Mamun Talukder", "Rezaul Haque", "Tarek Aziz", "Anwar Hossain", "Faisal Reza"];
const femaleNames = ["Nusrat Jahan", "Farhana Akter", "Sumaiya Khatun", "Tasnim Sultana", "Mou Begum", "Rima Parvin", "Shirin Akhter", "Nadia Islam", "Lamia Rahman", "Afsana Mimi", "Sadia Afrin", "Mehjabin Noor", "Jannatul Ferdous", "Rubina Yasmin", "Salma Haque", "Tania Chowdhury", "Bithi Das", "Puja Roy", "Samira Kabir", "Ritu Barua"];
const areas = ["Dhanmondi", "Mirpur", "Uttara", "Mohammadpur", "Gulshan", "Banani", "Rampura", "Bashundhara", "Malibagh", "Motijheel"];
const histories = [
  null, null, null, null, null,
  "Type 2 diabetes, controlled with medication.",
  "Hypertension; takes amlodipine daily.",
  "Asthma; carries an inhaler.",
  "Thyroid condition, on levothyroxine.",
  "Heart valve surgery in 2019; antibiotic cover advised before procedures.",
] as const;
const allergyList = [null, null, null, null, null, null, "Penicillin", "Latex", "Ibuprofen", "Sulfa drugs"] as const;
const dentalHistories = [null, "Regular check-ups every 6 months.", "Previous root canal on lower molar.", "History of gum bleeding.", "Wears a night guard for bruxism.", "Braces completed in 2018."] as const;

const patientCount = 40;
const patients = Array.from({ length: patientCount }, (_, index) => {
  const n = index + 1;
  const male = n % 2 === 1;
  const name = male ? maleNames[(n - 1) / 2] : femaleNames[(n - 2) / 2];
  return {
    id: `demo-patient-${pad(n)}`,
    patientCode: `DEMO-${pad(n, 3)}`,
    name,
    phone: `0170000${pad(n, 4)}`,
    email: n % 3 === 0 ? `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@demo.example` : null,
    dateOfBirth: new Date(Date.UTC(1962 + ((n * 7) % 45), (n * 5) % 12, 1 + ((n * 11) % 27))),
    address: `House ${10 + n}, Road ${1 + (n % 12)}, ${areas[n % areas.length]}, Dhaka`,
    emergencyContactName: `${pick(male ? femaleNames : maleNames)} (family)`,
    emergencyContactPhone: `0171000${pad(n, 4)}`,
    medicalHistory: histories[n % histories.length],
    allergies: allergyList[(n * 3) % allergyList.length],
    dentalHistory: dentalHistories[n % dentalHistories.length],
    createdAt: at(-(90 - n * 2), "10:00"),
  };
});

// ---------------------------------------------------------------- appointments

type AppointmentPlan = {
  n: number;
  patient: number | null; // 1-based patient index; null = unlinked website visitor
  service: ServiceCode;
  offset: number;
  time: string;
  status: AppointmentStatus;
  source: AppointmentSource;
};

const completedOffsets = [-55, -48, -42, -38, -33, -29, -24, -20, -16, -12, -9, -6, -4, -2];
const completedServices: (ServiceCode)[] = ["SCALE", "FILL", "RCT", "CONS", "EXT", "CROWN", "FILL", "RCT-M", "SCALE", "WHITE", "CONS", "FILL", "EXT-S", "SCALE"];
const times = ["09:30", "10:30", "11:30", "12:30", "15:00", "16:00"];

const appointmentPlans: AppointmentPlan[] = [];
completedOffsets.forEach((offset, index) => appointmentPlans.push({ n: appointmentPlans.length + 1, patient: index + 1, service: completedServices[index], offset, time: times[index % times.length], status: "COMPLETED", source: index % 4 === 0 ? "DIRECT" : "ADMIN" }));
[[-26, 15, "CONS"], [-14, 16, "FILL"], [9, 17, "SCALE"]].forEach(([offset, patient, service], index) => appointmentPlans.push({ n: appointmentPlans.length + 1, patient: patient as number, service: service as ServiceCode, offset: offset as number, time: times[(index + 2) % times.length], status: "CANCELLED", source: "ADMIN" }));
[[1, 18, "SCALE"], [2, 19, "CONS"], [4, 20, "FILL"], [6, 21, "RCT"], [8, 22, "XRAY"], [11, 23, "CROWN"]].forEach(([offset, patient, service], index) => appointmentPlans.push({ n: appointmentPlans.length + 1, patient: patient as number, service: service as ServiceCode, offset: offset as number, time: times[index % times.length], status: "CONFIRMED", source: index % 2 ? "ADMIN" : "DIRECT" }));
[[3, null, "CONS"], [5, null, "WHITE"], [7, 24, "SCALE"], [10, null, "ORTHO"], [13, 25, "FILL"], [14, null, "CONS"]].forEach(([offset, patient, service], index) => appointmentPlans.push({ n: appointmentPlans.length + 1, patient: patient as number | null, service: service as ServiceCode, offset: offset as number, time: times[(index + 1) % times.length], status: "PENDING", source: index % 2 ? "WHATSAPP" : "DIRECT" }));

const visitors = [["Mahbub Alam", "01710010001"], ["Ayesha Siddika", "01710010002"], ["Rony Biswas", "01710010003"], ["Lutfa Begum", "01710010004"]] as const;

// ---------------------------------------------------------------- main

async function assertSafeTarget() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed demo data when NODE_ENV=production.");
  }
  const [foreignPatients, foreignAppointments, foreignInvoices] = await Promise.all([
    prisma.patient.count({ where: { NOT: { id: { startsWith: "demo-" } } } }),
    prisma.appointment.count({ where: { NOT: { id: { startsWith: "demo-" } } } }),
    prisma.invoice.count({ where: { NOT: { id: { startsWith: "demo-" } } } }),
  ]);
  if ((foreignPatients || foreignAppointments || foreignInvoices) && !process.argv.includes("--allow-existing-data")) {
    throw new Error(
      `This database already contains real clinic records (${foreignPatients} patients, ${foreignAppointments} appointments, ${foreignInvoices} invoices). ` +
      "Demo data is meant for an empty development database. Use a separate database, or pass --allow-existing-data to add the demo rows next to the existing ones.",
    );
  }
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function wipeDemoRows(tx: Tx) {
  const demo = { id: { startsWith: "demo-" } };
  // Rows created through the app for demo patients have non-demo ids, so match on the patient too.
  const owned = { OR: [demo, { patient: demo }] };
  await tx.payment.deleteMany({ where: { invoice: owned } });
  await tx.invoiceItem.deleteMany({ where: { invoice: owned } });
  await tx.invoice.deleteMany({ where: owned });
  await tx.prescriptionMedication.deleteMany({ where: { prescription: owned } });
  await tx.prescription.deleteMany({ where: owned });
  await tx.treatmentSession.deleteMany({ where: { treatmentPlan: owned } });
  await tx.treatmentPlan.deleteMany({ where: owned });
  await tx.examinationRecord.deleteMany({ where: owned });
  await tx.dentalChartEntry.deleteMany({ where: owned });
  await tx.appointment.deleteMany({ where: owned });
  await tx.expense.deleteMany({ where: demo });
  await tx.patient.deleteMany({ where: demo });
  await tx.clinicService.deleteMany({ where: demo });
}

async function seedStaff() {
  const staff = [
    { id: "demo-user-admin", name: "Dr. Anika Rahman (Admin)", email: "admin@demo.example", role: "admin", password: DEMO_ADMIN_PASSWORD },
    { id: "demo-user-reception", name: "Sabina Khatun (Reception)", email: "reception@demo.example", role: "receptionist", password: DEMO_RECEPTION_PASSWORD },
  ];
  for (const person of staff) {
    await prisma.user.upsert({
      where: { id: person.id },
      create: { id: person.id, name: person.name, email: person.email, emailVerified: true, role: person.role },
      update: { name: person.name, role: person.role },
    });
    // The password is only set when the account is first created, so a re-run never overwrites a
    // password someone changed; it is stored hashed (scrypt) exactly as Better Auth does.
    const existing = await prisma.account.findUnique({ where: { id: `demo-acct-${person.id}` } });
    if (!existing) {
      await prisma.account.create({
        data: { id: `demo-acct-${person.id}`, accountId: person.id, providerId: "credential", userId: person.id, password: await hashPassword(person.password) },
      });
    }
  }
}

async function seedDoctor() {
  // One doctor per clinic. An existing profile (and its schedule) is left exactly as it is.
  const existing = await prisma.doctorProfile.findUnique({ where: { id: "primary" }, include: { schedules: true } });
  if (!existing) {
    await prisma.doctorProfile.create({
      data: {
        id: "primary",
        name: "Dr. Anika Rahman",
        qualifications: "BDS, MS (Endodontics)",
        specialization: "Endodontics & Restorative Dentistry",
        registrationNumber: "DEMO-12345",
        consultationFee: 500,
        phone: "01700000000",
        email: "doctor@demo.example",
        address: "Demo Dental Clinic, Road 5, Dhanmondi, Dhaka",
        bio: "Fictional doctor profile created for demonstration data.",
      },
    });
  }
  if (!existing?.schedules.length) {
    // Saturday to Thursday, 09:00-18:00; Friday closed.
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
      await prisma.doctorSchedule.upsert({
        where: { doctorId_dayOfWeek: { doctorId: "primary", dayOfWeek } },
        create: { doctorId: "primary", dayOfWeek, startTime: "09:00", endTime: "18:00", isWorking: dayOfWeek !== 5 },
        update: {},
      });
    }
  }
  return prisma.doctorSchedule.findMany({ where: { doctorId: "primary", isWorking: true } });
}

async function main() {
  await assertSafeTarget();
  await seedStaff();
  const workingDays = new Set((await seedDoctor()).map((schedule) => schedule.dayOfWeek));
  const weekdayOf = (offset: number) => new Date(`${dayKey(offset)}T12:00:00+06:00`).getUTCDay();

  // Keep every appointment on a working day, on a day of its own (so nothing can overlap).
  const usedDays = new Set<number>();
  for (const plan of appointmentPlans) {
    while (!workingDays.has(weekdayOf(plan.offset)) || usedDays.has(plan.offset)) plan.offset += plan.offset < 0 ? -1 : 1;
    usedDays.add(plan.offset);
  }
  const adminId = "demo-user-admin";
  const counts: Record<string, number> = {};
  const note = (key: string, amount = 1) => { counts[key] = (counts[key] ?? 0) + amount; };

  await prisma.$transaction(async (tx) => {
    await wipeDemoRows(tx);

    // Services and patients
    await tx.clinicService.createMany({
      data: services.map((service, index) => ({
        id: `demo-svc-${pad(index + 1)}`, code: service.code, name: service.name, category: service.category,
        standardPrice: service.price, durationMinutes: service.minutes, description: `${service.name} (demo price list).`,
      })),
    });
    note("services", services.length);
    await tx.patient.createMany({ data: patients });
    note("patients", patients.length);

    // Appointments
    const serviceId = (code: string) => `demo-svc-${pad(services.findIndex((service) => service.code === code) + 1)}`;
    let visitor = 0;
    const appointmentRows = appointmentPlans.map((plan) => {
      const patient = plan.patient ? patients[plan.patient - 1] : null;
      const guest = patient ? null : visitors[visitor++ % visitors.length];
      const service = serviceByCode[plan.service];
      return {
        id: `demo-appt-${pad(plan.n)}`,
        patientId: patient?.id ?? null,
        patientName: patient?.name ?? guest![0],
        patientPhone: patient?.phone ?? guest![1],
        patientEmail: patient?.email ?? null,
        service: service.name,
        serviceId: serviceId(plan.service),
        dateTime: at(plan.offset, plan.time),
        durationMinutes: service.minutes,
        status: plan.status,
        source: plan.source,
        notes: plan.status === "PENDING" ? "Requested through the clinic website." : plan.status === "CANCELLED" ? "Patient asked to cancel." : null,
        createdAt: at(plan.offset - 2, "09:00"),
      };
    });
    await tx.appointment.createMany({ data: appointmentRows });
    note("appointments", appointmentRows.length);

    // Examination records for completed visits; some set a follow-up date
    const completed = appointmentPlans.filter((plan) => plan.status === "COMPLETED");
    const diagnoses: Record<string, [string, string, string]> = {
      SCALE: ["Gum bleeding and tartar build-up", "Generalised calculus deposits, mild gingival inflammation", "Chronic generalised gingivitis"],
      FILL: ["Sensitivity to cold on lower right", "Occlusal cavity on tooth 46, no pulp involvement", "Dental caries, tooth 46"],
      RCT: ["Severe night-time toothache", "Deep caries with periapical radiolucency on tooth 36", "Irreversible pulpitis, tooth 36"],
      "RCT-M": ["Persistent pain on biting", "Tooth 26 tender to percussion, large restoration", "Symptomatic apical periodontitis, tooth 26"],
      CONS: ["Routine check-up", "No active caries; mild plaque accumulation", "Healthy dentition; oral hygiene advice given"],
      EXT: ["Painful broken tooth", "Non-restorable crown fracture on tooth 48", "Fractured tooth 48, extraction advised"],
      "EXT-S": ["Impacted wisdom tooth with swelling", "Partially erupted 38, pericoronal swelling", "Pericoronitis, impacted tooth 38"],
      CROWN: ["Large old filling broke", "Tooth 15 heavily restored, cusp fracture", "Fractured restoration, tooth 15, crown planned"],
      WHITE: ["Wants whiter teeth", "Generalised extrinsic staining, healthy gums", "Extrinsic tooth staining"],
    };
    const examinationRows = completed.map((plan, index) => {
      const [complaint, findings, diagnosis] = diagnoses[plan.service] ?? diagnoses.CONS;
      return {
        id: `demo-exam-${pad(index + 1)}`,
        patientId: patients[plan.patient! - 1].id,
        appointmentId: `demo-appt-${pad(plan.n)}`,
        examinedById: adminId,
        examinedAt: at(plan.offset, plan.time),
        chiefComplaint: complaint,
        findings,
        diagnosis,
        notes: index % 3 === 0 ? "Oral hygiene instructions given; advised a six-month review." : null,
        followUpDate: index % 3 === 1 ? dateOnly(plan.offset + 21 > 0 ? plan.offset + 21 : 3 + index) : null,
      };
    });
    await tx.examinationRecord.createMany({ data: examinationRows });
    note("examinations", examinationRows.length);

    // Dental charts for the first twelve patients
    const conditions: ToothCondition[] = ["CARIES", "FILLED", "FILLED", "CROWN", "ROOT_CANAL", "MISSING", "FRACTURED", "IMPLANT", "HEALTHY", "EXTRACTED"];
    const teeth = ["16", "26", "36", "46", "14", "24", "34", "44", "18", "28", "38", "48", "11", "21", "31", "41"];
    const chartRows = [];
    for (let patientIndex = 0; patientIndex < 12; patientIndex += 1) {
      const chosen = new Set<string>();
      while (chosen.size < 3 + (patientIndex % 4)) chosen.add(pick(teeth));
      for (const tooth of chosen) {
        chartRows.push({
          id: `demo-chart-${pad(patientIndex + 1)}-${tooth}`,
          patientId: patients[patientIndex].id,
          toothNumber: tooth,
          condition: pick(conditions),
          notes: random() > 0.6 ? "Monitor at next visit." : null,
          updatedById: adminId,
        });
      }
    }
    await tx.dentalChartEntry.createMany({ data: chartRows });
    note("dentalChartEntries", chartRows.length);

    // Treatment plans with sessions
    const planSpecs: { patient: number; procedure: string; diagnosis: string; teeth: string[]; cost: number; status: TreatmentPlanStatus; sessions: number }[] = [
      { patient: 3, procedure: "Root canal treatment", diagnosis: "Irreversible pulpitis, tooth 36", teeth: ["36"], cost: 9500, status: "COMPLETED", sessions: 3 },
      { patient: 8, procedure: "Root canal treatment and crown", diagnosis: "Symptomatic apical periodontitis, tooth 26", teeth: ["26"], cost: 16500, status: "IN_PROGRESS", sessions: 2 },
      { patient: 6, procedure: "Porcelain crown", diagnosis: "Fractured restoration, tooth 15", teeth: ["15"], cost: 7000, status: "IN_PROGRESS", sessions: 1 },
      { patient: 11, procedure: "Full-mouth scaling and gum therapy", diagnosis: "Chronic generalised periodontitis", teeth: [], cost: 6000, status: "IN_PROGRESS", sessions: 2 },
      { patient: 18, procedure: "Dental implant (lower left first molar)", diagnosis: "Missing tooth 36", teeth: ["36"], cost: 45000, status: "PLANNED", sessions: 0 },
      { patient: 19, procedure: "Composite fillings", diagnosis: "Multiple occlusal caries", teeth: ["16", "17", "26"], cost: 3600, status: "PLANNED", sessions: 0 },
      { patient: 4, procedure: "Surgical extraction of impacted wisdom tooth", diagnosis: "Impacted tooth 38", teeth: ["38"], cost: 3500, status: "COMPLETED", sessions: 1 },
      { patient: 12, procedure: "Teeth whitening", diagnosis: "Extrinsic staining", teeth: [], cost: 8000, status: "ON_HOLD", sessions: 0 },
      { patient: 20, procedure: "Partial denture", diagnosis: "Missing teeth 45, 46", teeth: ["45", "46"], cost: 12000, status: "CANCELLED", sessions: 0 },
      { patient: 9, procedure: "Orthodontic aligners", diagnosis: "Mild crowding of lower incisors", teeth: ["31", "32", "41", "42"], cost: 60000, status: "IN_PROGRESS", sessions: 3 },
    ];
    const sessionRows: { id: string; treatmentPlanId: string; createdById: string; performedAt: Date; notes: string }[] = [];
    const planRows = planSpecs.map((spec, index) => {
      const id = `demo-plan-${pad(index + 1)}`;
      const started = -50 + index * 4;
      for (let s = 0; s < spec.sessions; s += 1) {
        sessionRows.push({ id: `demo-session-${pad(index + 1)}-${s + 1}`, treatmentPlanId: id, createdById: adminId, performedAt: at(started + s * 7, "11:00"), notes: s === 0 ? "Procedure started; patient comfortable, local anaesthesia used." : `Visit ${s + 1}: progressing as planned, no complications.` });
      }
      return {
        id, patientId: patients[spec.patient - 1].id, diagnosis: spec.diagnosis, procedureName: spec.procedure, toothNumbers: spec.teeth,
        estimatedCost: spec.cost, status: spec.status, notes: null, createdAt: at(started - 1, "10:00"),
        completedAt: spec.status === "COMPLETED" ? at(started + 14, "12:00") : null,
      };
    });
    await tx.treatmentPlan.createMany({ data: planRows });
    await tx.treatmentSession.createMany({ data: sessionRows });
    note("treatmentPlans", planRows.length);
    note("treatmentSessions", sessionRows.length);

    // Prescriptions
    const medicationSets: [string, string, string, string][][] = [
      [["Amoxicillin 500mg", "1 capsule", "3 times daily", "5 days"], ["Paracetamol 500mg", "1 tablet", "up to 3 times daily if needed", "3 days"]],
      [["Ibuprofen 400mg", "1 tablet", "twice daily after food", "3 days"]],
      [["Metronidazole 400mg", "1 tablet", "3 times daily", "5 days"], ["Chlorhexidine 0.2% mouthwash", "10 ml", "twice daily", "7 days"]],
      [["Naproxen 500mg", "1 tablet", "twice daily after food", "4 days"], ["Omeprazole 20mg", "1 capsule", "once daily before breakfast", "4 days"]],
    ];
    const rxRows = completed.slice(0, 12).map((plan, index) => ({
      id: `demo-rx-${pad(index + 1)}`,
      patientId: patients[plan.patient! - 1].id,
      prescribedById: adminId,
      diagnosis: examinationRows[index].diagnosis,
      instructions: index % 2 ? "Avoid very hot or hard food for 24 hours." : "Rinse gently with warm salt water after meals.",
      followUpDate: index % 4 === 0 ? dateOnly(4 + index) : null,
      createdAt: at(plan.offset, plan.time),
    }));
    const medicationRows = rxRows.flatMap((rx, index) =>
      medicationSets[index % medicationSets.length].map(([name, dosage, frequency, duration], position) => ({
        id: `${rx.id}-med-${position + 1}`, prescriptionId: rx.id, name, dosage, frequency, duration, instructions: position === 0 && index % 3 === 0 ? "Complete the full course." : null,
      })),
    );
    await tx.prescription.createMany({ data: rxRows });
    await tx.prescriptionMedication.createMany({ data: medicationRows });
    note("prescriptions", rxRows.length);

    // Invoices and payments. Pattern by visit: full, full (two payments), full, partial, unpaid.
    const methods: PaymentMethod[] = ["CASH", "CARD", "MOBILE_BANKING", "BANK_TRANSFER", "CASH"];
    type InvoiceSpec = { key: string; patient: number; issuedOffset: number; lines: { code: string; quantity: number; price?: number; description?: string }[]; discount: number; tax: number; pay: "full" | "split" | "partial" | "none" | "void"; notes?: string };
    const invoiceSpecs: InvoiceSpec[] = completed.map((plan, index) => ({
      key: `visit-${pad(index + 1)}`, patient: plan.patient!, issuedOffset: plan.offset,
      lines: [{ code: plan.service, quantity: 1 }, ...(index % 4 === 1 ? [{ code: "XRAY", quantity: 2 }] : [])],
      discount: index % 5 === 2 ? 200 : 0, tax: 0,
      pay: (["full", "split", "full", "partial", "none"] as const)[index % 5],
    }));
    invoiceSpecs.push(
      { key: "plan-rct", patient: 3, issuedOffset: -36, lines: [{ code: "RCT-M", quantity: 1 }], discount: 0, tax: 0, pay: "full", notes: "Root canal, tooth 36." },
      { key: "plan-crown", patient: 8, issuedOffset: -18, lines: [{ code: "RCT-M", quantity: 1 }, { code: "CROWN", quantity: 1 }], discount: 500, tax: 0, pay: "partial", notes: "Advance for root canal and crown." },
      { key: "plan-ortho", patient: 9, issuedOffset: -30, lines: [{ code: "ORTHO", quantity: 1 }, { description: "Clear aligner set (stage 1)", code: "", quantity: 1, price: 55000 }], discount: 0, tax: 0, pay: "split" },
      { key: "plan-impl", patient: 18, issuedOffset: -3, lines: [{ code: "IMPL", quantity: 1 }], discount: 2000, tax: 0, pay: "split", notes: "Implant fee paid in two instalments." },
      { key: "void", patient: 26, issuedOffset: -10, lines: [{ code: "WHITE", quantity: 1 }], discount: 0, tax: 0, pay: "void", notes: "Raised in error." },
    );

    let invoiceNumber = 0;
    for (const spec of invoiceSpecs) {
      invoiceNumber += 1;
      const id = `demo-inv-${spec.key}`;
      const items = spec.lines.map((line, position) => {
        const service = line.code ? serviceByCode[line.code as ServiceCode] : null;
        const unitPrice = line.price ?? service!.price;
        return {
          id: `${id}-item-${position + 1}`, invoiceId: id, serviceId: line.code ? serviceId(line.code) : null,
          description: line.description ?? service!.name, quantity: line.quantity, unitPrice, amount: Math.round(unitPrice * line.quantity * 100) / 100,
        };
      });
      const totals = computeInvoiceTotals(items, spec.discount, spec.tax);
      const issuedAt = at(spec.issuedOffset, "13:00");
      const payments: { id: string; invoiceId: string; amount: number; method: PaymentMethod; status: "POSTED" | "REFUNDED"; receivedAt: Date; refundedAt: Date | null; reference: string | null; note: string | null }[] = [];
      const payment = (position: number, cents: number, extraDays: number, overrides: Partial<(typeof payments)[number]> = {}) =>
        payments.push({
          id: `${id}-pay-${position}`, invoiceId: id, amount: cents / 100, method: methods[(invoiceNumber + position) % methods.length], status: "POSTED",
          receivedAt: at(Math.min(spec.issuedOffset + extraDays, 0), "13:30"), refundedAt: null, reference: null, note: null, ...overrides,
        });
      if (spec.pay === "full") payment(1, totals.totalCents, 0);
      if (spec.pay === "split") {
        const first = Math.round(totals.totalCents * 0.6);
        payment(1, first, 0);
        payment(2, totals.totalCents - first, 5);
      }
      if (spec.pay === "partial") payment(1, Math.round(totals.totalCents * 0.5), 0);
      // One refunded payment so the refund workflow has realistic history.
      if (spec.key === "visit-05") payment(2, 100 * 100, 1, { status: "REFUNDED", refundedAt: at(Math.min(spec.issuedOffset + 2, 0), "15:00"), note: "Refund: duplicate card charge." });

      const posted = payments.filter((entry) => entry.status === "POSTED");
      const status = spec.pay === "void" ? "VOID" as const : statusForPayments(paidCents(posted), totals.totalCents);
      await tx.invoice.create({
        data: {
          id, invoiceCode: `INV-D${pad(invoiceNumber, 3)}`, patientId: patients[spec.patient - 1].id, status,
          subtotal: totals.subtotalCents / 100, discount: totals.discountCents / 100, tax: totals.taxCents / 100,
          notes: spec.notes ?? null, issuedAt, createdAt: issuedAt,
        },
      });
      await tx.invoiceItem.createMany({ data: items });
      if (payments.length) await tx.payment.createMany({ data: payments });
      note("invoices");
      note("payments", payments.length);
    }

    // Expenses over the last ~90 days
    const expenseRows: { id: string; category: ExpenseCategory; description: string; amount: number; spentAt: Date; method: PaymentMethod; reference: string | null; createdById: string; voidedAt?: Date; voidReason?: string }[] = [];
    const expense = (category: ExpenseCategory, description: string, amount: number, offset: number, method: PaymentMethod = "CASH", extra: { voidedAt?: Date; voidReason?: string } = {}) =>
      expenseRows.push({ id: `demo-exp-${pad(expenseRows.length + 1)}`, category, description, amount, spentAt: dateOnly(offset), method, reference: method === "BANK_TRANSFER" ? `TRX${pad(expenseRows.length + 1, 6)}` : null, createdById: adminId, ...extra });
    for (const offset of [-85, -55, -25]) {
      expense("RENT", "Clinic rent", 12000, offset, "BANK_TRANSFER");
      expense("SALARY", "Assistant and receptionist salaries", 15000, offset + 2, "BANK_TRANSFER");
      expense("UTILITIES", "Electricity, water and internet", 2400 + Math.round(random() * 400), offset + 5, "MOBILE_BANKING");
    }
    expense("SUPPLIES", "Composite resin and bonding agent", 12400, -70, "CARD");
    expense("SUPPLIES", "Disposable gloves, masks and cotton rolls", 3600, -48, "CASH");
    expense("SUPPLIES", "Local anaesthetic cartridges", 5400, -33, "CASH");
    expense("SUPPLIES", "Sterilisation pouches", 1800, -14, "CASH");
    expense("LAB_FEES", "Porcelain crown (dental laboratory)", 3500, -40, "BANK_TRANSFER");
    expense("LAB_FEES", "Partial denture (dental laboratory)", 4200, -21, "BANK_TRANSFER");
    expense("EQUIPMENT", "Replacement handpiece", 8500, -60, "CARD");
    expense("MAINTENANCE", "Autoclave servicing", 4500, -28, "CASH");
    expense("MAINTENANCE", "Dental chair hydraulic repair", 7000, -9, "CASH");
    expense("MARKETING", "Facebook page promotion", 3000, -35, "MOBILE_BANKING");
    expense("OTHER", "Waiting-room refreshments", 900, -7, "CASH");
    expense("EQUIPMENT", "Intraoral camera (ordered twice by mistake)", 22000, -16, "CARD", { voidedAt: at(-15, "10:00"), voidReason: "Duplicate order; supplier refunded." });
    await tx.expense.createMany({ data: expenseRows });
    note("expenses", expenseRows.length);
  }, { timeout: 120_000, maxWait: 30_000 });

  await verifyConsistency();

  console.log("Demo data is ready:");
  for (const [key, value] of Object.entries(counts)) console.log(`  ${key.padEnd(20)} ${value}`);
  console.log("\nSign in with the demo accounts listed in SEEDING.md (admin@demo.example, reception@demo.example).");
}

/** Re-reads the seeded rows and fails loudly if any invoice, payment or appointment is inconsistent. */
async function verifyConsistency() {
  const invoices = await prisma.invoice.findMany({ where: { id: { startsWith: "demo-" } }, include: { items: true, payments: true } });
  const problems: string[] = [];
  for (const invoice of invoices) {
    const itemTotal = invoice.items.reduce((sum, item) => sum + Math.round(Number(item.amount) * 100), 0);
    if (itemTotal !== Math.round(Number(invoice.subtotal) * 100)) problems.push(`${invoice.invoiceCode}: items do not add up to the subtotal`);
    const total = invoiceTotalCents(invoice);
    const paid = paidCents(invoice.payments.filter((payment) => payment.status === "POSTED"));
    if (paid > total) problems.push(`${invoice.invoiceCode}: paid more than the total`);
    if (invoice.status !== "VOID" && invoice.status !== statusForPayments(paid, total)) problems.push(`${invoice.invoiceCode}: status ${invoice.status} does not match payments`);
  }
  const confirmed = await prisma.appointment.findMany({ where: { id: { startsWith: "demo-" }, status: "CONFIRMED" }, orderBy: { dateTime: "asc" } });
  confirmed.forEach((appointment, index) => {
    const next = confirmed[index + 1];
    if (next && appointment.dateTime.getTime() + appointment.durationMinutes * 60_000 > next.dateTime.getTime()) problems.push(`appointments ${appointment.id} and ${next.id} overlap`);
  });
  if (problems.length) throw new Error(`Demo data failed its consistency check:\n- ${problems.join("\n- ")}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
