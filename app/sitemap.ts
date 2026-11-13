import fs from "node:fs";
import path from "node:path";
import type { MetadataRoute } from "next";
import { CASA_NUOVA, SITE_URL } from "@/lib/site";

// Si fa alla build. Con la casa nuova a "/" (CASA_NUOVA in lib/site.ts): la home e ogni pagina che scripts/home/build.mjs ha scritto
// (public/casa/pagine.json), compresi i testi di Nel mondo con la loro data. Prima del cambio: solo la home.
export const dynamic = "force-static";

type Pagina = { url: string; data?: string };

export default function sitemap(): MetadataRoute.Sitemap {
  if (!CASA_NUOVA) return [{ url: SITE_URL, changeFrequency: "weekly", priority: 1 }];
  const file = path.join(process.cwd(), "public/casa/pagine.json");
  const pagine: Pagina[] = JSON.parse(fs.readFileSync(file, "utf8")).pagine;
  return pagine.map((p) => ({
    url: SITE_URL + p.url,
    ...(p.data ? { lastModified: p.data } : {}),
    changeFrequency: p.url === "/" ? "weekly" : "monthly",
    priority: p.url === "/" ? 1 : p.url.split("/").length > 2 ? 0.6 : 0.8,
  }));
}
