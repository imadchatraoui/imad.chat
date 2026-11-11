import type { Metadata, Viewport } from "next";
import citiesJson from "@/content/astro/cities.json";
import curiositiesJson from "@/content/astro/curiosities.json";
import starsJson from "@/content/astro/stars.json";
import versesJson from "@/content/astro/verses.json";
import type { AstroFile, CityItem, CuriosityItem, StarItem, VerseItem } from "@/lib/astro/types";
import { getSections, sectionMetas } from "@/lib/sections";
import { siteFontVariables } from "@/components/site/fonts";
import SectionAnchorAction from "@/components/site/SectionAnchorAction";
import SectionPanel from "@/components/site/SectionPanel";
import ShellLab from "@/components/site/ShellLab";

export const metadata: Metadata = {
  title: "Laboratorio della cornice",
  description: "Banco di prova della cornice di imad’s world: barra, fogli, pannelli e comandi intorno all’astrolabio.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#070a14",
};

// l'ordine delle piastre voluto da Imad; eventuali città nuove vanno in fondo
const ORDER = ["torino", "al-quds", "gaza", "fes", "istanbul", "samarcanda", "kyoto", "cusco"];
const rank = (id: string) => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length);

export default function Page() {
  const cities = [...(citiesJson as unknown as AstroFile<CityItem>).items].sort((a, b) => rank(a.id) - rank(b.id));
  const stars = (starsJson as unknown as AstroFile<StarItem>).items.filter((s) => s.pointer);
  const verses = (versesJson as unknown as AstroFile<VerseItem>).items;
  const curiosities = (curiositiesJson as unknown as AstroFile<CuriosityItem>).items;
  const sections = getSections();

  // le sezioni si rendono qui, sul server: il Markdown non arriva nel browser
  const sectionPanels = Object.fromEntries(
    sections.map((s) => [s.id, <SectionPanel key={s.id} section={s} action={<SectionAnchorAction anchor={s.anchor} />} />]),
  );

  return (
    <div className={siteFontVariables}>
      <ShellLab
        cities={cities}
        stars={stars}
        verses={verses}
        curiosities={curiosities}
        sections={sectionMetas(sections)}
        sectionPanels={sectionPanels}
      />
    </div>
  );
}
