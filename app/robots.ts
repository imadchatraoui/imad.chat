import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // i banchi di prova (/lab) e l'anteprima della home nuova (/anteprima) non vanno nei motori di ricerca
    rules: { userAgent: "*", allow: "/", disallow: ["/lab/", "/anteprima"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
