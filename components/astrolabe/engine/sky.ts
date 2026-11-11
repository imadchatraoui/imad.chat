// Il mondo attorno: il cielo vero della città, visto guardando a sud verso l'alto.
// Gradiente dall'altezza vera del Sole (giorno, crepuscoli, notte), le stelle del catalogo
// nelle loro posizioni vere, la Luna con la sua fase. Tutto disegnato direttamente nello
// spazio dello schermo (proiezione stereografica larga), dietro lo strumento.

import * as THREE from "three";
import { brightStars, starColor, toDateCoordsMany } from "@/lib/astro";

const VIEW_ELEV = (32 * Math.PI) / 180;

const COMMON = /* glsl */ `
uniform float uLst;
uniform float uLat;
uniform float uE0;
uniform float uScale;
uniform float uAspect;

// equatoriale della data (vettore unitario) → est, nord, alto
vec3 eqToEnu(vec3 eq) {
  float c = cos(uLst), s = sin(uLst);
  // ruota attorno a z di -LST: sistema dell'angolo orario
  float xh = eq.x * c + eq.y * s;
  float yh = -eq.x * s + eq.y * c;
  float sl = sin(uLat), cl = cos(uLat);
  return vec3(yh, cl * eq.z - sl * xh, sl * eq.z + cl * xh);
}
// est, nord, alto → coordinate di vista (destra, su, avanti), guardando a sud con elevazione uE0
vec3 enuToView(vec3 d) {
  float se = sin(uE0), ce = cos(uE0);
  return vec3(-d.x, d.y * se + d.z * ce, -d.y * ce + d.z * se);
}
vec3 viewToEnu(vec3 v) {
  float se = sin(uE0), ce = cos(uE0);
  return vec3(-v.x, v.y * se - v.z * ce, v.y * ce + v.z * se);
}
`;

const skyVert = /* glsl */ `
varying vec2 vNdc;
void main() {
  vNdc = position.xy;
  gl_Position = vec4(position.xy, 0.9999, 1.0);
}
`;

const skyFrag = /* glsl */ `
${COMMON}
uniform vec3 uSun;          // direzione del Sole in est, nord, alto
uniform float uSunAlt;      // gradi
uniform vec3 uNightZenith;
uniform vec3 uNightHorizon;
uniform vec3 uDayZenith;
uniform vec3 uDayHorizon;
uniform vec3 uGlow;
uniform vec3 uGround;
uniform float uOpacity;
varying vec2 vNdc;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec2 ab = vec2(vNdc.x * uAspect, vNdc.y) / uScale;
  float r2 = dot(ab, ab);
  vec3 v = vec3(2.0 * ab.x, 2.0 * ab.y, 1.0 - r2) / (1.0 + r2);
  vec3 d = viewToEnu(v);
  float up = d.z;
  float day = smoothstep(-6.0, 4.0, uSunAlt);
  float tw = (1.0 - day) * smoothstep(-19.0, -5.0, uSunAlt);
  vec3 zen = mix(uNightZenith, uDayZenith, day);
  vec3 hor = mix(uNightHorizon, uDayHorizon, day);
  // il chiarore verso il Sole, più forte quando il Sole è vicino all'orizzonte
  float toward = max(dot(normalize(d), normalize(uSun)), 0.0);
  float glowAmt = (tw * 0.9 + day * 0.25) * pow(toward, 3.0);
  hor += uGlow * glowAmt;
  vec3 col;
  if (up >= 0.0) {
    float t = pow(clamp(up, 0.0, 1.0), 0.42);
    col = mix(hor, zen, t);
    col += uGlow * (tw * 0.35 + day * 0.1) * pow(toward, 12.0) * (1.0 - t);
  } else {
    float t = smoothstep(0.0, 0.22, -up);
    col = mix(hor * 0.55, uGround, t);
  }
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(col, uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const starVert = /* glsl */ `
${COMMON}
uniform float uPixelRatio;
uniform float uSunAlt;
attribute float aMag;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec3 d = eqToEnu(position);
  vec3 v = enuToView(d);
  float k = uScale / (1.0 + v.z);
  vec2 p = vec2(v.x * k / uAspect, v.y * k);
  // sotto l'orizzonte niente stelle; vicino all'orizzonte l'aria le spegne
  float ext = smoothstep(-0.01, 0.12, d.z);
  float night = 1.0 - smoothstep(-14.0, -4.0, uSunAlt);
  vAlpha = clamp(1.15 - 0.2 * aMag, 0.12, 1.0) * ext * (0.15 + 0.85 * night) * step(-0.6, v.z);
  vColor = aColor;
  gl_PointSize = clamp(4.6 - 0.85 * aMag, 1.4, 7.0) * uPixelRatio;
  gl_Position = vec4(p, 0.9998, 1.0);
}
`;

const starFrag = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c);
  float core = smoothstep(0.5, 0.0, r);
  float a = core * core * vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor * a, a);
  #include <colorspace_fragment>
}
`;

const moonFrag = /* glsl */ `
uniform vec2 uLight;      // direzione del Sole sullo schermo
uniform float uPhase;     // angolo di fase (rad): 0 piena, π nuova
uniform float uAlpha;
varying vec2 vP;
void main() {
  vec2 p = vP;
  float r2 = dot(p, p);
  float halo = exp(-max(r2 - 1.0, 0.0) * 5.0) * 0.18 * step(1.0, r2);
  if (r2 > 1.0) {
    if (halo < 0.004) discard;
    gl_FragColor = vec4(vec3(0.85, 0.82, 0.7) * halo * uAlpha, halo * uAlpha);
    return;
  }
  vec3 n = vec3(p, sqrt(1.0 - r2));
  vec3 L = vec3(normalize(uLight) * sin(uPhase), cos(uPhase));
  float lit = smoothstep(-0.04, 0.06, dot(n, L));
  // macchie dei mari, appena accennate
  float maria = 0.9 - 0.12 * smoothstep(0.2, 0.0, length(p - vec2(-0.25, 0.2))) - 0.1 * smoothstep(0.25, 0.0, length(p - vec2(0.2, -0.1)));
  vec3 bright = vec3(0.98, 0.95, 0.86) * maria;
  vec3 earthshine = vec3(0.06, 0.07, 0.1);
  vec3 col = mix(earthshine, bright, lit);
  float edge = smoothstep(1.0, 0.94, r2);
  gl_FragColor = vec4(col * uAlpha, uAlpha * edge);
  #include <colorspace_fragment>
}
`;

const moonVert = /* glsl */ `
uniform vec2 uCenter;
uniform vec2 uSize;
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = vec4(uCenter + position.xy * uSize, 0.9997, 1.0);
}
`;

export interface SkyState {
  lst: number; // radianti
  lat: number; // gradi
  sunEnu: THREE.Vector3;
  sunAlt: number;
  moonEnu: THREE.Vector3 | null;
  moonPhaseAngle: number; // gradi
}

/** Lo sfondo: gradiente, stelle, Luna. */
export class SkyLayer {
  readonly group = new THREE.Group();
  readonly uniforms: Record<string, THREE.IUniform>;
  private skyMat: THREE.ShaderMaterial;
  private starMat: THREE.ShaderMaterial;
  private moonMat: THREE.ShaderMaterial;
  private moon: THREE.Mesh;
  private disposables: { dispose(): void }[] = [];

  constructor(pixelRatio: number) {
    this.uniforms = {
      uLst: { value: 0 },
      uLat: { value: (45 * Math.PI) / 180 },
      uE0: { value: VIEW_ELEV },
      uScale: { value: 1.2 },
      uAspect: { value: 1 },
    };
    const u = this.uniforms;
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      uniforms: {
        ...u,
        uSun: { value: new THREE.Vector3(0, -1, -0.3) },
        uSunAlt: { value: -30 },
        uNightZenith: { value: new THREE.Color("#04060d") },
        uNightHorizon: { value: new THREE.Color("#14204a") },
        uDayZenith: { value: new THREE.Color("#2c4f86") },
        uDayHorizon: { value: new THREE.Color("#9bb2cc") },
        uGlow: { value: new THREE.Color("#e2a35a") },
        uGround: { value: new THREE.Color("#03050b") },
        uOpacity: { value: 1 },
      },
      // opaco: si disegna per primo, nel passaggio dei solidi, e non scrive la profondità
      depthTest: false,
      depthWrite: false,
      transparent: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.skyMat);
    quad.frustumCulled = false;
    quad.renderOrder = -10;
    this.disposables.push(quad.geometry, this.skyMat);

    // le stelle del catalogo, portate all'equatore della data una volta sola
    const cat = brightStars(5);
    const dated = toDateCoordsMany(cat, new Date());
    const pos = new Float32Array(cat.length * 3);
    const mag = new Float32Array(cat.length);
    const col = new Float32Array(cat.length * 3);
    dated.forEach((d, i) => {
      const a = d.ra * 15 * (Math.PI / 180);
      const dec = d.dec * (Math.PI / 180);
      pos[i * 3] = Math.cos(dec) * Math.cos(a);
      pos[i * 3 + 1] = Math.cos(dec) * Math.sin(a);
      pos[i * 3 + 2] = Math.sin(dec);
      mag[i] = cat[i].mag;
      const [r, g, b] = starColor(cat[i].bv);
      const c = new THREE.Color(r, g, b);
      c.convertSRGBToLinear();
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    });
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    sg.setAttribute("aMag", new THREE.BufferAttribute(mag, 1));
    sg.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    this.starMat = new THREE.ShaderMaterial({
      vertexShader: starVert,
      fragmentShader: starFrag,
      uniforms: { ...u, uPixelRatio: { value: pixelRatio }, uSunAlt: this.skyMat.uniforms.uSunAlt },
      // dietro lo strumento: il test di profondità le nasconde dove c'è l'ottone
      depthTest: true,
      depthWrite: false,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(sg, this.starMat);
    points.frustumCulled = false;
    points.renderOrder = -9;
    this.disposables.push(sg, this.starMat);

    this.moonMat = new THREE.ShaderMaterial({
      vertexShader: moonVert,
      fragmentShader: moonFrag,
      uniforms: {
        uCenter: { value: new THREE.Vector2() },
        uSize: { value: new THREE.Vector2(0.05, 0.05) },
        uLight: { value: new THREE.Vector2(1, 0) },
        uPhase: { value: 0 },
        uAlpha: { value: 1 },
      },
      depthTest: true,
      depthWrite: false,
      transparent: true,
    });
    this.moon = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), this.moonMat);
    this.moon.frustumCulled = false;
    this.moon.renderOrder = -8;
    this.disposables.push(this.moon.geometry, this.moonMat);

    this.group.add(quad, points, this.moon);
  }

  /** Dimensioni dello schermo: la scala della proiezione dipende dall'orientamento. */
  setViewport(width: number, height: number, pixelRatio: number) {
    const aspect = width / Math.max(1, height);
    this.uniforms.uAspect.value = aspect;
    // metà del lato lungo copre circa 62° dal centro della vista
    const halfAngle = (62 * Math.PI) / 180;
    const k = 1 / (2 * Math.tan(halfAngle / 2));
    this.uniforms.uScale.value = aspect < 1 ? k : k * aspect;
    this.starMat.uniforms.uPixelRatio.value = pixelRatio;
  }

  /** Proietta una direzione (est, nord, alto) sullo schermo, in NDC. */
  project(enu: THREE.Vector3): THREE.Vector2 | null {
    const e0 = this.uniforms.uE0.value as number;
    const se = Math.sin(e0);
    const ce = Math.cos(e0);
    const vx = -enu.x;
    const vy = enu.y * se + enu.z * ce;
    const vz = -enu.y * ce + enu.z * se;
    if (vz < -0.6) return null;
    const k = (this.uniforms.uScale.value as number) / (1 + vz);
    return new THREE.Vector2((vx * k) / (this.uniforms.uAspect.value as number), vy * k);
  }

  update(s: SkyState) {
    this.uniforms.uLst.value = s.lst;
    this.uniforms.uLat.value = (s.lat * Math.PI) / 180;
    this.skyMat.uniforms.uSun.value.copy(s.sunEnu);
    this.skyMat.uniforms.uSunAlt.value = s.sunAlt;
    // la Luna, se è sopra l'orizzonte e dentro la vista
    const m = s.moonEnu;
    const p = m && m.z > -0.01 ? this.project(m) : null;
    if (m && p && Math.abs(p.x) < 1.2 && Math.abs(p.y) < 1.2) {
      this.moon.visible = true;
      const aspect = this.uniforms.uAspect.value as number;
      // raggio del disco: il 3,6% del lato corto (la Luna vera sarebbe un puntino: la ingrandiamo)
      const size = 0.072 * Math.min(1, aspect);
      this.moonMat.uniforms.uCenter.value.copy(p);
      this.moonMat.uniforms.uSize.value.set(size / aspect, size);
      // direzione del Sole vista dalla Luna, sullo schermo
      const toward = s.sunEnu.clone().sub(m.clone().multiplyScalar(m.dot(s.sunEnu))).normalize();
      const q = this.project(m.clone().add(toward.multiplyScalar(0.05)).normalize());
      if (q) this.moonMat.uniforms.uLight.value.set((q.x - p.x) * aspect, q.y - p.y).normalize();
      this.moonMat.uniforms.uPhase.value = (s.moonPhaseAngle * Math.PI) / 180;
      this.moonMat.uniforms.uAlpha.value = THREE.MathUtils.smoothstep(m.z, -0.01, 0.05);
    } else {
      this.moon.visible = false;
    }
  }

  setOpacity(o: number) {
    this.skyMat.uniforms.uOpacity.value = o;
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
  }
}
