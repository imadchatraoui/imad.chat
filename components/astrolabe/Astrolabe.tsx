"use client";

// L'astrolabio di imad's world. Da importare con next/dynamic e ssr: false.
// Con WebGL è uno strumento 3D d'ottone; senza WebGL, o con "riduci movimento", è la versione 2D
// in SVG (AstrolabeFallback), con la stessa matematica e gli stessi metodi.

import { lazy, Suspense, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { getCity, CITIES, type AstroSection } from "@/lib/astro";
import AstrolabeFallback from "./AstrolabeFallback";
import type { AstrolabeEngine, EngineCallbacks } from "./engine/engine";
import type { AstrolabeHandle, AstrolabeProps } from "./types";

const AstrolabeScene = lazy(() => import("./AstrolabeScene"));

const NO_SECTIONS: AstroSection[] = [];

/** C'è WebGL? (un contesto di prova, subito liberato) */
export function hasWebGL(): boolean {
  if (typeof document === "undefined") return false;
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

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function Astrolabe(props: AstrolabeProps) {
  const {
    city: cityId = "torino",
    observer = null,
    sections = NO_SECTIONS,
    className,
    initialState = "assembled",
    framing,
    forceFallback,
    tariqVideo = "auto",
    sky = "full",
    ref,
  } = props;
  const [mode, setMode] = useState<"pending" | "3d" | "2d">("pending");
  const [lowEnd, setLowEnd] = useState(true);
  const engineRef = useRef<AstrolabeEngine | null>(null);
  const queue = useRef<((e: AstrolabeEngine) => void)[]>([]);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const twoD = !!forceFallback || prefersReducedMotion() || !hasWebGL();
    const nav = navigator as Navigator & { deviceMemory?: number };
    const cores = nav.hardwareConcurrency ?? 8;
    const mem = nav.deviceMemory ?? 8;
    const el = hostRef.current;
    const w = el?.clientWidth || window.innerWidth;
    const h = el?.clientHeight || window.innerHeight;
    const dpr = Math.min(1.75, window.devicePixelRatio || 1);
    const plateDevicePx = 0.6 * Math.min(w, h) * dpr;
    setLowEnd(cores <= 4 || mem <= 4 || plateDevicePx < 700);
    setMode(twoD ? "2d" : "3d");
  }, [forceFallback]);

  // le callback più recenti, senza ricreare il motore
  const callbacks = useRef<EngineCallbacks>({});
  callbacks.current = {
    onEvent: props.onEvent,
    onStarSelect: props.onStarSelect,
    onSectionSelect: props.onSectionSelect,
    onTimeChange: props.onTimeChange,
  };

  const run = useCallback((fn: (e: AstrolabeEngine) => void) => {
    if (engineRef.current) fn(engineRef.current);
    else queue.current.push(fn);
  }, []);

  const handle = useMemo<AstrolabeHandle>(
    () => ({
      mode: "3d",
      assemble: () => run((e) => e.assemble()),
      explode: () => run((e) => e.explode()),
      flip: () => run((e) => e.flip()),
      triggerTariq: () => run((e) => e.triggerTariq()),
      setTime: (d: Date, opts?: { animate?: boolean }) => run((e) => e.setTime(d, opts?.animate ?? true)),
      resetNow: () => run((e) => e.resetNow()),
      pointQibla: (on = true) => {
        if (engineRef.current) return engineRef.current.pointQibla(on);
        run((e) => e.pointQibla(on));
        return NaN;
      },
      scramble: () => run((e) => e.scramble()),
      realign: () => run((e) => e.realign()),
      selectStar: (id: string | null) => run((e) => e.selectStar(id)),
      getTime: () => engineRef.current?.simDate() ?? new Date(),
      isNow: () => engineRef.current?.isNow() ?? true,
      getLimbScreenCircle: () => engineRef.current?.getLimbScreenCircle() ?? null,
    }),
    [run],
  );

  useImperativeHandle(mode === "2d" ? null : ref, () => handle, [handle]);

  const onReady = props.onReady;
  const onEngine = useCallback(
    (e: AstrolabeEngine | null) => {
      engineRef.current = e;
      if (e) {
        const pending = queue.current.splice(0);
        for (const fn of pending) fn(e);
        onReady?.(handle);
      }
    },
    [handle, onReady],
  );

  const city = useMemo(() => getCity(cityId) ?? getCity("torino") ?? CITIES[0], [cityId]);
  const frame = useMemo(
    () => ({ top: framing?.top ?? 0.06, bottom: framing?.bottom ?? 0.1, side: framing?.side ?? 0.035 }),
    [framing?.top, framing?.bottom, framing?.side],
  );

  if (mode === "2d" || !city) {
    return <AstrolabeFallback {...props} />;
  }

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ position: "relative", width: "100%", height: "100%", outline: "none" }}
      tabIndex={0}
      role="group"
      aria-roledescription="astrolabio"
      aria-label="Astrolabio d'ottone. Trascina la rete per viaggiare nel tempo; tocca un puntatore per conoscere la stella. Con la tastiera: frecce per spostarti di un'ora, Home per tornare ad adesso."
      onKeyDown={(e) => {
        if (engineRef.current?.key(e.nativeEvent)) e.preventDefault();
      }}
    >
      {mode === "3d" && (
        <Suspense fallback={null}>
          <AstrolabeScene
            city={city}
            observer={observer}
            sections={sections}
            initialState={initialState}
            framing={frame}
            callbacks={callbacks}
            onEngine={onEngine}
            lowEnd={lowEnd}
            tariqVideo={tariqVideo}
            sky={sky}
          />
        </Suspense>
      )}
    </div>
  );
}
