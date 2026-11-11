"use client";

// Il logo in alto a sinistra. Se la pagina ha trovato public/logo.svg (lib/logo.ts, alla build) si usa
// quello, al massimo 160 × 40; altrimenti il segno inciso: la stella a otto punte e la scritta imad.chat.

import Link from "next/link";
import { useState } from "react";
import { StarMark } from "./icons";
import t from "./tokens.module.css";
import c from "./Chrome.module.css";

/** Il segno inciso con la scritta. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={`${c.mark} ${className ?? ""}`}>
      <StarMark size={22} className={c.markStar} />
      <span className={c.wordmark}>imad.chat</span>
    </span>
  );
}

export interface LogoSlotProps {
  href?: string;
  /** Il file del logo (es. "/logo.svg"), se c'è. */
  src?: string | null;
  className?: string;
}

export default function LogoSlot({ href = "/", src = null, className }: LogoSlotProps) {
  const [broken, setBroken] = useState(false);
  const show = src && !broken;
  return (
    <Link href={href} className={`${t.vars} ${c.logo} ${className ?? ""}`} aria-label="imad.chat, torna all’inizio">
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className={c.logoImg} onError={() => setBroken(true)} />
      ) : (
        <LogoMark />
      )}
    </Link>
  );
}
