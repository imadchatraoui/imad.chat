"use client";

// Il menu delle sezioni, dentro il foglio. Ogni voce porta il grado del lembo dove è incisa.
// Tastiera: Tab entra nella lista, frecce su e giù (Home, Fine) scorrono le voci, Invio apre.

import { useRef, type KeyboardEvent } from "react";
import type { SectionMeta } from "@/lib/sections";
import t from "./tokens.module.css";
import p from "./Panels.module.css";

export type SectionsMenuItem = Pick<SectionMeta, "id" | "title" | "summary" | "angle">;

export interface SectionsMenuProps {
  sections: readonly SectionsMenuItem[];
  onSelect: (id: string) => void;
  /** La sezione aperta per ultima, segnata nella lista. */
  currentId?: string | null;
  /** id del titolo, per aria-labelledby del foglio. */
  titleId?: string;
  /** Se c'è, in fondo compare «Rivedi l’intro». */
  onReplayIntro?: () => void;
  /** Il link alla pagina di ogni sezione (per condividerla): predefinito /sezioni/<id>. */
  hrefFor?: (id: string) => string;
}

export default function SectionsMenu({
  sections,
  onSelect,
  currentId,
  titleId = "sheet-title-sezioni",
  onReplayIntro,
  hrefFor = (id) => `/sezioni/${id}`,
}: SectionsMenuProps) {
  const listRef = useRef<HTMLOListElement>(null);

  const onKeyDown = (e: KeyboardEvent<HTMLOListElement>) => {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLAnchorElement>("a") ?? []);
    const i = items.indexOf(document.activeElement as HTMLAnchorElement);
    if (i < 0) return;
    let next = -1;
    if (e.key === "ArrowDown") next = (i + 1) % items.length;
    else if (e.key === "ArrowUp") next = (i - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    if (next >= 0) {
      e.preventDefault();
      items[next].focus();
    }
  };

  return (
    <nav className={p.panel} aria-labelledby={titleId}>
      <h2 id={titleId} className={p.title}>
        Sezioni
      </h2>
      <p className={p.lede}>Ognuna è incisa sul bordo graduato dell’astrolabio: si apre da qui o toccando il suo segno.</p>
      <ol ref={listRef} className={p.menuList} onKeyDown={onKeyDown}>
        {sections.map((s) => (
          <li key={s.id}>
            {/* un vero link alla pagina della sezione: si apre qui nel foglio, ma si può anche copiare e condividere */}
            <a
              href={hrefFor(s.id)}
              className={p.menuItem}
              aria-current={currentId === s.id ? "true" : undefined}
              onClick={(e) => {
                if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                onSelect(s.id);
              }}
            >
              <span className={p.menuDeg} aria-hidden="true">
                {Math.round(s.angle)}°
              </span>
              <span className={p.menuName}>{s.title}</span>
              {s.summary ? <span className={p.menuSummary}>{s.summary}</span> : null}
            </a>
          </li>
        ))}
      </ol>
      {onReplayIntro ? (
        <p className={p.menuFoot}>
          <button type="button" className={`${t.button} ${p.replay}`} onClick={onReplayIntro}>
            Rivedi l’intro
          </button>
        </p>
      ) : null}
    </nav>
  );
}
