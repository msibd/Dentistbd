import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { NAV_KEYS, NAV_PAGES } from "@/modules/website/schemas/website-layout";


// The home page, plus one page per menu section (about, services, gallery, why us, reviews, contact).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Read the address when asked, not at build time, so one build works on any domain.
  await connection();
  const siteUrl = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    ...NAV_KEYS.filter((key) => key !== "home").map((key) => ({
      url: `${siteUrl}${NAV_PAGES[key]}`,
      changeFrequency: "monthly" as const,
      priority: key === "services" ? 0.8 : 0.6,
    })),
  ];
}
