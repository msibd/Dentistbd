import { prisma } from "@/lib/prisma";
import type { TreatmentPlanStatus } from "@/generated/prisma/client";

export async function listTreatmentPlans({
  page,
  pageSize,
  search,
  status,
}: {
  page: number;
  pageSize: number;
  search: string;
  status: TreatmentPlanStatus | "ALL";
}) {
  const where = {
    ...(status === "ALL" ? {} : { status }),
    ...(search
      ? {
          OR: [
            { diagnosis: { contains: search, mode: "insensitive" as const } },
            { procedureName: { contains: search, mode: "insensitive" as const } },
            { patient: { name: { contains: search, mode: "insensitive" as const } } },
            { patient: { patientCode: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [plans, total] = await prisma.$transaction([
    prisma.treatmentPlan.findMany({
      where,
      include: {
        patient: { select: { id: true, patientCode: true, name: true, phone: true } },
        sessions: {
          orderBy: { performedAt: "desc" },
          take: 3,
          include: { createdBy: { select: { name: true } } },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.treatmentPlan.count({ where }),
  ]);

  // Count sessions only for the visible page; Prisma's _count would aggregate every session first.
  const sessionCounts = plans.length
    ? await prisma.treatmentSession.groupBy({
        by: ["treatmentPlanId"],
        orderBy: { treatmentPlanId: "asc" },
        where: { treatmentPlanId: { in: plans.map((plan) => plan.id) } },
        _count: { _all: true },
      })
    : [];
  const sessionCountByPlan = new Map(sessionCounts.map((row) => [row.treatmentPlanId, row._count._all]));

  return {
    plans: plans.map((plan) => ({
      ...plan,
      estimatedCost: plan.estimatedCost.toString(),
      _count: { sessions: sessionCountByPlan.get(plan.id) ?? 0 },
    })),
    total,
    page,
    pageSize,
  };
}
