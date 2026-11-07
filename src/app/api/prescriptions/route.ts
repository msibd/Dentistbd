import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";
import { prescriptionInputSchema as prescriptionSchema } from "@/modules/clinic/schemas/prescription-schema";


export async function GET(request: Request) {
  const access = await authorize(request.headers, "prescriptions:read");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  const searchParams = new URL(request.url).searchParams;
  const search = searchParams.get("search")?.trim() ?? "";
  const cursor = z.string().min(1).max(100).safeParse(searchParams.get("cursor") ?? undefined);
  if (searchParams.has("cursor") && !cursor.success) {
    return NextResponse.json({ error: "Invalid prescription cursor." }, { status: 400 });
  }
  const pageSize = 100;
  const rows = await prisma.prescription.findMany({
    where: search ? {
      OR: [
        { diagnosis: { contains: search, mode: "insensitive" } },
        { patient: { name: { contains: search, mode: "insensitive" } } },
        { patient: { patientCode: { contains: search, mode: "insensitive" } } },
      ],
    } : undefined,
    select: {
      id: true,
      diagnosis: true,
      instructions: true,
      followUpDate: true,
      createdAt: true,
      patient: { select: { id: true, patientCode: true, name: true, phone: true } },
      prescribedBy: { select: { name: true } },
      medications: { select: { id: true, name: true, dosage: true, frequency: true, duration: true, instructions: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(cursor.success ? { cursor: { id: cursor.data }, skip: 1 } : {}),
    take: pageSize + 1,
  });
  const hasMore = rows.length > pageSize;
  const prescriptions = hasMore ? rows.slice(0, pageSize) : rows;
  return NextResponse.json({ prescriptions, nextCursor: hasMore ? prescriptions.at(-1)?.id ?? null : null });
}

export async function POST(request: Request) {
  const access = await authorize(request.headers, "prescriptions:write");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  let payload: unknown;
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = prescriptionSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid prescription." }, { status: 400 });
  const patient = await prisma.patient.findUnique({ where: { id: parsed.data.patientId }, select: { id: true } });
  if (!patient) return NextResponse.json({ error: "Patient not found." }, { status: 404 });
  const prescription = await prisma.prescription.create({
    data: {
      patientId: patient.id,
      prescribedById: access.session.user.id,
      diagnosis: parsed.data.diagnosis,
      instructions: parsed.data.instructions,
      followUpDate: parsed.data.followUpDate ? new Date(`${parsed.data.followUpDate}T00:00:00.000Z`) : null,
      medications: { create: parsed.data.medications },
    },
    include: { patient: { select: { patientCode: true, name: true } }, medications: true },
  });
  await writeAuditEvent(request, access.session.user.id, "CREATE", "Prescription", prescription.id);
  return NextResponse.json({ prescription }, { status: 201 });
}
