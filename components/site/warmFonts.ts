// Fa scaricare in anticipo i caratteri che servono più tardi (l'arabo, il corsivo e il monospace dei dati),
// quando il browser è libero: così il primo nome arabo compare già in Amiri, senza il lampo del carattere
// di ripiego. Le variabili arrivano da next/font (app/layout.tsx).

let warmed = false;

function familyOf(el: Element, variable: string): string | null {
  const v = getComputedStyle(el).getPropertyValue(variable).trim();
  return v || null;
}

export function warmSiteFonts(root?: Element | null) {
  if (warmed || typeof window === "undefined" || !("fonts" in document)) return;
  warmed = true;
  const run = () => {
    const el = root ?? document.documentElement;
    const arabic = familyOf(el, "--font-amiri") ?? "Amiri";
    const mono = familyOf(el, "--font-mono-intro");
    const serif = familyOf(el, "--font-serif-intro");
    const loads = [document.fonts.load(`400 32px ${arabic}`, "الشعرى القدس ٱلسَّمَآءِ")];
    if (mono) loads.push(document.fonts.load(`400 14px ${mono}`, "0123456789:°′″"));
    // i nomi traslitterati (al-Shiʿrā, aṭ-Ṭāriq) usano le lettere dell'alfabeto latino esteso
    if (serif) loads.push(document.fonts.load(`italic 500 20px ${serif}`, "ʿāīūṭḥṣḍẓĀĪŪṬḤṢ"), document.fonts.load(`500 20px ${serif}`, "ʿāīūṭḥṣḍẓ"));
    void Promise.allSettled(loads);
  };
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 2500 });
  else window.setTimeout(run, 1200);
}
