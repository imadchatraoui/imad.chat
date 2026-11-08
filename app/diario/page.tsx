import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import { getNotes } from "@/lib/notes";

export const metadata: Metadata = {
  title: "Diario",
  description: "Quello che mi interessa, in ordine di tempo.",
  alternates: { canonical: "/diario" },
};

export default function DiarioPage() {
  const notes = getNotes();

  return (
    <div className="flex min-h-dvh flex-col">
      <Header current="diario" />
      <main className="mx-auto w-full max-w-[44rem] flex-1 px-5 pt-10 pb-24 sm:px-0">
        <h1 className="voice text-[2.5rem] leading-none tracking-[-0.01em]">Diario</h1>
        <p className="voice mt-3 text-[1.125rem] text-muted">Quello che mi interessa, in ordine di tempo.</p>

        {notes.length === 0 ? (
          <p className="voice mt-12 text-muted">Ancora nessuna pagina.</p>
        ) : (
          <ul className="mt-10 divide-y divide-line border-t border-line">
            {notes.map((n) => (
              <li key={n.slug}>
                <Link
                  href={`/diario/${n.slug}`}
                  className="grid grid-cols-[3.5rem_1fr] items-baseline gap-x-4 py-4 sm:grid-cols-[7.5rem_1fr_auto]"
                >
                  <span className="text-[0.8125rem] text-muted tabular-nums">
                    <span className="sm:hidden">{n.dateShort}</span>
                    <span className="hidden sm:inline">{n.dateLong}</span>
                  </span>
                  <span>
                    <span className="voice block text-[1.125rem] leading-snug">{n.title}</span>
                    {n.excerpt && (
                      <span className="voice mt-1 block text-[0.9375rem] leading-snug text-muted">{n.excerpt}</span>
                    )}
                  </span>
                  {n.tags.length > 0 && (
                    <span className="hidden text-[0.8125rem] text-muted sm:block">{n.tags.join(", ")}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
