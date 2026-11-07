import SectionPage, { sectionMetadata } from "@/app/public_website/components/section-page";

export const instant = false;

export const metadata = sectionMetadata("services", "Dental services", "Dental treatments offered at the clinic, with what each involves, how long it takes and the fee.");

export default function Page() {
  return <SectionPage only="services" />;
}
