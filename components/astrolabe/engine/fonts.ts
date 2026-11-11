// I caratteri delle incisioni. Le pagine li caricano con next/font e li espongono come variabili CSS:
// --font-newsreader (serif), --font-amiri (arabo), --font-geist-mono (dati). Qui li leggiamo
// dall'elemento che ospita l'astrolabio, con ripieghi sicuri.

export interface EngraveFonts {
  serif: string;
  mono: string;
  arabic: string;
}

const FALLBACK: EngraveFonts = {
  serif: '"Newsreader", "Cormorant Garamond", "Iowan Old Style", Georgia, serif',
  mono: '"Geist Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
  arabic: '"Amiri", "Noto Naskh Arabic", "Geeza Pro", serif',
};

function cssVar(el: Element, name: string): string {
  try {
    return getComputedStyle(el).getPropertyValue(name).trim();
  } catch {
    return "";
  }
}

export function resolveFonts(el?: Element | null): EngraveFonts {
  if (typeof window === "undefined") return FALLBACK;
  const host = el ?? document.documentElement;
  const serif = cssVar(host, "--font-newsreader") || cssVar(host, "--font-cormorant");
  const mono = cssVar(host, "--font-geist-mono") || cssVar(host, "--font-mono");
  const arabic = cssVar(host, "--font-amiri");
  return {
    serif: serif ? `${serif}, Georgia, serif` : FALLBACK.serif,
    mono: mono ? `${mono}, ui-monospace, Menlo, monospace` : FALLBACK.mono,
    arabic: arabic ? `${arabic}, "Noto Naskh Arabic", serif` : FALLBACK.arabic,
  };
}

/** Aspetta che i caratteri delle incisioni siano pronti (al massimo `timeout` ms). */
export async function waitForFonts(f: EngraveFonts, timeout = 2500): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  const loads = [
    `40px ${f.serif}`,
    `italic 40px ${f.serif}`,
    `40px ${f.mono}`,
    `40px ${f.arabic}`,
  ].map((spec) => document.fonts.load(spec).catch(() => []));
  await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, timeout))]);
}
