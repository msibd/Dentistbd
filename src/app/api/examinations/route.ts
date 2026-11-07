import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/admin-session";
import { apiError, parseBody, parseQuery } from "@/lib/api";
import { examinationInputSchema } from "@/modules/clinical/schemas/clinical-schema";
import { ClinicalRuleError, createExamination, listExaminations } from "@/modules/clinical/services/clinical-service";

const listQuerySchema = z.object({
  patientId: z.string().min(1, "patientId is required."),
  cursor: z.string().min(1).max(100).optional(),
});

const PAGE_SIZE = 20;

export async function GET(request: Request) {
  const access = await authorize(request.headers, "clinical:read");
  if (!access.session) return apiError(access.error, access.status);
  const query = parseQuery(request, listQuerySchema);
  if (!query.ok) return query.response;

  const rows = await listExaminations(query.data.patientId, query.data.cursor, PAGE_SIZE);
  const hasMore = rows.length > PAGE_SIZE;
  const examinations = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  return NextResponse.json({ examinations, nextCursor: hasMore ? examinations.at(-1)?.id ?? null : null });
}

export async function POST(request: Request) {
  const access = await authorize(request.headers, "clinical:write");
  if (!access.session) return apiError(access.error, access.status);
  const body = await parseBody(request, examinationInputSchema, "Invalid examination record.");
  if (!body.ok) return body.response;

  try {
    const examination = await createExamination(request, access.session.user.id, body.data);
    return NextResponse.json({ examination }, { status: 201 });
  } catch (error) {
    if (error instanceof ClinicalRuleError) return apiError(error.message, error.status);
    throw error;
  }
}
