import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { writeAuditEvent } from "@/lib/audit";
import { listTreatmentPlans } from "@/modules/treatments/queries/treatment-plan-queries";
import {
  treatmentListParamsSchema,
  treatmentPlanInputSchema,
} from "@/modules/treatments/schemas/treatment-plan-schema";
import { createTreatmentPlan } from "@/modules/treatments/services/treatment-plan-service";

export async function GET(request: Request) {
  const access = await authorize(request.headers, "treatments:read");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });

  const params = new URL(request.url).searchParams;
  const parsed = treatmentListParamsSchema.safeParse({
    page: params.get("page") ?? undefined,
    pageSize: params.get("pageSize") ?? undefined,
    search: params.get("search") ?? undefined,
    status: params.get("status") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid treatment search or filter." }, { status: 400 });
  }

  return NextResponse.json(await listTreatmentPlans(parsed.data));
}

export async function POST(request: Request) {
  const access = await authorize(request.headers, "treatments:write");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = treatmentPlanInputSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid treatment plan." }, { status: 400 });
  }

  const plan = await createTreatmentPlan(parsed.data);
  await writeAuditEvent(request, access.session.user.id, "CREATE", "TreatmentPlan", plan.id);
  return NextResponse.json({ plan: { ...plan, estimatedCost: plan.estimatedCost.toString() } }, { status: 201 });
}
