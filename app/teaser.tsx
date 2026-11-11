"use client";

import { useEffect, useState } from "react";
import Intro from "@/components/intro/Intro";

type Viewport = { w: number; h: number };

export default function Teaser() {
  const [done, setDone] = useState(false);
  const [vp, setVp] = useState<Viewport | null>(null);

  useEffect(() => {
    const measure = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Il cerchio graduato lascia spazio sotto per la riga finale.
  const target = vp ? { cx: vp.w / 2, cy: vp.h * 0.47, r: Math.min(vp.w * 0.42, vp.h * 0.36) } : undefined;
  const captionTop = vp && target ? Math.max(target.cy + target.r + 28, vp.h - 90) : 0;
  const captionFits = vp ? captionTop + 28 <= vp.h : false;

  return (
    <main>
      <Intro targetRect={target} onDone={() => setDone(true)} />
      {done && captionFits && (
        <p
          className="appear"
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            top: captionTop,
            margin: 0,
            textAlign: "center",
            fontFamily: "var(--font-serif-intro), Georgia, serif",
            fontStyle: "italic",
            fontSize: "1.125rem",
            letterSpacing: "0.01em",
            color: "rgba(239, 230, 210, 0.62)",
            pointerEvents: "none",
          }}
        >
          L&rsquo;astrolabio è ancora in officina.
        </p>
      )}
    </main>
  );
}
