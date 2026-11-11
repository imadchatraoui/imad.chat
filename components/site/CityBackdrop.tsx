"use client";

// Lo sfondo a tutto schermo dietro l'astrolabio: la città della piastra, di notte o di giorno.
// Se il manifesto elenca city/<id>-<night|day>-<v|h>.mp4 parte il loop (muto, in linea, col .jpg come
// poster); altrimenti il .jpg; altrimenti un gradiente che segue il cielo calcolato. Ogni cambio di città
// o di cielo è una dissolvenza di 1,2 secondi. Sempre attenuato, con una vignetta: l'astrolabio resta
// il protagonista. Niente video se si chiede meno movimento o si risparmiano dati.

import { useEffect, useRef, useState } from "react";
import { cityMedia, useMedia, type CityMedia, type Orientation, type SkyState } from "@/lib/media";
import t from "./tokens.module.css";
import s from "./Backdrop.module.css";

export interface CityBackdropProps {
  /** Id della città (content/astro/cities.json). */
  city: string;
  sky: SkyState;
  /** v (verticale), h (orizzontale) o auto (dall'orientamento dello schermo). */
  orientation?: Orientation | "auto";
  className?: string;
}

interface Layer {
  key: string;
  sky: SkyState;
  media: CityMedia | null;
  video: boolean;
  on: boolean;
}

const FADE_MS = 1200;

function useQuery(query: string, initial = false): boolean {
  const [m, setM] = useState(initial);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return m;
}

function saveData(): boolean {
  const c = (navigator as unknown as { connection?: { saveData?: boolean } }).connection;
  return !!c?.saveData;
}

function BackdropVideo({ src, poster, onReady }: { src: string; poster: string | null; onReady: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // iOS vuole l'attributo muted, non solo la proprietà, per partire da solo
    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute("muted", "");
    v.setAttribute("playsinline", "");
    const ready = () => onReady();
    v.addEventListener("loadeddata", ready, { once: true });
    void v.play().catch(() => {
      // autoplay negato: resta il poster
    });
    return () => v.removeEventListener("loadeddata", ready);
  }, [src, onReady]);
  return (
    <video
      ref={ref}
      className={s.media}
      src={src}
      poster={poster ?? undefined}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      disablePictureInPicture
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}

export default function CityBackdrop({ city, sky, orientation = "auto", className }: CityBackdropProps) {
  const index = useMedia();
  const portrait = useQuery("(orientation: portrait)", true);
  const reduce = useQuery("(prefers-reduced-motion: reduce)");
  const o: Orientation = orientation === "auto" ? (portrait ? "v" : "h") : orientation;
  const media = cityMedia(city, sky, o, index);
  const [noVideo, setNoVideo] = useState(false);
  useEffect(() => setNoVideo(saveData()), []);
  const video = !!media?.video && !reduce && !noVideo;
  const key = `${city}|${sky}|${media ? (video ? media.video : media.image) : "gradient"}`;

  const [layers, setLayers] = useState<Layer[]>(() => [{ key, sky, media, video, on: true }]);

  useEffect(() => {
    setLayers((ls) => {
      if (ls[ls.length - 1]?.key === key) return ls;
      return [...ls.slice(-1), { key, sky, media, video, on: false }];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // la nuova si accende (subito se è un gradiente, quando l'immagine o il video sono pronti),
  // le vecchie si tolgono a dissolvenza finita
  const reveal = (k: string) =>
    setLayers((ls) => (ls.some((l) => l.key === k && !l.on) ? ls.map((l) => (l.key === k ? { ...l, on: true } : l)) : ls));

  const top = layers[layers.length - 1];
  useEffect(() => {
    if (!top || top.on) return;
    let raf = 0;
    if (!top.media) raf = requestAnimationFrame(() => requestAnimationFrame(() => reveal(top.key)));
    // se l'immagine non arriva, si accende lo stesso: meglio un salto che uno sfondo fermo
    const fallback = window.setTimeout(() => reveal(top.key), 2500);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(fallback);
    };
  }, [top]);

  useEffect(() => {
    if (layers.length < 2 || !top?.on) return;
    const id = window.setTimeout(() => setLayers((ls) => ls.slice(-1)), reduce ? 50 : FADE_MS + 100);
    return () => window.clearTimeout(id);
  }, [layers.length, top?.on, reduce]);

  return (
    <div className={`${t.vars} ${s.backdrop} ${className ?? ""}`} aria-hidden="true" data-sky={sky}>
      {layers.map((l) => (
        <div key={l.key} className={s.layer} data-on={l.on ? "" : undefined} data-sky={l.sky}>
          {l.media && l.video && l.media.video ? (
            <BackdropVideo src={l.media.video} poster={l.media.image} onReady={() => reveal(l.key)} />
          ) : l.media?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={s.media} src={l.media.image} alt="" decoding="async" onLoad={() => reveal(l.key)} />
          ) : (
            <div className={s.gradient} />
          )}
          {l.media ? <div className={s.dim} /> : null}
        </div>
      ))}
      <div className={s.vignette} />
    </div>
  );
}
