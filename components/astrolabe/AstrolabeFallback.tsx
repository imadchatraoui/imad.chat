"use client";

// La versione 2D dell'astrolabio, in SVG: per chi non ha WebGL o ha chiesto di ridurre il movimento.
// Stessa matematica del 3D (lib/astro): la piastra della città, la rete con i puntatori sulle stelle,
// il lembo graduato con i segni delle sezioni, la regola, il retro con il codice inciso.
// Si trascina la rete, si toccano le stelle; i cambi sono quieti, senza grandi movimenti.

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  CITIES,
  DEG,
  getCity,
  horizonPoint,
  azimuthCurve,
  msForReteTurn,
  plateGeometry,
  projectOnRete,
  qiblaBearing,
  RETE_SOURCE,
  reteAngle,
  reteDesign,
  rotateClockwise,
  clockAngle,
  STARS,
  sunEquatorial,
  toDateCoordsMany,
  type AstroSection,
  type PlateCurve,
  type Pt,
} from "@/lib/astro";
import type { AstrolabeHandle, AstrolabeProps } from "./types";
import { DIMS } from "./engine/dims";

const VB = 1.32; // mezzo lato del riquadro, in unità di piastra
const TOP = 2.12; // il trono e l'anello sporgono in alto

const C = {
  brass: "#c9a25b",
  brassLight: "#ead6a0",
  brassDark: "#8a6630",
  line: "#3a2810",
  night: "#070a14",
  lapis: "#14204a",
  cream: "#efe6d2",
};

const X = (x: number) => x;
const Y = (y: number) => -y;

function curveEl(c: PlateCurve, props: React.SVGProps<SVGCircleElement & SVGLineElement>, key?: string | number) {
  if (c.kind === "circle") return <circle key={key} cx={X(c.cx)} cy={Y(c.cy)} r={c.r} {...props} />;
  const dx = c.x2 - c.x1;
  const dy = c.y2 - c.y1;
  const l = Math.hypot(dx, dy) || 1;
  return <line key={key} x1={X(c.x1 - (dx / l) * 4)} y1={Y(c.y1 - (dy / l) * 4)} x2={X(c.x1 + (dx / l) * 4)} y2={Y(c.y1 + (dy / l) * 4)} {...props} />;
}

const poly = (pts: Pt[]) => "M" + pts.map((p) => `${X(p.x).toFixed(4)},${Y(p.y).toFixed(4)}`).join("L") + "Z";

/** Il contorno del trono, in SVG (le stesse curve del 3D, semplificate). */
function kursiPath(): string {
  const segs = (s: number) => [
    [0.25 * s, 1.12, 0.48 * s, 1.03, 0.66 * s, 0.906],
    [0.74 * s, 1.0],
    [0.82 * s, 1.02, 0.87 * s, 1.1, 0.82 * s, 1.16],
    [0.78 * s, 1.2, 0.72 * s, 1.17, 0.7 * s, 1.14],
    [0.64 * s, 1.17, 0.6 * s, 1.23, 0.53 * s, 1.29],
    [0.55 * s, 1.35, 0.47 * s, 1.41, 0.41 * s, 1.37],
    [0.36 * s, 1.4, 0.31 * s, 1.42, 0.27 * s, 1.44],
    [0.29 * s, 1.5, 0.23 * s, 1.55, 0.18 * s, 1.52],
    [0.16 * s, 1.58, 0.1 * s, 1.62, 0.055 * s, 1.645],
    [0.04 * s, 1.67, 0.03 * s, 1.69, 0, DIMS.kursiTop],
  ];
  const fmt = (x: number, y: number) => `${X(x).toFixed(3)},${Y(y).toFixed(3)}`;
  let d = `M${fmt(0, 1.12)}`;
  for (const v of segs(1)) d += v.length === 2 ? `L${fmt(v[0], v[1])}` : `C${fmt(v[0], v[1])} ${fmt(v[2], v[3])} ${fmt(v[4], v[5])}`;
  // la metà sinistra al contrario
  const left = segs(-1);
  const pts: number[][] = [[0, 1.12], ...left];
  for (let i = pts.length - 1; i >= 1; i--) {
    const cur = pts[i];
    const prevEnd = pts[i - 1].slice(-2);
    d += cur.length === 2 ? `L${fmt(prevEnd[0], prevEnd[1])}` : `C${fmt(cur[2], cur[3])} ${fmt(cur[0], cur[1])} ${fmt(prevEnd[0], prevEnd[1])}`;
  }
  return d + "Z";
}

export default function AstrolabeFallback(props: AstrolabeProps) {
  const { city: cityId = "torino", observer = null, sections = [], className, framing, ref } = props;
  const frame = { top: framing?.top ?? 0.06, bottom: framing?.bottom ?? 0.1, side: framing?.side ?? 0.035 };
  const city = getCity(cityId) ?? getCity("torino") ?? CITIES[0];
  const [offset, setOffset] = useState(0);
  const [nowMode, setNowMode] = useState(true);
  const [tick, setTick] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [qibla, setQibla] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [tariq, setTariq] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: number; last: number; moved: boolean; x: number; y: number } | null>(null);
  const cb = useRef(props);
  cb.current = props;

  // il cielo vero scorre: si aggiorna ogni 20 secondi
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 20000);
    return () => clearInterval(t);
  }, []);

  const simTime = Date.now() + (nowMode ? 0 : offset);
  void tick;
  const date = new Date(simTime);
  const lon = city?.lon ?? 0;
  const angle = reteAngle(date, lon);

  const plate = useMemo(() => (city ? plateGeometry(city.lat, { altStep: 6, azStep: 15 }) : null), [city]);
  const design = useMemo(() => {
    const list = STARS.filter((s) => s.pointer);
    const dated = toDateCoordsMany(
      list.map((s) => ({ ra: s.ra, dec: s.dec })),
      new Date(),
    );
    return reteDesign(list.map((s, i) => ({ id: s.id, ra: dated[i].ra, dec: dated[i].dec, mag: s.mag, special: !!s.quran })));
  }, []);

  const sun = sunEquatorial(date);
  const sunAngle = clockAngle(rotateClockwise(projectOnRete(sun.ra, sun.dec), angle));
  const obs = observer ?? (city ? { lat: city.lat, lon: city.lon } : { lat: 45, lon: 7.7 });
  const bearing = qiblaBearing(obs.lat, obs.lon);
  const qPoint = city ? horizonPoint(bearing, city.lat) : { x: 0, y: 0 };
  const ruleAngle = qibla ? clockAngle(qPoint) : sunAngle;

  const emitTime = useCallback((d: Date, now: boolean) => cb.current.onTimeChange?.(d, now), []);
  useEffect(() => {
    emitTime(new Date(Date.now() + (nowMode ? 0 : offset)), nowMode);
  }, [offset, nowMode, emitTime]);

  const handle = useMemo<AstrolabeHandle>(
    () => ({
      mode: "2d",
      assemble: () => cb.current.onEvent?.("assemble"),
      explode: () => undefined,
      flip: () => {
        setFlipped((f) => !f);
        cb.current.onEvent?.("flip");
      },
      triggerTariq: () => {
        setTariq(true);
        cb.current.onEvent?.("tariq");
        setTimeout(() => setTariq(false), 5200);
      },
      setTime: (d: Date) => {
        setOffset(d.getTime() - Date.now());
        setNowMode(false);
      },
      resetNow: () => {
        setOffset(0);
        setNowMode(true);
        setQibla(false);
      },
      pointQibla: (on = true) => {
        setQibla(on);
        if (on) cb.current.onEvent?.("qibla");
        return bearing;
      },
      scramble: () => undefined,
      realign: () => undefined,
      selectStar: (id: string | null) => setSelected(id),
      getTime: () => new Date(Date.now() + offsetRef.current),
      isNow: () => nowRef.current,
      getLimbScreenCircle: () => {
        const svg = svgRef.current;
        if (!svg) return null;
        const r = svg.getBoundingClientRect();
        const scale = Math.min(r.width / (2 * VB), r.height / (VB + TOP));
        return { cx: r.width / 2, cy: (TOP / (VB + TOP)) * r.height, r: DIMS.mater * scale };
      },
    }),
    [bearing],
  );
  const offsetRef = useRef(0);
  offsetRef.current = nowMode ? 0 : offset;
  const nowRef = useRef(true);
  nowRef.current = nowMode;

  useImperativeHandle(ref, () => handle, [handle]);
  useEffect(() => {
    cb.current.onReady?.(handle);
    // una volta sola, quando c'è
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- gesti: trascinare la rete, toccare stelle e segni
  const toLocal = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const m = svg.getScreenCTM();
    if (!m) return null;
    const p = pt.matrixTransform(m.inverse());
    return { x: p.x, y: -p.y };
  };

  const onDown = (e: React.PointerEvent) => {
    const p = toLocal(e.clientX, e.clientY);
    if (!p || Math.hypot(p.x, p.y) > DIMS.mater) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { id: e.pointerId, last: Math.atan2(p.x, p.y), moved: false, x: e.clientX, y: e.clientY };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) d.moved = true;
    if (!d.moved || flipped) return;
    const p = toLocal(e.clientX, e.clientY);
    if (!p || Math.hypot(p.x, p.y) < 0.12) return;
    const a = Math.atan2(p.x, p.y);
    let da = a - d.last;
    if (da > Math.PI) da -= 2 * Math.PI;
    if (da < -Math.PI) da += 2 * Math.PI;
    d.last = a;
    const base = nowRef.current ? 0 : offsetRef.current;
    setOffset(base + msForReteTurn(da));
    setNowMode(false);
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved || flipped) return;
    const p = toLocal(e.clientX, e.clientY);
    if (!p) return;
    // la stella più vicina
    const svg = svgRef.current!;
    const scale = svg.getBoundingClientRect().width / (2 * VB);
    let best: string | null = null;
    let bestD = 26 / scale;
    for (const ptr of design.pointers) {
      const q = rotateClockwise(ptr.tip, angle);
      const dd = Math.hypot(q.x - p.x, q.y - p.y);
      if (dd < bestD) {
        bestD = dd;
        best = ptr.id;
      }
    }
    if (best) {
      setSelected(best);
      cb.current.onEvent?.("select");
      cb.current.onStarSelect?.(best);
      return;
    }
    let sec: AstroSection | null = null;
    let sd = 26 / scale;
    for (const s of sections) {
      const a = s.angle * DEG;
      const rr = DIMS.mater - 0.04;
      const dd = Math.hypot(Math.sin(a) * rr - p.x, Math.cos(a) * rr - p.y);
      if (dd < sd) {
        sd = dd;
        sec = s;
      }
    }
    if (sec) {
      cb.current.onEvent?.("select");
      cb.current.onSectionSelect?.(sec.id);
    }
  };
  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 * 60000 : 3600000;
    const base = nowMode ? 0 : offset;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      setOffset(base + step);
      setNowMode(false);
      e.preventDefault();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      setOffset(base - step);
      setNowMode(false);
      e.preventDefault();
    } else if (e.key === "Home") {
      setOffset(0);
      setNowMode(true);
      e.preventDefault();
    }
  };

  if (!city || !plate) return <div className={className} />;
  const h = plate.horizon;
  const R = DIMS.mater;
  const deg = angle / DEG;
  const kursi = kursiPath();
  const qCurve = qibla ? azimuthCurve(bearing, city.lat) : null;

  return (
    <div
      className={className}
      style={{ position: "relative", width: "100%", height: "100%" }}
      tabIndex={0}
      role="group"
      aria-roledescription="astrolabio"
      aria-label="Astrolabio d'ottone, versione semplice. Trascina la rete per viaggiare nel tempo; tocca un puntatore per conoscere la stella. Con la tastiera: frecce per spostarti di un'ora, Home per tornare ad adesso."
      onKeyDown={onKey}
    >
      <svg
        ref={svgRef}
        viewBox={`${-VB} ${-TOP} ${2 * VB} ${VB + TOP}`}
        style={{
          position: "absolute",
          top: `${frame.top * 100}%`,
          bottom: `${frame.bottom * 100}%`,
          left: `${frame.side * 100}%`,
          right: `${frame.side * 100}%`,
          width: `${(1 - 2 * frame.side) * 100}%`,
          height: `${(1 - frame.top - frame.bottom) * 100}%`,
          display: "block",
          touchAction: "pan-y pinch-zoom",
          userSelect: "none",
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => (drag.current = null)}
      >
        <defs>
          <radialGradient id="ab-brass" cx="35%" cy="30%" r="80%">
            <stop offset="0" stopColor={C.brassLight} />
            <stop offset="0.55" stopColor={C.brass} />
            <stop offset="1" stopColor={C.brassDark} />
          </radialGradient>
          <linearGradient id="ab-rete" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f1dc9f" />
            <stop offset="1" stopColor="#b9904a" />
          </linearGradient>
          <clipPath id="ab-plate">
            <circle r={1} />
          </clipPath>
          <clipPath id="ab-sky">
            {h.kind === "circle" ? (
              plate.skyInside ? (
                <circle cx={X(h.cx)} cy={Y(h.cy)} r={h.r} />
              ) : (
                <path clipRule="evenodd" d={`M-3,-3H3V3H-3Z M${X(h.cx) - h.r},${Y(h.cy)} a${h.r},${h.r} 0 1,0 ${2 * h.r},0 a${h.r},${h.r} 0 1,0 ${-2 * h.r},0Z`} />
              )
            ) : (
              <rect x={-3} y={-3} width={6} height={3 + Y(h.y1)} />
            )}
          </clipPath>
        </defs>

        {/* il trono e l'anello */}
        <circle cx={0} cy={Y(DIMS.kursiTop + 0.07 + DIMS.ringR)} r={DIMS.ringR} fill="none" stroke="url(#ab-brass)" strokeWidth={DIMS.ringTube * 2} />
        <path d={kursi} fill="url(#ab-brass)" fillRule="evenodd" stroke={C.line} strokeWidth={0.004} />
        {/* la maniglia a bocciolo e i trafori del trono */}
        <ellipse cx={0} cy={Y(DIMS.kursiTop + 0.005)} rx={0.026} ry={0.075} fill="url(#ab-brass)" stroke={C.line} strokeWidth={0.003} />
        <g fill={C.night}>
          <circle cx={0} cy={Y(1.625)} r={0.015} />
          <path d={`M-0.05,${Y(1.31)}L-0.05,${Y(1.405)}C-0.05,${Y(1.45)} -0.012,${Y(1.47)} -0.006,${Y(1.5)}L0,${Y(1.522)}L0.006,${Y(1.5)}C0.012,${Y(1.47)} 0.05,${Y(1.45)} 0.05,${Y(1.405)}L0.05,${Y(1.31)}Q0,${Y(1.29)} -0.05,${Y(1.31)}Z`} />
          {[-1, 1].map((s) => (
            <g key={s}>
              <circle cx={0.79 * s} cy={Y(1.105)} r={0.019} />
              <circle cx={0.135 * s} cy={Y(1.535)} r={0.014} />
            </g>
          ))}
          <g fill="none" stroke={C.night} strokeLinecap="round">
            {[-1, 1].map((s) => (
              <g key={s}>
                <path d={`M${0.095 * s},${Y(1.31)}C${0.17 * s},${Y(1.42)} ${0.24 * s},${Y(1.28)} ${0.31 * s},${Y(1.37)}`} strokeWidth={0.024} />
                <path d={`M${0.34 * s},${Y(1.27)}C${0.4 * s},${Y(1.22)} ${0.47 * s},${Y(1.25)} ${0.45 * s},${Y(1.3)}`} strokeWidth={0.022} />
                <path d={`M${0.12 * s},${Y(1.42)}C${0.16 * s},${Y(1.48)} ${0.21 * s},${Y(1.4)} ${0.24 * s},${Y(1.45)}`} strokeWidth={0.016} />
                <path d={`M${0.555 * s},${Y(1.175)}C${0.585 * s},${Y(1.15)} ${0.625 * s},${Y(1.15)} ${0.645 * s},${Y(1.18)}`} strokeWidth={0.016} />
              </g>
            ))}
          </g>
        </g>

        {!flipped ? (
          <g>
            {/* la madre con il lembo graduato */}
            <circle r={R} fill="url(#ab-brass)" stroke={C.line} strokeWidth={0.006} />
            <g stroke={C.line} strokeLinecap="round">
              {Array.from({ length: 360 }, (_, d) => {
                const a = d * DEG;
                const r1 = R - 0.018;
                const r0 = d % 10 === 0 ? R - 0.062 : d % 5 === 0 ? r1 - 0.03 : r1 - 0.018;
                return <line key={d} x1={Math.sin(a) * r0} y1={-Math.cos(a) * r0} x2={Math.sin(a) * r1} y2={-Math.cos(a) * r1} strokeWidth={d % 10 === 0 ? 0.004 : 0.0022} />;
              })}
            </g>
            <g fill={C.line} fontFamily="var(--font-newsreader), Georgia, serif" fontSize={0.05} textAnchor="middle" dominantBaseline="middle">
              {Array.from({ length: 36 }, (_, i) => {
                const d = i * 10;
                const a = d * DEG;
                const rr = R - 0.1;
                const lower = Math.cos(a) < -0.001;
                return (
                  <text key={d} x={Math.sin(a) * rr} y={-Math.cos(a) * rr} transform={`rotate(${lower ? d + 180 : d} ${Math.sin(a) * rr} ${-Math.cos(a) * rr})`}>
                    {d}
                  </text>
                );
              })}
            </g>
            {sections.map((s) => {
              const a = s.angle * DEG;
              const rr = R - 0.04;
              return (
                <g key={s.id} transform={`translate(${Math.sin(a) * rr} ${-Math.cos(a) * rr}) rotate(${s.angle})`}>
                  <circle r={0.034} fill={C.brass} stroke={C.line} strokeWidth={0.004} />
                  <path d="M0,-0.022L0.0062,-0.0062L0.022,0L0.0062,0.0062L0,0.022L-0.0062,0.0062L-0.022,0L-0.0062,-0.0062Z" fill={C.line} />
                  <title>{s.title}</title>
                </g>
              );
            })}
            {/* la piastra della città */}
            <circle r={DIMS.plate} fill="#d8b56e" stroke={C.line} strokeWidth={0.004} />
            <g clipPath="url(#ab-plate)" fill="none" stroke={C.line} strokeWidth={0.0035}>
              <g clipPath="url(#ab-sky)" strokeWidth={0.0022} opacity={0.7}>
                {plate.azimuths.map((a, i) => curveEl(a.curve, {}, i))}
              </g>
              {plate.almucantars.map((a, i) => curveEl(a.curve, { strokeWidth: a.alt % 30 === 0 ? 0.0045 : 0.0028 }, i))}
              {plate.twilight && curveEl(plate.twilight, { strokeDasharray: "0.012 0.008" })}
              {plate.hours.map((hl) => (
                <path key={hl.n} d={"M" + hl.points.map((p) => `${X(p.x)},${Y(p.y)}`).join("L")} strokeDasharray="0.006 0.006" strokeWidth={0.0022} />
              ))}
              {curveEl(h, { strokeWidth: 0.008 })}
              <line x1={0} y1={-1} x2={0} y2={1} />
              <line x1={-1} y1={0} x2={1} y2={0} />
              <circle r={1} strokeWidth={0.006} />
              <circle r={plate.rEquator} />
              <circle r={plate.rCancer} />
              {qCurve && curveEl(qCurve, { stroke: "#fff3c8", strokeWidth: 0.008, clipPath: "url(#ab-sky)" })}
            </g>
            <text x={0} y={Y(-0.33)} textAnchor="middle" fontFamily="var(--font-newsreader), Georgia, serif" fontStyle="italic" fontSize={0.06} fill={C.line}>
              {city.name}
            </text>
            {qibla && <circle cx={X(qPoint.x)} cy={Y(qPoint.y)} r={0.022} fill="#fff3c8" />}

            {/* la rete, girata dall'ora */}
            <g transform={`rotate(${deg})`} fill="url(#ab-rete)" stroke={C.line} strokeWidth={0.0025}>
              <path fillRule="evenodd" d={`M${-design.ring.outer},0a${design.ring.outer},${design.ring.outer} 0 1,0 ${2 * design.ring.outer},0a${design.ring.outer},${design.ring.outer} 0 1,0 ${-2 * design.ring.outer},0Z M${-design.ring.inner},0a${design.ring.inner},${design.ring.inner} 0 1,0 ${2 * design.ring.inner},0a${design.ring.inner},${design.ring.inner} 0 1,0 ${-2 * design.ring.inner},0Z`} />
              <circle cx={X(design.ecliptic.cx)} cy={Y(design.ecliptic.cy)} r={design.ecliptic.r - design.ecliptic.width / 2} fill="none" stroke="url(#ab-rete)" strokeWidth={design.ecliptic.width} />
              <path d={`M0,${Y(design.equator.r)}A${design.equator.r},${design.equator.r} 0 0,0 0,${Y(-design.equator.r)}`} fill="none" stroke="url(#ab-rete)" strokeWidth={design.equator.width} />
              {design.bars.map((b, i) => (
                <line key={i} x1={X(b.a.x)} y1={Y(b.a.y)} x2={X(b.b.x)} y2={Y(b.b.y)} stroke="url(#ab-rete)" strokeWidth={b.width} />
              ))}
              <circle r={design.hub.r} />
              {design.ornaments.map((o, i) => (
                <path key={i} d={poly(o)} strokeWidth={0.0015} />
              ))}
              {design.piercings.map((h, i) => (
                <circle key={`h${i}`} cx={X(h.cx)} cy={Y(h.cy)} r={h.r} fill="#c9a564" strokeWidth={0.001} />
              ))}
              {design.pointers.map((p) => (
                <g key={p.id}>
                  {p.stem && <path d={poly(p.stem)} strokeWidth={0.0015} />}
                  {p.kind === "flame" && <path d={poly(p.outline)} strokeWidth={0.0015} />}
                  {p.rosette && <circle cx={X(p.rosette.cx)} cy={Y(p.rosette.cy)} r={p.rosette.r} />}
                  {(p.kind === "hole" || selected === p.id) && (
                    <circle cx={X(p.tip.x)} cy={Y(p.tip.y)} r={selected === p.id ? 0.016 : 0.009} fill={selected === p.id ? "#fff6dc" : C.night} stroke="none" />
                  )}
                </g>
              ))}
              <circle r={design.hub.hole} fill={C.night} stroke="none" />
            </g>

            {/* la regola: segue il Sole (sul lembo si legge l'ora solare) o la qibla */}
            <g transform={`rotate(${ruleAngle / DEG})`}>
              <path d="M0,-1.13L0.03,-0.97L0.03,-0.06A0.058,0.058 0 0,1 0.03,0.06L0.03,0.97L0,1.13L-0.03,0.97L-0.03,0.06A0.058,0.058 0 0,1 -0.03,-0.06L-0.03,-0.97Z" fill="url(#ab-brass)" stroke={C.line} strokeWidth={0.003} />
              <line x1={0} y1={-1.1} x2={0} y2={1.1} stroke={C.line} strokeWidth={0.002} />
            </g>
            <circle r={DIMS.pinR} fill={C.brassLight} stroke={C.line} strokeWidth={0.003} />
          </g>
        ) : (
          <g>
            {/* il retro: le scale e il codice che fa girare la rete */}
            <circle r={R} fill="url(#ab-brass)" stroke={C.line} strokeWidth={0.006} />
            <g stroke={C.line}>
              {Array.from({ length: 360 }, (_, d) => {
                const a = d * DEG;
                const r1 = R - 0.02;
                const r0 = d % 10 === 0 ? R - 0.065 : r1 - 0.018;
                return <line key={d} x1={Math.sin(a) * r0} y1={-Math.cos(a) * r0} x2={Math.sin(a) * r1} y2={-Math.cos(a) * r1} strokeWidth={0.0022} />;
              })}
            </g>
            <text x={0} y={Y(0.66)} textAnchor="middle" fontFamily="var(--font-geist-mono), ui-monospace, monospace" fontSize={0.035} fill={C.line}>
              lib/astro/time.ts
            </text>
            <g fontFamily="var(--font-geist-mono), ui-monospace, monospace" fontSize={0.046} fill={C.line}>
              {RETE_SOURCE.split("\n").map((line, i) => (
                <text key={i} x={-0.74} y={Y(0.54 - i * 0.068)} xmlSpace="preserve">
                  {line}
                </text>
              ))}
            </g>
            <text x={0} y={Y(-0.72)} textAnchor="middle" fontFamily="var(--font-newsreader), Georgia, serif" fontStyle="italic" fontSize={0.05} fill={C.line}>
              hello, imad&apos;s world
            </text>
            <rect x={-1.2} y={-0.036} width={2.4} height={0.072} fill="url(#ab-brass)" stroke={C.line} strokeWidth={0.003} />
          </g>
        )}
        {tariq && (
          <g style={{ transition: "opacity 1.2s" }}>
            <circle cx={0} cy={Y(TOP - 0.15)} r={0.05} fill="#fffaf0" opacity={0.95} />
            <circle cx={0} cy={Y(TOP - 0.15)} r={0.16} fill="#fff3d0" opacity={0.18} />
          </g>
        )}
      </svg>
    </div>
  );
}
