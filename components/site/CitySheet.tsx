"use client";

// Il contenuto del foglio per la città della piastra. Si carica solo quando serve (next/dynamic).

import { CITIES } from "@/lib/astro/data";
import CityPanel from "./CityPanel";
import { useShownTime, type TimeStore } from "./timeStore";

export interface CitySheetProps {
  id: string;
  time: TimeStore;
}

export default function CitySheet({ id, time }: CitySheetProps) {
  // l'ora mostra i secondi quando segue l'orologio vero: si aggiorna ogni secondo
  const { date, isNow } = useShownTime(time, true);
  const city = CITIES.find((c) => c.id === id);
  if (!city) return null;
  return <CityPanel city={city} date={date} isNow={isNow} />;
}
