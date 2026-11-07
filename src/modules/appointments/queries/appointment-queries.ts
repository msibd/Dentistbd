import { prisma } from "@/lib/prisma";

export async function listAppointments(cursor?: string) {
  const [appointments, totalCount] = await prisma.$transaction([
    prisma.appointment.findMany({
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ dateTime: "desc" }, { id: "desc" }],
      take: 101,
    }),
    prisma.appointment.count(),
  ]);
  const hasMore = appointments.length > 100;
  const page = hasMore ? appointments.slice(0, 100) : appointments;

  return {
    appointments: page,
    totalCount,
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
  };
}

// Case-insensitive substring search across the fields shown in the dashboard search box.
export async function searchAppointments(search: string) {
  const contains = { contains: search, mode: "insensitive" as const };
  const appointments = await prisma.appointment.findMany({
    where: { OR: [{ patientName: contains }, { patientPhone: contains }, { service: contains }, { id: contains }] },
    orderBy: [{ dateTime: "desc" }, { id: "desc" }],
    take: 5,
  });
  return { appointments, totalCount: appointments.length, nextCursor: null };
}
