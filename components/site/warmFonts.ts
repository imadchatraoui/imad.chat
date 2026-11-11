// Fa scaricare in anticipo i caratteri che servono più tardi (l'arabo, il monospace dei dati), quando il
// browser è libero: così il primo nome arabo compare già in Amiri, senza il lampo del carattere di ripiego.

let warmed = false;

function familyOf(variable: string): string | null {
  const v = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return v || null;
}

export function warmSiteFonts(root?: Element | null) {
  if (warmed || typeof window === "undefined" || !("fonts" in document)) return;
  warmed = true;
  const run = () => {
    const style = root ? getComputedStyle(root) : null;
    const arabic = style?.getPropertyValue("--font-amiri").trim() || familyOf("--font-amiri") || "Amiri";
    const mono = style?.getPropertyValue("--font-geist-mono").trim() || familyOf("--font-geist-mono");
    const loads = [
      document.fonts.load(`400 32px ${arabic}`, "الشعرى القدس"),
      document.fonts.load(`700 32px ${arabic}`, "ٱلسَّمَآءِ"),
    ];
    if (mono) loads.push(document.fonts.load(`400 14px ${mono}`, "0123456789:°′″"));
    void Promise.allSettled(loads);
  };
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 2500 });
  else window.setTimeout(run, 1200);
}
