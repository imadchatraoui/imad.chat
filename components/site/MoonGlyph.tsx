// La Luna incisa: il disco d'ottone, la parte in ombra tratteggiata come in un'incisione.
// Disegnata per la frazione illuminata vera e girata come la si vede da quel luogo
// (il lembo acceso guarda il Sole). Nessun hook: va bene sul server e nel browser.

export interface MoonGlyphProps {
  /** Frazione del disco illuminata, 0…1. */
  illuminated: number;
  /** Dove punta il lembo acceso: gradi dall'alto, in senso orario (90 = a destra). */
  brightLimb: number;
  size?: number;
  /** Descrizione per chi non vede l'immagine; senza, è decorativa. */
  label?: string;
  className?: string;
}

const R = 20;

function litPath(k: number): string {
  if (k >= 0.995) return `M0 ${-R}A${R} ${R} 0 1 1 0 ${R}A${R} ${R} 0 1 1 0 ${-R}Z`;
  const rx = Math.abs(1 - 2 * k) * R;
  // dal polo alto lungo il lembo destro, poi indietro lungo il terminatore (un'ellisse)
  return `M0 ${-R}A${R} ${R} 0 0 1 0 ${R}A${rx.toFixed(3)} ${R} 0 0 ${k < 0.5 ? 0 : 1} 0 ${-R}Z`;
}

function darkPath(k: number): string {
  if (k <= 0.005) return `M0 ${-R}A${R} ${R} 0 1 1 0 ${R}A${R} ${R} 0 1 1 0 ${-R}Z`;
  const rx = Math.abs(1 - 2 * k) * R;
  return `M0 ${-R}A${R} ${R} 0 0 0 0 ${R}A${rx.toFixed(3)} ${R} 0 0 ${k < 0.5 ? 0 : 1} 0 ${-R}Z`;
}

export default function MoonGlyph({ illuminated, brightLimb, size = 52, label, className }: MoonGlyphProps) {
  const k = Math.max(0, Math.min(1, illuminated));
  const id = `moon-${Math.round(k * 1000)}-${Math.round(brightLimb)}`;
  const showLit = k > 0.005;
  const showDark = k < 0.995;
  return (
    <svg
      width={size}
      height={size}
      viewBox="-24 -24 48 48"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <defs>
        <radialGradient id={`${id}-lit`} cx="0.36" cy="0.32" r="0.8">
          <stop offset="0" stopColor="#f4e6bd" />
          <stop offset="0.65" stopColor="#e2c98e" />
          <stop offset="1" stopColor="#c9a25b" />
        </radialGradient>
        <pattern id={`${id}-hatch`} width="2.1" height="2.1" patternUnits="userSpaceOnUse" patternTransform="rotate(-32)">
          <line x1="0" y1="0" x2="0" y2="2.1" stroke="#c9a25b" strokeWidth="0.55" strokeOpacity="0.62" />
        </pattern>
      </defs>
      {/* l'anello inciso intorno */}
      <circle r="23" fill="none" stroke="#c9a25b" strokeOpacity="0.32" strokeWidth="0.5" />
      <g transform={`rotate(${(brightLimb - 90).toFixed(2)})`}>
        {showLit ? <path d={litPath(k)} fill={`url(#${id}-lit)`} /> : null}
        {showDark ? (
          <>
            <path d={darkPath(k)} fill="#0c1430" />
            <path d={darkPath(k)} fill={`url(#${id}-hatch)`} />
          </>
        ) : null}
      </g>
      <circle r={R} fill="none" stroke="#c9a25b" strokeWidth="0.8" />
    </svg>
  );
}
