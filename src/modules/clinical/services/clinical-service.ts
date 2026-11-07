import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";
import type { DentalChartUpdate, ExaminationInput, ExaminationUpdate } from "@/modules/clinical/schemas/clinical-schema";

export class ClinicalRuleError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409) {
    super(message);
  }
}

const dateOnly = (value: string | null) => (value ? new Date(`${value}T00:00:00.000Z`) : null);

const examinationSelect = {
  id: true,
  patientId: true,
  appointmentId: true,
  examinedAt: true,
  chiefComplaint: true,
  findings: true,
  diagnosis: true,
  notes: true,
  followUpDate: true,
  createdAt: true,
  updatedAt: true,
  examinedBy: { select: { id: true, name: true } },
} as const;

export async function createExamination(request: Request, actorId: string, input: ExaminationInput) {
  return prisma.$transaction(async (transaction) => {
    const patient = await transaction.patient.findUnique({ where: { id: input.patientId }, select: { id: true } });
    if (!patient) throw new ClinicalRuleError("Patient not found.", 404);

    if (input.appointmentId) {
      const appointment = await transaction.appointment.findUnique({
        where: { id: input.appointmentId },
        select: { patientId: true },
      });
      if (!appointment) throw new ClinicalRuleError("Appointment not found.", 404);
      if (appointment.patientId !== input.patientId) {
        throw new ClinicalRuleError("That appointment belongs to a different patient.", 400);
      }
    }

    const examination = await transaction.examinationRecord.create({
      data: {
        patientId: input.patientId,
        appointmentId: input.appointmentId,
        examinedById: actorId,
        examinedAt: input.examinedAt ? new Date(input.examinedAt) : undefined,
        chiefComplaint: input.chiefComplaint,
        findings: input.findings,
        diagnosis: input.diagnosis,
        notes: input.notes,
        followUpDate: dateOnly(input.followUpDate),
      },
      select: examinationSelect,
    });
    await writeAuditEvent(request, actorId, "CREATE", "ExaminationRecord", examination.id, { patientId: input.patientId }, transaction);
    return examination;
  });
}

export async function updateExamination(request: Request, actorId: string, id: string, input: ExaminationUpdate) {
  return prisma.$transaction(async (transaction) => {
    const current = await transaction.examinationRecord.findUnique({ where: { id }, select: { id: true } });
    if (!current) return null;
    const examination = await transaction.examinationRecord.update({
      where: { id },
      data: {
        examinedAt: input.examinedAt ? new Date(input.examinedAt) : undefined,
        chiefComplaint: input.chiefComplaint,
        findings: input.findings,
        diagnosis: input.diagnosis,
        notes: input.notes,
        followUpDate: dateOnly(input.followUpDate),
      },
      select: examinationSelect,
    });
    await writeAuditEvent(request, actorId, "UPDATE", "ExaminationRecord", id, undefined, transaction);
    return examination;
  });
}

export function listExaminations(patientId: string, cursor?: string, pageSize = 20) {
  return prisma.examinationRecord.findMany({
    where: { patientId },
    select: examinationSelect,
    orderBy: [{ examinedAt: "desc" }, { id: "desc" }],
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: pageSize + 1,
  });
}

export function getExamination(id: string) {
  return prisma.examinationRecord.findUnique({ where: { id }, select: examinationSelect });
}

export async function getDentalChart(patientId: string) {
  const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true } });
  if (!patient) return null;
  return prisma.dentalChartEntry.findMany({
    where: { patientId },
    select: { toothNumber: true, condition: true, notes: true, updatedAt: true, updatedBy: { select: { id: true, name: true } } },
    orderBy: { toothNumber: "asc" },
  });
}

export async function updateDentalChart(request: Request, actorId: string, patientId: string, input: DentalChartUpdate) {
  return prisma.$transaction(async (transaction) => {
    const patient = await transaction.patient.findUnique({ where: { id: patientId }, select: { id: true } });
    if (!patient) return null;
    for (const entry of input.entries) {
      await transaction.dentalChartEntry.upsert({
        where: { patientId_toothNumber: { patientId, toothNumber: entry.toothNumber } },
        create: { patientId, toothNumber: entry.toothNumber, condition: entry.condition, notes: entry.notes, updatedById: actorId },
        update: { condition: entry.condition, notes: entry.notes, updatedById: actorId },
      });
    }
    await writeAuditEvent(request, actorId, "UPDATE", "DentalChart", patientId, { teeth: input.entries.length }, transaction);
    return transaction.dentalChartEntry.findMany({
      where: { patientId },
      select: { toothNumber: true, condition: true, notes: true, updatedAt: true, updatedBy: { select: { id: true, name: true } } },
      orderBy: { toothNumber: "asc" },
    });
  });
}
