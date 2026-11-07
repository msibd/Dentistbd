import { connection, NextResponse } from "next/server";
import { getPublicClinicData } from "@/app/public_website/queries/clinic-queries";

export async function GET() {
  await connection(); // request time only: `next build` must not need the database
  return NextResponse.json(await getPublicClinicData(), {
    headers: { "Cache-Control": "no-store" },
  });
}
