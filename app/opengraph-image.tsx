import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// L'anteprima condivisa: la notte di lapislazzuli, il lembo inciso con i gradi, e il saluto.
// Il carattere è il file locale assets/fonts/newsreader.woff: niente font dalla rete durante la build.

export const alt = "hello, imad’s world: un astrolabio d’ottone nella notte";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const W = 1200;
const H = 630;
const CX = 600;
const CY = 300;
const R = 270;

const night = "#070a14";
const brass = "#c9a25b";
const brassLight = "#ead6a0";
const cream = "#efe6d2";

/** Un generatore pseudo-casuale fisso: le stelle stanno sempre negli stessi punti. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function limbSvg(): string {
  const r = rng(86);
  const parts: string[] = [];
  // le stelle, più rade dentro il cerchio
  for (let i = 0; i < 190; i++) {
    const x = r() * W;
    const y = r() * H;
    const inside = Math.hypot(x - CX, y - CY) < R + 6;
    if (inside && r() < 0.72) continue;
    const big = r() < 0.08;
    const a = (big ? 0.55 : 0.18 + r() * 0.3).toFixed(2);
    parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${big ? 1.5 : 0.6 + r() * 0.6}" fill="#f4ecd8" fill-opacity="${a}"/>`);
  }
  // il lembo: due filetti e le tacche dei gradi
  parts.push(`<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${brass}" stroke-opacity="0.9" stroke-width="1.6"/>`);
  parts.push(`<circle cx="${CX}" cy="${CY}" r="${R - 26}" fill="none" stroke="${brass}" stroke-opacity="0.55" stroke-width="1"/>`);
  parts.push(`<circle cx="${CX}" cy="${CY}" r="${R + 9}" fill="none" stroke="${brass}" stroke-opacity="0.3" stroke-width="0.8"/>`);
  for (let d = 0; d < 360; d++) {
    const len = d % 30 === 0 ? 26 : d % 10 === 0 ? 15 : d % 5 === 0 ? 10 : 5;
    const w = d % 30 === 0 ? 1.6 : d % 10 === 0 ? 1.1 : 0.7;
    const op = d % 30 === 0 ? 0.95 : d % 5 === 0 ? 0.75 : 0.5;
    const a = (d * Math.PI) / 180;
    const s = Math.sin(a);
    const c = Math.cos(a);
    const x1 = CX + s * R;
    const y1 = CY - c * R;
    const x2 = CX + s * (R - len);
    const y2 = CY - c * (R - len);
    const color = d % 30 === 0 ? brassLight : brass;
    parts.push(
      `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${color}" stroke-opacity="${op}" stroke-width="${w}"/>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`;
}

export default async function Image() {
  const newsreader = await readFile(join(process.cwd(), "assets", "fonts", "newsreader.woff"));
  const limb = `data:image/svg+xml;base64,${Buffer.from(limbSvg()).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: `radial-gradient(circle at 50% 47%, #14204a 0%, #0c1534 38%, ${night} 72%)`,
          fontFamily: "Newsreader",
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
            paddingBottom: 30,
          }}
        >
          <div style={{ fontSize: 46, lineHeight: 1, color: cream, opacity: 0.74, letterSpacing: "0.01em" }}>hello,</div>
          <div style={{ fontSize: 78, lineHeight: 1.15, color: brassLight, letterSpacing: "-0.005em", marginTop: 8 }}>imad’s world</div>
          <div style={{ fontSize: 23, lineHeight: 1, color: brass, letterSpacing: "0.08em", marginTop: 26 }}>imad.chat</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Newsreader", data: newsreader, style: "normal", weight: 400 }],
    },
  );
}
