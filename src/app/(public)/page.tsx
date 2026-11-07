import type { Metadata } from "next";
import { connection } from "next/server";
import ClinicWebsite from "@/app/public_website/components/clinic-website";
import { getPublicClinicData, getPublicGalleryImages } from "@/app/public_website/queries/clinic-queries";
import { BRAND_FULL_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: { absolute: BRAND_FULL_NAME },
  description: "ক্লিনিকের সেবা, চিকিৎসকের তথ্য এবং অ্যাপয়েন্টমেন্টের অনুরোধ।",
  alternates: { canonical: "/" },
};

export const instant = false;

export default async function HomePage() {
  // Render at request time, never during `next build`: the build must not need the database (Docker/CI
  // builds have none). The data itself stays cached ("use cache" in clinic-queries) and is refreshed
  // when staff save changes, so this costs one render, not a database query, per visit.
  await connection();
  const [clinic, galleryImages] = await Promise.all([
    getPublicClinicData(),
    getPublicGalleryImages(),
  ]);
  return <ClinicWebsite clinic={clinic} galleryImages={galleryImages} />;
}
