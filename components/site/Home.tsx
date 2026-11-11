"use client";

// La pagina: imad's world.
//
// 1. L'intro (components/intro) scrive "hello, world", lo trasforma in "hello, imad’s world" e incide un
//    cerchio graduato: proprio dove cadrà il lembo dell'astrolabio (stage.ts).
// 2. Intanto, dietro, l'astrolabio si costruisce nascosto (a piccoli passi, cedendo il filo principale
//    all'intro). Quando l'intro ha chiuso il cerchio e lo strumento è pronto, l'intro sfuma e l'ottone si
//    monta pezzo per pezzo sul cerchio (assemble). Costruirlo dopo, a intro finita, non conviene: dove
//    WebGL è emulato dalla CPU il primo contesto può farsi attendere a lungo, e la pausa si vedrebbe.
// 3. Poi la cornice: il logo e «Sezioni» in alto, la barra delle piastre e dei gesti in basso, i fogli
//    con le stelle, le città e le sezioni. I suoni seguono gli eventi dell'intro e dello strumento.
//
// Senza WebGL, o con "riduci movimento", l'astrolabio è la sua versione 2D in SVG. Chi torna nella
// stessa sessione vede subito il cerchio finito; «Rivedi l’intro», nel menu delle sezioni, la rimette.

import dynamic from "next/dynamic";
import { Component, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Intro, { type IntroEventName } from "@/components/intro/Intro";
import type { AstrolabeEventName, AstrolabeHandle } from "@/components/astrolabe/types";
import type { AstroSection, Observer } from "@/lib/astro/types";
import type { SectionMeta } from "@/lib/sections";
import { useMedia, type SkyState } from "@/lib/media";
import { getSound } from "@/lib/sound";
import type { SectionAnchor } from "./anchors";
import CityBackdrop from "./CityBackdrop";
import ControlBar, { type CityLite } from "./ControlBar";
import { compass } from "./format";
import { titleIds } from "./ids";
import SectionsMenu from "./SectionsMenu";
import { ShellActionsProvider } from "./ShellContext";
import Sheet from "./Sheet";
import SiteChrome from "./SiteChrome";
import { predictLimb2d, predictLimb3d, sameCircle, type Circle, type Framing } from "./stage";
import { createTimeStore, useShownTime, type TimeStore } from "./timeStore";
import t from "./tokens.module.css";
import h from "./Home.module.css";

const Astrolabe = dynamic(() => import("@/components/astrolabe/Astrolabe"), { ssr: false });
const AstrolabeFallback = dynamic(() => import("@/components/astrolabe/AstrolabeFallback"), { ssr: false });
const StarSheet = dynamic(() => import("./StarSheet"), { ssr: false });
const CitySheet = dynamic(() => import("./CitySheet"), { ssr: false });

export interface HomeCity extends CityLite {
  lat: number;
  lon: number;
}

export interface HomeProps {
  cities: HomeCity[];
  /** Le sezioni (senza il corpo), nell'ordine del menu. */
  sections: SectionMeta[];
  /** Le sezioni già rese sul server (SectionPanel), per id. */
  sectionPanels: Record<string, ReactNode>;
  /** La piastra di partenza. */
  defaultCity?: string;
  /** Il file del logo (public/logo.svg), se c'è. */
  logo?: string | null;
}

type SheetState =
  | { kind: "menu" }
  | { kind: "star"; id: string }
  | { kind: "city"; id: string }
  | { kind: "section"; id: string }
  | null;

/** at-Tariq: il video in public/media/video/tariq-v.mp4 è ancora quello provvisorio (senza i tre colpi):
 *  finché non arriva quello definitivo, la scena è quella disegnata. Poi basta mettere "auto". */
const TARIQ_VIDEO: "auto" | "procedural" = "procedural";

const SEEN_KEY = "imad.intro";
/** La dissolvenza dell'intro sull'astrolabio che si monta, in ms. */
const HANDOFF_MS = 1100;
/** Se lo strumento 3D non è pronto tanto dopo la fine dell'intro, si passa alla versione 2D. */
const WATCHDOG_MS = 25000;

function readSeen(): boolean {
  try {
    return window.sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSeen() {
  try {
    window.sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // archiviazione bloccata: l'intro tornerà alla prossima visita, pazienza
  }
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

const round4 = (x: number) => Math.round(x * 10000) / 10000;

/** Se lo strumento 3D cade (contesto WebGL perso, errore del motore), resta la versione 2D. */
class StageBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// --- i pezzi che leggono l'istante mostrato (si ridisegnano da soli, non tutta la pagina) -----------

const Backdrop = memo(CityBackdrop);

type SkyLib = typeof import("./sky");

function LiveBackdrop({
  city,
  time,
  sky,
  onSky,
}: {
  city: HomeCity;
  time: TimeStore;
  sky: SkyLib | null;
  onSky?: (s: SkyState) => void;
}) {
  const { date } = useShownTime(time);
  const state: SkyState = sky ? sky.skyStateAt(date, city.lat, city.lon) : "notte";
  useEffect(() => onSky?.(state), [state, onSky]);
  return <Backdrop city={city.id} sky={state} />;
}

type BarProps = Omit<React.ComponentProps<typeof ControlBar>, "date" | "isNow" | "now"> & { time: TimeStore };

function LiveControlBar({ time, ...rest }: BarProps) {
  const { date, isNow } = useShownTime(time, true);
  return <ControlBar {...rest} date={date} isNow={isNow} />;
}

// --- la pagina -------------------------------------------------------------------------------

export default function Home({ cities, sections, sectionPanels, defaultCity = "torino", logo = null }: HomeProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const sound = useMemo(() => getSound(), []);
  const time = useMemo(() => createTimeStore(), []);

  const [mounted, setMounted] = useState(false);
  const [vp, setVp] = useState<{ w: number; h: number } | null>(null);
  const [headerH, setHeaderH] = useState(56);
  const [barH, setBarH] = useState(0);
  const [twoD, setTwoD] = useState<boolean | null>(null);
  const [failed3d, setFailed3d] = useState(false);
  const [skyLib, setSkyLib] = useState<SkyLib | null>(null);

  // l'intro e il passaggio di consegne
  const [run, setRun] = useState(0);
  const [skipIntro, setSkipIntro] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [introGone, setIntroGone] = useState(false);
  const [api, setApi] = useState<AstrolabeHandle | null>(null);
  const [measured, setMeasured] = useState<Circle | null>(null);
  const [live, setLive] = useState(false);
  const handedOff = useRef(false);

  // la cornice
  const [cityId, setCityId] = useState(() => (cities.some((c) => c.id === defaultCity) ? defaultCity : cities[0]?.id ?? "torino"));
  const [sheet, setSheet] = useState<SheetState>(null);
  const [lastSection, setLastSection] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [qibla, setQibla] = useState<{ bearing: number; here: boolean } | null>(null);
  const [observer, setObserver] = useState<Observer | null>(null);
  const [inset, setInset] = useState({ bottom: 0, right: 0 });
  const [sky, setSky] = useState<SkyState>("notte");
  const geoAsked = useRef(false);
  const media = useMedia();

  const city = cities.find((c) => c.id === cityId) ?? cities[0];

  // --- al montaggio: misure, modo 2D o 3D, chi torna -------------------------------------------

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setVp((v) => (v && v.w === el.clientWidth && v.h === el.clientHeight ? v : { w: el.clientWidth, h: el.clientHeight }));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setTwoD(reducedMotion() || !webglAvailable());
    if (readSeen()) setSkipIntro(true);
    setMounted(true);
    // i calcoli del cielo (astronomy-engine) arrivano dopo il primo disegno
    let alive = true;
    void import("./sky").then((m) => alive && setSkyLib(m));
    return () => {
      alive = false;
    };
  }, []);

  // --- inquadratura: lo strumento sta tra la barra in alto e i comandi in basso -----------------

  const framing = useMemo<Framing | undefined>(() => {
    if (!vp || !barH) return undefined;
    // telefono in orizzontale: il logo e «Sezioni» stanno negli angoli, lo strumento può salire fin sotto
    const compact = vp.w > vp.h && vp.h <= 520;
    const top = compact ? 6 / vp.h : Math.min(0.24, (headerH + 4) / vp.h);
    const bottom = Math.min(0.46, (barH + 6) / vp.h);
    return { top: round4(top), bottom: round4(bottom), side: vp.w < 640 ? 0.035 : 0.045 };
  }, [vp, headerH, barH]);

  const mode2d = twoD === true || failed3d;
  const predicted = useMemo<Circle | undefined>(() => {
    if (!vp || !framing || twoD === null) return undefined;
    return mode2d ? predictLimb2d(vp.w, vp.h, framing) : predictLimb3d(vp.w, vp.h, framing);
  }, [vp, framing, twoD, mode2d]);

  // lo strumento pronto dice dov'è davvero il suo lembo
  useEffect(() => {
    if (!api || api.mode !== "3d" || !framing) return;
    // due fotogrammi: il motore ha già rifatto l'inquadratura con le misure nuove
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => {
        const c = api.getLimbScreenCircle();
        if (c && Number.isFinite(c.r) && c.r > 10) setMeasured((m) => (sameCircle(m, c) ? m : c));
      });
    });
    return () => cancelAnimationFrame(id);
  }, [api, framing, vp]);

  const target = useMemo(() => {
    const c = measured && predicted && Math.abs(measured.r - predicted.r) < predicted.r * 0.08 ? measured : predicted;
    return c ? { cx: Math.round(c.cx * 10) / 10, cy: Math.round(c.cy * 10) / 10, r: Math.round(c.r * 10) / 10 } : undefined;
  }, [measured, predicted]);

  // con ?debug=1 lo strumento si comanda dalla console (window.__astrolabe), come nel banco di prova,
  // e window.__imadStage dice dove l'intro incide il suo cerchio
  useEffect(() => {
    if (!/[?&]debug=1/.test(window.location.search)) return;
    const w = window as unknown as { __astrolabe?: AstrolabeHandle | null; __imadStage?: unknown };
    w.__astrolabe = api;
    w.__imadStage = { predicted, measured, target, framing, mode2d, introDone, live };
  }, [api, predicted, measured, target, framing, mode2d, introDone, live]);

  // --- il passaggio di consegne ------------------------------------------------------------

  useEffect(() => {
    if (!introDone || !api || handedOff.current) return;
    handedOff.current = true;
    api.assemble();
    writeSeen();
    setLive(true);
  }, [introDone, api]);

  useEffect(() => {
    if (!live) return;
    const id = window.setTimeout(() => setIntroGone(true), reducedMotion() ? 250 : HANDOFF_MS + 250);
    // i pannelli delle stelle e delle città, pronti prima del primo tocco
    const pre = window.setTimeout(() => {
      void import("./StarSheet");
      void import("./CitySheet");
    }, 2500);
    return () => {
      window.clearTimeout(id);
      window.clearTimeout(pre);
    };
  }, [live]);

  // se lo strumento 3D non arriva (rete lentissima, motore fermo), la versione 2D prende il suo posto
  useEffect(() => {
    if (!introDone || api || mode2d) return;
    const id = window.setTimeout(() => setFailed3d(true), WATCHDOG_MS);
    return () => window.clearTimeout(id);
  }, [introDone, api, mode2d]);

  const onIntroDone = useCallback(() => setIntroDone(true), []);
  const onIntroEvent = useCallback((n: IntroEventName) => sound.play(n), [sound]);

  const replayIntro = useCallback(() => {
    setSheet(null);
    handedOff.current = false;
    setApi(null);
    setMeasured(null);
    setLive(false);
    setIntroDone(false);
    setIntroGone(false);
    setSkipIntro(false);
    setFlipped(false);
    setQibla(null);
    time.set(null);
    setRun((r) => r + 1);
  }, [time]);

  // --- lo strumento --------------------------------------------------------------------------

  const onReady = useCallback((h: AstrolabeHandle) => setApi(h), []);
  const onAstroEvent = useCallback((n: AstrolabeEventName) => sound.play(n), [sound]);
  const onTimeChange = useCallback((d: Date, now: boolean) => time.set(now ? null : d.getTime()), [time]);

  const sheetNow = useRef<SheetState>(null);
  useEffect(() => {
    sheetNow.current = sheet;
  }, [sheet]);
  const openSheet = useCallback(
    (next: SheetState) => {
      if (!sheetNow.current && next) sound.play("open");
      setSheet(next);
    },
    [sound],
  );

  const closeSheet = useCallback(() => {
    sound.play("close");
    setSheet(null);
  }, [sound]);

  const onStarSelect = useCallback((id: string) => openSheet({ kind: "star", id }), [openSheet]);
  const onSectionSelect = useCallback(
    (id: string) => {
      setLastSection(id);
      openSheet({ kind: "section", id });
    },
    [openSheet],
  );

  // la stella scelta resta accesa sulla rete finché il suo foglio è aperto
  const selectedStar = sheet?.kind === "star" ? sheet.id : null;
  useEffect(() => {
    api?.selectStar(selectedStar);
  }, [api, selectedStar]);

  const changeCity = useCallback((id: string) => setCityId(id), []);

  // l'ambiente sonoro: quello della città, se c'è; altrimenti la notte, quando è notte
  const ambience = media.has(`amb/${cityId}.mp3`) ? cityId : sky !== "giorno" && media.has("amb/notte.mp3") ? "notte" : null;
  useEffect(() => {
    if (live) sound.setAmbience(ambience);
  }, [live, ambience, sound]);

  const toNow = useCallback(() => {
    api?.resetNow();
    // "Adesso" riporta anche la regola sul Sole
    setQibla(null);
  }, [api]);

  const toggleFlip = useCallback(() => {
    if (!api) return;
    api.flip();
    setFlipped((f) => !f);
  }, [api]);

  const tariq = useCallback(() => api?.triggerTariq(), [api]);

  const askPosition = useCallback(() => {
    if (geoAsked.current || typeof navigator === "undefined" || !navigator.geolocation) return;
    geoAsked.current = true;
    // la posizione resta nel browser: serve solo a calcolare la direzione della Kaʿba da qui
    navigator.geolocation.getCurrentPosition(
      (pos) => setObserver({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: 20000 },
    );
  }, []);

  const qiblaOn = useCallback(() => {
    if (!api) return;
    const bearing = api.pointQibla(true);
    setQibla({ bearing, here: !!observer });
    askPosition();
  }, [api, observer, askPosition]);

  const toggleQibla = useCallback(() => {
    if (!api) return;
    if (qibla) {
      api.pointQibla(false);
      setQibla(null);
    } else qiblaOn();
  }, [api, qibla, qiblaOn]);

  // arrivata la posizione: la direzione si ricalcola da qui (il motore rigira la regola da sé)
  useEffect(() => {
    if (!observer || !qibla) return;
    const id = requestAnimationFrame(() => {
      if (!api) return;
      setQibla({ bearing: api.pointQibla(true), here: true });
    });
    return () => cancelAnimationFrame(id);
    // solo quando arriva la posizione
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observer]);

  // la qibla vale per la piastra (o per dove sei): cambiando città si ricalcola
  useEffect(() => {
    if (!api || !qibla || observer) return;
    const id = window.setTimeout(() => setQibla({ bearing: api.pointQibla(true), here: false }), 50);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId]);

  // i gesti legati alle sezioni («Mostra la piastra di Al-Quds», «Indica la qibla»…)
  const onAnchor = useCallback(
    (a: SectionAnchor) => {
      setSheet(null);
      window.setTimeout(() => {
        if (!api) return;
        if (a.kind === "city") {
          if (cities.some((c) => c.id === a.city)) changeCity(a.city);
        } else if (a.kind === "cielo") toNow();
        else if (a.kind === "tariq") api.triggerTariq();
        else if (a.kind === "qibla") {
          if (!qibla) qiblaOn();
        } else if (a.kind === "retro" && !flipped) toggleFlip();
      }, 360);
    },
    [api, cities, changeCity, toNow, qibla, qiblaOn, flipped, toggleFlip],
  );

  const actions = useMemo(() => ({ onAnchor, cityName: (id: string) => cities.find((c) => c.id === id)?.name }), [onAnchor, cities]);

  const astroSections = useMemo<AstroSection[]>(() => sections.map((s) => ({ id: s.id, title: s.title, angle: s.angle })), [sections]);
  const where = useMemo(() => (city ? { name: city.name, lat: city.lat, lon: city.lon } : null), [city]);

  // sul desktop il pannello sta a destra: lo strumento scivola a sinistra per restare intero
  const shift = inset.right ? -inset.right / 2 : 0;

  // la tastiera: Home sull'astrolabio torna ad adesso (e la regola torna al Sole)
  const onStageKey = (e: React.KeyboardEvent) => {
    if (e.key === "Home") setQibla(null);
  };

  // --- il foglio -------------------------------------------------------------------------------

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
        onReplayIntro={replayIntro}
      />
    );
  } else if (sheet?.kind === "star") {
    labelledBy = titleIds.star(sheet.id);
    key = `star:${sheet.id}`;
    content = <StarSheet id={sheet.id} where={where} time={time} />;
  } else if (sheet?.kind === "city") {
    labelledBy = titleIds.city(sheet.id);
    key = `city:${sheet.id}`;
    content = <CitySheet id={sheet.id} time={time} />;
  } else if (sheet?.kind === "section" && sectionPanels[sheet.id]) {
    labelledBy = titleIds.section(sheet.id);
    key = `section:${sheet.id}`;
    content = sectionPanels[sheet.id];
  }

  const astroProps = {
    city: cityId,
    observer,
    sections: astroSections,
    initialState: "hidden" as const,
    framing,
    sky: "stars" as const,
    tariqVideo: TARIQ_VIDEO,
    onReady,
    onEvent: onAstroEvent,
    onStarSelect,
    onSectionSelect,
    onTimeChange,
  };

  return (
    <ShellActionsProvider value={actions}>
      <main className={`${t.vars} ${h.home}`} data-home="" data-live={live ? "" : undefined}>
        <h1 className="sr-only" lang="en">
          hello, imad’s world
        </h1>

        {/* prima nel documento la barra in alto: l'ordine della tastiera segue quello dello schermo */}
        <SiteChrome
          onOpenSections={() => openSheet({ kind: "menu" })}
          sectionsOpen={sheet?.kind === "menu"}
          soundToggle
          logo={logo}
          intro={!live}
          onHeight={setHeaderH}
        />

        {mounted && city ? <LiveBackdrop city={city} time={time} sky={skyLib} onSky={setSky} /> : null}

        <div
          ref={stageRef}
          className={h.stage}
          style={shift ? { transform: `translate3d(${shift}px, 0, 0)` } : undefined}
          onKeyDown={onStageKey}
          inert={!live}
        >
          {mounted && framing && twoD !== null ? (
            mode2d ? (
              <AstrolabeFallback key={`2d-${run}`} {...astroProps} />
            ) : (
              <StageBoundary key={`3d-${run}`} onError={() => setFailed3d(true)}>
                <Astrolabe {...astroProps} />
              </StageBoundary>
            )
          ) : null}
        </div>

        {!introGone ? (
          <Intro
            key={run}
            targetRect={target}
            skip={skipIntro}
            onDone={onIntroDone}
            onEvent={onIntroEvent}
            headingAs="p"
            className={h.intro}
            style={{ opacity: live ? 0 : 1 }}
          />
        ) : null}

        <p className={h.qibla} style={{ top: headerH + 4 }} data-on={qibla && live ? "" : undefined} aria-live="polite">
          {qibla && live ? (
            <>
              <span className={h.qiblaFrom}>{qibla.here ? "la qibla da dove sei" : `la qibla da ${city?.name ?? ""}`}</span>
              <span className={h.qiblaDir}>
                <span className={h.data}>{`${Math.round(qibla.bearing)}°`}</span> {compass(qibla.bearing)}
              </span>
            </>
          ) : null}
        </p>


        {mounted && city ? (
          <LiveControlBar
            time={time}
            cities={cities}
            cityId={city.id}
            onCityChange={changeCity}
            onCityInfo={(id) => openSheet({ kind: "city", id })}
            onNow={toNow}
            onFlip={toggleFlip}
            flipped={flipped}
            onQibla={toggleQibla}
            qiblaActive={!!qibla}
            onTariq={tariq}
            showSound={false}
            hidden={!live}
            onHeight={setBarH}
            className={h.controls}
          />
        ) : null}

        <Sheet open={!!content} onClose={closeSheet} labelledBy={labelledBy} contentKey={key} onInset={setInset}>
          {content}
        </Sheet>

        <noscript>
          <div className={h.noscript}>
            <p>
              L’astrolabio ha bisogno di JavaScript per girare. Le sezioni si leggono anche così:
            </p>
            <ul>
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`/sezioni/${s.id}`}>{s.title}</a>
                </li>
              ))}
            </ul>
          </div>
        </noscript>
      </main>
    </ShellActionsProvider>
  );
}
