import { connection, NextResponse } from "next/server";
import { getPublicGalleryImages } from "@/app/public_website/queries/clinic-queries";

export async function GET() {
  await connection(); // request time only: `next build` must not need the database
  const images = await getPublicGalleryImages();
  return NextResponse.json({ images }, { headers: { "Cache-Control": "no-store" } });
}
