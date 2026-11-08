"use client";

import Link from "next/link";
import { site } from "@/site.config";
import ThemeToggle from "./ThemeToggle";

type Props = {
  current?: "home" | "diario";
  /** Mostra «nuova chat» e chiama questa funzione. */
  onReset?: () => void;
};

export default function Header({ current, onReset }: Props) {
  return (
    <header className="mx-auto flex h-14 w-full max-w-[44rem] items-center justify-between px-5 sm:px-0">
      <Link
        href="/"
        className="voice text-[1.3125rem] leading-none tracking-[-0.01em]"
        aria-label={`${site.domain}, pagina iniziale`}
      >
        {site.domain}
      </Link>

      <nav className="flex items-center gap-1 text-[0.9375rem]" aria-label="Principale">
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="rounded-full px-3 py-1.5 text-muted transition-colors hover:text-ink"
          >
            nuova chat
          </button>
        )}
        <Link
          href="/diario"
          aria-current={current === "diario" ? "page" : undefined}
          className={`rounded-full px-3 py-1.5 transition-colors hover:text-ink ${
            current === "diario" ? "text-ink" : "text-muted"
          }`}
        >
          diario
        </Link>
        <ThemeToggle />
      </nav>
    </header>
  );
}
