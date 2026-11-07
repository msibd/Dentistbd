import type { TreatmentPlanStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { TreatmentPlanInput } from "@/modules/treatments/schemas/treatment-plan-schema";

export async function createTreatmentPlan(input: TreatmentPlanInput) {
  return prisma.treatmentPlan.create({
    data: {
      ...input,
      estimatedCost: input.estimatedCost,
    },
  });
}

export async function updateTreatmentPlan(
  id: string,
  input: TreatmentPlanInput,
) {
  try {
    return await prisma.$transaction(async (transaction) => {
      const current = await transaction.treatmentPlan.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!current) return null;
      if (current.status === "COMPLETED" || current.status === "CANCELLED") {
        return { unavailable: true as const };
      }

      const plan = await transaction.treatmentPlan.update({
        where: { id },
        data: {
          ...input,
          estimatedCost: input.estimatedCost,
          completedAt: input.status === "COMPLETED" ? new Date() : null,
        },
      });
      return { ...plan, unavailable: false as const };
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

export async function updateTreatmentPlanStatus(
  id: string,
  status: TreatmentPlanStatus,
) {
  try {
    return await prisma.$transaction(async (transaction) => {
      const current = await transaction.treatmentPlan.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!current) return null;
      if (current.status === "COMPLETED" || current.status === "CANCELLED") {
        return { unavailable: true as const };
      }

      const plan = await transaction.treatmentPlan.update({
        where: { id },
        data: {
          status,
          completedAt: status === "COMPLETED" ? new Date() : null,
        },
      });
      return { ...plan, unavailable: false as const };
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

export async function addTreatmentSession(
  treatmentPlanId: string,
  notes: string,
  performedAt: Date | undefined,
  createdById: string,
) {
  return prisma.$transaction(async (transaction) => {
    const plan = await transaction.treatmentPlan.findUnique({
      where: { id: treatmentPlanId },
      select: { id: true, status: true },
    });
    if (!plan) return null;
    if (plan.status === "COMPLETED" || plan.status === "CANCELLED") {
      return { unavailable: true as const };
    }

    const session = await transaction.treatmentSession.create({
      data: {
        treatmentPlanId,
        notes,
        performedAt,
        createdById,
      },
      include: { createdBy: { select: { name: true } } },
    });

    if (plan.status === "PLANNED") {
      await transaction.treatmentPlan.update({
        where: { id: treatmentPlanId },
        data: { status: "IN_PROGRESS" },
      });
    }

    return {
      ...session,
      unavailable: false as const,
    };
  });
}

export async function getTreatmentPlanById(id: string) {
  const plan = await prisma.treatmentPlan.findUnique({
    where: { id },
    include: {
      patient: { select: { id: true, patientCode: true, name: true, phone: true } },
      sessions: {
        orderBy: { performedAt: "desc" },
        include: { createdBy: { select: { name: true } } },
      },
    },
  });
  if (!plan) return null;
  return { ...plan, estimatedCost: plan.estimatedCost.toString() };
}
