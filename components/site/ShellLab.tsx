"use client";

// /lab/shell: tutta la cornice intorno a un disco segnaposto, per giudicarla sul telefono e sul desktop.
//   ?panel=menu | star:sirius | city:gaza | section:at-tariq   apre un foglio
//   ?snap=full                                                 foglio a tutta altezza
//   ?city=gaza                                                 piastra iniziale
//   ?t=2026-11-11T21:00:00Z                                    istante fisso (screenshot ripetibili)
//   ?sky=notte|crepuscolo|giorno                               forza il cielo dello sfondo
//   ?intro=1                                                   barra in basso nascosta, come durante l'intro

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CityItem, CuriosityItem, StarItem, VerseItem } from "@/lib/astro/types";
import { qiblaBearing } from "@/lib/astro/qibla";
import { msForReteTurn } from "@/lib/astro/time";
import type { SectionMeta } from "@/lib/sections";
import { getSound } from "@/lib/sound";
import type { SkyState } from "@/lib/media";
import type { SectionAnchor } from "./anchors";
import CityBackdrop from "./CityBackdrop";
import CityPanel from "./CityPanel";
import ControlBar from "./ControlBar";
import { titleIds } from "./ids";
import PlaceholderDisc from "./PlaceholderDisc";
import SectionsMenu from "./SectionsMenu";
import { ShellActionsProvider } from "./ShellContext";
import Sheet, { type SheetSnap } from "./Sheet";
import SiteChrome from "./SiteChrome";
import { skyStateAt } from "./sky";
import StarPanel from "./StarPanel";
import t from "./tokens.module.css";
import l from "./Lab.module.css";

type SheetState = { kind: "menu" } | { kind: "star"; id: string } | { kind: "city"; id: string } | { kind: "section"; id: string } | null;

export interface ShellLabProps {
  cities: CityItem[];
  stars: StarItem[];
  verses: VerseItem[];
  curiosities: CuriosityItem[];
  sections: SectionMeta[];
  /** Le sezioni già rese sul server, per id. */
  sectionPanels: Record<string, ReactNode>;
}

const CURIOSITY_FOR_STAR: Record<string, string> = {
  sirius: "al-shira",
  betelgeuse: "betelgeuse-punti",
  aldebaran: "cielo-arabo",
  altair: "cielo-arabo",
  vega: "cielo-arabo",
  deneb: "cielo-arabo",
  rigel: "cielo-arabo",
};

function parsePanel(v: string | null): SheetState {
  if (!v) return null;
  if (v === "menu") return { kind: "menu" };
  const [kind, id] = v.split(":");
  if ((kind === "star" || kind === "city" || kind === "section") && id) return { kind, id };
  return null;
}

export default function ShellLab({ cities, stars, verses, curiosities, sections, sectionPanels }: ShellLabProps) {
  const [mounted, setMounted] = useState(false);
  const [cityId, setCityId] = useState("torino");
  const [fixed, setFixed] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [offset, setOffset] = useState(0);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [initialSnap, setInitialSnap] = useState<SheetSnap>("half");
  const [lastSection, setLastSection] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [qiblaOn, setQiblaOn] = useState(false);
  const [tariqKey, setTariqKey] = useState(0);
  const [skyOverride, setSkyOverride] = useState<SkyState | null>(null);
  const [intro, setIntro] = useState(false);
  const [bottom, setBottom] = useState(170);
  const [inset, setInset] = useState({ bottom: 0, right: 0 });
  const sound = useRef(getSound());

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const c = q.get("city");
    if (c && cities.some((x) => x.id === c)) setCityId(c);
    const tt = q.get("t");
    if (tt && !Number.isNaN(Date.parse(tt))) setFixed(Date.parse(tt));
    const sk = q.get("sky");
    if (sk === "notte" || sk === "crepuscolo" || sk === "giorno") setSkyOverride(sk);
    if (q.get("snap") === "full") setInitialSnap("full");
    setIntro(q.get("intro") === "1");
    setSheet(parsePanel(q.get("panel")));
    setNow(Date.now());
    setMounted(true);
  }, [cities]);

  // l'orologio vero, una volta al secondo (fermo se l'istante è fissato)
  useEffect(() => {
    if (fixed != null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [fixed]);

  const base = fixed ?? now;
  const date = useMemo(() => new Date(base + offset), [base, offset]);
  const isNow = offset === 0;
  const city = cities.find((c) => c.id === cityId) ?? cities[0];
  const sky: SkyState = skyOverride ?? skyStateAt(date, city.lat, city.lon);

  const play = (n: string) => sound.current.play(n);

  const changeCity = useCallback((id: string) => {
    setCityId(id);
    sound.current.play("plate");
    sound.current.setAmbience(id);
  }, []);

  const openSheet = (s: SheetState) => {
    if (!sheet) play("open");
    setSheet(s);
  };

  const onAnchor = useCallback(
    (a: SectionAnchor) => {
      setSheet(null);
      window.setTimeout(() => {
        if (a.kind === "city") changeCity(a.city);
        else if (a.kind === "cielo") setOffset(0);
        else if (a.kind === "tariq") {
          setTariqKey((k) => k + 1);
          sound.current.play("tariq");
        } else if (a.kind === "qibla") {
          setQiblaOn(true);
          sound.current.play("qibla");
        } else if (a.kind === "retro") {
          setFlipped(true);
          sound.current.play("flip");
        }
      }, 320);
    },
    [changeCity],
  );

  const actions = useMemo(() => ({ onAnchor, cityName: (id: string) => cities.find((c) => c.id === id)?.name }), [onAnchor, cities]);

  const starItem = sheet?.kind === "star" ? stars.find((s) => s.id === sheet.id) : undefined;
  const cityItem = sheet?.kind === "city" ? cities.find((c) => c.id === sheet.id) : undefined;

  let content: ReactNode = null;
  let labelledBy: string | undefined;
  let key = "";
  if (sheet?.kind === "menu") {
    labelledBy = titleIds.menu;
    key = "menu";
    content = (
      <SectionsMenu
        sections={sections}
        currentId={lastSection}
        onSelect={(id) => {
          setLastSection(id);
          setSheet({ kind: "section", id });
        }}
      />
    );
  } else if (sheet?.kind === "star" && starItem) {
    labelledBy = titleIds.star(starItem.id);
    key = `star:${starItem.id}`;
    const verse = starItem.quran ? verses.find((v) => v.key === starItem.quran) ?? null : null;
    const curiosity = curiosities.find((c) => c.id === CURIOSITY_FOR_STAR[starItem.id]) ?? null;
    content = <StarPanel star={starItem} verse={verse} curiosity={curiosity} where={city} date={date} />;
  } else if (sheet?.kind === "city" && cityItem) {
    labelledBy = titleIds.city(cityItem.id);
    key = `city:${cityItem.id}`;
    content = <CityPanel city={cityItem} date={date} isNow={isNow} />;
  } else if (sheet?.kind === "section" && sectionPanels[sheet.id]) {
    labelledBy = titleIds.section(sheet.id);
    key = `section:${sheet.id}`;
    content = sectionPanels[sheet.id];
  }

  return (
    <ShellActionsProvider value={actions}>
      <main className={`${t.vars} ${l.lab}`}>
        {mounted ? <CityBackdrop city={city.id} sky={sky} /> : null}

        {/* sul desktop lo strumento scivola a sinistra per restare intero accanto al pannello */}
        <div
          className={l.stage}
          style={{
            top: "calc(56px + env(safe-area-inset-top, 0px))",
            bottom: intro ? 24 : bottom,
            transform: inset.right ? `translateX(${-inset.right / 2}px)` : undefined,
          }}
        >
          {mounted ? (
            <PlaceholderDisc
              date={date}
              lon={city.lon}
              stars={stars.filter((s) => s.pointer)}
              sections={sections}
              flipped={flipped}
              qibla={qiblaOn ? qiblaBearing(city.lat, city.lon) : null}
              tariqKey={tariqKey}
              selectedStar={sheet?.kind === "star" ? sheet.id : null}
              onStar={(id) => {
                play("select");
                openSheet({ kind: "star", id });
              }}
              onSection={(id) => {
                setLastSection(id);
                openSheet({ kind: "section", id });
              }}
              onTurn={(rad) => {
                setOffset((o) => o + msForReteTurn(rad));
                play("tick");
              }}
            />
          ) : null}
        </div>

        <SiteChrome onOpenSections={() => openSheet({ kind: "menu" })} sectionsOpen={sheet?.kind === "menu"} soundToggle={intro} />

        {mounted ? (
          <ControlBar
            cities={cities}
            cityId={city.id}
            onCityChange={changeCity}
            onCityInfo={(id) => openSheet({ kind: "city", id })}
            date={date}
            isNow={isNow}
            now={base}
            onNow={() => {
              setOffset(0);
              play("tick");
            }}
            onFlip={() => {
              setFlipped((f) => !f);
              play("flip");
            }}
            flipped={flipped}
            onQibla={() => {
              setQiblaOn((q) => !q);
              play("qibla");
            }}
            qiblaActive={qiblaOn}
            onTariq={() => {
              setTariqKey((k) => k + 1);
              play("tariq");
            }}
            hidden={intro}
            onHeight={setBottom}
          />
        ) : null}

        <Sheet
          open={!!content}
          onClose={() => setSheet(null)}
          labelledBy={labelledBy}
          contentKey={key}
          initialSnap={initialSnap}
          onInset={setInset}
        >
          {content}
        </Sheet>
      </main>
    </ShellActionsProvider>
  );
}
