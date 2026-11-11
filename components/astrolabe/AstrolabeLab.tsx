"use client";

// Banco di prova dell'astrolabio (/lab/astrolabio, non indicizzato). Parametri utili:
//   ?city=gaza            piastra iniziale
//   ?t=2026-11-11T21:00Z  istante fisso (per screenshot ripetibili)
//   ?state=hidden|exploded stato iniziale
//   ?fallback=1           versione 2D

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  citiesInOrder,
  getCity,
  getStar,
  localDateString,
  localTimeString,
  moonInfo,
  type AstroSection,
} from "@/lib/astro";
import type { AstrolabeHandle } from "./types";

const Astrolabe = dynamic(() => import("./Astrolabe"), { ssr: false });

const SECTIONS: AstroSection[] = [
  { id: "codice", title: "Codice", angle: 28 },
  { id: "corano", title: "Corano", angle: 72 },
  { id: "stelle", title: "Stelle e spazio", angle: 118 },
  { id: "viaggi", title: "Viaggi e culture", angle: 162 },
  { id: "folklore", title: "Folklore e curiosità", angle: 208 },
  { id: "torino", title: "Torino", angle: 252 },
  { id: "palestina", title: "Palestina", angle: 298 },
];

const ui = {
  night: "#070a14",
  lapis: "#14204a",
  brass: "#c9a25b",
  brassLight: "#ead6a0",
  cream: "#efe6d2",
  muted: "#8a8fa3",
};

export default function AstrolabeLab() {
  const params = useMemo(() => (typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search)), []);
  const cities = useMemo(() => citiesInOrder(), []);
  const [cityId, setCityId] = useState(params.get("city") ?? "torino");
  const [time, setTime] = useState<{ d: Date; now: boolean }>({ d: new Date(), now: true });
  const [star, setStar] = useState<string | null>(null);
  const [section, setSection] = useState<string | null>(null);
  const [qibla, setQibla] = useState<number | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const api = useRef<AstrolabeHandle | null>(null);
  const [mode, setMode] = useState<string>("");
  const state = (params.get("state") as "hidden" | "exploded" | null) ?? "assembled";
  const [landscape, setLandscape] = useState(false);
  useEffect(() => {
    const upd = () => setLandscape(window.innerWidth > window.innerHeight);
    upd();
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);
  const framing = useMemo(
    () => (landscape ? { top: 0.07, bottom: 0.15, side: 0.03 } : { top: 0.13, bottom: 0.25, side: 0.03 }),
    [landscape],
  );
  const fixedTime = params.get("t");

  const onReady = useCallback(
    (h: AstrolabeHandle) => {
      api.current = h;
      setMode(h.mode);
      if (fixedTime) {
        const d = new Date(fixedTime);
        if (!Number.isNaN(d.getTime())) h.setTime(d, { animate: false });
      }
      (window as unknown as { __astrolabe?: AstrolabeHandle }).__astrolabe = h;
    },
    [fixedTime],
  );

  const onEvent = useCallback((name: string) => {
    setLog((l) => [name, ...l].slice(0, 6));
  }, []);

  useEffect(() => {
    document.documentElement.style.background = ui.night;
    document.body.style.background = ui.night;
  }, []);

  const city = getCity(cityId);
  const s = star ? getStar(star) : null;
  const moon = useMemo(() => moonInfo(time.d), [time.d]);
  const tz = city?.tz ?? "Europe/Rome";

  const button: React.CSSProperties = {
    font: "inherit",
    color: ui.cream,
    background: "transparent",
    border: `1px solid rgba(201,162,91,0.45)`,
    borderRadius: 999,
    padding: "7px 13px",
    fontSize: 14,
    lineHeight: 1.1,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        background: `radial-gradient(120% 80% at 50% 110%, ${ui.lapis} 0%, ${ui.night} 60%)`,
        color: ui.cream,
        fontFamily: "var(--font-newsreader), Georgia, serif",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", inset: 0 }}>
        <Astrolabe
          city={cityId}
          sections={SECTIONS}
          initialState={state}
          forceFallback={params.get("fallback") === "1"}
          tariqVideo={params.get("tariq") === "procedural" ? "procedural" : "auto"}
          framing={framing}
          onReady={onReady}
          onEvent={onEvent}
          onStarSelect={(id) => {
            setStar(id);
            setSection(null);
          }}
          onSectionSelect={(id) => {
            setSection(id);
            setStar(null);
          }}
          onTimeChange={(d, now) => setTime({ d, now })}
        />
      </div>

      {/* in alto: dove e quando */}
      <header style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "14px 16px", pointerEvents: "none" }}>
        <div style={{ fontStyle: "italic", fontSize: 19, color: ui.brassLight }}>{city?.name ?? cityId}</div>
        <div style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace", fontSize: 12.5, color: ui.muted, marginTop: 2 }}>
          {localTimeString(time.d, tz)} · {localDateString(time.d, tz)}
          {time.now ? "" : " · nel tempo"}
        </div>
        <div style={{ fontSize: 13, color: ui.muted, marginTop: 2 }}>
          stanotte la luna è {moon.name}, illuminata al {Math.round(moon.illuminated * 100)}%
        </div>
      </header>

      {/* la scheda della stella o della sezione */}
      {(s || section) && (
        <div
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: "calc(env(safe-area-inset-bottom) + 132px)",
            maxWidth: 420,
            padding: "12px 14px",
            border: `1px solid rgba(201,162,91,0.35)`,
            borderRadius: 14,
            background: "rgba(7,10,20,0.88)",
          }}
        >
          {s ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                <span style={{ fontSize: 20, fontStyle: "italic", color: ui.brassLight }}>{s.translit || s.name}</span>
                {s.ar ? (
                  <span lang="ar" dir="rtl" style={{ fontFamily: "var(--font-amiri), serif", fontSize: 22 }}>
                    {s.ar}
                  </span>
                ) : null}
              </div>
              <div style={{ fontSize: 14.5, color: ui.cream, marginTop: 4 }}>
                {s.name}
                {s.meaning ? ` · ${s.meaning}` : ""}
                {s.quran ? ` · Corano ${s.quran}` : ""}
              </div>
              <div style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace", fontSize: 12, color: ui.muted, marginTop: 4 }}>
                AR {s.ra.toFixed(3)} h · dec {s.dec.toFixed(2)}° · mag {s.mag}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 17, fontStyle: "italic" }}>{SECTIONS.find((x) => x.id === section)?.title}</div>
          )}
        </div>
      )}

      {/* in basso: i comandi */}
      <nav
        aria-label="Comandi dell'astrolabio"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "10px 12px calc(env(safe-area-inset-bottom) + 12px)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
          {cities.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCityId(c.id)}
              aria-pressed={c.id === cityId}
              style={{
                ...button,
                borderColor: c.id === cityId ? ui.brass : "rgba(201,162,91,0.3)",
                color: c.id === cityId ? ui.brassLight : ui.cream,
                fontStyle: "italic",
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button type="button" style={{ ...button, borderColor: ui.brass, color: ui.brassLight }} onClick={() => api.current?.resetNow()}>
            Adesso
          </button>
          <button
            type="button"
            style={button}
            onClick={() => {
              if (qibla === null) setQibla(api.current?.pointQibla(true) ?? null);
              else {
                api.current?.pointQibla(false);
                setQibla(null);
              }
            }}
          >
            {qibla === null ? "Qibla" : `Qibla ${Math.round(qibla)}°`}
          </button>
          <button type="button" style={button} onClick={() => api.current?.flip()}>
            Gira
          </button>
          <button type="button" style={button} onClick={() => api.current?.triggerTariq()}>
            at-Tariq
          </button>
          <button type="button" style={button} onClick={() => api.current?.explode()}>
            Esplodi
          </button>
          <button type="button" style={button} onClick={() => api.current?.assemble()}>
            Monta
          </button>
          <button type="button" style={button} onClick={() => api.current?.scramble()}>
            Scombina
          </button>
          <button type="button" style={button} onClick={() => api.current?.realign()}>
            Riallinea
          </button>
        </div>
        <div style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace", fontSize: 11, color: ui.muted }} aria-live="polite">
          {mode} {log.join(" · ")}
        </div>
      </nav>
    </main>
  );
}
