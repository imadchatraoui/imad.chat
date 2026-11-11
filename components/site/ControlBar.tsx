"use client";

// La barra in basso, sopra l'astrolabio senza coprirne il centro: le otto piastre come una scala
// graduata, l'ora della città scelta, «Adesso», e i gesti dello strumento (gira, qibla, at-Tariq, suono).
// Tutti i bersagli sono di almeno 44 px; rispetta le aree sicure del telefono.

import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import type { CityItem } from "@/lib/astro/types";
import { formatClock, formatDateShort, formatOffset } from "./format";
import { IconFlip, IconQibla, IconTariq } from "./icons";
import SoundToggle from "./SoundToggle";
import t from "./tokens.module.css";
import b from "./ControlBar.module.css";

export type CityLite = Pick<CityItem, "id" | "name" | "nameLocal" | "tz">;

// --- la scala delle città ------------------------------------------------------------------------

export interface CitySwitcherProps {
  cities: readonly CityLite[];
  value: string;
  onChange: (id: string) => void;
  /** Un secondo tocco sulla città già scelta (es. per aprirne la scheda). */
  onReselect?: (id: string) => void;
  className?: string;
}

function scriptOf(s: string): "ar" | "ja" | "latin" {
  if (/[؀-ۿ]/.test(s)) return "ar";
  if (/[぀-ヿ㐀-鿿]/.test(s)) return "ja";
  return "latin";
}

export function CitySwitcher({ cities, value, onChange, onReselect, className }: CitySwitcherProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  // la piastra scelta resta al centro della scala
  useEffect(() => {
    const box = scroller.current;
    const el = box?.querySelector<HTMLElement>(`[data-city="${value}"]`);
    if (!box || !el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const left = el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2;
    box.scrollTo({ left: Math.max(0, left), behavior: first.current || reduce ? "auto" : "smooth" });
    first.current = false;
  }, [value]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = cities.findIndex((c) => c.id === value);
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % cities.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + cities.length) % cities.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = cities.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(cities[next].id);
    requestAnimationFrame(() => scroller.current?.querySelector<HTMLElement>(`[data-city="${cities[next].id}"]`)?.focus());
  };

  return (
    <div ref={scroller} className={`${b.cities} ${className ?? ""}`}>
      <div className={b.cityList} role="radiogroup" aria-label="Piastra dell’astrolabio" onKeyDown={onKeyDown}>
        {cities.map((c) => {
          const checked = c.id === value;
          const script = c.nameLocal ? scriptOf(c.nameLocal) : null;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              data-city={c.id}
              className={`${t.button} ${b.city}`}
              onClick={() => (checked ? onReselect?.(c.id) : onChange(c.id))}
            >
              <span className={b.cityName}>{c.name}</span>
              <span
                className={b.cityLocal}
                data-script={script ?? undefined}
                lang={script === "ar" ? "ar" : script === "ja" ? "ja" : undefined}
                aria-hidden="true"
              >
                {c.nameLocal && c.nameLocal !== c.name ? c.nameLocal : " "}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- l'ora --------------------------------------------------------------------------------------

export interface TimeReadoutProps {
  date: Date;
  timeZone: string;
  isNow: boolean;
  /** L'istante di riferimento per lo scarto «+3 h» (predefinito: l'orologio del dispositivo). */
  now?: number;
  /** Il nome della città, per chi usa un lettore di schermo. */
  cityName?: string;
  /** Se c'è, la lettura diventa un pulsante (es. apre la scheda della città). */
  onClick?: () => void;
  className?: string;
}

export function TimeReadout({ date, timeZone, isNow, now, cityName, onClick, className }: TimeReadoutProps) {
  const ref = now ?? Date.now();
  const clock = formatClock(date, timeZone, isNow);
  // nel viaggio nel tempo la riga si allunga: l'anno si toglie se è quello di adesso
  const day = formatDateShort(date, timeZone, isNow ? undefined : new Date(ref));
  const offset = isNow ? null : formatOffset(date.getTime() - ref);
  const content = (
    <>
      <time className={b.clock} dateTime={date.toISOString()} suppressHydrationWarning>
        {clock}
      </time>
      <span className={b.day} suppressHydrationWarning>
        {day}
      </span>
      {offset ? (
        <span className={b.offset} suppressHydrationWarning>
          {offset}
        </span>
      ) : null}
    </>
  );
  const label = `${cityName ? `${cityName}, ` : ""}ora locale ${clock}, ${day}${offset ? `, ${offset} da adesso` : ""}`;
  return onClick ? (
    <button type="button" className={`${t.button} ${b.time} ${className ?? ""}`} onClick={onClick} aria-label={`${label}. Apri la scheda della città`}>
      {content}
    </button>
  ) : (
    <div className={`${b.time} ${className ?? ""}`} role="group" aria-label={label}>
      {content}
    </div>
  );
}

// --- adesso -------------------------------------------------------------------------------------

export function NowButton({ isNow, onNow, className }: { isNow: boolean; onNow: () => void; className?: string }) {
  return (
    <button
      type="button"
      className={`${t.button} ${b.now} ${className ?? ""}`}
      data-live={isNow ? "" : undefined}
      onClick={onNow}
      title={isNow ? "Il cielo è quello di adesso" : "Torna al cielo di adesso"}
    >
      <span className={b.dot} aria-hidden="true" />
      Adesso
    </button>
  );
}

// --- i gesti dello strumento ---------------------------------------------------------------------

export function ActionButton({
  label,
  icon,
  onClick,
  pressed,
  className,
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  pressed?: boolean;
  className?: string;
}) {
  return (
    <button type="button" className={`${t.button} ${b.action} ${className ?? ""}`} onClick={onClick} aria-pressed={pressed}>
      <span className={b.ring} aria-hidden="true">
        {icon}
      </span>
      <span className={b.label}>{label}</span>
    </button>
  );
}

// --- la barra -------------------------------------------------------------------------------------

export interface ControlBarProps {
  cities: readonly CityLite[];
  cityId: string;
  onCityChange: (id: string) => void;
  /** Tocco sulla città già scelta o sull'ora: apre la scheda della città. */
  onCityInfo?: (id: string) => void;
  /** L'istante mostrato dall'astrolabio. */
  date: Date;
  isNow: boolean;
  /** L'istante di riferimento di «adesso» (predefinito: l'orologio del dispositivo). */
  now?: number;
  onNow: () => void;
  onFlip?: () => void;
  flipped?: boolean;
  onQibla?: () => void;
  qiblaActive?: boolean;
  onTariq?: () => void;
  /** Mostra l'interruttore del suono (predefinito sì). */
  showSound?: boolean;
  /** Nasconde la barra (es. durante l'intro). */
  hidden?: boolean;
  /** Quanto spazio occupa in basso, in px CSS (per lasciare libero lo strumento: framing.bottom). */
  onHeight?: (px: number) => void;
  className?: string;
}

export default function ControlBar({
  cities,
  cityId,
  onCityChange,
  onCityInfo,
  date,
  isNow,
  now,
  onNow,
  onFlip,
  flipped,
  onQibla,
  qiblaActive,
  onTariq,
  showSound = true,
  hidden = false,
  onHeight,
  className,
}: ControlBarProps) {
  const inner = useRef<HTMLDivElement>(null);
  const city = cities.find((c) => c.id === cityId) ?? cities[0];

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el || !onHeight) return;
    const report = () => onHeight(Math.max(0, Math.round(window.innerHeight - el.getBoundingClientRect().top)));
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    window.addEventListener("resize", report);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", report);
    };
  }, [onHeight]);

  return (
    <div className={`${t.vars} ${b.bar} ${className ?? ""}`} data-hidden={hidden ? "" : undefined} aria-hidden={hidden || undefined}>
      <div ref={inner} className={b.inner}>
        <div className={b.timeRow}>
          <TimeReadout
            date={date}
            timeZone={city?.tz ?? "Europe/Rome"}
            isNow={isNow}
            now={now}
            cityName={city?.name}
            onClick={onCityInfo && city ? () => onCityInfo(city.id) : undefined}
          />
          <NowButton isNow={isNow} onNow={onNow} />
        </div>
        <CitySwitcher className={b.cityRow} cities={cities} value={cityId} onChange={onCityChange} onReselect={onCityInfo} />
        <div className={b.actions}>
          {onFlip ? <ActionButton label="gira" icon={<IconFlip size={22} />} onClick={onFlip} pressed={!!flipped} /> : null}
          {onQibla ? <ActionButton label="qibla" icon={<IconQibla size={22} />} onClick={onQibla} pressed={!!qiblaActive} /> : null}
          {onTariq ? <ActionButton label="at-Tariq" icon={<IconTariq size={22} />} onClick={onTariq} /> : null}
          {showSound ? <SoundToggle withLabel className={b.action} ringClassName={b.ring} labelClassName={b.label} /> : null}
        </div>
      </div>
    </div>
  );
}
