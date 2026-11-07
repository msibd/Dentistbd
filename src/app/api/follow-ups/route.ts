import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/admin-session";
import { apiError, parseQuery } from "@/lib/api";
import { addClinicDays, getClinicDateKey } from "@/lib/clinic-date";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(14),
});

const dateOnly = (value: string) => new Date(`${value}T00:00:00.000Z`);

// Upcoming follow-up dates set on prescriptions and examinations, so the front desk can call
// patients back. It deliberately returns contact details only, never diagnoses or notes.
export async function GET(request: Request) {
  const access = await authorize(request.headers, "appointments:read");
  if (!access.session) return apiError(access.error, access.status);
  const query = parseQuery(request, querySchema);
  if (!query.ok) return query.response;

  const today = getClinicDateKey(new Date());
  const range = { gte: dateOnly(today), lte: dateOnly(addClinicDays(today, query.data.days)) };
  const patientSelect = { select: { id: true, patientCode: true, name: true, phone: true, isActive: true } } as const;
  const [prescriptions, examinations] = await Promise.all([
    prisma.prescription.findMany({ where: { followUpDate: range, patient: { isActive: true } }, select: { followUpDate: true, patient: patientSelect } }),
    prisma.examinationRecord.findMany({ where: { followUpDate: range, patient: { isActive: true } }, select: { followUpDate: true, patient: patientSelect } }),
  ]);

  // One reminder per patient and date, even when a prescription and an examination agree.
  const reminders = new Map<string, { followUpDate: string; patient: { id: string; patientCode: string; name: string; phone: string } }>();
  for (const row of [...prescriptions, ...examinations]) {
    if (!row.followUpDate) continue;
    const followUpDate = row.followUpDate.toISOString().slice(0, 10);
    const { id, patientCode, name, phone } = row.patient;
    reminders.set(`${id}:${followUpDate}`, { followUpDate, patient: { id, patientCode, name, phone } });
  }
  const followUps = [...reminders.values()].sort((a, b) => a.followUpDate.localeCompare(b.followUpDate) || a.patient.name.localeCompare(b.patient.name));
  return NextResponse.json({ range: { from: today, days: query.data.days }, followUps });
}
