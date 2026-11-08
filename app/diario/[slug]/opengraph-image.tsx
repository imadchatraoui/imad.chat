import { ImageResponse } from "next/og";
import { getNote, getNotes } from "@/lib/notes";
import { OG_SIZE, OgStar, og, ogFont } from "@/lib/og";
import { site } from "@/site.config";

export const alt = "Una pagina del diario";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return getNotes().map((n) => ({ slug: n.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const note = getNote(slug);
  const title = note?.title ?? site.title;
  const fontSize = title.length > 48 ? 60 : title.length > 28 ? 76 : 92;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: og.paper,
          color: og.ink,
          fontFamily: "Newsreader",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 30, color: og.muted }}>
          <span>{note?.dateLong ?? ""}</span>
          <span>{note?.tags.join(", ") ?? ""}</span>
        </div>
        <div style={{ fontSize, lineHeight: 1.05, letterSpacing: "-0.015em", maxWidth: 1000 }}>{title}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 32 }}>
          <span>{site.domain}</span>
          <OgStar />
        </div>
      </div>
    ),
    { ...size, fonts: await ogFont() },
  );
}
