import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { writeAuditEvent } from "@/lib/audit";
import {
  treatmentPlanStatusSchema,
  treatmentPlanInputSchema,
} from "@/modules/treatments/schemas/treatment-plan-schema";
import {
  getTreatmentPlanById,
  updateTreatmentPlan,
  updateTreatmentPlanStatus,
} from "@/modules/treatments/services/treatment-plan-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await authorize(request.headers, "treatments:read");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  const plan = await getTreatmentPlanById(id);
  if (!plan) return NextResponse.json({ error: "Treatment plan not found." }, { status: 404 });
  return NextResponse.json({ plan });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await authorize(request.headers, "treatments:write");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (
    payload &&
    typeof payload === "object" &&
    "status" in payload &&
    Object.keys(payload).length === 1
  ) {
    const parsedStatus = treatmentPlanStatusSchema.safeParse(payload.status);
    if (!parsedStatus.success) {
      return NextResponse.json({ error: "Invalid treatment status." }, { status: 400 });
    }
    const plan = await updateTreatmentPlanStatus(id, parsedStatus.data);
    if (!plan) return NextResponse.json({ error: "Treatment plan not found." }, { status: 404 });
    if ("unavailable" in plan && plan.unavailable) {
      return NextResponse.json({ error: "Completed or cancelled treatment plans cannot be changed." }, { status: 409 });
    }
    await writeAuditEvent(request, access.session.user.id, "UPDATE_STATUS", "TreatmentPlan", id, { status: parsedStatus.data });
    return NextResponse.json({ plan: { ...plan, estimatedCost: plan.estimatedCost.toString() } });
  }

  const parsed = treatmentPlanInputSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid treatment plan." }, { status: 400 });
  }
  const plan = await updateTreatmentPlan(id, parsed.data);
  if (!plan) return NextResponse.json({ error: "Treatment plan not found." }, { status: 404 });
  if ("unavailable" in plan && plan.unavailable) {
    return NextResponse.json({ error: "Completed or cancelled treatment plans cannot be changed." }, { status: 409 });
  }
  await writeAuditEvent(request, access.session.user.id, "UPDATE", "TreatmentPlan", id);
  return NextResponse.json({ plan: { ...plan, estimatedCost: plan.estimatedCost.toString() } });
}
