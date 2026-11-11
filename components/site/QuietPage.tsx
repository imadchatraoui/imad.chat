// Una pagina quieta, fuori dall'astrolabio: le sezioni con un indirizzo loro (da condividere) e la
// pagina che non c'è. Stessa notte, stesso ottone, stessi caratteri del foglio; si legge scorrendo.
// Nessun hook: si rende sul server.

import Link from "next/link";
import type { ReactNode } from "react";
import { logoSrc } from "@/lib/logo";
import { LogoMark } from "./LogoSlot";
import t from "./tokens.module.css";
import q from "./Quiet.module.css";

export interface QuietPageProps {
  children: ReactNode;
  /** Sotto il contenuto, prima della firma (es. le altre sezioni). */
  after?: ReactNode;
  /** Il link «Torna all’astrolabio» in alto (predefinito sì). */
  back?: boolean;
}

export default function QuietPage({ children, after, back = true }: QuietPageProps) {
  const logo = logoSrc();
  return (
    <div className={`${t.vars} ${q.page}`}>
      <header className={q.head}>
        <Link href="/" className={q.logo} aria-label="imad.chat, torna all’astrolabio">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className={q.logoImg} />
          ) : (
            <LogoMark />
          )}
        </Link>
        {back ? (
          <Link href="/" className={q.back}>
            Torna all’astrolabio
          </Link>
        ) : null}
      </header>
      <main className={q.main}>{children}</main>
      {after}
      <footer className={q.foot}>
        <span className={q.rule} aria-hidden="true" />
        <p className={q.sign}>
          <span className={q.hello}>hello,</span> <span className={q.world}>imad’s world</span>
        </p>
      </footer>
    </div>
  );
}
