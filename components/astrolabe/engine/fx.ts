// Luci: il bagliore sul puntatore scelto, la linea della qibla sulla piastra, at-Tariq.

import * as THREE from "three";
import { makeCanvas } from "./canvas";

let glowTex: THREE.Texture | null = null;

export function glowTexture(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = makeCanvas(128);
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,248,226,1)");
  g.addColorStop(0.12, "rgba(255,236,190,0.85)");
  g.addColorStop(0.35, "rgba(234,214,160,0.25)");
  g.addColorStop(1, "rgba(234,214,160,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  glowTex = t;
  return t;
}

let kaabaTex: THREE.Texture | null = null;

/** Il segno della qibla: un piccolo cubo nero con la fascia d'oro, in un alone. */
export function kaabaTexture(): THREE.Texture {
  if (kaabaTex) return kaabaTex;
  const c = makeCanvas(128);
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,236,190,0.9)");
  g.addColorStop(0.35, "rgba(255,220,150,0.35)");
  g.addColorStop(1, "rgba(255,220,150,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = "#0b0a0a";
  ctx.fillRect(48, 48, 32, 32);
  ctx.fillStyle = "#e9c46a";
  ctx.fillRect(48, 56, 32, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  kaabaTex = t;
  return t;
}

let sunTex: THREE.Texture | null = null;

/** Il Sole sull'eclittica della rete: un dischetto d'oro con i raggi incisi. */
export function sunTexture(): THREE.Texture {
  if (sunTex) return sunTex;
  const c = makeCanvas(128);
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,226,150,0.55)");
  g.addColorStop(0.5, "rgba(255,210,120,0.12)");
  g.addColorStop(1, "rgba(255,210,120,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  ctx.translate(64, 64);
  ctx.strokeStyle = "#f6d27a";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 20, Math.sin(a) * 20);
    ctx.lineTo(Math.cos(a) * (i % 2 ? 30 : 36), Math.sin(a) * (i % 2 ? 30 : 36));
    ctx.stroke();
  }
  ctx.fillStyle = "#ffe08a";
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#8a5a12";
  ctx.lineWidth = 2;
  ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  sunTex = t;
  return t;
}

/** Un bagliore che si può appendere a un punto dello strumento. */
export function makeGlow(size: number, color = "#ffe9b8"): THREE.Sprite {
  const m = new THREE.SpriteMaterial({
    map: glowTexture(),
    color: new THREE.Color(color),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    transparent: true,
    toneMapped: false,
  });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(size);
  s.renderOrder = 20;
  return s;
}

/** Un nastro sottile lungo una polilinea, nel piano z costante. */
export function ribbon(points: { x: number; y: number }[], width: number, z: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const n = points.length;
  let along = 0;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(n - 1, i + 1)];
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    if (i > 0) along += Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y);
    pos.push(p.x - dy * width, p.y + dx * width, z, p.x + dy * width, p.y - dx * width, z);
    uv.push(along, 0, along, 1);
    if (i < n - 1) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Materiale della linea luminosa della qibla: si disegna da un capo all'altro con uProgress. */
export function qiblaMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uProgress: { value: 0 }, uLength: { value: 1 }, uAlpha: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uProgress; uniform float uLength; uniform float uAlpha;
      varying vec2 vUv;
      void main() {
        float t = vUv.x / uLength;
        if (t > uProgress) discard;
        float across = 1.0 - abs(vUv.y * 2.0 - 1.0);
        float head = smoothstep(uProgress - 0.08, uProgress, t);
        vec3 col = mix(vec3(1.0, 0.84, 0.48), vec3(1.0, 0.98, 0.92), head) * 1.6;
        float a = pow(across, 1.2) * uAlpha * (0.85 + 0.15 * head);
        gl_FragColor = vec4(col * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

/**
 * At-Tariq: una stella che bussa tre volte e poi trafigge il buio.
 * Uno strato a tutto schermo che disegna il nucleo della stella, gli anelli dei colpi e il raggio.
 */
export class TariqLayer {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uCenter: { value: new THREE.Vector2(0, 0.7) },
        uAspect: { value: 1 },
        uCore: { value: 0 },
        uFlash: { value: 0 },
        uRing: { value: 0 },
        uRingAlpha: { value: 0 },
        uBeam: { value: 0 },
        uBeamAlpha: { value: 0 },
        uDark: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vNdc;
        void main() { vNdc = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec2 uCenter; uniform float uAspect;
        uniform float uCore; uniform float uFlash; uniform float uRing; uniform float uRingAlpha;
        uniform float uBeam; uniform float uBeamAlpha; uniform float uDark;
        varying vec2 vNdc;
        void main() {
          vec2 d = (vNdc - uCenter) * vec2(uAspect, 1.0);
          float r = length(d);
          // il nucleo e la sua corona
          float core = uCore * (exp(-r * r * 9000.0) + 0.55 * exp(-r * 40.0) * (0.4 + uFlash));
          // spighe sottili, come una stella vista attraverso l'aria
          float spikes = uCore * (exp(-abs(d.x) * 900.0) * exp(-abs(d.y) * 18.0) + exp(-abs(d.y) * 900.0) * exp(-abs(d.x) * 18.0)) * (0.35 + 0.65 * uFlash);
          // l'anello del colpo
          float ring = uRingAlpha * exp(-pow((r - uRing) * 60.0, 2.0));
          // il raggio che trafigge: dalla stella verso il basso
          float below = step(d.y, 0.0) * step(-uBeam * 2.4, d.y);
          float beam = uBeamAlpha * below * (exp(-abs(d.x) * 420.0) + 0.35 * exp(-abs(d.x) * 40.0)) * (1.0 - smoothstep(0.0, uBeam * 2.4 + 0.001, -d.y) * 0.5);
          vec3 col = vec3(1.0, 0.97, 0.9) * (core + spikes + beam) + vec3(0.92, 0.84, 0.62) * ring;
          float glow = clamp(core + spikes + ring + beam, 0.0, 1.0);
          // il buio attorno, un po' più profondo mentre la stella bussa
          gl_FragColor = vec4(col, 0.0) + vec4(0.0, 0.0, 0.0, uDark * 0.45 * (1.0 - glow));
        }`,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 50;
    this.mesh.visible = false;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
