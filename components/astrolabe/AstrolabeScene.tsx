"use client";

// La scena WebGL: Canvas di React Three Fiber, luci da studio (Lightformer, niente HDR esterni),
// il motore dell'astrolabio. Si ridisegna solo quando serve (frameloop "demand").

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { citiesInOrder, getCity, STARS, type AstroSection, type CityItem, type Observer } from "@/lib/astro";
import { AstrolabeEngine, type EngineCallbacks } from "./engine/engine";
import { resolveFonts, waitForFonts } from "./engine/fonts";
import { loadManifest } from "./engine/manifest";

export interface SceneProps {
  city: CityItem;
  observer: Observer | null;
  sections: AstroSection[];
  initialState: "assembled" | "exploded" | "hidden";
  framing: { top: number; bottom: number; side: number };
  callbacks: React.RefObject<EngineCallbacks>;
  onEngine: (e: AstrolabeEngine | null) => void;
  lowEnd: boolean;
}

function Engine({ city, observer, sections, initialState, framing, callbacks, onEngine, lowEnd }: SceneProps) {
  const { scene, camera, gl, invalidate } = useThree();
  const [engine, setEngine] = useState<AstrolabeEngine | null>(null);
  const first = useRef({ city, observer, sections, initialState, framing });

  useEffect(() => {
    let alive = true;
    let made: AstrolabeEngine | null = null;
    const host = gl.domElement.parentElement ?? gl.domElement;
    const fonts = resolveFonts(host);
    Promise.all([waitForFonts(fonts), loadManifest()]).then(([, manifest]) => {
      if (!alive) return;
      const init = first.current;
      made = new AstrolabeEngine({
        scene,
        camera: camera as THREE.PerspectiveCamera,
        dom: gl.domElement,
        invalidate,
        fonts,
        manifest,
        stars: STARS,
        cities: citiesInOrder(),
        sections: init.sections,
        city: init.city,
        observer: init.observer,
        texSize: lowEnd ? 1024 : 2048,
        anisotropy: Math.min(8, gl.capabilities.getMaxAnisotropy()),
        pixelRatio: gl.getPixelRatio(),
        initialState: init.initialState,
        framing: init.framing,
        callbacks: {
          onEvent: (n) => callbacks.current?.onEvent?.(n),
          onStarSelect: (id) => callbacks.current?.onStarSelect?.(id),
          onSectionSelect: (id) => callbacks.current?.onSectionSelect?.(id),
          onTimeChange: (d, now) => callbacks.current?.onTimeChange?.(d, now),
        },
      });
      setEngine(made);
      onEngine(made);
      invalidate();
    });
    return () => {
      alive = false;
      onEngine(null);
      made?.dispose();
    };
    // il motore nasce una volta sola: le props successive arrivano con i metodi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engine?.setCity(city);
  }, [engine, city]);
  useEffect(() => {
    engine?.setObserver(observer);
  }, [engine, observer]);
  useEffect(() => {
    engine?.setSections(sections);
  }, [engine, sections]);
  useEffect(() => {
    engine?.setFraming(framing);
  }, [engine, framing]);

  useFrame((_, dt) => {
    if (!engine) return;
    if (engine.update(dt)) invalidate();
  });

  return null;
}

/** Lo studio: una grande luce morbida calda in alto a sinistra, un filo freddo di controluce, il blu della notte. */
function Studio() {
  return (
    <Environment resolution={256} frames={1}>
      <color attach="background" args={["#0e1533"]} />
      {/* una grande luce morbida davanti: la faccia dell'ottone la riflette tutta */}
      <Lightformer form="rect" intensity={1.25} color="#fff1da" position={[0, 1.2, 6]} scale={[10, 6]} target={[0, 0, 0]} />
      {/* la luce chiave, calda, in alto a sinistra */}
      <Lightformer form="rect" intensity={6} color="#ffe6bd" position={[-3.2, 3.2, 4]} scale={[3.2, 2.2]} target={[0, 0, 0]} />
      {/* controluce fredda dall'alto, dietro */}
      <Lightformer form="rect" intensity={3.2} color="#b9c8ff" position={[0, 5, -2.5]} scale={[9, 1]} target={[0, 0, 0]} />
      {/* un filo blu da destra, il colore della notte */}
      <Lightformer form="rect" intensity={1.6} color="#9fb4f0" position={[5, 0, 2]} scale={[2, 6]} target={[0, 0, 0]} />
      {/* un riflesso caldo dal basso */}
      <Lightformer form="rect" intensity={0.9} color="#ffcf8a" position={[0, -5, 2]} scale={[9, 2.4]} target={[0, 0, 0]} />
      <Lightformer form="ring" intensity={2.2} color="#fff6e6" position={[2.4, 2.6, 4.5]} scale={0.8} target={[0, 0, 0]} />
    </Environment>
  );
}

export default function AstrolabeScene(props: SceneProps) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.75]}
      camera={{ fov: 30, near: 0.05, far: 60, position: [0, 0.4, 9] }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance", stencil: false }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1.08;
        gl.setClearColor(0x000000, 0);
      }}
      style={{ touchAction: "pan-y pinch-zoom" }}
    >
      <Studio />
      <directionalLight position={[-2.5, 3.2, 4]} intensity={1.15} color="#fff0d4" />
      <directionalLight position={[3, -1, -3]} intensity={0.35} color="#8fa6ee" />
      <Engine {...props} />
    </Canvas>
  );
}

export { getCity };
