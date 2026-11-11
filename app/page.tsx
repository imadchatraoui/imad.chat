import Home, { type HomeCity } from "@/components/site/Home";
import SectionAnchorAction from "@/components/site/SectionAnchorAction";
import SectionPanel from "@/components/site/SectionPanel";
import { citiesInOrder } from "@/lib/astro/data";
import { logoSrc } from "@/lib/logo";
import { getSections, sectionMetas } from "@/lib/sections";

// La pagina si costruisce una volta, alla build: le sezioni e le città sono file del repository.
// Il cielo, l'ora e la luna li calcola il browser, in tempo reale.

export default function Page() {
  const sections = getSections();
  // solo quanto serve alla barra delle piastre e allo sfondo; il resto dei dati arriva con lo strumento
  const cities: HomeCity[] = citiesInOrder().map(({ id, name, nameLocal, tz, lat, lon }) => ({ id, name, nameLocal, tz, lat, lon }));

  // le sezioni si rendono qui, sul server: il Markdown non arriva nel browser
  const sectionPanels = Object.fromEntries(
    sections.map((s) => [s.id, <SectionPanel key={s.id} section={s} action={<SectionAnchorAction anchor={s.anchor} />} />]),
  );

  return <Home cities={cities} sections={sectionMetas(sections)} sectionPanels={sectionPanels} logo={logoSrc()} />;
}
