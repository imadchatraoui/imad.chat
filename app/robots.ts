import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // i banchi di prova (/lab) e le anteprime (/anteprima, /gatto) non vanno nei motori di ricerca
    rules: { userAgent: "*", allow: "/", disallow: ["/lab/", "/anteprima", "/gatto"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
