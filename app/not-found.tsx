import Link from "next/link";

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        fontFamily: "var(--font-serif-intro), Georgia, serif",
        color: "#efe6d2",
        padding: "2rem",
      }}
    >
      <div>
        <p style={{ fontStyle: "italic", fontSize: "2rem", margin: 0 }}>Questa pagina non c&rsquo;è.</p>
        <p style={{ marginTop: "1.5rem" }}>
          <Link href="/" style={{ color: "#ead6a0" }}>
            Torna a imad.chat
          </Link>
        </p>
      </div>
    </main>
  );
}
