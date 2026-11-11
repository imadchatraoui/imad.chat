// Una pagina del mushaf: la sura e i versetti, l'arabo, l'italiano con la sua fonte, una riga verso il
// cielo e il bottone per l'astrolabio. Il piede (la riga e il bottone) resta sempre in vista; se il
// versetto è lungo scorre solo la parte sopra, e una freccina in mezzo lo dice (senza coprire il testo).
//
// L'arabo arriva intatto da content/astro/verses.json (vedi arabic.ts): i nodi di testo dentro
// [data-q-ayah-text], uniti da uno spazio, rifanno esattamente il campo `ar`; i segni di fine versetto
// stanno in [data-q-ayah-end], fuori dal testo.

import { memo, useEffect, useRef, type ReactNode, type RefObject } from "react";
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

/**
 * C'è ancora testo sotto, nella parte che scorre? Lo dice l'attributo data-more sulla pagina.
 * Niente stato di React: mentre le pagine girano non deve ridisegnarsi niente.
 */
function useMoreBelow(scrollRef: RefObject<HTMLElement | null>, pageRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = scrollRef.current;
    const page = pageRef.current;
    if (!el || !page) return;
    const check = () => page.toggleAttribute("data-more", el.scrollHeight - el.clientHeight - el.scrollTop > 6);
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => {
      el.removeEventListener("scroll", check);
      ro.disconnect();
    };
  }, [scrollRef, pageRef]);
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

function QuranPage({ page, idBase, actionHintId, onAction }: QuranPageProps) {
  const { verse, meta } = page;
  const titleId = `${idBase}-p${page.index}`;
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLElement>(null);
  useMoreBelow(scrollRef, pageRef);
  return (
    <article ref={pageRef} className={s.page} aria-labelledby={titleId} aria-roledescription="pagina" data-size={page.size}>
      <p className={s.folio} aria-hidden="true">
        {page.index + 1}
      </p>
      <div ref={scrollRef} className={s.pageScroll} data-q-scroll="">
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
      </div>

      <div className={s.foot}>
        <span className={s.more} aria-hidden="true">
          <svg viewBox="0 0 20 12">
            <path d="M3 3l7 6 7-6" />
          </svg>
        </span>
        {meta ? (
          <>
            <p className={s.bridge}>{meta.bridge}</p>
            <button type="button" className={s.action} aria-describedby={actionHintId} onClick={() => onAction?.(page)}>
              <span>{meta.label}</span>
              <svg className={s.actionIcon} viewBox="0 0 20 20" aria-hidden="true">
                <path d="M4 10h11M11 5.5 15.5 10 11 14.5" />
              </svg>
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}

// le pagine non cambiano mentre girano: niente ridisegni inutili durante le animazioni
export default memo(QuranPage);
