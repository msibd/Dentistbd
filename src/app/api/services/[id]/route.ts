import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";
import { feeRangeCheck, feeRangeError, servicePublicFields } from "@/modules/clinic/schemas/service-public-fields";
import { invalidatePublicCache, publicCacheTags } from "@/lib/public-cache";

const updateSchema = z.object({
  code: z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(80),
  description: z.string().trim().max(1000).nullable(),
  ...servicePublicFields,
  standardPrice: z.number().finite().min(0).max(99999999),
  durationMinutes: z.number().int().min(5).max(600),
  isActive: z.boolean(),
}).refine(feeRangeCheck, feeRangeError);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorize(request.headers, "services:write");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  let payload: unknown;
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid service." }, { status: 400 });
  const { id } = await params;
  try {
    const service = await prisma.clinicService.update({ where: { id }, data: parsed.data });
    await writeAuditEvent(request, access.session.user.id, "UPDATE", "ClinicService", id);
    invalidatePublicCache(publicCacheTags.clinic);
    return NextResponse.json({ service: { ...service, standardPrice: service.standardPrice.toString(), feeMax: service.feeMax?.toString() ?? null } });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error) {
      if (error.code === "P2025") return NextResponse.json({ error: "Service not found." }, { status: 404 });
      if (error.code === "P2002") return NextResponse.json({ error: "Service code or name is already in use." }, { status: 409 });
    }
    throw error;
  }
}
