"use client";

// Il banco di prova del mushaf (/lab/corano): il libro sopra un segnaposto scuro dell'astrolabio,
// una finta barra dei controlli in basso e il registro delle azioni ricevute.

import { useCallback, useState } from "react";
import QuranBook from "./QuranBook";
import type { QuranAction, QuranEvent, Verse } from "./types";
import s from "./QuranLab.module.css";

interface LogLine {
  n: number;
  time: string;
  text: string;
  kind: "action" | "open" | "event";
}

export interface QuranLabProps {
  verses: Verse[];
  initialKey?: string;
  startOpen?: boolean;
  /** il libro decide da sé se è aperto (senza la prop open) */
  uncontrolled?: boolean;
}

function describe(a: QuranAction): string {
  return a.type === "star" ? `{ type: "star", id: "${a.id}" }` : `{ type: "${a.type}" }`;
}

export default function QuranLab({ verses, initialKey, startOpen = false, uncontrolled = false }: QuranLabProps) {
  const [open, setOpen] = useState(startOpen);
  const [log, setLog] = useState<LogLine[]>([]);
  const [last, setLast] = useState<QuranAction | null>(null);

  const push = useCallback((text: string, kind: LogLine["kind"]) => {
    const time = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLog((l) => [{ n: (l[0]?.n ?? 0) + 1, time, text, kind }, ...l].slice(0, 40));
  }, []);

  const onAction = useCallback(
    (a: QuranAction) => {
      setLast(a);
      push(`onAction ${describe(a)}`, "action");
    },
    [push],
  );

  const onOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      push(`onOpenChange(${next})`, "open");
    },
    [push],
  );

  const onEvent = useCallback((e: QuranEvent) => push(`onEvent("${e}")`, "event"), [push]);

  return (
    <main className={s.lab}>
      <div className={s.sky} aria-hidden="true">
        <div className={s.instrument}>
          <span className={s.instrumentLabel}>astrolabio</span>
          <span className={s.instrumentNote}>segnaposto</span>
        </div>
      </div>

      <section className={s.panel} aria-labelledby="lab-title">
        <h1 id="lab-title" className={s.title}>
          Laboratorio del Corano
        </h1>
        <p className={s.lead}>
          Ultima azione: <code data-testid="last-action">{last ? describe(last) : "nessuna"}</code>
        </p>
        <ol className={s.log} data-testid="action-log" aria-label="Registro delle azioni">
          {log.length === 0 ? <li className={s.empty}>Apri il libro in basso a destra e premi un bottone.</li> : null}
          {log.map((l) => (
            <li key={l.n} data-kind={l.kind}>
              <span className={s.time}>{l.time}</span> <code>{l.text}</code>
            </li>
          ))}
        </ol>
      </section>

      <div className={s.controls} aria-hidden="true">
        <span>controlli (segnaposto)</span>
      </div>

      <QuranBook
        verses={verses}
        initialKey={initialKey}
        open={uncontrolled ? undefined : open}
        onOpenChange={onOpenChange}
        onAction={onAction}
        onEvent={onEvent}
        className={s.book}
      />
    </main>
  );
}
