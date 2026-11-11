import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // i banchi di prova (/lab) servono solo a chi sviluppa
    rules: { userAgent: "*", allow: "/", disallow: "/lab/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
