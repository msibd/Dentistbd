import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { apiError, parseBody } from "@/lib/api";
import { dentalChartUpdateSchema } from "@/modules/clinical/schemas/clinical-schema";
import { getDentalChart, updateDentalChart } from "@/modules/clinical/services/clinical-service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorize(request.headers, "clinical:read");
  if (!access.session) return apiError(access.error, access.status);
  const { id } = await params;
  const chart = await getDentalChart(id);
  if (!chart) return apiError("Patient not found.", 404);
  return NextResponse.json({ chart });
}

// Sets the recorded condition of one or more teeth; teeth not listed are left unchanged.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorize(request.headers, "clinical:write");
  if (!access.session) return apiError(access.error, access.status);
  const body = await parseBody(request, dentalChartUpdateSchema, "Invalid dental chart.");
  if (!body.ok) return body.response;
  const { id } = await params;
  const chart = await updateDentalChart(request, access.session.user.id, id, body.data);
  if (!chart) return apiError("Patient not found.", 404);
  return NextResponse.json({ chart });
}
