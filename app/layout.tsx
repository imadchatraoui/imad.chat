import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { GeistMono } from "geist/font/mono";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// Le pagine del sito sono statiche (public/, da scripts/home/build.mjs) e hanno i loro metadati. Questo layout serve a ciò che
// rende Next: la pagina 404 (app/not-found.tsx), l'anteprima condivisa, le icone, robots.txt e la sitemap.
// I caratteri sono quelli della casa: Manrope (una copia in assets/fonts, niente rete durante la build) e Geist Mono.

const manrope = localFont({
  src: "../assets/fonts/manrope-latin.woff2",
  weight: "200 800",
  display: "swap",
  variable: "--font-manrope",
});

const description = "Il sito di Imad Chatraoui.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "imad.chat — il sito di Imad Chatraoui", template: "%s — imad.chat" },
  description,
  applicationName: "imad.chat",
  openGraph: { type: "website", siteName: "imad.chat", locale: "it_IT", title: "imad.chat — il sito di Imad Chatraoui", description },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef0f8" },
    { media: "(prefers-color-scheme: dark)", color: "#070810" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${manrope.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
