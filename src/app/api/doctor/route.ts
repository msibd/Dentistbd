import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";
import { invalidatePublicCache, publicCacheTags } from "@/lib/public-cache";

const scheduleSchema = z.array(z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  isWorking: z.boolean(),
})).length(7).superRefine((days, context) => {
  if (new Set(days.map((day) => day.dayOfWeek)).size !== 7) {
    context.addIssue({ code: "custom", message: "Each weekday must appear exactly once." });
  }
  days.forEach((day, index) => {
    if (day.isWorking && day.startTime >= day.endTime) {
      context.addIssue({ code: "custom", path: [index, "endTime"], message: "End time must be after start time." });
    }
  });
});

const profileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  qualifications: z.string().trim().max(500).default(""),
  specialization: z.string().trim().min(1).max(120),
  registrationNumber: z.string().trim().max(80).nullable(),
  consultationFee: z.number().finite().min(0).max(99999999),
  phone: z.string().trim().max(30).nullable(),
  email: z.union([z.email(), z.literal(""), z.null()]).transform((value) => value || null),
  address: z.string().trim().max(1000).nullable(),
  bio: z.string().trim().max(3000).nullable(),
  schedules: scheduleSchema,
});

export async function GET(request: Request) {
  const access = await authorize(request.headers, "doctor:read");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  const doctor = await prisma.doctorProfile.findUnique({
    where: { id: "primary" },
    include: { schedules: { orderBy: { dayOfWeek: "asc" } } },
  });
  return NextResponse.json({ doctor });
}

export async function PUT(request: Request) {
  const access = await authorize(request.headers, "doctor:write");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  let payload: unknown;
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = profileSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid doctor profile." }, { status: 400 });

  const { schedules, ...profile } = parsed.data;
  const saved = await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(41680271)`;
    const confirmedAppointments = await transaction.appointment.findMany({
      where: { status: "CONFIRMED", dateTime: { gte: new Date() } },
      select: { dateTime: true, durationMinutes: true },
    });
    const schedulesByDay = new Map(schedules.map((schedule) => [schedule.dayOfWeek, schedule]));
    for (const appointment of confirmedAppointments) {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Dhaka",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(appointment.dateTime);
      const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
      const dayOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(values.weekday);
      const schedule = schedulesByDay.get(dayOfWeek);
      const requestedStart = Number(values.hour) * 60 + Number(values.minute);
      const [endHour, endMinute] = (schedule?.endTime ?? "00:00").split(":").map(Number);
      if (!schedule?.isWorking || values.hour + ":" + values.minute < schedule.startTime || requestedStart + appointment.durationMinutes > endHour * 60 + endMinute) {
        return null;
      }
    }

    const saved = await transaction.doctorProfile.upsert({
      where: { id: "primary" },
      create: { id: "primary", ...profile },
      update: profile,
    });
    for (const schedule of schedules) {
      await transaction.doctorSchedule.upsert({
        where: { doctorId_dayOfWeek: { doctorId: "primary", dayOfWeek: schedule.dayOfWeek } },
        create: { ...schedule, doctorId: "primary" },
        update: schedule,
      });
    }
    return saved;
  });
  if (!saved) {
    return NextResponse.json({ error: "The updated availability conflicts with a confirmed appointment. Reschedule or cancel that appointment first." }, { status: 409 });
  }
  const doctor = saved;
  await writeAuditEvent(request, access.session.user.id, "UPDATE", "DoctorProfile", doctor.id);
  invalidatePublicCache(publicCacheTags.clinic);
  return NextResponse.json({ doctor });
}
