"use client";

// Il logo in alto a sinistra. Se esiste public/logo.svg (o il manifesto elenca "logo.svg") si usa quello,
// al massimo 160 × 40; altrimenti il segno inciso: la stella a otto punte e la scritta imad.chat.

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadMedia } from "@/lib/media";
import { StarMark } from "./icons";
import t from "./tokens.module.css";
import c from "./Chrome.module.css";

const LOGO = "/logo.svg";
const SESSION_KEY = "imad.logo";

// una sola verifica per pagina, anche se il componente si monta due volte
let probe: Promise<boolean> | null = null;

function findLogo(): Promise<boolean> {
  if (!probe) {
    probe = (async () => {
      const index = await loadMedia();
      if (index.has("logo.svg")) return true;
      try {
        const r = await fetch(LOGO, { method: "HEAD", cache: "no-cache" });
        return r.ok && (r.headers.get("content-type") ?? "").includes("svg");
      } catch {
        return false;
      }
    })();
  }
  return probe;
}

function remembered(): boolean | null {
  try {
    const v = window.sessionStorage.getItem(SESSION_KEY);
    return v === "1" ? true : v === "0" ? false : null;
  } catch {
    return null;
  }
}

function remember(found: boolean) {
  try {
    window.sessionStorage.setItem(SESSION_KEY, found ? "1" : "0");
  } catch {
    // niente
  }
}

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
  className?: string;
}

export default function LogoSlot({ href = "/", className }: LogoSlotProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const known = remembered();
    if (known === false) return;
    if (known === true) {
      setSrc(LOGO);
      return;
    }
    void findLogo().then((found) => {
      remember(found);
      if (alive && found) setSrc(LOGO);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Link href={href} className={`${t.vars} ${c.logo} ${className ?? ""}`} aria-label="imad.chat, torna all’inizio">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className={c.logoImg}
          onError={() => {
            remember(false);
            setSrc(null);
          }}
        />
      ) : (
        <LogoMark />
      )}
    </Link>
  );
}
