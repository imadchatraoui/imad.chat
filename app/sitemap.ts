import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://imad.chat", changeFrequency: "weekly", priority: 1 }];
}
