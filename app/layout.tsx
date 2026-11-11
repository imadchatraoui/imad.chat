import type { Metadata, Viewport } from "next";
import { Amiri, Cormorant_Garamond, JetBrains_Mono } from "next/font/google";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// Tre caratteri, ognuno col suo compito:
// - Cormorant Garamond, l'unico serif: titoli, testi, versi, e "imad’s world" nell'intro;
// - JetBrains Mono: solo i dati veri (ore, gradi, coordinate) e il "hello, world" dell'intro;
// - Amiri: l'arabo.
// I nomi delle variabili sono quelli che legge l'intro (components/intro); globals.css ne ricava
// --font-serif, --font-mono e --font-arabic per il resto del sito e per le incisioni dell'astrolabio.

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-serif-intro",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-mono-intro",
});

// L'arabo pesa e non serve al primo disegno: lo scarica la cornice quando il browser è libero.
const arabic = Amiri({
  subsets: ["arabic"],
  weight: "400",
  display: "swap",
  preload: false,
  variable: "--font-amiri",
});

const description =
  "hello, imad’s world: un astrolabio d’ottone che legge il cielo vero, in questo momento. Stelle dai nomi arabi, versetti del Corano, la qibla, Torino e la Palestina.";

export const metadata: Metadata = {
  // imad.chat quando il dominio è collegato, altrimenti l'indirizzo vercel.app: le anteprime funzionano da subito
  metadataBase: new URL(SITE_URL),
  title: { default: "imad.chat", template: "%s · imad.chat" },
  description,
  applicationName: "imad.chat",
  openGraph: {
    type: "website",
    siteName: "imad.chat",
    locale: "it_IT",
    url: "/",
    title: "imad.chat",
    description,
  },
  twitter: { card: "summary_large_image", title: "imad.chat", description },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#070a14",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${serif.variable} ${mono.variable} ${arabic.variable}`}>
      <body>{children}</body>
    </html>
  );
}
