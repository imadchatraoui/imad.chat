"use client";

// Il contesto della cornice: permette a un pannello reso sul server (SectionPanel) di contenere un
// pulsante che comanda l'astrolabio, senza passare funzioni dal server al browser.

import { createContext, useContext, type ReactNode } from "react";
import type { SectionAnchor } from "./anchors";

export interface ShellActions {
  /** Esegue il gesto legato a una sezione (cambia piastra, at-Tariq, qibla, gira, adesso). */
  onAnchor?: (anchor: SectionAnchor) => void;
  /** Il nome italiano di una città, per le etichette. */
  cityName?: (id: string) => string | undefined;
}

const Ctx = createContext<ShellActions>({});

export function ShellActionsProvider({ value, children }: { value: ShellActions; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShellActions(): ShellActions {
  return useContext(Ctx);
}
