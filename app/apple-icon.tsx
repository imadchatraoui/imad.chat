import { ImageResponse } from "next/og";

// L'icona per la schermata Home del telefono: il logo dei nove tasti, il centro d'oro, sul blu di notte dell'hero
// (lo stesso disegno di app/icon.svg). iOS arrotonda da sé gli angoli.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const CELL = 44;
const GAP = 9;

function Key({ i }: { i: number }) {
  if (i === 4) {
    return (
      <div style={{ width: CELL, height: CELL, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            background: "#f3dfa8",
            boxShadow: "0 0 16px 5px rgba(243, 223, 168, 0.55)",
          }}
        />
      </div>
    );
  }
  return (
    <div
      style={{
        width: CELL,
        height: CELL,
        borderRadius: 12,
        background: "#eef0fa",
        opacity: i % 2 === 1 ? 0.62 : 0.9,
      }}
    />
  );
}

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: GAP,
          background: "linear-gradient(180deg, #141a40 0%, #232c63 100%)",
        }}
      >
        {[0, 1, 2].map((r) => (
          <div key={r} style={{ display: "flex", gap: GAP }}>
            {[0, 1, 2].map((c) => (
              <Key key={c} i={r * 3 + c} />
            ))}
          </div>
        ))}
      </div>
    ),
    size,
  );
}
