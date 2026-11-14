import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Si indicizza tutto il sito tranne la pagina di prova di Dot (/gatto).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/gatto"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
