import SectionPage, { sectionMetadata } from "@/app/public_website/components/section-page";

export const instant = false;

export const metadata = sectionMetadata("contact", "Contact us", "Clinic address, opening hours, phone and map.");

export default function Page() {
  return <SectionPage only="contact" />;
}
