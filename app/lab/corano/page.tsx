import type { Metadata, Viewport } from "next";
import QuranLab from "@/components/quran/QuranLab";
import data from "@/content/astro/verses.json";

// Banco di prova del mushaf interattivo. ?k=2:144 apre a quella pagina, ?open=1 parte col libro aperto.

export const metadata: Metadata = {
  title: "Laboratorio del Corano",
  description: "Banco di prova del Corano interattivo di imad's world.",
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: "#070a14",
};

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const key = typeof q.k === "string" ? q.k : undefined;
  return <QuranLab verses={data.items} initialKey={key} startOpen={q.open === "1"} />;
}
