import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QuietPage from "@/components/site/QuietPage";
import SectionPanel from "@/components/site/SectionPanel";
import { getSection, getSections } from "@/lib/sections";
import q from "@/components/site/Quiet.module.css";

// Ogni sezione ha anche un indirizzo suo, per condividerla e per i motori di ricerca: la stessa
// scheda del foglio dell'astrolabio, su una pagina quieta. Si costruiscono tutte alla build.

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getSections().map((s) => ({ slug: s.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const section = getSection(slug);
  if (!section) return {};
  const url = `/sezioni/${section.id}`;
  return {
    title: section.title,
    description: section.summary || undefined,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      siteName: "imad.chat",
      locale: "it_IT",
      url,
      title: `${section.title} · imad.chat`,
      description: section.summary || undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${section.title} · imad.chat`,
      description: section.summary || undefined,
    },
  };
}

export default async function SectionPage({ params }: Props) {
  const { slug } = await params;
  const section = getSection(slug);
  if (!section) notFound();
  const others = getSections().filter((s) => s.id !== section.id);

  return (
    <QuietPage
      after={
        others.length ? (
          <nav className={q.more} aria-labelledby="altre-sezioni">
            <h2 id="altre-sezioni" className={q.moreTitle}>
              Le altre sezioni
            </h2>
            <ul className={q.moreList}>
              {others.map((s) => (
                <li key={s.id}>
                  <Link href={`/sezioni/${s.id}`} className={q.moreLink}>
                    <span className={q.moreDeg} aria-hidden="true">
                      {Math.round(s.angle)}°
                    </span>
                    <span className={q.moreName}>{s.title}</span>
                    {s.summary ? <span className={q.moreSummary}>{s.summary}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null
      }
    >
      <SectionPanel section={section} headingLevel={1} />
    </QuietPage>
  );
}
