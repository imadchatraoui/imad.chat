// Una sezione del sito (content/sezioni/*.md): titolo, una riga d'apertura, il gesto legato
// sull'astrolabio (facoltativo) e il corpo in Markdown. I segnaposto {{verse:CHIAVE}} diventano
// versetti veri, presi da content/astro/verses.json.
//
// Nessun hook: conviene renderlo sul server (react-markdown resta fuori dal bundle del browser) e
// passarlo già pronto alla cornice; per il pulsante del gesto c'è SectionAnchorAction.

import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import versesJson from "@/content/astro/verses.json";
import type { VerseItem } from "@/lib/astro/types";
import { titleIds } from "./ids";
import VerseBlock from "./VerseBlock";
import ps from "./Panels.module.css";
import type { ReactNode } from "react";

export interface SectionPanelSection {
  id: string;
  title: string;
  summary?: string;
  /** Il corpo in Markdown. */
  body: string;
}

export interface SectionPanelProps {
  section: SectionPanelSection;
  /** Un pulsante sotto l'apertura, di solito <SectionAnchorAction anchor={section.anchor} />. */
  action?: ReactNode;
  titleId?: string;
  /** I versetti disponibili (predefiniti: content/astro/verses.json). */
  verses?: readonly VerseItem[];
}

const DEFAULT_VERSES: readonly VerseItem[] = (versesJson as unknown as { items: VerseItem[] }).items ?? [];
const PLACEHOLDER = /\{\{\s*verse:\s*([^}\s]+)\s*\}\}/g;

type Part = { kind: "md"; text: string } | { kind: "verse"; key: string };

/** Divide il corpo nei pezzi di Markdown e nei versetti. */
export function splitVerses(body: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  for (const m of body.matchAll(PLACEHOLDER)) {
    const i = m.index ?? 0;
    const text = body.slice(last, i);
    if (text.trim()) parts.push({ kind: "md", text });
    parts.push({ kind: "verse", key: m[1] });
    last = i + m[0].length;
  }
  const rest = body.slice(last);
  if (rest.trim()) parts.push({ kind: "md", text: rest });
  return parts;
}

function isExternal(href: string | undefined): boolean {
  return !!href && /^https?:\/\//.test(href);
}

const components: Components = {
  a({ node: _node, href, children, ...rest }) {
    return isExternal(href) ? (
      <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    ) : (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
  p({ node, children, ...rest }) {
    // le righe delle fonti, in fondo, più piccole
    const first = node?.children?.[0];
    const sources = first?.type === "text" && /^\s*Fonti?\b/i.test(first.value);
    return (
      <p className={sources ? ps.small : undefined} {...rest}>
        {children}
      </p>
    );
  },
  // i titoli dentro le sezioni scendono di un livello: il titolo della sezione è già un h2
  h1: ({ node: _n, ...rest }) => <h3 {...rest} />,
  h2: ({ node: _n, ...rest }) => <h3 {...rest} />,
};

export default function SectionPanel({ section, action, titleId = titleIds.section(section.id), verses = DEFAULT_VERSES }: SectionPanelProps) {
  const parts = splitVerses(section.body ?? "");
  return (
    <article className={ps.panel} aria-labelledby={titleId}>
      <h2 id={titleId} className={ps.title}>
        {section.title}
      </h2>
      {section.summary ? <p className={ps.lede}>{section.summary}</p> : null}
      {action}
      <div className={`${ps.prose} ${ps.sectionBody}`}>
        {parts.map((part, i) => {
          if (part.kind === "verse") {
            const verse = verses.find((v) => v.key === part.key);
            if (!verse) {
              if (process.env.NODE_ENV !== "production") console.warn(`[SectionPanel] versetto non trovato: ${part.key}`);
              return null;
            }
            return <VerseBlock key={`v${i}`} verse={verse} />;
          }
          return (
            <Markdown key={`m${i}`} remarkPlugins={[remarkGfm]} components={components}>
              {part.text}
            </Markdown>
          );
        })}
      </div>
    </article>
  );
}
