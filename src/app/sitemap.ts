import type { MetadataRoute } from "next";

const siteUrl = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

// The public website is one page; its sections are reached by anchors.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: siteUrl, changeFrequency: "weekly", priority: 1 }];
}
