// I caratteri della cornice, con next/font. Applica `siteFontVariables` a un antenato (di solito <html>):
// definisce --font-newsreader, --font-amiri e --font-geist-mono, che i componenti usano con un ripiego.
//
// Amiri pesa: non si precarica. La carica warmSiteFonts() quando il browser è libero, prima che
// serva al primo nome arabo.

import { Amiri, Newsreader } from "next/font/google";
import { GeistMono } from "geist/font/mono";

export const newsreader = Newsreader({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
  variable: "--font-newsreader",
});

export const amiri = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  display: "swap",
  preload: false,
  variable: "--font-amiri",
});

export const geistMono = GeistMono;

export const siteFontVariables = `${newsreader.variable} ${amiri.variable} ${GeistMono.variable}`;
