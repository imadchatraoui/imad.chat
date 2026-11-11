"use client";

// Il mushaf: un libro chiuso in un angolo dello schermo. Un tocco lo apre (vola al centro e la copertina
// gira sul dorso, a destra, come in ogni mushaf); si sfoglia da destra a sinistra trascinando la pagina,
// toccando gli angoli in basso, con le frecce o con i puntini. Ogni pagina ha un bottone che agisce
// sull'astrolabio: il libro si richiude, e un segnalibro riporta alla stessa pagina.
//
// Accessibilità: dialogo modale (il fuoco resta dentro e torna al libro dopo), Esc chiude, ← e →
// sfogliano (← va avanti, come in un libro che si legge da destra), etichette in italiano, l'arabo
// con lang="ar" dir="rtl". Con "riduci movimento" tutto diventa una dissolvenza.
//
// Le animazioni sono fatte a mano (Web Animations e stili in linea), fuori dal ciclo di React: React
// decide quali pagine esistono e che ruolo hanno (data-part), motion.ts le muove.

import { useCallback, useEffect, useEffectEvent, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { flushSync } from "react-dom";
import { quranFont, warmQuranFont } from "./fonts";
import { animateFrames, animatePath, applyFrame, clearFrame, dragProgress, flight, settled, type TurnGeo } from "./motion";
import { buildPages, pageIndexOf, type QuranPageData } from "./pages";
import QuranPage from "./QuranPage";
import type { QuranBookProps } from "./types";
import s from "./QuranBook.module.css";

type Phase = "closed" | "opening" | "open" | "closing";
type Mode = "spread" | "single";
type SlotSide = "left" | "right" | "single";
type SlotPart = "rest" | "front" | "back" | "under-in" | "under-out";

interface Turn {
  dir: 1 | -1;
  /** vista di partenza e d'arrivo: la doppia pagina (spread) o la pagina (single) */
  from: number;
  to: number;
  /** la pagina da ricordare all'arrivo */
  toPage: number;
  /** guidato dal dito */
  drag?: boolean;
  /** solo un accenno, la prima volta: la pagina si alza un poco e torna giù */
  peek?: boolean;
}

interface Slot {
  key: string;
  index: number | null;
  side: SlotSide;
  part: SlotPart;
}

interface DragState {
  id: number;
  x0: number;
  y0: number;
  decided: boolean;
  dir: 1 | -1;
  edge: boolean;
  p: number;
  geo: TurnGeo | null;
  width: number;
  samples: { t: number; x: number }[];
}

const SPREAD_QUERY = "(min-width: 860px) and (min-height: 540px)";
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

const EASE_TURN = "cubic-bezier(0.45, 0.05, 0.22, 1)";
const EASE_FLY_IN = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const EASE_FLY_OUT = "cubic-bezier(0.55, 0, 0.3, 1)";
const EASE_SETTLE = "cubic-bezier(0.25, 0.8, 0.3, 1)";

/** Quanto si alza la pagina nell'accenno. */
const PEEK = 0.13;
/** L'accenno si fa una volta per visita. */
let peekDone = false;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function geoFor(mode: Mode, dir: 1 | -1, reduced: boolean): TurnGeo {
  if (reduced) return { kind: "fade" };
  return mode === "spread" ? { kind: "spread", dir } : { kind: "single", dir };
}

/** Le pagine da mostrare e il ruolo di ognuna, in ordine di indice (così i nodi non si spostano). */
function slotsFor(mode: Mode, view: number, count: number, turn: Turn | null, phase: Phase, reduced: boolean): Slot[] {
  const slot = (i: number, side: SlotSide, part: SlotPart): Slot => {
    const ok = i >= 0 && i < count;
    return { key: ok ? `p${i}` : `blank-${side}`, index: ok ? i : null, side, part };
  };
  const covering = (phase === "opening" || phase === "closing") && !reduced;
  let out: Slot[];
  if (mode === "spread") {
    const R = (v: number) => 2 * v;
    const L = (v: number) => 2 * v + 1;
    if (covering) out = [slot(R(view), "right", "back"), slot(L(view), "left", "under-in")];
    else if (turn && reduced)
      out = [slot(R(turn.from), "right", "front"), slot(L(turn.from), "left", "front"), slot(R(turn.to), "right", "under-in"), slot(L(turn.to), "left", "under-in")];
    else if (turn && turn.dir === 1)
      out = [slot(R(turn.from), "right", "under-out"), slot(L(turn.from), "left", "front"), slot(R(turn.to), "right", "back"), slot(L(turn.to), "left", "under-in")];
    else if (turn)
      out = [slot(R(turn.from), "right", "front"), slot(L(turn.from), "left", "under-out"), slot(R(turn.to), "right", "under-in"), slot(L(turn.to), "left", "back")];
    else out = [slot(R(view), "right", "rest"), slot(L(view), "left", "rest")];
    // due pagine bianche dallo stesso lato non possono esistere insieme (chiave unica)
    const seen = new Set<string>();
    out = out.filter((x) => (seen.has(x.key) ? false : (seen.add(x.key), true)));
  } else if (covering) out = [slot(view, "single", "under-in")];
  else if (turn && (reduced || turn.dir === 1)) out = [slot(turn.from, "single", "front"), slot(turn.to, "single", "under-in")];
  else if (turn) out = [slot(turn.from, "single", "under-out"), slot(turn.to, "single", "front")];
  else out = [slot(view, "single", "rest")];
  return out.sort((a, b) => (a.index ?? 1e6) - (b.index ?? 1e6));
}

function focusablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest("[inert]") && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden",
  );
}

function pageName(p: QuranPageData | undefined): string {
  return p ? `${p.verse.surahName}, ${p.ref}` : "";
}

export default function QuranBook({ verses, onAction, open, onOpenChange, initialKey, className, onEvent }: QuranBookProps) {
  const pages = useMemo(() => buildPages(verses), [verses]);
  const count = pages.length;

  const wide = useMediaQuery(SPREAD_QUERY);
  const reduced = useMediaQuery(REDUCED_QUERY);
  const mode: Mode = wide ? "spread" : "single";

  const [page, setPage] = useState(() => pageIndexOf(pages, initialKey));
  // initialKey è anche un comando: se cambia, il libro va a quella pagina
  const [seenKey, setSeenKey] = useState(initialKey);
  if (initialKey !== seenKey) {
    setSeenKey(initialKey);
    if (initialKey) setPage(pageIndexOf(pages, initialKey));
  }

  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const [phase, setPhase] = useState<Phase>("closed");
  const [turn, setTurn] = useState<Turn | null>(null);
  const [bookmark, setBookmark] = useState<number | null>(null);
  const [pill, setPill] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const safePage = count ? Math.min(Math.max(page, 0), count - 1) : 0;
  const viewCount = mode === "spread" ? Math.ceil(count / 2) : count;
  const view = mode === "spread" ? Math.floor(safePage / 2) : safePage;
  const viewPages = useMemo(() => (mode === "spread" ? [2 * view, 2 * view + 1] : [view]).filter((i) => i < count), [mode, view, count]);
  const pageOfView = useCallback((v: number) => (mode === "spread" ? 2 * v : v), [mode]);

  const uid = useId().replace(/:/g, "");
  const dialogId = `${uid}-dialog`;
  const titleId = `${uid}-title`;
  const hintId = `${uid}-hint`;

  const rootRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLButtonElement>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<HTMLElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);

  // lo stato più recente, per i gestori che vivono fuori dal render
  const live = useRef({ phase, turn, view, viewCount, mode, reduced, pageOfView });
  useLayoutEffect(() => {
    live.current = { phase, turn, view, viewCount, mode, reduced, pageOfView };
  });

  const running = useRef<Animation[]>([]);
  const pending = useRef<{ view: number; page?: number } | null>(null);
  const drag = useRef<DragState | null>(null);
  const raf = useRef(0);
  const suppressClick = useRef(false);
  const fastClose = useRef(false);
  const peekTimer = useRef<number | null>(null);

  // --- aprire e chiudere -------------------------------------------------------------------------

  const requestOpen = useCallback(
    (next: boolean) => {
      if (open === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [open, onOpenChange],
  );

  // l'ultima versione dei callback, per i gestori che vivono fuori dal render
  const onEventRef = useRef(onEvent);
  useLayoutEffect(() => {
    onEventRef.current = onEvent;
  });
  const emit = useCallback((name: "open" | "close" | "turn") => onEventRef.current?.(name), []);

  useEffect(() => {
    if (isOpen && phase === "closed") {
      setPhase("opening");
      emit("open");
    } else if (!isOpen && phase === "open") {
      drag.current = null;
      setTurn(null);
      setPhase("closing");
      emit("close");
    } else if ((!isOpen && phase === "opening") || (isOpen && phase === "closing")) {
      // cambio di idea a metà: si finisce subito il movimento in corso, poi si torna indietro
      running.current.forEach((a) => a.finish());
    }
  }, [isOpen, phase]);

  // la pagina sotto non scorre mentre il libro è aperto
  useEffect(() => {
    if (phase === "closed") return;
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = before;
    };
  }, [phase === "closed"]); // eslint-disable-line react-hooks/exhaustive-deps

  // il carattere del Corano si scarica quando il browser è libero
  useEffect(() => {
    const sample = pages.map((p) => p.verse.ar).join(" ");
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => void warmQuranFont(sample), { timeout: 4000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(() => void warmQuranFont(sample), 2000);
    return () => window.clearTimeout(t);
  }, [pages]);

  const warmNow = useCallback(() => void warmQuranFont(pages.map((p) => p.verse.ar).join(" ")), [pages]);

  // il cartellino «torna al versetto» resta un po', poi rimane solo il segnalibro
  useEffect(() => {
    if (!pill) return;
    const t = window.setTimeout(() => setPill(false), 14000);
    return () => window.clearTimeout(t);
  }, [pill]);

  const describe = useCallback(
    (v: number, m: Mode) => {
      if (m === "spread") {
        const a = pages[2 * v];
        const b = pages[2 * v + 1];
        return b ? `Pagine ${2 * v + 1} e ${2 * v + 2} di ${count}: ${pageName(a)}; ${pageName(b)}` : `Pagina ${2 * v + 1} di ${count}: ${pageName(a)}`;
      }
      return `Pagina ${v + 1} di ${count}: ${pageName(pages[v])}`;
    },
    [pages, count],
  );

  const schedulePeek = useEffectEvent(() => {
    if (peekDone || reduced || view + 1 >= viewCount) return;
    peekDone = true;
    peekTimer.current = window.setTimeout(() => {
      peekTimer.current = null;
      startTurn(view + 1, { peek: true });
    }, 420);
  });

  useLayoutEffect(() => {
    if (phase !== "opening") return;
    const dialog = dialogRef.current;
    const book = bookRef.current;
    const backdrop = backdropRef.current;
    if (!dialog || !book || !backdrop) return;
    dialog.focus({ preventScroll: true });

    const chrome = [topRef.current, dotsRef.current].filter((x): x is HTMLElement => !!x);
    const cover = coverRef.current;
    const dock = anchorRef.current?.getBoundingClientRect();
    const f = !reduced && cover && dock ? flight(book.getBoundingClientRect(), cover.getBoundingClientRect(), dock) : null;
    const geo = geoFor(mode, 1, false);
    let anims: Animation[];
    if (!f) {
      if (!reduced) applyFrame(book, geo, 1);
      anims = [dialog.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reduced ? 200 : 260, easing: "ease-out", fill: "both" })];
    } else {
      book.style.transformOrigin = f.origin;
      const turnMs = mode === "spread" ? 760 : 620;
      anims = [
        backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, easing: "ease-out", fill: "both" }),
        book.animate([{ transform: f.transform }, { transform: "none" }], { duration: 460, easing: EASE_FLY_IN, fill: "both" }),
        ...animateFrames(book, geo, 0, 1, { duration: turnMs, delay: 320, easing: EASE_TURN, fill: "both" }),
        ...chrome.map((el) => el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 320 + turnMs - 160, easing: "ease-out", fill: "both" })),
      ];
    }
    running.current = anims;
    let alive = true;
    void settled(anims).then((ok) => {
      if (!alive || !ok) return;
      flushSync(() => {
        setPhase("open");
        setAnnouncement(describe(live.current.view, live.current.mode));
      });
      schedulePeek();
    });
    return () => {
      alive = false;
      anims.forEach((a) => a.cancel());
      running.current = [];
      book.style.transformOrigin = "";
      clearFrame(book);
    };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (phase !== "closing") return;
    const dialog = dialogRef.current;
    const book = bookRef.current;
    const backdrop = backdropRef.current;
    if (!dialog || !book || !backdrop) return;
    if (peekTimer.current) window.clearTimeout(peekTimer.current);

    const fast = fastClose.current;
    fastClose.current = false;
    const chrome = [topRef.current, dotsRef.current].filter((x): x is HTMLElement => !!x);
    const cover = coverRef.current;
    const dock = anchorRef.current?.getBoundingClientRect();
    const f = !reduced && cover && dock ? flight(book.getBoundingClientRect(), cover.getBoundingClientRect(), dock) : null;
    const geo = geoFor(mode, 1, false);
    let anims: Animation[];
    if (!f) {
      if (!reduced) applyFrame(book, geo, 1);
      anims = [dialog.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduced ? 180 : 220, easing: "ease-in", fill: "both" })];
    } else {
      book.style.transformOrigin = f.origin;
      const turnMs = mode === "spread" ? 600 : 460;
      const flyAt = turnMs - 90;
      anims = [
        ...chrome.map((el) => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: "ease-out", fill: "both" })),
        ...animateFrames(book, geo, 1, 0, { duration: turnMs, easing: EASE_TURN, fill: "both" }),
        book.animate([{ transform: "none" }, { transform: f.transform }], { duration: 420, delay: flyAt, easing: EASE_FLY_OUT, fill: "both" }),
        backdrop.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: fast ? 380 : 420,
          delay: fast ? 0 : flyAt - 60,
          easing: "ease-in-out",
          fill: "both",
        }),
      ];
    }
    running.current = anims;
    let alive = true;
    void settled(anims).then((ok) => {
      if (!alive || !ok) return;
      flushSync(() => setPhase("closed"));
      dockRef.current?.focus({ preventScroll: true });
    });
    return () => {
      alive = false;
      anims.forEach((a) => a.cancel());
      running.current = [];
      book.style.transformOrigin = "";
      clearFrame(book);
    };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback(
    (viaAction = false) => {
      fastClose.current = viaAction;
      requestOpen(false);
    },
    [requestOpen],
  );

  // --- sfogliare ----------------------------------------------------------------------------------

  const finishTurn = useCallback(
    (to: { view: number; page: number } | null) => {
      const before = live.current.view;
      flushSync(() => {
        if (to) setPage(to.page);
        setTurn(null);
      });
      running.current.forEach((a) => a.cancel());
      running.current = [];
      clearFrame(bookRef.current);
      if (to && to.view !== before) setAnnouncement(describe(to.view, live.current.mode));
      // il fuoco era su una pagina che non c'è più: torna al libro
      const dialog = dialogRef.current;
      if (dialog && !dialog.contains(document.activeElement)) dialog.focus({ preventScroll: true });
      const next = pending.current;
      pending.current = null;
      if (next) startTurnRef.current(next.view, { page: next.page });
    },
    [describe],
  );

  const startTurn = useCallback(
    (toView: number, opts: { page?: number; peek?: boolean } = {}) => {
      const { phase: ph, turn: current, view: from, viewCount: vc, pageOfView: pv } = live.current;
      if (ph !== "open" || toView < 0 || toView >= vc) return;
      if (current) {
        if (opts.peek) return;
        // un giro alla volta: il prossimo aspetta, e quello in corso accelera
        pending.current = { view: toView, page: opts.page };
        running.current.forEach((a) => a.updatePlaybackRate(current.peek ? 4 : 2.2));
        return;
      }
      if (toView === from) {
        if (opts.page !== undefined) setPage(opts.page);
        return;
      }
      if (!opts.peek) emit("turn");
      setTurn({ dir: toView > from ? 1 : -1, from, to: toView, toPage: opts.page ?? pv(toView), peek: opts.peek });
    },
    [emit],
  );
  const startTurnRef = useRef(startTurn);
  useLayoutEffect(() => {
    startTurnRef.current = startTurn;
  });

  /** Avanti (+1) o indietro (−1), contando anche i giri già in coda. */
  const go = useCallback(
    (dir: 1 | -1) => {
      const base = pending.current?.view ?? live.current.turn?.to ?? live.current.view;
      const target = live.current.turn?.peek ? live.current.view + dir : base + dir;
      startTurn(target);
    },
    [startTurn],
  );

  const goToPage = useCallback(
    (i: number) => {
      const v = live.current.mode === "spread" ? Math.floor(i / 2) : i;
      startTurn(v, { page: i });
    },
    [startTurn],
  );

  // giri automatici (angoli, frecce, puntini, accenno): React ha già messo le pagine, qui si muovono
  useLayoutEffect(() => {
    if (!turn || turn.drag) return;
    const book = bookRef.current;
    if (!book) return;
    const geo = geoFor(mode, turn.dir, reduced);
    const anims = turn.peek
      ? animatePath(book, geo, (t) => PEEK * Math.pow(Math.sin(Math.PI * t), 1.15), { duration: 1150, easing: "linear", fill: "both" })
      : animateFrames(book, geo, 0, 1, { duration: reduced ? 240 : mode === "spread" ? 720 : 560, easing: reduced ? "ease-in-out" : EASE_TURN, fill: "both" });
    running.current = anims;
    let alive = true;
    void settled(anims).then((ok) => {
      if (alive && ok) finishTurn(turn.peek ? null : { view: turn.to, page: turn.toPage });
    });
    return () => {
      alive = false;
      anims.forEach((a) => a.cancel());
      clearFrame(book);
    };
  }, [turn]); // eslint-disable-line react-hooks/exhaustive-deps

  // se cambia la forma del libro (telefono girato, finestra stretta) un giro a metà si annulla
  useEffect(() => {
    if (!live.current.turn) return;
    running.current.forEach((a) => a.cancel());
    running.current = [];
    drag.current = null;
    setTurn(null);
    clearFrame(bookRef.current);
  }, [mode]);

  // --- il dito sulla pagina ---------------------------------------------------------------------

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    suppressClick.current = false;
    if (live.current.phase !== "open") return;
    if (e.pointerType === "mouse") {
      // col mouse si afferra l'angolo; il resto della pagina resta testo da selezionare
      if (e.button !== 0 || !(e.target as Element).closest("[data-corner]")) return;
    }
    const t = live.current.turn;
    if (t && !t.peek) return;
    if (t?.peek) running.current.forEach((a) => a.finish());
    const pageEl = bookRef.current?.querySelector<HTMLElement>("[data-part]");
    drag.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      decided: false,
      dir: 1,
      edge: false,
      p: 0,
      geo: null,
      width: pageEl?.getBoundingClientRect().width || 360,
      samples: [{ t: e.timeStamp, x: e.clientX }],
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const book = bookRef.current;
    if (!d || d.id !== e.pointerId || !book) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.decided) {
      if (Math.hypot(dx, dy) < 10) return;
      // in verticale è lo scorrimento della pagina: non è affar nostro
      if (Math.abs(dx) < Math.abs(dy) * 1.2 || live.current.turn) {
        drag.current = null;
        return;
      }
      d.decided = true;
      // il libro si legge da destra: il dito verso destra porta avanti
      d.dir = dx > 0 ? 1 : -1;
      suppressClick.current = true;
      try {
        book.setPointerCapture(e.pointerId);
      } catch {
        /* il puntatore può essere già sparito */
      }
      const { view: v, viewCount: vc, mode: m, reduced: r, pageOfView: pv } = live.current;
      const target = v + d.dir;
      if (target < 0 || target >= vc) d.edge = true;
      else {
        d.geo = geoFor(m, d.dir, r);
        flushSync(() => setTurn({ dir: d.dir, from: v, to: target, toPage: pv(target), drag: true }));
        emit("turn");
      }
    }
    d.samples.push({ t: e.timeStamp, x: e.clientX });
    if (d.samples.length > 6) d.samples.shift();
    if (d.edge) {
      // non c'è niente da quella parte: il libro resiste un poco
      book.style.transform = `translateX(${(Math.sign(dx) * Math.min(26, Math.abs(dx) * 0.16)).toFixed(1)}px)`;
      return;
    }
    const geo = d.geo;
    if (!geo) return;
    d.p = dragProgress(geo, Math.max(0, dx * d.dir), d.width);
    if (!raf.current) {
      // il primo fotogramma subito (le pagine nuove non devono comparire piatte), poi uno per frame
      applyFrame(book, geo, d.p);
      raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        const dd = drag.current;
        if (dd?.geo && bookRef.current) applyFrame(bookRef.current, dd.geo, dd.p);
      });
    }
  };

  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const book = bookRef.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (raf.current) {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    }
    if (!d.decided || !book) return;
    if (d.edge) {
      const from = book.style.transform || "none";
      book.style.transform = "";
      book.animate([{ transform: from }, { transform: "none" }], { duration: 280, easing: EASE_SETTLE });
      return;
    }
    const t = live.current.turn;
    if (!d.geo || !t) return;
    applyFrame(book, d.geo, d.p);
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const v = last.t > first.t ? ((last.x - first.x) / (last.t - first.t)) * d.dir : 0;
    const complete = e.type !== "pointercancel" && (d.p > 0.34 || (v > 0.3 && d.p > 0.03));
    const target = complete ? 1 : 0;
    const rest = Math.abs(target - d.p);
    const anims = animateFrames(book, d.geo, d.p, target, {
      duration: Math.round(140 + (live.current.mode === "spread" ? 520 : 400) * rest),
      easing: EASE_SETTLE,
      fill: "both",
    });
    running.current = anims;
    void settled(anims).then((ok) => {
      if (ok) finishTurn(complete ? { view: t.to, page: t.toPage } : null);
    });
  };

  const onClickCapture = (e: ReactMouseEvent) => {
    // dopo un trascinamento il clic che segue non vale
    if (suppressClick.current) {
      suppressClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // --- tastiera e fuoco ----------------------------------------------------------------------------

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const dialog = dialogRef.current;
    if (!dialog || e.defaultPrevented) return;
    if (e.key === "Escape") {
      e.preventDefault();
      if (phase === "opening" || phase === "open") close();
      return;
    }
    if (e.key === "Tab") {
      const items = focusablesIn(dialog);
      const active = document.activeElement as HTMLElement | null;
      if (!items.length) {
        e.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (!active || !dialog.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && (active === first || active === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
      return;
    }
    if (phase !== "open" || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      startTurn(0);
    } else if (e.key === "End") {
      e.preventDefault();
      startTurn(viewCount - 1);
    }
  });

  useEffect(() => {
    if (phase === "closed") return;
    const handler = (e: KeyboardEvent) => onKey(e);
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [phase === "closed"]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      if (peekTimer.current) window.clearTimeout(peekTimer.current);
      if (raf.current) cancelAnimationFrame(raf.current);
    },
    [],
  );

  // --- azioni ----------------------------------------------------------------------------------------

  const fire = useCallback(
    (p: QuranPageData) => {
      if (!p.meta || live.current.phase !== "open") return;
      setPage(p.index);
      setBookmark(p.index);
      setPill(true);
      onAction?.(p.meta.action);
      close(true);
    },
    [onAction, close],
  );

  const openBook = useCallback(() => {
    warmNow();
    setPill(false);
    if (bookmark !== null) setPage(bookmark);
    requestOpen(true);
  }, [warmNow, bookmark, requestOpen]);

  // --- disegno ----------------------------------------------------------------------------------------

  const slots = phase === "closed" ? [] : slotsFor(mode, view, count, turn, phase, reduced);
  const showCover = (phase === "opening" || phase === "closing") && !reduced;
  const canNext = view + 1 < viewCount;
  const canPrev = view > 0;
  const marked = bookmark !== null ? pages[bookmark] : undefined;
  const dockLabel = marked ? `Riapri il Corano alla pagina di ${pageName(marked)}` : "Apri il Corano: versetti sul cielo";

  return (
    <div ref={rootRef} className={`${s.root} ${quranFont.variable}${className ? ` ${className}` : ""}`} lang="it" data-q-root="">
      <div className={s.dock} data-hidden={phase !== "closed" ? "" : undefined}>
        {pill && marked ? (
          <button type="button" className={s.pill} onClick={openBook} aria-label={`Torna alla pagina di ${pageName(marked)}`}>
            <svg viewBox="0 0 20 20" aria-hidden="true" className={s.pillIcon}>
              <path d="M8 5 4 9l4 4M4.5 9H12a4 4 0 0 1 0 8h-1.5" />
            </svg>
            <span>Torna a {marked.verse.surahName}</span>
          </button>
        ) : null}
        <button
          ref={dockRef}
          type="button"
          className={s.dockBook}
          aria-label={dockLabel}
          aria-haspopup="dialog"
          aria-expanded={phase !== "closed"}
          aria-controls={phase !== "closed" ? dialogId : undefined}
          onClick={openBook}
          onPointerEnter={warmNow}
          onFocus={warmNow}
          data-marked={marked ? "" : undefined}
        >
          <span className={s.dockBack} aria-hidden="true" />
          <span className={s.dockBlock} aria-hidden="true" />
          <span ref={anchorRef} className={s.dockAnchor} aria-hidden="true">
            <span className={`${s.coverArt} ${s.dockCover}`} />
          </span>
          <span className={s.ribbon} aria-hidden="true" />
        </button>
      </div>

      {phase !== "closed" ? (
        <div
          ref={dialogRef}
          id={dialogId}
          className={s.dialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          data-mode={mode}
          data-phase={phase}
        >
          <div ref={backdropRef} className={s.backdrop} onClick={() => close()} />

          <div ref={topRef} className={s.top}>
            <h2 id={titleId} className={s.title}>
              Il cielo nel Corano
            </h2>
            <button type="button" className={s.close} onClick={() => close()} aria-label="Chiudi il Corano">
              <span>Chiudi</span>
              <svg viewBox="0 0 16 16" aria-hidden="true" className={s.closeIcon}>
                <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
              </svg>
            </button>
          </div>

          <div
            className={s.stage}
            onClick={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
            <div
              ref={bookRef}
              className={s.book}
              data-mode={mode}
              data-turning={turn ? "" : undefined}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
              onClickCapture={onClickCapture}
            >
              {slots.map((sl) => {
                // le pagine della vista di partenza restano vive durante il giro; le nuove lo diventano all'arrivo
                const active = turn ? (mode === "spread" ? [2 * turn.from, 2 * turn.from + 1] : [turn.from]) : viewPages;
                const current = sl.index !== null && active.includes(sl.index);
                return (
                  <div
                    key={sl.key}
                    className={s.slot}
                    data-side={sl.side}
                    data-part={sl.part}
                    inert={!current || phase !== "open"}
                    aria-hidden={!current || undefined}
                  >
                    {sl.index === null ? <div className={s.blank} /> : <QuranPage page={pages[sl.index]} idBase={uid} actionHintId={hintId} onAction={fire} />}
                    <div className={s.shade} data-shade="" />
                  </div>
                );
              })}

              {showCover ? (
                <div ref={coverRef} className={s.cover} data-side={mode === "spread" ? "left" : "single"} data-part="front" aria-hidden="true">
                  <div className={s.coverArt} />
                  <div className={s.shade} data-shade="" />
                </div>
              ) : null}

              {phase === "open" && canNext ? (
                <button
                  type="button"
                  className={s.corner}
                  data-corner="next"
                  aria-label={`Pagina successiva: ${pageName(pages[pageOfView(view + 1)])}`}
                  onClick={() => go(1)}
                />
              ) : null}
              {phase === "open" && canPrev ? (
                <button
                  type="button"
                  className={s.corner}
                  data-corner="prev"
                  aria-label={`Pagina precedente: ${pageName(pages[pageOfView(view - 1)])}`}
                  onClick={() => go(-1)}
                />
              ) : null}
            </div>
          </div>

          <nav ref={dotsRef} className={s.dots} aria-label="Indice delle pagine" data-mode={mode} dir="rtl">
            {pages.map((p, i) => {
              const here = viewPages.includes(i);
              return (
                <button
                  key={p.verse.key}
                  type="button"
                  className={s.dot}
                  aria-label={`Pagina ${i + 1} di ${count}: ${pageName(p)}`}
                  aria-current={here ? "page" : undefined}
                  data-current={here ? "" : undefined}
                  onClick={() => goToPage(i)}
                >
                  <span />
                </button>
              );
            })}
          </nav>

          <p className={s.srOnly} aria-live="polite" aria-atomic="true">
            {announcement}
          </p>
          <p id={hintId} hidden>
            Chiude il libro e mostra il cielo sull’astrolabio.
          </p>
        </div>
      ) : null}
    </div>
  );
}
