import SectionPage, { sectionMetadata } from "@/app/public_website/components/section-page";

export const instant = false;

export const metadata = sectionMetadata("whyUs", "Why choose us", "Why patients trust the clinic for their dental care.");

export default function Page() {
  return <SectionPage only="whyUs" />;
}
