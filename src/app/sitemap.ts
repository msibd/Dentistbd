import type { MetadataRoute } from "next";
import { NAV_KEYS, NAV_PAGES } from "@/modules/website/schemas/website-layout";

const siteUrl = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

// The home page, plus one page per menu section (about, services, gallery, why us, reviews, contact).
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    ...NAV_KEYS.filter((key) => key !== "home").map((key) => ({
      url: `${siteUrl}${NAV_PAGES[key]}`,
      changeFrequency: "monthly" as const,
      priority: key === "services" ? 0.8 : 0.6,
    })),
  ];
}
