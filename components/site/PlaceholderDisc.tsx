"use client";

// Solo per /lab/shell: un disco d'ottone al posto dell'astrolabio, per giudicare la cornice.
// Le punte delle stelle stanno dove le mette la proiezione vera (lib/astro), i segni delle sezioni
// sul lembo, e trascinando il disco si viaggia nel tempo come con la rete.

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { OBLIQUITY, R_CANCER, R_EQ, projectOnRete, rotateClockwise } from "@/lib/astro/projection";
import { reteAngle } from "@/lib/astro/time";
import { RETE_SOURCE } from "@/lib/astro/engraving";
import l from "./Lab.module.css";

export interface DiscStar {
  id: string;
  name: string;
  ra: number;
  dec: number;
}

export interface PlaceholderDiscProps {
  date: Date;
  lon: number;
  stars: readonly DiscStar[];
  sections: readonly { id: string; title: string; angle: number }[];
  flipped: boolean;
  /** Azimut della qibla in gradi, o null. */
  qibla: number | null;
  /** Cambia per far partire il lampo di at-Tariq. */
  tariqKey: number;
  selectedStar?: string | null;
  onStar: (id: string) => void;
  onSection: (id: string) => void;
  /** La rete è stata girata di tanti radianti (in senso orario = avanti nel tempo). */
  onTurn: (radians: number) => void;
}

const S = 76; // raggio del tropico del Capricorno, in unità del disegno
const DEG = Math.PI / 180;

function plate(p: { x: number; y: number }) {
  return { x: p.x * S, y: -p.y * S };
}

function eclipticPath(angle: number): string {
  const e = OBLIQUITY * DEG;
  const pts: string[] = [];
  for (let i = 0; i <= 120; i++) {
    const lam = (i / 120) * 2 * Math.PI;
    const ra = Math.atan2(Math.sin(lam) * Math.cos(e), Math.cos(lam)) / DEG / 15;
    const dec = Math.asin(Math.sin(e) * Math.sin(lam)) / DEG;
    const q = plate(rotateClockwise(projectOnRete((ra + 24) % 24, dec), angle));
    pts.push(`${q.x.toFixed(2)},${q.y.toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

export default function PlaceholderDisc({
  date,
  lon,
  stars,
  sections,
  flipped,
  qibla,
  tariqKey,
  selectedStar,
  onStar,
  onSection,
  onTurn,
}: PlaceholderDiscProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: number; a: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  const angle = reteAngle(date, lon);

  const angleAt = (e: ReactPointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    // il centro del disco è a (0,0) nel viewBox -110 -132 220 242
    const cx = r.left + (110 / 220) * r.width;
    const cy = r.top + (132 / 242) * r.height;
    return Math.atan2(e.clientX - cx, -(e.clientY - cy));
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (flipped) return;
    drag.current = { id: e.pointerId, a: angleAt(e), moved: false };
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const a = angleAt(e);
    let da = a - d.a;
    if (da > Math.PI) da -= 2 * Math.PI;
    if (da < -Math.PI) da += 2 * Math.PI;
    if (!d.moved && Math.abs(da) < 0.03) return;
    if (!d.moved) {
      d.moved = true;
      setDragging(true);
      svgRef.current?.setPointerCapture(e.pointerId);
    }
    d.a = a;
    onTurn(da);
  };
  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    window.setTimeout(() => {
      drag.current = null;
      setDragging(false);
    }, 0);
  };
  const tapped = (fn: () => void) => () => {
    if (drag.current?.moved) return;
    fn();
  };

  const ticks: string[] = [];
  for (let i = 0; i < 360; i += 2) {
    const len = i % 30 === 0 ? 8 : i % 10 === 0 ? 5.5 : 3;
    const s = Math.sin(i * DEG);
    const c = Math.cos(i * DEG);
    ticks.push(`M${(s * 99).toFixed(2)},${(-c * 99).toFixed(2)}L${(s * (99 - len)).toFixed(2)},${(-c * (99 - len)).toFixed(2)}`);
  }

  const qPlate = qibla == null ? null : (qibla - 180) * DEG;

  return (
    <div className={l.discWrap} data-flipped={flipped ? "" : undefined}>
      <svg
        ref={svgRef}
        className={`${l.disc} ${l.front}`}
        viewBox="-110 -132 220 242"
        role="img"
        aria-label="Segnaposto dell’astrolabio: trascina per far girare la rete"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        data-dragging={dragging ? "" : undefined}
      >
        <defs>
          <radialGradient id="ph-limb" cx="0.38" cy="0.3" r="0.85">
            <stop offset="0" stopColor="#f0d79b" />
            <stop offset="0.45" stopColor="#c9a25b" />
            <stop offset="1" stopColor="#7d5a26" />
          </radialGradient>
          <radialGradient id="ph-plate" cx="0.42" cy="0.35" r="0.9">
            <stop offset="0" stopColor="#d9b874" />
            <stop offset="0.6" stopColor="#ad853f" />
            <stop offset="1" stopColor="#6e4f1f" />
          </radialGradient>
          <radialGradient id="ph-flash" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fffaf0" stopOpacity="0.95" />
            <stop offset="1" stopColor="#fffaf0" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* il trono e l'anello */}
        <g fill="url(#ph-limb)" stroke="#5c421a" strokeWidth="0.6">
          <circle cx="0" cy="-121" r="7" fill="none" stroke="#c9a25b" strokeWidth="2.4" />
          <path d="M-30,-93 C-27,-103 -18,-104 -14,-110 C-10,-116 -5,-114 0,-116 C5,-114 10,-116 14,-110 C18,-104 27,-103 30,-93 Z" />
        </g>

        <circle r="100" fill="url(#ph-limb)" stroke="#4d3812" strokeWidth="0.8" />
        <path d={ticks.join("")} stroke="#3f2c0d" strokeWidth="0.45" opacity="0.85" />
        <circle r="86" fill="url(#ph-plate)" stroke="#4d3812" strokeWidth="0.7" />

        {/* la piastra: tropici ed equatore */}
        <g fill="none" stroke="#3f2c0d" strokeWidth="0.45" opacity="0.7">
          <circle r={S} />
          <circle r={R_EQ * S} />
          <circle r={R_CANCER * S} />
          <path d={`M0,${-S}V${S}M${-S},0H${S}`} strokeDasharray="1.2 2.4" />
        </g>

        {/* la rete: l'eclittica e le punte delle stelle, dove sono adesso */}
        <g>
          <path d={eclipticPath(angle)} fill="none" stroke="#f3dfa8" strokeWidth="1.4" opacity="0.9" />
          {stars.map((s) => {
            if (s.dec < -23.4) return null;
            const p = plate(rotateClockwise(projectOnRete(s.ra, s.dec), angle));
            const sel = s.id === selectedStar;
            return (
              <g key={s.id} className={l.star} onClick={tapped(() => onStar(s.id))}>
                <title>{s.name}</title>
                <circle cx={p.x} cy={p.y} r="9" fill="transparent" />
                <circle cx={p.x} cy={p.y} r={sel ? 3.4 : 2.4} fill={sel ? "#fffaf0" : "#2a1d08"} stroke="#f3dfa8" strokeWidth="1.1" />
              </g>
            );
          })}
        </g>

        {/* la regola della qibla */}
        {qPlate != null ? (
          <g className={l.rule}>
            <path d={`M0,0L${(Math.sin(qPlate) * 84).toFixed(2)},${(-Math.cos(qPlate) * 84).toFixed(2)}`} stroke="#fffaf0" strokeWidth="1.6" />
            <rect
              x="-3"
              y="-3"
              width="6"
              height="6"
              fill="#070a14"
              stroke="#f3dfa8"
              strokeWidth="0.8"
              transform={`translate(${(Math.sin(qPlate) * 90).toFixed(2)},${(-Math.cos(qPlate) * 90).toFixed(2)})`}
            />
          </g>
        ) : null}

        {/* i segni delle sezioni sul lembo */}
        {sections.map((s) => {
          const a = s.angle * DEG;
          const x = Math.sin(a) * 93;
          const y = -Math.cos(a) * 93;
          return (
            <g key={s.id} className={l.mark} onClick={tapped(() => onSection(s.id))}>
              <title>{s.title}</title>
              <circle cx={x} cy={y} r="8" fill="transparent" />
              <circle cx={x} cy={y} r="3.6" fill="#f0d79b" stroke="#3f2c0d" strokeWidth="0.7" />
              <circle cx={x} cy={y} r="1.2" fill="#3f2c0d" />
            </g>
          );
        })}

        <circle r="3.2" fill="#f0d79b" stroke="#3f2c0d" strokeWidth="0.7" />

        {tariqKey > 0 ? <circle key={tariqKey} className={l.flash} r="60" cy="-10" fill="url(#ph-flash)" /> : null}
      </svg>

      {/* il retro: il codice che calcola il cielo */}
      <svg className={`${l.disc} ${l.back}`} viewBox="-110 -132 220 242" aria-hidden={!flipped}>
        <circle cx="0" cy="-121" r="7" fill="none" stroke="#c9a25b" strokeWidth="2.4" />
        <path
          d="M-30,-93 C-27,-103 -18,-104 -14,-110 C-10,-116 -5,-114 0,-116 C5,-114 10,-116 14,-110 C18,-104 27,-103 30,-93 Z"
          fill="url(#ph-limb)"
        />
        <circle r="100" fill="#b48d48" stroke="#4d3812" strokeWidth="0.8" />
        <circle r="92" fill="none" stroke="#3f2c0d" strokeWidth="0.5" />
        <text className={l.code} x="-80" y="-20" fill="#3a2709">
          {RETE_SOURCE.split("\n").map((line, i) => (
            <tspan key={i} x="-80" dy={i === 0 ? 0 : 8.6}>
              {line}
            </tspan>
          ))}
        </text>
      </svg>
    </div>
  );
}
