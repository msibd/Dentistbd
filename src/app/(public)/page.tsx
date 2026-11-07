import type { Metadata } from "next";
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
  const [clinic, galleryImages] = await Promise.all([
    getPublicClinicData(),
    getPublicGalleryImages(),
  ]);
  return <ClinicWebsite clinic={clinic} galleryImages={galleryImages} />;
}
