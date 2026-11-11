"use client";

// Il contenuto del foglio per una stella toccata sulla rete. Si carica solo al primo tocco (next/dynamic):
// i dati (content/astro) e i calcoli del cielo (astronomy-engine) restano fuori dal primo caricamento.

import { CURIOSITIES, STARS, VERSES } from "@/lib/astro/data";
import type { CuriosityItem, StarItem } from "@/lib/astro/types";
import StarPanel from "./StarPanel";
import { useShownTime, type TimeStore } from "./timeStore";

/** Le curiosità più vicine a ogni stella; le altre stelle ne ricevono una sulle stelle dai nomi arabi. */
const CURIOSITY_FOR_STAR: Record<string, string> = {
  sirius: "al-shira",
  vega: "tanabata",
  altair: "tanabata",
  betelgeuse: "betelgeuse-punti",
  rigel: "cielo-arabo",
  aldebaran: "cielo-arabo",
  deneb: "cielo-arabo",
  alpheratz: "nuvoletta-andromeda",
};
const GENERAL = ["rete-di-tudela", "libro-stelle-fisse", "chaucer"];

function curiosityFor(star: StarItem): CuriosityItem | null {
  const byId = (id: string) => CURIOSITIES.find((c) => c.id === id) ?? null;
  const own = CURIOSITY_FOR_STAR[star.id];
  if (own) return byId(own);
  const i = Math.max(0, STARS.findIndex((s) => s.id === star.id));
  return byId(GENERAL[i % GENERAL.length]);
}

export interface StarSheetProps {
  id: string;
  /** La città della piastra: per dire quanto è alta la stella sopra il suo orizzonte. */
  where: { name: string; lat: number; lon: number } | null;
  time: TimeStore;
}

export default function StarSheet({ id, where, time }: StarSheetProps) {
  const { date } = useShownTime(time);
  const star = STARS.find((s) => s.id === id);
  if (!star) return null;
  const verse = star.quran ? VERSES.find((v) => v.key === star.quran) ?? null : null;
  return <StarPanel star={star} verse={verse} curiosity={curiosityFor(star)} where={where} date={date} />;
}
