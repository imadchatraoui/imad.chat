// Il frontmatter `anchor` di una sezione dice a cosa si lega sull'astrolabio.
// Funzioni pure: le usa chi vuole aggiungere all'apertura di una sezione il gesto corrispondente.

export type SectionAnchor =
  | { kind: "city"; city: string }
  | { kind: "cielo" }
  | { kind: "tariq" }
  | { kind: "qibla" }
  | { kind: "retro" }
  | { kind: "other"; value: string };

export function parseAnchor(anchor: string | null | undefined): SectionAnchor | null {
  const a = (anchor ?? "").trim().toLowerCase();
  if (!a) return null;
  if (a.startsWith("citta:") || a.startsWith("città:")) {
    const city = a.slice(a.indexOf(":") + 1).trim();
    return city ? { kind: "city", city } : null;
  }
  if (a === "cielo" || a === "tariq" || a === "qibla" || a === "retro") return { kind: a };
  return { kind: "other", value: a };
}

/** L'etichetta del pulsante che compie il gesto legato alla sezione, o null. */
export function anchorActionLabel(a: SectionAnchor | null, cityName?: (id: string) => string | undefined): string | null {
  if (!a) return null;
  switch (a.kind) {
    case "city":
      return `Mostra la piastra di ${cityName?.(a.city) ?? a.city}`;
    case "cielo":
      return "Torna al cielo di adesso";
    case "tariq":
      return "Mostra at-Tariq";
    case "qibla":
      return "Indica la qibla";
    case "retro":
      return "Gira l’astrolabio";
    default:
      return null;
  }
}
