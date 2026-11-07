import SectionPage, { sectionMetadata } from "@/app/public_website/components/section-page";

export const instant = false;

export const metadata = sectionMetadata("reviews", "Patient reviews", "What our patients say, and share your own feedback.");

export default function Page() {
  return <SectionPage only="reviews" />;
}
