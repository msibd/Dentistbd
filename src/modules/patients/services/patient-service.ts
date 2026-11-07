import { prisma } from "@/lib/prisma";
import type { PatientInput } from "@/modules/patients/schemas/patient-schema";
import {
  getPatientById,
  listPatientChoices,
  listPatients,
  type PatientListOptions,
} from "@/modules/patients/queries/patient-queries";

export async function getPatientDirectory(options: PatientListOptions) {
  return listPatients(options);
}

export async function getPatientChoices(options: PatientListOptions) {
  return listPatientChoices(options);
}

export async function getPatientProfile(id: string) {
  return getPatientById(id);
}

export function getPatientCount() {
  return prisma.patient.count();
}

/** Raised when the same person looks to be registered already (same name and phone). */
export class DuplicatePatientError extends Error {
  constructor(readonly existingPatientCode: string) {
    super(`A patient with this name and phone number is already registered (${existingPatientCode}).`);
    this.name = "DuplicatePatientError";
  }
}

export async function createPatient(input: PatientInput) {
  return prisma.$transaction(async (transaction) => {
    const duplicate = await transaction.patient.findFirst({
      where: { name: { equals: input.name, mode: "insensitive" }, phone: input.phone },
      select: { patientCode: true },
    });
    if (duplicate) throw new DuplicatePatientError(duplicate.patientCode);

    const [sequence] = await transaction.$queryRaw<{ value: string }[]>`
      SELECT nextval('"patient_code_seq"')::text AS value
    `;

    return transaction.patient.create({
      data: {
        ...input,
        dateOfBirth: input.dateOfBirth ? new Date(`${input.dateOfBirth}T00:00:00.000Z`) : null,
        patientCode: `PID-${sequence.value.padStart(5, "0")}`,
      },
    });
  });
}

export async function updatePatient(id: string, input: PatientInput) {
  try {
    return await prisma.patient.update({
      where: { id },
      data: {
        ...input,
        dateOfBirth: input.dateOfBirth ? new Date(`${input.dateOfBirth}T00:00:00.000Z`) : null,
      },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return null;
    }

    throw error;
  }
}

export async function updatePatientActiveStatus(id: string, isActive: boolean) {
  try {
    return await prisma.patient.update({
      where: { id },
      data: { isActive },
      select: { id: true, isActive: true },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return null;
    }

    throw error;
  }
}

export async function deletePatient(id: string) {
  return prisma.$transaction(async (transaction) => {
    const patient = await transaction.patient.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!patient) return null;

    const [appointmentCount, treatmentPlanCount] = await Promise.all([
      transaction.appointment.count({ where: { patientId: id } }),
      transaction.treatmentPlan.count({ where: { patientId: id } }),
    ]);

    if (appointmentCount || treatmentPlanCount) {
      return { deleted: false, appointmentCount, treatmentPlanCount };
    }

    await transaction.patient.delete({ where: { id } });
    return { deleted: true, appointmentCount: 0, treatmentPlanCount: 0 };
  });
}
