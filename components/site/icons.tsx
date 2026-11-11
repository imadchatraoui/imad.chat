// Icone incise: linee sottili d'ottone su un quadrato di 24 unità, colore dal testo (currentColor).

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Gira: lo strumento visto di taglio, con l'anello di sospensione, e l'orbita del giro. */
export function IconFlip(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="3.6" r="1.35" />
      <ellipse cx="12" cy="12.6" rx="4.1" ry="7.4" />
      <path d="M12 5.2v.4" />
      <path d="M12 9.4v6.4" strokeWidth={0.9} opacity={0.75} />
      <path d="M5.1 10.6C2.9 11.4 1.9 12.4 1.9 13.4c0 2.1 4.5 3.8 10.1 3.8s10.1-1.7 10.1-3.8c0-1-1-2-3.2-2.8" />
      <path d="M17.6 9.5l1.4 1.1-1.3 1.3" />
    </Svg>
  );
}

/** Qibla: una bussola il cui ago indica la Kaʿba, fuori dal quadrante. */
export function IconQibla(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="13.5" r="7.6" />
      <path d="M11 6.9v1.1M11 19v1.1M4.4 13.5h1.1M16.5 13.5h1.1" strokeWidth={1} opacity={0.8} />
      <path d="M15.4 8.8l-3.3 5.8-3.4 1.6 1.2-3.5z" strokeWidth={1} />
      <path d="M15.4 8.8l-3.3 5.8-2.2-2z" fill="currentColor" strokeWidth={1} />
      <rect x="16.7" y="2.6" width="4.4" height="4.4" rx="0.3" fill="currentColor" stroke="none" />
      <path d="M16.7 4.1h4.4" stroke="var(--night, #070a14)" strokeWidth={0.75} />
    </Svg>
  );
}

/** At-Tariq: an-najm ath-thāqib, la stella così luminosa che trafigge il buio con i suoi raggi. */
export function IconTariq(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 1.2l.62 10.18L12 22.8l-.62-11.42z" fill="currentColor" stroke="none" />
      <path d="M1.2 12l10.18-.62L22.8 12l-11.42.62z" fill="currentColor" stroke="none" />
      <path d="M8.1 8.1l7.8 7.8M15.9 8.1l-7.8 7.8" strokeWidth={0.8} opacity={0.6} />
      <circle cx="12" cy="12" r="4.9" strokeWidth={0.9} opacity={0.7} />
      <circle cx="12" cy="12" r="1.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Suono acceso o spento. */
export function IconSound({ on, ...props }: IconProps & { on: boolean }) {
  return (
    <Svg {...props}>
      <path d="M3.6 9.6h3.3l4.6-4v12.8l-4.6-4H3.6z" />
      {on ? (
        <>
          <path d="M14.6 9.3a3.8 3.8 0 0 1 0 5.4" />
          <path d="M17.2 6.8a7.4 7.4 0 0 1 0 10.4" />
        </>
      ) : (
        <path d="M15.4 10l4 4M19.4 10l-4 4" />
      )}
    </Svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </Svg>
  );
}

/** La stella a otto punte: due quadrati incrociati, come sulle piastre e sui frontespizi. */
export function StarMark({ size = 22, title, ...rest }: IconProps & { title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <g stroke="currentColor" strokeWidth={1.5} strokeLinejoin="miter">
        <rect x="7.4" y="7.4" width="17.2" height="17.2" />
        <rect x="7.4" y="7.4" width="17.2" height="17.2" transform="rotate(45 16 16)" />
      </g>
      <circle cx="16" cy="16" r="5.1" stroke="currentColor" strokeWidth={0.75} opacity={0.75} />
      <circle cx="16" cy="16" r="1.9" fill="currentColor" />
    </svg>
  );
}
