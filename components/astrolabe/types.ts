import type { Ref } from "react";
import type { AstroSection, Observer } from "@/lib/astro";
import type { AstrolabeEventName } from "./engine/engine";

export type { AstrolabeEventName };

/** I metodi dell'astrolabio, per chi lo comanda da fuori (ref o onReady). */
export interface AstrolabeHandle {
  /** "3d" con WebGL, "2d" nella versione SVG. */
  readonly mode: "3d" | "2d";
  /** Le parti esplose volano al loro posto e si incastrano. */
  assemble(): void;
  /** Le parti si separano lungo l'asse, vista di tre quarti. */
  explode(): void;
  /** Gira lo strumento: sul retro c'è inciso il codice che calcola il cielo. */
  flip(): void;
  /** At-Tariq: tre colpi luminosi, poi un raggio che trafigge il buio. */
  triggerTariq(): void;
  /** Porta il cielo a un istante (la rete gira fino lì; animate: false per saltarci subito). */
  setTime(date: Date, opts?: { animate?: boolean }): void;
  /** Torna al cielo vero di adesso. */
  resetNow(): void;
  /** La regola si gira verso la qibla (false per tornare al Sole). Ritorna l'azimut in gradi. */
  pointQibla(on?: boolean): number;
  /** Scombina gli anelli come strati di un cubo di Rubik. */
  scramble(): void;
  /** Li riallinea (e apre la piastra segreta). */
  realign(): void;
  /** Evidenzia un puntatore (null per toglierlo). */
  selectStar(id: string | null): void;
  /** L'istante mostrato dalla rete. */
  getTime(): Date;
  /** Se la rete segue l'orologio vero. */
  isNow(): boolean;
  /** Il cerchio esterno del lembo sullo schermo (pixel CSS dal canvas), per allineare l'intro. */
  getLimbScreenCircle(): { cx: number; cy: number; r: number } | null;
}

export interface AstrolabeProps {
  /** Id della città della piastra (content/astro/cities.json). Predefinita: torino. */
  city?: string;
  /** Dove si trova chi guarda, per la qibla. Senza, si usa la città della piastra. */
  observer?: Observer | null;
  /** Le sezioni del sito, incise come segni sul lembo. */
  sections?: AstroSection[];
  /** Tocco su un puntatore della rete. */
  onStarSelect?: (id: string) => void;
  /** Tocco su un segno del lembo. */
  onSectionSelect?: (id: string) => void;
  /** Lo strumento è pronto: riceve gli stessi metodi del ref. */
  onReady?: (api: AstrolabeHandle) => void;
  /** Eventi per i suoni facoltativi: tick, plate, assemble, flip, tariq (e altri, vedi README). */
  onEvent?: (name: AstrolabeEventName) => void;
  /** L'istante mostrato cambia (al massimo ~8 volte al secondo). */
  onTimeChange?: (date: Date, isNow: boolean) => void;
  className?: string;
  /** Stato iniziale: montato (predefinito), esploso, o nascosto in attesa di assemble(). */
  initialState?: "assembled" | "exploded" | "hidden";
  /** Spazio da lasciare libero attorno allo strumento, in frazioni del contenitore. */
  framing?: { top?: number; bottom?: number; side?: number };
  /** at-Tariq: "auto" usa video/tariq-v|h.mp4 se il manifesto li elenca, "procedural" sempre la versione disegnata. */
  tariqVideo?: "auto" | "procedural";
  /** Forza la versione 2D (per prova). */
  forceFallback?: boolean;
  ref?: Ref<AstrolabeHandle>;
}
