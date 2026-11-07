import { connection, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

// For load balancers, Docker and uptime monitors: 200 when the app can reach its database, 503 when
// it cannot. Public on purpose, so it says nothing else (no versions, no counts, no error details).
export async function GET() {
  await connection();
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Database check timed out.")), 3_000)),
    ]);
    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logger.error("Health check failed: database unreachable.", { error });
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
