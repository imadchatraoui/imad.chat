// La stella toccata sulla rete: il nome arabo grande, la traslitterazione, il significato, il cartellino
// con i dati veri (costellazione, magnitudine, coordinate J2000), la nota, il versetto se la stella è nel
// Corano, e una curiosità. Nessun hook: va bene sul server e nel browser.

import type { CuriosityItem, StarItem, VerseItem } from "@/lib/astro/types";
import { aPlace, capitalize, compass, formatDec, formatRA, num } from "./format";
import { titleIds } from "./ids";
import { starAltAz } from "./sky";
import VerseBlock from "./VerseBlock";
import p from "./Panels.module.css";

export interface StarPanelProps {
  star: StarItem;
  /** Il versetto di star.quran (da content/astro/verses.json), se c'è. */
  verse?: VerseItem | null;
  curiosity?: CuriosityItem | null;
  titleId?: string;
  /** Facoltativi: dove e quando, per dire quanto è alta la stella sopra quell'orizzonte. */
  where?: { name: string; lat: number; lon: number } | null;
  date?: Date | null;
}

export default function StarPanel({ star, verse, curiosity, titleId = titleIds.star(star.id), where, date }: StarPanelProps) {
  const hasArabic = !!star.ar?.trim();
  const sky = where && date ? starAltAz(date, where.lat, where.lon, star.ra, star.dec) : null;

  return (
    <article className={p.panel} aria-labelledby={titleId}>
      <header className={p.starHead}>
        {hasArabic ? (
          <>
            <p className={p.arName} lang="ar" dir="rtl">
              {star.ar}
            </p>
            {star.translit ? <p className={p.translit}>{star.translit}</p> : null}
            <h2 id={titleId} className={p.starName}>
              {star.name}
            </h2>
          </>
        ) : (
          <>
            <h2 id={titleId} className={p.starNameLarge}>
              {star.name}
            </h2>
            {star.translit ? <p className={p.translit}>{star.translit}</p> : null}
          </>
        )}
      </header>

      {star.meaning ? <p className={p.meaning}>{capitalize(star.meaning)}</p> : null}

      <dl className={p.plate}>
        <dt>costellazione</dt>
        <dd>{star.constellation}</dd>
        <dt>magnitudine</dt>
        <dd>{num(star.mag, 2)}</dd>
        <dt>ascensione retta</dt>
        <dd>{formatRA(star.ra)}</dd>
        <dt>declinazione</dt>
        <dd>{formatDec(star.dec)}</dd>
        {sky && where ? (
          <>
            <dt>{`${aPlace(where.name)}, ora`}</dt>
            <dd>
              {sky.altitude > 0 ? (
                <>
                  <span>{`${num(sky.altitude, 0)}°`}</span>
                  <span className={p.soft}>{`sopra l’orizzonte, verso ${compass(sky.azimuth)}`}</span>
                </>
              ) : (
                <span className={p.soft}>sotto l’orizzonte</span>
              )}
            </dd>
          </>
        ) : null}
      </dl>
      <p className={p.plateNote}>coordinate J2000</p>

      {star.note ? <p className={`${p.prose} ${p.note}`}>{star.note}</p> : null}

      {star.quran && verse ? <VerseBlock verse={verse} /> : null}

      {curiosity ? (
        <aside className={p.curio}>
          <h3 className={p.curioTitle}>{curiosity.title}</h3>
          <p className={p.prose}>{curiosity.text}</p>
        </aside>
      ) : null}
    </article>
  );
}
