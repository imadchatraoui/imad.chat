"use client";

// L'interruttore del suono: spento finché non lo si accende. La scelta resta nel browser.

import { useSound } from "@/lib/sound";
import { IconSound } from "./icons";
import t from "./tokens.module.css";
import c from "./Chrome.module.css";

export interface SoundToggleProps {
  className?: string;
  /** Mostra anche la parola sotto l'icona (nella barra in basso). */
  withLabel?: boolean;
  labelClassName?: string;
  ringClassName?: string;
}

export default function SoundToggle({ className, withLabel, labelClassName, ringClassName }: SoundToggleProps) {
  const { enabled, toggle } = useSound();
  return (
    <button
      type="button"
      className={`${t.button} ${className ?? c.iconButton}`}
      aria-pressed={enabled}
      data-kind="sound"
      aria-label={withLabel ? undefined : "Suono"}
      title={enabled ? "Suono acceso" : "Suono spento"}
      onClick={toggle}
    >
      <span className={ringClassName} aria-hidden={withLabel ? true : undefined}>
        <IconSound on={enabled} size={22} />
      </span>
      {withLabel ? <span className={labelClassName}>suono</span> : null}
    </button>
  );
}
