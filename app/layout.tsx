import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-serif-intro",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  variable: "--font-mono-intro",
});

// Il dominio pubblico del progetto: imad.chat quando è collegato, altrimenti l'indirizzo vercel.app.
const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || "imad.chat";

export const metadata: Metadata = {
  metadataBase: new URL(`https://${productionHost}`),
  title: "imad.chat",
  description: "hello, imad's world",
  openGraph: {
    type: "website",
    siteName: "imad.chat",
    title: "imad.chat",
    description: "hello, imad's world",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "hello, imad's world" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#070a14",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${serif.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
