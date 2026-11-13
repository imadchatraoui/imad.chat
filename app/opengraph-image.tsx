import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// L'anteprima condivisa del sito (WhatsApp, Instagram, iMessage, i motori di ricerca), disegnata a codice alla build:
// il cielo di notte dell'hero, qualche stella ferma, il logo dei nove tasti con il centro d'oro e la scritta imad.chat_
// con il punto d'oro, come la lascia l'intro. Nessuna foto. Le pagine statiche la indicano come /opengraph-image
// (scripts/home/build.mjs). Il carattere è Manrope da assets/fonts (niente rete durante la build).

export const alt = "imad.chat: il logo dei nove tasti con il centro d'oro e la scritta imad.chat, su un cielo di notte";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#f4f5fa";
const GOLD = "#f3dfa8";

// stelle ferme, sempre le stesse (x, y in px; r raggio; a luce)
const STARS: [number, number, number, number][] = [
  [72, 64, 1.4, 0.55], [214, 38, 1, 0.4], [356, 92, 1.2, 0.5], [512, 46, 0.9, 0.35], [668, 112, 1.3, 0.45],
  [804, 58, 1, 0.4], [1124, 92, 1.1, 0.45], [1150, 260, 0.9, 0.35], [1060, 392, 1.3, 0.5], [1164, 520, 1, 0.4],
  [930, 560, 1.2, 0.45], [760, 594, 0.9, 0.3], [560, 572, 1.1, 0.35], [330, 600, 1, 0.3], [120, 566, 1.3, 0.4],
  [40, 330, 1, 0.35], [880, 214, 0.8, 0.3], [640, 236, 0.8, 0.25],
];

function Logo() {
  const cell = 46;
  const gap = 8;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {[0, 1, 2].map((r) => (
        <div key={r} style={{ display: "flex", gap }}>
          {[0, 1, 2].map((c) => {
            const i = r * 3 + c;
            if (i === 4) {
              return (
                <div key={c} style={{ width: cell, height: cell, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 16, height: 16, borderRadius: 8, background: GOLD, boxShadow: "0 0 18px 6px rgba(243, 223, 168, 0.55)" }} />
                </div>
              );
            }
            return (
              <div
                key={c}
                style={{
                  width: cell,
                  height: cell,
                  borderRadius: 13,
                  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.24) 0%, rgba(255, 255, 255, 0.12) 100%)",
                  border: "1px solid rgba(255, 255, 255, 0.16)",
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default async function OpengraphImage() {
  const [extraBold, semiBold] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/manrope-800.ttf")),
    readFile(join(process.cwd(), "assets/fonts/manrope-600.ttf")),
  ]);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "linear-gradient(180deg, #0a0d22 0%, #141a40 52%, #232c63 100%)",
          fontFamily: "Manrope",
          color: INK,
        }}
      >
        {/* la luce della stella grande, in alto a destra, come nell'hero */}
        <div
          style={{
            position: "absolute",
            left: 640,
            top: 0,
            width: 560,
            height: 560,
            // la sfumatura finisce prima dei bordi del riquadro: il disegno delle immagini taglia le sfumature radiali che li toccano
            backgroundImage: "radial-gradient(circle at 70% 20%, rgba(150, 165, 255, 0.24) 0%, rgba(150, 165, 255, 0.08) 22%, rgba(150, 165, 255, 0) 50%)",
          }}
        />
        {STARS.map(([x, y, r, a], k) => (
          <div
            key={k}
            style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: r, background: `rgba(255, 255, 255, ${a})` }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            left: 1028,
            top: 120,
            width: 14,
            height: 14,
            borderRadius: 7,
            background: "#ffffff",
            boxShadow: "0 0 22px 8px rgba(220, 226, 255, 0.55)",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 96px", width: "100%" }}>
          <Logo />
          <div style={{ display: "flex", marginTop: 46, marginLeft: -7, fontSize: 168, fontWeight: 800, letterSpacing: -9, lineHeight: 0.94 }}>
            <span>imad</span>
            <span style={{ color: GOLD }}>.</span>
            <span>chat</span>
            <span style={{ opacity: 0.9 }}>_</span>
          </div>
          <div style={{ display: "flex", marginTop: 30, fontSize: 40, fontWeight: 600, letterSpacing: -0.8, color: "rgba(240, 242, 252, 0.66)" }}>
            il sito di Imad Chatraoui
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Manrope", data: extraBold, weight: 800, style: "normal" },
        { name: "Manrope", data: semiBold, weight: 600, style: "normal" },
      ],
    },
  );
}
