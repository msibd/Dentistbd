import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";
import { feeRangeCheck, feeRangeError, servicePublicFields } from "@/modules/clinic/schemas/service-public-fields";
import { invalidatePublicCache, publicCacheTags } from "@/lib/public-cache";

const serviceSchema = z.object({
  code: z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(80),
  description: z.string().trim().max(1000).nullable(),
  ...servicePublicFields,
  standardPrice: z.number().finite().min(0).max(99999999),
  durationMinutes: z.number().int().min(5).max(600),
}).refine(feeRangeCheck, feeRangeError);

export async function GET(request: Request) {
  const access = await authorize(request.headers, "services:read");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "true";
  const services = await prisma.clinicService.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ services: services.map((item) => ({ ...item, standardPrice: item.standardPrice.toString(), feeMax: item.feeMax?.toString() ?? null })) });
}

export async function POST(request: Request) {
  const access = await authorize(request.headers, "services:write");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  let payload: unknown;
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = serviceSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid service." }, { status: 400 });
  try {
    const service = await prisma.clinicService.create({ data: parsed.data });
    await writeAuditEvent(request, access.session.user.id, "CREATE", "ClinicService", service.id);
    invalidatePublicCache(publicCacheTags.clinic);
    return NextResponse.json({ service: { ...service, standardPrice: service.standardPrice.toString(), feeMax: service.feeMax?.toString() ?? null } }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Service code or name is already in use." }, { status: 409 });
    }
    throw error;
  }
}
