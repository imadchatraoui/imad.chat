import { ImageResponse } from "next/og";
import { OG_SIZE, OgStar, og, ogFont } from "@/lib/og";
import { site } from "@/site.config";

export const alt = site.description;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
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
        <div style={{ fontSize: 160, lineHeight: 1, letterSpacing: "-0.02em" }}>Salam.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 40, lineHeight: 1.3, maxWidth: 900 }}>{site.description}</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 32 }}>
            <span>{site.domain}</span>
            <OgStar />
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFont() },
  );
}
