import type { MetadataRoute } from "next";
import { getNotes } from "@/lib/notes";
import { site } from "@/site.config";

export default function sitemap(): MetadataRoute.Sitemap {
  const notes = getNotes();
  return [
    { url: site.url, changeFrequency: "daily", priority: 1 },
    { url: `${site.url}/diario`, changeFrequency: "weekly", priority: 0.8 },
    ...notes.map((n) => ({
      url: `${site.url}/diario/${n.slug}`,
      lastModified: new Date(`${n.date}T12:00:00Z`),
      priority: 0.6,
    })),
  ];
}
