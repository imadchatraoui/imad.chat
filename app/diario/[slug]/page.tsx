import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Prose from "@/components/Prose";
import Star from "@/components/Star";
import { getNote, getNotes } from "@/lib/notes";
import { site } from "@/site.config";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getNotes().map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const note = getNote(slug);
  if (!note) return {};
  return {
    title: note.title,
    description: note.excerpt || site.description,
    alternates: { canonical: `/diario/${note.slug}` },
    openGraph: {
      type: "article",
      title: note.title,
      description: note.excerpt || site.description,
      publishedTime: note.date,
      tags: note.tags,
    },
  };
}

export default async function NotePage({ params }: Props) {
  const { slug } = await params;
  const note = getNote(slug);
  if (!note) notFound();

  const askHref = `/?q=${encodeURIComponent(`Parlami di «${note.title}»`)}&focus=${note.slug}`;

  return (
    <div className="flex min-h-dvh flex-col">
      <Header current="diario" />
      <main className="mx-auto w-full max-w-[40rem] flex-1 px-5 pt-10 pb-24 sm:px-0">
        <article>
          <header>
            <p className="text-[0.8125rem] leading-snug text-muted">
              {note.dateLong}
              <br />
              {note.dateHijri}
            </p>
            <h1 className="voice mt-4 text-[2.25rem] leading-[1.1] tracking-[-0.01em] text-balance sm:text-[2.75rem]">
              {note.title}
            </h1>
            {note.tags.length > 0 && <p className="mt-3 text-[0.8125rem] text-muted">{note.tags.join(", ")}</p>}
          </header>

          <Prose className="mt-8">{note.body}</Prose>

          <div className="mt-10 text-lapis">
            <Star size={30} />
          </div>
        </article>

        <nav className="mt-12 flex flex-wrap gap-x-6 gap-y-2 text-[0.9375rem]" aria-label="Pagina">
          <Link href={askHref} className="text-lapis underline decoration-1 underline-offset-4">
            Chiedimi di questa pagina
          </Link>
          <Link href="/diario" className="text-muted transition-colors hover:text-ink">
            Tutte le pagine
          </Link>
        </nav>
      </main>
    </div>
  );
}
