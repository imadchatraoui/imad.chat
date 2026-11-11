"use client";

// La barra in alto: il logo a sinistra, il suono e il menu "Sezioni" a destra.
// Non copre l'astrolabio: è trasparente e sfuma nella notte.

import { useEffect, useRef } from "react";
import LogoSlot from "./LogoSlot";
import SoundToggle from "./SoundToggle";
import { warmSiteFonts } from "./warmFonts";
import t from "./tokens.module.css";
import c from "./Chrome.module.css";

export interface SiteChromeProps {
  /** Apre il menu delle sezioni. */
  onOpenSections: () => void;
  /** Se il menu è aperto (aria-expanded del pulsante). */
  sectionsOpen?: boolean;
  /** Mostra l'interruttore del suono (predefinito sì; nascondilo se c'è già nella ControlBar). */
  soundToggle?: boolean;
  /** Dove porta il logo. */
  homeHref?: string;
  /** Nasconde la barra (es. durante l'intro), con una dissolvenza. */
  hidden?: boolean;
  className?: string;
}

export default function SiteChrome({
  onOpenSections,
  sectionsOpen = false,
  soundToggle = true,
  homeHref = "/",
  hidden = false,
  className,
}: SiteChromeProps) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    warmSiteFonts(ref.current);
  }, []);

  return (
    <header ref={ref} className={`${t.vars} ${c.bar} ${className ?? ""}`} data-hidden={hidden ? "" : undefined} aria-hidden={hidden || undefined}>
      <LogoSlot href={homeHref} />
      <div className={c.actions}>
        {soundToggle ? <SoundToggle /> : null}
        <button
          type="button"
          className={`${t.button} ${c.sections}`}
          aria-haspopup="dialog"
          aria-expanded={sectionsOpen}
          onClick={onOpenSections}
          tabIndex={hidden ? -1 : undefined}
        >
          Sezioni
        </button>
      </div>
    </header>
  );
}
