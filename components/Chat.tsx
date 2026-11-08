"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NoteSummary } from "@/lib/notes";
import { site } from "@/site.config";
import Header from "./Header";
import NoteCard from "./NoteCard";
import Prose from "./Prose";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  done?: boolean;
  error?: string;
};

type Props = {
  notes: NoteSummary[];
  greeting: string;
  dateLines: [string, string];
};

const ERRORS: Record<string, string> = {
  not_configured: "Il bot non è ancora acceso. Intanto puoi leggere il diario.",
  rate_limited: "Troppe domande tutte insieme. Riprova tra un minuto.",
  too_long: "Messaggio troppo lungo. Prova con meno parole.",
  empty: "Non ho trovato le parole. Prova a chiedere in un altro modo.",
  upstream: "Non riesco a rispondere adesso. Riprova tra poco, oppure leggi il diario.",
  network: "Non riesco a rispondere adesso. Riprova tra poco, oppure leggi il diario.",
};

const REF = /\[\[([a-z0-9-]+)\]\]/g;

/** Toglie i riferimenti [[slug]] dal testo e li restituisce a parte. */
function splitRefs(text: string, streaming: boolean): { clean: string; slugs: string[] } {
  const slugs: string[] = [];
  let clean = text.replace(REF, (_, slug: string) => {
    if (!slugs.includes(slug)) slugs.push(slug);
    return "";
  });
  // Un riferimento ancora a metà, mentre il testo arriva.
  if (streaming) clean = clean.replace(/\s*\[\[[^\]]*\]?$/, "");
  clean = clean
    .replace(/[ \t]+([.,;:!?»)])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { clean, slugs };
}

function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

class ChatError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export default function Chat({ notes, greeting, dateLines }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const bySlug = useMemo(() => new Map(notes.map((n) => [n.slug, n])), [notes]);

  const questions = useMemo(() => {
    const fromNotes = notes
      .filter((n) => n.question)
      .slice(0, 3)
      .map((n) => ({ text: n.question as string, focus: n.slug }));
    const fallback = site.fallbackQuestions.map((text) => ({ text, focus: undefined as string | undefined }));
    return [...fromNotes, ...fallback].slice(0, 3);
  }, [notes]);

  const send = useCallback(
    async (text: string, focus?: string) => {
      const q = text.trim();
      if (!q || busy) return;

      const userMsg: Msg = { id: uid(), role: "user", content: q };
      const botId = uid();
      const history = [...messages, userMsg];
      setMessages([...history, { id: botId, role: "assistant", content: "" }]);
      setInput("");
      setBusy(true);
      stickToBottom.current = true;

      const update = (patch: Partial<Msg> | ((m: Msg) => Partial<Msg>)) =>
        setMessages((ms) =>
          ms.map((m) => (m.id === botId ? { ...m, ...(typeof patch === "function" ? patch(m) : patch) } : m)),
        );

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history
              .filter((m) => m.content.trim() && !m.error)
              .slice(-12)
              .map(({ role, content }) => ({ role, content })),
            focus,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new ChatError(data?.error ?? "upstream");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let received = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (chunk) {
            received += chunk;
            update((m) => ({ content: m.content + chunk }));
          }
        }
        update(received.trim() ? { done: true } : { done: true, error: "empty" });
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          update((m) => (m.content.trim() ? { done: true } : { done: true, error: "empty" }));
        } else {
          update({ done: true, error: err instanceof ChatError ? err.code : "network" });
        }
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [messages, busy],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  // Arrivo da una pagina del diario con una domanda già pronta (?q=…&focus=slug).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) {
      const focus = params.get("focus") ?? undefined;
      window.history.replaceState({}, "", "/");
      void send(q, focus);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "/" porta il cursore nella casella.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key === "/" && !(target instanceof HTMLTextAreaElement) && !(target instanceof HTMLInputElement)) {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Segui il testo che arriva, ma solo se chi legge è già in fondo.
  useEffect(() => {
    const onScroll = () => {
      const gap = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
      stickToBottom.current = gap < 160;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (messages.length && stickToBottom.current) {
      endRef.current?.scrollIntoView({ block: "end", behavior: busy ? "auto" : "smooth" });
    }
  }, [messages, busy]);

  // La casella cresce con il testo.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const inConversation = messages.length > 0;

  return (
    <div className="flex min-h-dvh flex-col">
      <Header current="home" onReset={inConversation ? reset : undefined} />

      <main className="mx-auto w-full max-w-[44rem] flex-1 px-5 sm:px-0">
        {inConversation ? (
          <ol className="space-y-7 pt-6 pb-6" aria-live="polite" aria-busy={busy}>
            {messages.map((m) =>
              m.role === "user" ? (
                <li key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-[1.25rem] rounded-br-md bg-wash px-4 py-2.5 text-[0.9375rem] leading-relaxed whitespace-pre-wrap">
                    {m.content}
                  </div>
                </li>
              ) : (
                <li key={m.id}>
                  <Assistant message={m} bySlug={bySlug} />
                </li>
              ),
            )}
            <div ref={endRef} aria-hidden="true" />
          </ol>
        ) : (
          <section className="pt-[11vh] pb-10 sm:pt-[15vh]">
            <h1 className="voice rise text-[3.25rem] leading-[1] tracking-[-0.015em] text-balance sm:text-[4rem]">
              {greeting}
            </h1>
            <p className="rise rise-2 mt-4 text-[0.9375rem] leading-snug text-muted">
              {dateLines[0]}
              <br />
              {dateLines[1]}
            </p>
            <p className="voice rise rise-3 mt-8 max-w-[34rem] text-[1.1875rem] leading-relaxed">{site.intro}</p>

            <div className="rise rise-3 mt-6 flex flex-wrap gap-2">
              {questions.map((q) => (
                <button
                  key={q.text}
                  type="button"
                  onClick={() => void send(q.text, q.focus)}
                  className="rounded-full bg-wash px-3.5 py-2 text-[0.9375rem] transition-colors hover:bg-line"
                >
                  {q.text}
                </button>
              ))}
            </div>

            {notes.length > 0 && (
              <div className="mt-14">
                <h2 className="mb-2 text-[0.8125rem] text-muted">Ultime pagine</h2>
                <ul className="divide-y divide-line border-t border-line">
                  {notes.slice(0, 4).map((n) => (
                    <li key={n.slug}>
                      <Link href={`/diario/${n.slug}`} className="flex items-baseline gap-4 py-3">
                        <span className="w-14 shrink-0 text-[0.8125rem] text-muted tabular-nums">{n.dateShort}</span>
                        <span className="voice text-[1.0625rem] leading-snug">{n.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link href="/diario" className="mt-3 inline-block text-[0.875rem] text-muted transition-colors hover:text-ink">
                  Tutto il diario
                </Link>
              </div>
            )}
          </section>
        )}
      </main>

      <div className="sticky bottom-0 bg-paper pt-2">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-linear-to-t from-paper to-transparent"
        />
        <form
          className="mx-auto w-full max-w-[44rem] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-0"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <div className="composer flex items-end gap-2 rounded-[1.375rem] bg-wash py-2 pr-2 pl-4 ring-1 ring-transparent transition-shadow focus-within:ring-line">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder={inConversation ? "Scrivi…" : "Chiedimi qualcosa…"}
              aria-label="Messaggio"
              enterKeyHint="send"
              autoComplete="off"
              className="max-h-40 flex-1 resize-none bg-transparent py-1.5 text-[1rem] leading-6 outline-none placeholder:text-muted"
            />
            {busy ? (
              <button
                type="button"
                onClick={stop}
                aria-label="Ferma la risposta"
                className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-paper"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                  <rect width="12" height="12" rx="2" fill="currentColor" />
                </svg>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                aria-label="Invia"
                className="grid size-9 shrink-0 place-items-center rounded-full bg-lapis text-paper transition-opacity disabled:opacity-30"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M8 13V3m0 0L3.5 7.5M8 3l4.5 4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>
          <p className="mt-2 text-center text-[0.75rem] text-muted">{site.disclaimer}</p>
        </form>
      </div>
    </div>
  );
}

function Assistant({ message, bySlug }: { message: Msg; bySlug: Map<string, NoteSummary> }) {
  if (message.error) {
    return (
      <p className="voice text-[1.0625rem] leading-relaxed text-muted">
        {ERRORS[message.error] ?? ERRORS.upstream}{" "}
        <Link href="/diario" className="text-lapis underline decoration-1 underline-offset-4">
          Apri il diario
        </Link>
      </p>
    );
  }

  const { clean, slugs } = splitRefs(message.content, !message.done);

  if (!clean && !message.done) {
    return (
      <p className="voice breathe text-[1.5rem] leading-none text-muted" aria-label="Sto scrivendo">
        …
      </p>
    );
  }

  const refs = slugs.map((s) => bySlug.get(s)).filter((n): n is NoteSummary => !!n);

  return (
    <div>
      <Prose>{clean}</Prose>
      {refs.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {refs.map((n) => (
            <NoteCard key={n.slug} note={n} />
          ))}
        </div>
      )}
    </div>
  );
}
