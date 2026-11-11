'use client';

/*
 * <Intro /> — the first impression of imad.chat: "hello, world" is typed, "world" evaporates into
 * stars, "imad’s world" condenses out of them in gold, and an engraved limb circle is drawn
 * around it, ready to hand off to the 3D astrolabe.
 *
 *   <Intro
 *     targetRect={{ cx, cy, r }}          // limb circle, CSS px (default: centre, r = min(w, h) · 0.42)
 *     onEvent={(name) => playSound(name)} // 'type' | 'backspace' | 'dissolve' | 'condense' | 'circle'
 *     onDone={() => showAstrolabe()}      // once, when the circle closes (or 400 ms after a skip)
 *     skip={returningVisitor}             // true: final state (immediately at mount, crossfade later)
 *   />
 *
 * Fonts come from the CSS variables --font-mono-intro and --font-serif-intro (set with next/font
 * on an ancestor); the canvas waits for them before sampling glyphs. Tap, click or any key skips
 * to the final state; prefers-reduced-motion shows the final frame at once. The root is fixed and
 * covers the viewport by default (override with className / style); targetRect is relative to it.
 * After onDone the root stops intercepting pointer events, so it can stay mounted underneath.
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
}

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Fn', 'OS']);

export default function Intro({ onDone, targetRect, skip = false, onEvent, className, style }: IntroProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<IntroEngine | null>(null);
  const onDoneRef = useRef(onDone);
  const onEventRef = useRef(onEvent);
  const targetRef = useRef(targetRect);
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
    let engine: IntroEngine;
    try {
      engine = new IntroEngine(canvas, {
        reducedMotion: reduced,
        startFinal: skipRef.current,
        onEvent: (name) => onEventRef.current?.(name),
        onDone: () => {
          setDone(true);
          onDoneRef.current?.();
        },
        getTarget: () => targetRef.current ?? null,
      });
    } catch {
      // no 2D canvas at all: nothing to animate, hand over at once
      setDone(true);
      onDoneRef.current?.();
      return;
    }
    engineRef.current = engine;
    engine.start();

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

    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', onResize);
      root.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
      engine.dispose();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    skipRef.current = skip;
    if (skip) engineRef.current?.skip();
  }, [skip]);

  const tcx = targetRect?.cx;
  const tcy = targetRect?.cy;
  const tr = targetRect?.r;
  useEffect(() => {
    const next = tcx != null && tcy != null && tr != null ? { cx: tcx, cy: tcy, r: tr } : undefined;
    const prev = targetRef.current;
    targetRef.current = next;
    if (prev?.cx !== next?.cx || prev?.cy !== next?.cy || prev?.r !== next?.r) engineRef.current?.relayout();
  }, [tcx, tcy, tr]);

  return (
    <div
      ref={rootRef}
      className={className}
      data-intro={done ? 'done' : 'playing'}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#070a14',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        pointerEvents: done ? 'none' : 'auto',
        ...style,
      }}
    >
      <h1 className="sr-only">{"hello, imad's world"}</h1>
      <canvas ref={canvasRef} aria-hidden="true" style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}
