import Link from "next/link";
import type { NoteSummary } from "@/lib/notes";

/** Una pagina del diario, come la mostra il bot quando la cita. */
export default function NoteCard({ note }: { note: NoteSummary }) {
  return (
    <Link
      href={`/diario/${note.slug}`}
      className="block rounded-xl border border-line px-4 py-3 transition-colors hover:border-muted"
    >
      <div className="flex items-baseline justify-between gap-4 text-[0.8125rem] text-muted">
        <span>{note.dateLong}</span>
        {note.tags.length > 0 && <span>{note.tags.join(", ")}</span>}
      </div>
      <div className="voice mt-1 text-[1.0625rem] leading-snug">{note.title}</div>
      {note.excerpt && (
        <p className="voice mt-1 line-clamp-2 text-[0.9375rem] leading-snug text-muted">{note.excerpt}</p>
      )}
    </Link>
  );
}
