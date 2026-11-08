import Link from "next/link";
import Header from "@/components/Header";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="mx-auto w-full max-w-[44rem] flex-1 px-5 pt-[15vh] sm:px-0">
        <h1 className="voice text-[3rem] leading-none">Questa pagina non c&apos;è.</h1>
        <p className="voice mt-6 text-[1.125rem] text-muted">Forse l&apos;ho spostata, forse non l&apos;ho ancora scritta.</p>
        <p className="mt-8 flex gap-6 text-[0.9375rem]">
          <Link href="/" className="text-lapis underline decoration-1 underline-offset-4">
            Torna alla chat
          </Link>
          <Link href="/diario" className="text-muted hover:text-ink">
            Apri il diario
          </Link>
        </p>
      </main>
    </div>
  );
}
