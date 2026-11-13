import type { MetadataRoute } from "next";
import { CASA_NUOVA, SITE_URL } from "@/lib/site";

// Con la casa nuova a "/" (CASA_NUOVA in lib/site.ts) si indicizza tutto il sito tranne la pagina di prova di Dot (/gatto).
// Prima del cambio restano fuori anche le anteprime (/anteprima con le sue pagine interne) e il vecchio /lab.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: CASA_NUOVA ? ["/gatto"] : ["/lab/", "/anteprima", "/gatto"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
