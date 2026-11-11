import { ImageResponse } from "next/og";

// L'icona per la schermata Home: la stella a otto punte incisa nell'ottone, su lapislazzuli,
// dentro un lembo graduato. iOS arrotonda da sé gli angoli.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

function markSvg(): string {
  const c = 90;
  const parts: string[] = [];
  // il lembo: 72 tacche, ogni 5 gradi; ogni 30 più lunghe
  for (let d = 0; d < 360; d += 5) {
    const a = (d * Math.PI) / 180;
    const long = d % 30 === 0;
    const r1 = 78;
    const r2 = long ? 70 : 74;
    parts.push(
      `<line x1="${(c + Math.sin(a) * r1).toFixed(2)}" y1="${(c - Math.cos(a) * r1).toFixed(2)}" x2="${(c + Math.sin(a) * r2).toFixed(2)}" y2="${(c - Math.cos(a) * r2).toFixed(2)}" stroke="#c9a25b" stroke-opacity="${long ? 0.95 : 0.6}" stroke-width="${long ? 1.6 : 1}"/>`,
    );
  }
  parts.push(`<circle cx="${c}" cy="${c}" r="78.5" fill="none" stroke="#c9a25b" stroke-opacity="0.8" stroke-width="1.2"/>`);
  parts.push(`<circle cx="${c}" cy="${c}" r="66" fill="none" stroke="#c9a25b" stroke-opacity="0.35" stroke-width="0.8"/>`);
  // la stella: due quadrati incrociati, incisi con un solco chiaro nel mezzo
  const sq = (rot: number) =>
    `<rect x="${c - 33}" y="${c - 33}" width="66" height="66" transform="rotate(${rot} ${c} ${c})"`;
  parts.push(`${sq(0)} fill="none" stroke="#c9a25b" stroke-width="7" stroke-linejoin="miter"/>`);
  parts.push(`${sq(45)} fill="none" stroke="#c9a25b" stroke-width="7" stroke-linejoin="miter"/>`);
  parts.push(`${sq(0)} fill="none" stroke="#f3e2b4" stroke-width="1.4" stroke-opacity="0.85"/>`);
  parts.push(`${sq(45)} fill="none" stroke="#f3e2b4" stroke-width="1.4" stroke-opacity="0.85"/>`);
  parts.push(`<circle cx="${c}" cy="${c}" r="15" fill="none" stroke="#c9a25b" stroke-width="2"/>`);
  parts.push(`<circle cx="${c}" cy="${c}" r="6.5" fill="#ead6a0"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">${parts.join("")}</svg>`;
}

export default function AppleIcon() {
  const src = `data:image/svg+xml;base64,${Buffer.from(markSvg()).toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 50% 42%, #1b2a5c 0%, #14204a 45%, #0b1330 100%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={180} height={180} alt="" />
      </div>
    ),
    size,
  );
}
