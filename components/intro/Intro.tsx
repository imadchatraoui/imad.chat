'use client';

/*
 * <Intro /> — the first impression of imad.chat: "hello, world" is typed, "world" evaporates into
 * stars, "imad’s world" condenses out of them in gold, and the astrolabe's limb scale is engraved
 * around it, ready to hand off to the 3D astrolabe.
 *
 *   <Intro
 *     targetRect={{ cx, cy, r }}          // the astrolabe's limb, CSS px (getLimbScreenCircle());
 *                                         // default: centre, r = min(w, h) · 0.42
 *     onEvent={(name) => playSound(name)} // 'type' | 'backspace' | 'dissolve' | 'condense' | 'circle'
 *     onDone={() => showAstrolabe()}      // once: when the limb closes, 400 ms after a skip, or on failure
 *     skip={returningVisitor}             // true: final state (immediately at mount, crossfade later)
 *   />
 *
 * Fonts come from the CSS variables --font-mono-intro and --font-serif-intro (set with next/font
 * on an ancestor; --font-newsreader is the serif's second choice); the canvas waits for them up to
 * 3 s, then plays in local faces and swaps the real ones in once it is safe. Tap, click or any key
 * skips to the final state; prefers-reduced-motion shows the final frame and hands over at once.
 * The root is fixed and covers the viewport by default (override with className / style);
 * targetRect is relative to it. After onDone the root stops intercepting pointer events and the
 * engine winds down by itself (the sky settles, then rendering stops): fade the intro out and
 * unmount it once the astrolabe has taken over.
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { IntroEngine, type IntroEventName, type IntroTargetRect } from './engine';

export type { IntroEventName, IntroTargetRect };

export interface IntroProps {
  onDone?: () => void;
  targetRect?: IntroTargetRect;
  skip?: boolean;
  onEvent?: (name: IntroEventName) => void;
  className?: string;
  style?: CSSProperties;
  /** Element of the screen-reader title. Use 'p' when the page renders its own h1. Default 'h1'. */
  headingAs?: 'h1' | 'p';
}

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Fn', 'OS']);
/** Visible seconds after which the intro is skipped, then handed over whatever its state. */
const WATCHDOG_SKIP_S = 12;
const WATCHDOG_ABORT_S = 15;

/** Half-pixel rounding: sub-pixel jitter of the target never re-lays out the intro. */
const half = (x: number | undefined) => (x == null || !Number.isFinite(x) ? undefined : Math.round(x * 2) / 2);

export default function Intro({
  onDone,
  targetRect,
  skip = false,
  onEvent,
  className,
  style,
  headingAs = 'h1',
}: IntroProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<IntroEngine | null>(null);
  const onDoneRef = useRef(onDone);
  const onEventRef = useRef(onEvent);
  const tcx = half(targetRect?.cx);
  const tcy = half(targetRect?.cy);
  const tr = half(targetRect?.r);
  const target = tcx != null && tcy != null && tr != null ? { cx: tcx, cy: tcy, r: tr } : undefined;
  const targetRef = useRef(target);
  const skipRef = useRef(skip);
  const [done, setDone] = useState(false);

  // latest callbacks, without restarting the animation when the parent re-renders
  useEffect(() => {
    onDoneRef.current = onDone;
    onEventRef.current = onEvent;
  });

  // engine lifecycle — StrictMode-safe: the cleanup disposes it, a remount starts afresh
  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;
    const reduced =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      setDone(true);
      onDoneRef.current?.();
    };
    let created: IntroEngine | null = null;
    try {
      created = new IntroEngine(canvas, {
        reducedMotion: reduced,
        startFinal: skipRef.current,
        onEvent: (name) => onEventRef.current?.(name),
        onDone: finish,
        getTarget: () => targetRef.current ?? null,
      });
      created.start();
    } catch {
      // no usable 2D canvas: nothing to animate, hand over at once
      try {
        created?.dispose();
      } catch {
        /* already broken */
      }
      finish();
      return;
    }
    const engine = created;
    engineRef.current = engine;

    const onResize = () => engine.resize();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(onResize) : null;
    if (ro) ro.observe(root);
    else window.addEventListener('resize', onResize);
    const onPointer = () => engine.skip();
    const onKey = (e: KeyboardEvent) => {
      if (!MODIFIER_KEYS.has(e.key)) engine.skip();
    };
    root.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);

    // a stuck intro must never hold the site: skip it, then hand over regardless
    let visible = 0;
    const watchdog = window.setInterval(() => {
      if (finished) {
        window.clearInterval(watchdog);
        return;
      }
      if (document.visibilityState !== 'visible') return;
      visible++;
      if (visible === WATCHDOG_SKIP_S) engine.skip();
      else if (visible >= WATCHDOG_ABORT_S) {
        try {
          engine.abort();
        } finally {
          finish();
        }
      }
    }, 1000);

    return () => {
      window.clearInterval(watchdog);
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', onResize);
      root.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
      engine.dispose();
      if (engineRef.current === engine) engineRef.current = null;
      // release the backing store now (iOS counts detached canvases until GC); a remount resizes it
      canvas.width = 0;
      canvas.height = 0;
    };
  }, []);

  useEffect(() => {
    skipRef.current = skip;
    if (skip) engineRef.current?.skip();
  }, [skip]);

  useEffect(() => {
    const next = tcx != null && tcy != null && tr != null ? { cx: tcx, cy: tcy, r: tr } : undefined;
    const prev = targetRef.current;
    targetRef.current = next;
    if (prev?.cx !== next?.cx || prev?.cy !== next?.cy || prev?.r !== next?.r) engineRef.current?.relayout();
  }, [tcx, tcy, tr]);

  const Heading = headingAs;
  return (
    <div
      ref={rootRef}
      className={className}
      data-intro={done ? 'done' : 'playing'}
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        isolation: 'isolate',
        background: '#070a14',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        pointerEvents: done ? 'none' : 'auto',
        ...style,
      }}
    >
      <Heading className="sr-only" lang="en">
        hello, imad’s world
      </Heading>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  );
}
