import type { Metadata } from "next";
import { getPublicClinicData, getPublicGalleryImages } from "@/app/public_website/queries/clinic-queries";
import { BRAND_NAME } from "@/lib/brand";
import type { NavKey } from "@/modules/website/schemas/website-layout";
import { NAV_PAGES } from "@/modules/website/schemas/website-layout";
import ClinicWebsite from "./clinic-website";

/** One menu section as its own page (header and footer as on the home page, nothing else). */
export default async function SectionPage({ only }: { only: NavKey }) {
  const [clinic, galleryImages] = await Promise.all([
    getPublicClinicData(),
    only === "gallery" ? getPublicGalleryImages() : Promise.resolve([]),
  ]);
  return <ClinicWebsite clinic={clinic} galleryImages={galleryImages} only={only} />;
}

/** Title, description and canonical address for a section page. */
export function sectionMetadata(only: NavKey, title: string, description: string): Metadata {
  const url = NAV_PAGES[only];
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", title: `${title} | ${BRAND_NAME}`, url },
  };
}
