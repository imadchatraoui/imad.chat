/**
 * Il segno ۞ (rub el hizb) dei manoscritti del Corano, disegnato: due quadrati e un punto.
 * Chiude ogni pagina del diario ed è l'icona del sito.
 */
export default function Star({ size = 28, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: "flex" }} aria-hidden="true">
      <g fill="none" stroke={color} strokeWidth="3">
        <rect x="18" y="18" width="28" height="28" />
        <rect x="18" y="18" width="28" height="28" transform="rotate(45 32 32)" />
      </g>
      <circle cx="32" cy="32" r="3.5" fill={color} />
    </svg>
  );
}
