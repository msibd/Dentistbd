import type { Metadata } from "next";
import ClinicWebsite from "@/app/public_website/components/clinic-website";
import { getPublicClinicData, getPublicGalleryImages } from "@/app/public_website/queries/clinic-queries";

export const metadata: Metadata = {
  title: { absolute: "Dr Ovi's Dental Care & Endodontics" },
  description: "ক্লিনিকের সেবা, চিকিৎসকের তথ্য এবং অ্যাপয়েন্টমেন্টের অনুরোধ।",
};

export const instant = false;

export default async function HomePage() {
  const [clinic, galleryImages] = await Promise.all([
    getPublicClinicData(),
    getPublicGalleryImages(),
  ]);
  return <ClinicWebsite clinic={clinic} galleryImages={galleryImages} />;
}
