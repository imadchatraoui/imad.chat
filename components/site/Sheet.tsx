"use client";

// Il foglio: sul telefono sale dal basso (maniglia, due altezze, si chiude trascinandolo giù),
// sul desktop (≥ 900 px) è un pannello sul lato destro. È un dialogo modale: il fuoco resta dentro,
// Esc chiude, e alla chiusura il fuoco torna a chi l'aveva aperto.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { texture, useMedia } from "@/lib/media";
import { IconClose } from "./icons";
import t from "./tokens.module.css";
import s from "./Sheet.module.css";

export type SheetSnap = "half" | "full";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** id dell'intestazione che dà il nome al dialogo. */
  labelledBy?: string;
  /** In alternativa, il nome del dialogo. */
  label?: string;
  /** Cambia con il contenuto (es. "star:sirius"): il foglio torna in cima e il fuoco si riposiziona. */
  contentKey?: string;
  /** Altezza di partenza sul telefono. */
  initialSnap?: SheetSnap;
  /** Le due altezze, in frazioni dello schermo. */
  snapPoints?: readonly [number, number];
  onSnapChange?: (snap: SheetSnap) => void;
  /**
   * Quanto schermo copre il foglio quando si ferma, in px CSS: { bottom } sul telefono, { right } sul
   * desktop; zero quando è chiuso. Serve a spostare l'astrolabio (framing) perché resti visibile.
   */
  onInset?: (inset: { bottom: number; right: number }) => void;
  className?: string;
}

const DESKTOP = "(min-width: 900px)";
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
const DURATION = 460;

function useMatch(query: string): boolean {
  // il foglio si monta solo nel browser (present parte da false), quindi qui si può leggere subito
  const [match, setMatch] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function Sheet({
  open,
  onClose,
  children,
  labelledBy,
  label,
  contentKey,
  initialSnap = "half",
  snapPoints = [0.45, 0.92],
  onSnapChange,
  onInset,
  className,
}: SheetProps) {
  const desktop = useMatch(DESKTOP);
  const index = useMedia();
  // sempre false al primo render: il foglio non esiste nell'HTML del server, nasce dopo l'idratazione
  const [present, setPresent] = useState(false);
  const [snap, setSnapState] = useState<SheetSnap>(initialSnap);

  const rootRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const grabRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const onInsetRef = useRef(onInset);
  const snapRef = useRef(snap);
  const posRef = useRef(0);
  const heightRef = useRef(0);
  const closingRef = useRef<number | null>(null);
  const drag = useRef<{ id: number; startY: number; startPos: number; active: boolean; samples: { t: number; y: number }[] } | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
    onInsetRef.current = onInset;
  });

  const [half, full] = snapPoints;

  // --- geometria ---------------------------------------------------------------------------

  const geometry = useCallback(() => {
    const H = window.innerHeight;
    const height = Math.round(full * H);
    return { H, height, yFull: 0, yHalf: Math.round((full - half) * H), yClosed: height + 32 };
  }, [full, half]);

  const paint = useCallback(
    (y: number, animate: boolean) => {
      const el = sheetRef.current;
      const scrim = scrimRef.current;
      if (!el) return;
      posRef.current = y;
      const ms = animate ? (reducedMotion() ? 140 : DURATION) : 0;
      if (desktop) {
        el.style.transition = ms ? `transform ${ms}ms var(--ease-out), opacity ${ms}ms ease` : "none";
        el.style.transform = y > 0 ? "translate3d(calc(100% + 32px), 0, 0)" : "translate3d(0, 0, 0)";
        if (scrim) {
          scrim.style.transition = ms ? `opacity ${ms}ms ease` : "none";
          scrim.style.opacity = y > 0 ? "0" : "0.42";
        }
        return;
      }
      const g = geometry();
      el.style.transition = ms ? `transform ${ms}ms var(--ease-sheet)` : "none";
      el.style.transform = `translate3d(0, ${y}px, 0)`;
      if (scrim) {
        const k = Math.max(0, Math.min(1, (g.yClosed - y) / g.yClosed));
        scrim.style.transition = ms ? `opacity ${ms}ms ease` : "none";
        scrim.style.opacity = String(0.66 * k * k);
      }
    },
    [desktop, geometry],
  );

  /** Dice a chi ascolta quanto copre il foglio fermo a una posizione (o chiuso). */
  const report = useCallback(
    (y: number | "closed") => {
      const cb = onInsetRef.current;
      if (!cb) return;
      if (y === "closed") cb({ bottom: 0, right: 0 });
      else if (desktop) cb({ bottom: 0, right: y > 0 ? 0 : Math.round(sheetRef.current?.offsetWidth ?? 0) });
      else cb({ bottom: Math.max(0, Math.round(geometry().height - y)), right: 0 });
    },
    [desktop, geometry],
  );

  const setSnap = useCallback(
    (next: SheetSnap) => {
      snapRef.current = next;
      setSnapState(next);
      onSnapChange?.(next);
    },
    [onSnapChange],
  );

  const goTo = useCallback(
    (target: SheetSnap | "closed", animate = true) => {
      if (target === "closed") {
        onCloseRef.current();
        return;
      }
      const g = geometry();
      const y = target === "full" ? g.yFull : g.yHalf;
      setSnap(target);
      paint(y, animate);
      report(y);
    },
    [geometry, paint, setSnap, report],
  );

  // --- apertura e chiusura -------------------------------------------------------------------

  useEffect(() => {
    if (open) {
      if (closingRef.current) {
        // riaperto mentre si chiudeva: torna dov'era
        window.clearTimeout(closingRef.current);
        closingRef.current = null;
        if (present) {
          const g = geometry();
          const y = desktop ? 0 : snapRef.current === "full" ? g.yFull : g.yHalf;
          paint(y, true);
          report(y);
        }
      }
      if (!present) {
        restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setPresent(true);
      }
    } else if (present && !closingRef.current) {
      const g = geometry();
      paint(desktop ? 1 : g.yClosed, true);
      report("closed");
      closingRef.current = window.setTimeout(() => {
        closingRef.current = null;
        setPresent(false);
        const back = restoreRef.current;
        restoreRef.current = null;
        if (back && back.isConnected) back.focus({ preventScroll: true });
      }, reducedMotion() ? 150 : DURATION);
    }
  }, [open, present, desktop, geometry, paint, report]);

  // al montaggio: parte da fuori e scivola dentro
  useLayoutEffect(() => {
    if (!present || !open) return;
    const g = geometry();
    const el = sheetRef.current;
    if (!el) return;
    el.style.height = desktop ? "" : `${g.height}px`;
    paint(desktop ? 1 : g.yClosed, false);
    const startSnap = initialSnap;
    setSnap(startSnap);
    const raf = requestAnimationFrame(() => {
      // un frame dopo, così la transizione parte dalla posizione chiusa
      void el.offsetHeight;
      const y = desktop ? 0 : startSnap === "full" ? g.yFull : g.yHalf;
      paint(y, true);
      report(y);
      el.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [present]);

  // cambio di modo (telefono / desktop) o di dimensione mentre è aperto
  useEffect(() => {
    if (!present) return;
    const relayout = () => {
      const el = sheetRef.current;
      if (!el || !open) return;
      const g = geometry();
      el.style.height = desktop ? "" : `${g.height}px`;
      const y = desktop ? 0 : snapRef.current === "full" ? g.yFull : g.yHalf;
      paint(y, false);
      report(y);
    };
    relayout();
    window.addEventListener("resize", relayout);
    return () => window.removeEventListener("resize", relayout);
  }, [present, desktop, open, geometry, paint, report]);

  // contenuto nuovo: torna in cima e porta il fuoco al dialogo
  useEffect(() => {
    if (!present || !open) return;
    const c = contentRef.current;
    if (c) c.scrollTop = 0;
    sheetRef.current?.focus({ preventScroll: true });
  }, [contentKey, present, open]);

  // Esc chiude, Tab resta dentro
  useEffect(() => {
    if (!present || !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const root = sheetRef.current;
      if (!root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (!items.length) {
        e.preventDefault();
        root.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!root.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || active === root)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [present, open]);

  // --- trascinamento (solo telefono) ---------------------------------------------------------

  const beginDrag = useCallback((id: number, y: number) => {
    drag.current = { id, startY: y, startPos: posRef.current, active: false, samples: [{ t: performance.now(), y }] };
  }, []);

  const moveDrag = useCallback(
    (y: number): boolean => {
      const d = drag.current;
      if (!d) return false;
      const dy = y - d.startY;
      if (!d.active) {
        if (Math.abs(dy) < 6) return false;
        d.active = true;
      }
      let pos = d.startPos + dy;
      if (pos < 0) pos = -Math.sqrt(-pos) * 3; // oltre l'altezza massima, resiste
      paint(pos, false);
      const now = performance.now();
      d.samples.push({ t: now, y });
      while (d.samples.length > 2 && now - d.samples[0].t > 90) d.samples.shift();
      return true;
    },
    [paint],
  );

  const endDrag = useCallback(() => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.active) return;
    const a = d.samples[0];
    const b = d.samples[d.samples.length - 1];
    const v = b.t > a.t ? (b.y - a.y) / (b.t - a.t) : 0; // px/ms, positivo verso il basso
    const g = geometry();
    const y = posRef.current;
    const proj = y + v * 200;
    if (proj > g.yHalf + 0.34 * (g.yClosed - g.yHalf)) {
      // dall'altezza massima un colpo deciso si ferma a metà; più in basso chiude
      if (y < g.yHalf * 0.55 && v < 2.2) goTo("half");
      else goTo("closed");
    } else if (proj < g.yHalf / 2) goTo("full");
    else goTo("half");
  }, [geometry, goTo]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (desktop || e.button !== 0) return;
    const target = e.target as Node;
    const inGrab = grabRef.current?.contains(target);
    const inContent = contentRef.current?.contains(target) && snapRef.current === "half";
    if (!inGrab && !inContent) return;
    beginDrag(e.pointerId, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const wasActive = d.active;
    if (moveDrag(e.clientY) && !wasActive) {
      try {
        sheetRef.current?.setPointerCapture(e.pointerId);
      } catch {
        // il puntatore è già andato
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const moved = d.active;
    endDrag();
    if (moved) {
      // un trascinamento non è un tocco: il clic che segue non deve aprire nulla
      const swallow = (ev: Event) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      window.addEventListener("click", swallow, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
    }
  };

  // all'altezza massima il contenuto scorre; tirandolo giù quando è in cima, si trascina il foglio
  useEffect(() => {
    const el = contentRef.current;
    if (!present || desktop || !el) return;
    let startY = 0;
    let startTop = 0;
    let decided = false;
    let pulling = false;
    const onStart = (e: TouchEvent) => {
      if (snapRef.current !== "full" || e.touches.length !== 1) return;
      startY = e.touches[0].clientY;
      startTop = el.scrollTop;
      decided = false;
      pulling = false;
    };
    const onMove = (e: TouchEvent) => {
      if (snapRef.current !== "full" || e.touches.length !== 1) return;
      const y = e.touches[0].clientY;
      if (!decided) {
        const dy = y - startY;
        if (Math.abs(dy) < 4) return;
        decided = true;
        pulling = dy > 0 && startTop <= 0 && el.scrollTop <= 0;
        if (pulling) beginDrag(-1, startY);
      }
      if (pulling) {
        e.preventDefault();
        moveDrag(y);
      }
    };
    const onEnd = () => {
      if (pulling) endDrag();
      pulling = false;
      decided = false;
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [present, desktop, beginDrag, moveDrag, endDrag]);

  if (!present) return null;

  const tex = texture("T05", index);
  const style = tex ? ({ "--sheet-tex": `url(${tex})` } as CSSProperties) : undefined;

  return (
    <div ref={rootRef} className={`${t.vars} ${s.root} ${className ?? ""}`} data-mode={desktop ? "panel" : "sheet"}>
      <div ref={scrimRef} className={s.scrim} onClick={() => onCloseRef.current()} aria-hidden="true" />
      <div
        ref={sheetRef}
        className={s.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        tabIndex={-1}
        data-snap={snap}
        data-tex={tex ? "" : undefined}
        style={style}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div ref={grabRef} className={s.grab}>
          {!desktop ? (
            <button
              type="button"
              className={`${t.button} ${s.handle}`}
              aria-label={snap === "half" ? "Apri il foglio a tutta altezza" : "Riduci il foglio a metà"}
              onClick={() => goTo(snap === "half" ? "full" : "half")}
            >
              <span className={s.handleBar} aria-hidden="true" />
            </button>
          ) : null}
          <button type="button" className={`${t.button} ${s.close}`} aria-label="Chiudi" onClick={() => onCloseRef.current()}>
            <IconClose size={22} />
          </button>
        </div>
        <div ref={contentRef} className={s.content}>
          <div key={contentKey} className={s.body}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
