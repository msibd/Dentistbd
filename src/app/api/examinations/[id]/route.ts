import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { apiError, parseBody } from "@/lib/api";
import { examinationUpdateSchema } from "@/modules/clinical/schemas/clinical-schema";
import { getExamination, updateExamination } from "@/modules/clinical/services/clinical-service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorize(request.headers, "clinical:read");
  if (!access.session) return apiError(access.error, access.status);
  const { id } = await params;
  const examination = await getExamination(id);
  if (!examination) return apiError("Examination record not found.", 404);
  return NextResponse.json({ examination });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorize(request.headers, "clinical:write");
  if (!access.session) return apiError(access.error, access.status);
  const body = await parseBody(request, examinationUpdateSchema, "Invalid examination record.");
  if (!body.ok) return body.response;
  const { id } = await params;
  const examination = await updateExamination(request, access.session.user.id, id, body.data);
  if (!examination) return apiError("Examination record not found.", 404);
  return NextResponse.json({ examination });
}
