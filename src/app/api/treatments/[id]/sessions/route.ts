import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { writeAuditEvent } from "@/lib/audit";
import { treatmentSessionInputSchema } from "@/modules/treatments/schemas/treatment-plan-schema";
import { addTreatmentSession } from "@/modules/treatments/services/treatment-plan-service";

export async function POST(
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

  const parsed = treatmentSessionInputSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid session notes." }, { status: 400 });
  }

  const session = await addTreatmentSession(
    id,
    parsed.data.notes,
    parsed.data.performedAt ? new Date(parsed.data.performedAt) : undefined,
    access.session.user.id,
  );
  if (!session) return NextResponse.json({ error: "Treatment plan not found." }, { status: 404 });
  if ("unavailable" in session && session.unavailable) {
    return NextResponse.json({ error: "Sessions cannot be added to completed or cancelled plans." }, { status: 409 });
  }
  await writeAuditEvent(request, access.session.user.id, "ADD_SESSION", "TreatmentPlan", id);
  return NextResponse.json({ session }, { status: 201 });
}
