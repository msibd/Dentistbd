import SectionPage, { sectionMetadata } from "@/app/public_website/components/section-page";

export const instant = false;

export const metadata = sectionMetadata("about", "About the dentist", "Meet the dentist: qualifications, experience and how the clinic cares for you.");

export default function Page() {
  return <SectionPage only="about" />;
}
