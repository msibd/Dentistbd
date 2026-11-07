import type { MetadataRoute } from "next";
import { connection } from "next/server";

// Search engines may read the public website; the staff area and the API are off limits.
export default async function robots(): Promise<MetadataRoute.Robots> {
  // Read the address when asked, not at build time, so one build works on any domain.
  await connection();
  const siteUrl = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/", "/login", "/forgot-password", "/dashboard", "/appointments", "/patients", "/doctors", "/dental-chart",
        "/treatments", "/prescriptions", "/services", "/billing", "/inventory", "/expenses", "/reports", "/website",
        "/reviews", "/access", "/email-settings", "/sms-settings", "/security", "/offline",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
