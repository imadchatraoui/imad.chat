"use client";

// La barra in alto: il logo a sinistra, il suono e il menu "Sezioni" a destra.
// Non copre l'astrolabio: è trasparente e sfuma nella notte. Durante l'intro resta solo l'interruttore
// del suono, così chi vuole sentire la battitura può accenderlo; il resto entra con l'astrolabio.

import { useEffect, useLayoutEffect, useRef } from "react";
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
  /** Il file del logo (public/logo.svg), se c'è; altrimenti il segno inciso. */
  logo?: string | null;
  /** Nasconde la barra (es. durante l'intro), con una dissolvenza. */
  hidden?: boolean;
  /** Durante l'intro: solo l'interruttore del suono; logo e Sezioni entrano dopo, con una dissolvenza. */
  intro?: boolean;
  /** L'altezza della barra in px CSS (aree sicure comprese), per lasciare libero lo strumento. */
  onHeight?: (px: number) => void;
  className?: string;
}

export default function SiteChrome({
  onOpenSections,
  sectionsOpen = false,
  soundToggle = true,
  homeHref = "/",
  logo = null,
  hidden = false,
  intro = false,
  onHeight,
  className,
}: SiteChromeProps) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    warmSiteFonts(ref.current);
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !onHeight) return;
    // offsetHeight non risente della traslazione della dissolvenza
    const report = () => onHeight(el.offsetHeight);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeight]);

  return (
    <header
      ref={ref}
      className={`${t.vars} ${c.bar} ${className ?? ""}`}
      data-hidden={hidden ? "" : undefined}
      data-intro={intro ? "" : undefined}
      inert={hidden}
    >
      <div className={c.lead} inert={intro}>
        <LogoSlot href={homeHref} src={logo} />
      </div>
      <div className={c.actions}>
        {soundToggle ? <SoundToggle /> : null}
        <button
          type="button"
          className={`${t.button} ${c.sections}`}
          aria-haspopup="dialog"
          aria-expanded={sectionsOpen}
          onClick={onOpenSections}
          inert={intro}
        >
          Sezioni
        </button>
      </div>
    </header>
  );
}
