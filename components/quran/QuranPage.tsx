// Una pagina del mushaf: la sura e i versetti, l'arabo, l'italiano con la sua fonte, una riga verso il
// cielo e il bottone per l'astrolabio. Nessun hook: è solo presentazione.
//
// L'arabo arriva intatto da content/astro/verses.json (vedi arabic.ts): i nodi di testo dentro
// [data-q-ayah-text], uniti da uno spazio, rifanno esattamente il campo `ar`; i segni di fine versetto
// stanno in [data-q-ayah-end], fuori dal testo.

import type { ReactNode } from "react";
import { ayahEndSign, keepTogether } from "./arabic";
import type { QuranPageData } from "./pages";
import s from "./QuranBook.module.css";

export interface QuranPageProps {
  page: QuranPageData;
  /** prefisso per gli id (useId del libro), così due libri nella stessa pagina non si pestano i piedi */
  idBase: string;
  /** id del testo nascosto che spiega cosa fa il bottone */
  actionHintId?: string;
  onAction?: (page: QuranPageData) => void;
}

function words(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  keepTogether(text).forEach((group, i) => {
    if (i > 0) out.push(" ");
    // una parola con il suo segno di pausa: insieme sulla stessa riga
    out.push(group.includes(" ") ? <span key={i} className={s.keep}>{group}</span> : group);
  });
  return out;
}

function Arabic({ page }: { page: QuranPageData }) {
  const { verse, ayahTexts } = page;
  let body: ReactNode[];
  if (ayahTexts) {
    body = [];
    ayahTexts.forEach((text, i) => {
      if (i > 0) body.push(" ");
      body.push(
        <span key={`t${i}`} data-q-ayah-text="">
          {words(text)}
        </span>,
        <span key={`e${i}`} className={s.ayahEnd} data-q-ayah-end="" aria-hidden="true">
          {ayahEndSign(verse.ayahs[i])}
        </span>,
      );
    });
  } else {
    // non si sa dividere con certezza: il blocco intero, senza segni di fine versetto
    body = [
      <span key="t" data-q-ayah-text="">
        {words(verse.ar)}
      </span>,
    ];
  }
  return (
    <p className={s.ar} lang="ar" dir="rtl" data-q-ar={verse.key}>
      {body}
    </p>
  );
}

export default function QuranPage({ page, idBase, actionHintId, onAction }: QuranPageProps) {
  const { verse, meta } = page;
  const titleId = `${idBase}-p${page.index}`;
  return (
    <article className={s.page} aria-labelledby={titleId} aria-roledescription="pagina" data-size={page.size}>
      <div className={s.pageScroll} data-q-scroll="">
        <header className={s.pageHead}>
          <h3 id={titleId} className={s.surah}>
            {verse.surahName}
          </h3>
          <p className={s.ref}>
            Sura {verse.surah}, {page.ayahLabel}
          </p>
        </header>

        <figure className={s.verse}>
          <blockquote className={s.quote} cite={page.quranUrl}>
            <Arabic page={page} />
            <span className={s.rule} aria-hidden="true" />
            <p className={s.it} lang="it">
              {page.italian}
            </p>
          </blockquote>
          <figcaption className={s.credit}>
            Traduzione di {verse.translator}.{" "}
            <span className={s.links}>
              <a
                href={page.quranUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Leggi ${verse.surahName} ${page.ref} su quran.com (si apre in una nuova scheda)`}
              >
                quran.com
                <svg className={s.ext} viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M4.5 2.5h5v5M9.5 2.5 3 9" />
                </svg>
              </a>
              {page.textSource ? (
                <>
                  {" · "}
                  <a
                    href={page.textSource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Il testo della traduzione su ${page.textSource.host} (si apre in una nuova scheda)`}
                  >
                    {page.textSource.host}
                    <svg className={s.ext} viewBox="0 0 12 12" aria-hidden="true">
                      <path d="M4.5 2.5h5v5M9.5 2.5 3 9" />
                    </svg>
                  </a>
                </>
              ) : null}
            </span>
          </figcaption>
        </figure>

        {meta ? (
          <div className={s.sky}>
            <p className={s.bridge}>{meta.bridge}</p>
            <button type="button" className={s.action} aria-describedby={actionHintId} onClick={() => onAction?.(page)}>
              <span>{meta.label}</span>
              <svg className={s.actionIcon} viewBox="0 0 20 20" aria-hidden="true">
                <path d="M4 10h11M11 5.5 15.5 10 11 14.5" />
              </svg>
            </button>
          </div>
        ) : null}
      </div>
      <p className={s.folio} aria-hidden="true">
        {page.index + 1}
      </p>
    </article>
  );
}
