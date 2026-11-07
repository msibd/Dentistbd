import SectionPage, { sectionMetadata } from "@/app/public_website/components/section-page";

export const instant = false;

export const metadata = sectionMetadata("gallery", "Clinic gallery", "Photos of the clinic and its treatment rooms.");

export default function Page() {
  return <SectionPage only="gallery" />;
}
