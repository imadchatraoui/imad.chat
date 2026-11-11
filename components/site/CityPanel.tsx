// La città della piastra: il nome (anche nella sua scrittura), la stessa luna sopra Torino e Gaza con la
// fase vera, il cartellino (ora locale, cielo dal Sole calcolato, coordinate, qibla), il racconto e i fatti.
// Nessun hook: va bene sul server e nel browser.

import type { CityItem } from "@/lib/astro/types";
import { kaabaDistanceKm, qiblaBearing } from "@/lib/astro/qibla";
import { compass, formatClock, formatDateLong, formatLat, formatLon, grouped, listWith, num } from "./format";
import { titleIds } from "./ids";
import MoonGlyph from "./MoonGlyph";
import { moonState, skyState, sunAltitude } from "./sky";
import p from "./Panels.module.css";

export interface CityPanelProps {
  city: CityItem;
  /** L'istante mostrato (quello dell'astrolabio). */
  date: Date;
  /** true se è l'istante vero di adesso: l'ora mostra i secondi. */
  isNow?: boolean;
  titleId?: string;
  /** Le città nominate con quella scelta nella riga della luna. */
  moonCompanions?: readonly string[];
}

const LANG_BY_CITY: Record<string, string> = { istanbul: "tr", samarcanda: "uz", cusco: "qu", kyoto: "ja" };

function localLang(city: CityItem): string | undefined {
  const s = city.nameLocal ?? "";
  if (/[؀-ۿ]/.test(s)) return "ar";
  if (/[぀-ヿ㐀-鿿]/.test(s)) return "ja";
  return LANG_BY_CITY[city.id];
}

/** «c’è la stessa luna…», con il nome della fase. */
function samePhrase(name: string, illuminated: number): string {
  const pct = `${Math.round(illuminated * 100)}%`;
  switch (name) {
    case "luna nuova":
      return "c’è la stessa luna nuova";
    case "luna piena":
      return "c’è la stessa luna piena";
    case "primo quarto":
      return "c’è la stessa luna, al primo quarto";
    case "ultimo quarto":
      return "c’è la stessa luna, all’ultimo quarto";
    case "falce crescente":
    case "falce calante":
      return `c’è la stessa luna: una ${name}, illuminata al ${pct}`;
    default:
      return `c’è la stessa luna, ${name}, illuminata al ${pct}`;
  }
}

export default function CityPanel({ city, date, isNow = false, titleId = titleIds.city(city.id), moonCompanions = ["Torino", "Gaza"] }: CityPanelProps) {
  const sunAlt = sunAltitude(date, city.lat, city.lon);
  const sky = skyState(sunAlt);
  const moon = moonState(date, city.lat, city.lon);
  const places = [city.name, ...moonCompanions.filter((n) => n.toLowerCase() !== city.name.toLowerCase())];
  const sentence = `Stanotte ${listWith("su", places)} ${samePhrase(moon.name, moon.illuminated)}.`;
  const qibla = qiblaBearing(city.lat, city.lon);
  const km = kaabaDistanceKm(city.lat, city.lon);
  const lang = localLang(city);
  const facts = (city.facts ?? []).filter((f): f is string => typeof f === "string" && f.trim() !== "");

  return (
    <article className={p.panel} aria-labelledby={titleId}>
      <header>
        <div className={p.cityHead}>
          <h2 id={titleId} className={p.title}>
            {city.name}
          </h2>
          {city.nameLocal && city.nameLocal !== city.name ? (
            <p className={p.cityLocal} lang={lang} dir={lang === "ar" ? "rtl" : undefined}>
              {city.nameLocal}
            </p>
          ) : null}
        </div>
        <p className={p.country}>{city.country}</p>
      </header>

      <div className={p.moon}>
        <MoonGlyph
          illuminated={moon.illuminated}
          brightLimb={moon.brightLimb}
          size={56}
          label={`La Luna vista da ${city.name}: ${moon.name}, illuminata al ${Math.round(moon.illuminated * 100)}%`}
        />
        <p className={p.moonText}>{sentence}</p>
      </div>

      <dl className={p.plate}>
        <dt>ora locale</dt>
        <dd suppressHydrationWarning>{formatClock(date, city.tz, isNow)}</dd>
        <dt>data</dt>
        <dd suppressHydrationWarning>{formatDateLong(date, city.tz)}</dd>
        <dt>cielo</dt>
        <dd suppressHydrationWarning>
          <span className={p.soft}>{`${sky}, il Sole a`}</span>
          <span>{`${num(sunAlt, 1)}°`}</span>
        </dd>
        <dt>coordinate</dt>
        <dd>
          <span>{formatLat(city.lat)}</span>
          <span>{formatLon(city.lon)}</span>
        </dd>
        <dt>qibla</dt>
        <dd>
          <span>{`${Math.round(qibla)}°`}</span>
          <span className={p.soft}>{`verso ${compass(qibla)}, a`}</span>
          <span>{`${grouped(km)} km`}</span>
        </dd>
      </dl>

      {city.blurb ? <p className={`${p.prose} ${p.blurb}`}>{city.blurb}</p> : null}

      {facts.length ? (
        <ul className={p.facts}>
          {facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
