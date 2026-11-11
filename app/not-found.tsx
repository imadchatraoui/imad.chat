import type { Metadata } from "next";
import Link from "next/link";
import QuietPage from "@/components/site/QuietPage";
import q from "@/components/site/Quiet.module.css";

export const metadata: Metadata = {
  title: "Pagina non trovata",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <QuietPage back={false}>
      <div className={q.lost}>
        <h1 className={q.lostTitle}>Questa pagina non c’è.</h1>
        <p className={q.lostText}>Forse è stata spostata, forse il cielo qui non è ancora stato inciso.</p>
        <Link href="/" className={q.lostLink}>
          Torna all’astrolabio
        </Link>
      </div>
    </QuietPage>
  );
}
