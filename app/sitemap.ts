import type { MetadataRoute } from "next";
import { getSections } from "@/lib/sections";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    ...getSections().map((s) => ({
      url: `${SITE_URL}/sezioni/${s.id}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
