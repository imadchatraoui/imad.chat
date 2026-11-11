"use client";

// L'istante mostrato dall'astrolabio, fuori dallo stato di React: mentre si trascina la rete cambia
// fino a otto volte al secondo, e così si ridisegnano solo l'orologio, lo sfondo e i pannelli che lo
// leggono, non tutta la pagina. Quando l'astrolabio segue il cielo vero ("adesso"), l'orologio
// scorre da sé, un secondo alla volta.

import { useEffect, useState, useSyncExternalStore } from "react";

export interface ShownTime {
  /** L'istante mostrato, in ms; null finché si segue l'orologio vero. */
  at: number | null;
}

export interface TimeStore {
  get(): ShownTime;
  set(at: number | null): void;
  subscribe(cb: () => void): () => void;
}

const NOW: ShownTime = { at: null };

export function createTimeStore(): TimeStore {
  let state: ShownTime = NOW;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(at) {
      if (at === state.at) return;
      state = at === null ? NOW : { at };
      for (const l of listeners) l();
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}

const serverSnapshot = () => NOW;

/**
 * L'istante da mostrare e se è "adesso". Con `tick` l'orologio vero avanza ogni secondo
 * (per chi mostra i secondi); senza, ogni minuto.
 */
export function useShownTime(store: TimeStore, tick = false): { date: Date; isNow: boolean } {
  const shown = useSyncExternalStore(store.subscribe, store.get, serverSnapshot);
  const [now, setNow] = useState(() => Date.now());
  const isNow = shown.at === null;
  useEffect(() => {
    if (!isNow) return;
    setNow(Date.now());
    const step = tick ? 1000 : 60000;
    // allineato al secondo (o al minuto), così l'ora cambia insieme a quella del telefono
    let id = 0;
    const schedule = () => {
      id = window.setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, step - (Date.now() % step) + 5);
    };
    schedule();
    return () => window.clearTimeout(id);
  }, [isNow, tick]);
  return { date: new Date(isNow ? now : (shown.at as number)), isNow };
}
