import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getSection, getSections } from "@/lib/sections";

// L'anteprima condivisa di una sezione: il lembo graduato nella notte, con il segno della sezione
// nel punto del lembo dove è incisa, e il titolo in corsivo d'oro (Cormorant Garamond, come l'intro).
// Il carattere è un file del repository (assets/fonts, solo latino): niente rete durante la build.

export const alt = "Il titolo della sezione nel lembo graduato dell’astrolabio d’ottone di imad’s world";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return getSections().map((s) => ({ slug: s.id }));
}

const W = 1200;
const H = 630;
const CX = 600;
const CY = 315;
const R = 272;

const brass = "#c9a25b";
const brassLight = "#ead6a0";
const cream = "#efe6d2";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function limbSvg(angle: number): string {
  const r = rng(86);
  const parts: string[] = [];
  for (let i = 0; i < 200; i++) {
    const x = r() * W;
    const y = r() * H;
    const inside = Math.hypot(x - CX, y - CY) < R + 8;
    if (inside && r() < 0.8) continue;
    const big = r() < 0.07;
    const a = (big ? 0.6 : 0.16 + r() * 0.3).toFixed(2);
    parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${big ? 1.5 : 0.6 + r() * 0.6}" fill="#f4ecd8" fill-opacity="${a}"/>`);
  }
  parts.push(`<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${brass}" stroke-opacity="0.9" stroke-width="1.6"/>`);
  parts.push(`<circle cx="${CX}" cy="${CY}" r="${R + 8}" fill="none" stroke="${brass}" stroke-opacity="0.35" stroke-width="0.8"/>`);
  parts.push(`<circle cx="${CX}" cy="${CY}" r="${R - 28}" fill="none" stroke="${brass}" stroke-opacity="0.5" stroke-width="1"/>`);
  for (let d = 0; d < 360; d++) {
    const len = d % 30 === 0 ? 28 : d % 10 === 0 ? 16 : d % 5 === 0 ? 11 : 5;
    const w = d % 30 === 0 ? 1.6 : d % 10 === 0 ? 1.1 : 0.7;
    const op = d % 30 === 0 ? 0.95 : d % 5 === 0 ? 0.75 : 0.5;
    const a = (d * Math.PI) / 180;
    const s = Math.sin(a);
    const c = Math.cos(a);
    parts.push(
      `<line x1="${(CX + s * R).toFixed(2)}" y1="${(CY - c * R).toFixed(2)}" x2="${(CX + s * (R - len)).toFixed(2)}" y2="${(CY - c * (R - len)).toFixed(2)}" stroke="${d % 30 === 0 ? cream : brass}" stroke-opacity="${op}" stroke-width="${w}"/>`,
    );
  }
  // il segno della sezione sul lembo: una piccola rosetta d'oro, come quelle incise sullo strumento
  const a = (angle * Math.PI) / 180;
  const mx = CX + Math.sin(a) * (R + 22);
  const my = CY - Math.cos(a) * (R + 22);
  parts.push(`<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="9" fill="${brassLight}" fill-opacity="0.18"/>`);
  parts.push(`<rect x="${(mx - 5).toFixed(1)}" y="${(my - 5).toFixed(1)}" width="10" height="10" fill="${brassLight}" transform="rotate(45 ${mx.toFixed(1)} ${my.toFixed(1)})"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`;
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const section = getSection(slug);
  const title = section?.title ?? "imad’s world";
  const font = await readFile(join(process.cwd(), "assets", "fonts", "cormorant-garamond-italic-500.ttf"));
  const limb = `data:image/svg+xml;base64,${Buffer.from(limbSvg(section?.angle ?? 0)).toString("base64")}`;
  const fontSize = title.length > 13 ? 62 : 80;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "radial-gradient(circle at 50% 46%, #14204a 0%, #0c1534 40%, #070a14 74%)",
          fontFamily: "Cormorant Garamond",
          fontStyle: "italic",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={limb} width={W} height={H} alt="" style={{ position: "absolute", left: 0, top: 0 }} />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: W,
            height: H,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize, lineHeight: 1.1, color: brassLight, maxWidth: 470, textAlign: "center" }}>{title}</div>
          <div style={{ fontSize: 30, lineHeight: 1, color: brass, marginTop: 30, letterSpacing: "0.02em" }}>imad.chat</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Cormorant Garamond", data: font, style: "italic", weight: 500 }],
    },
  );
}
