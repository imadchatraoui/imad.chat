// Il motore dell'astrolabio: tiene il tempo, gira la rete col dito (con inerzia e scatti morbidi),
// cambia le piastre, monta e smonta lo strumento, lo gira sul retro, chiama at-Tariq, punta la qibla,
// scombina gli anelli. Non sa niente di React: la scena R3F gli passa camera, canvas e invalidate.

import * as THREE from "three";
import {
  clockAngle,
  DEG,
  horizontalOf,
  horizonPoint,
  moonEquatorial,
  moonInfo,
  msForReteTurn,
  projectOnRete,
  qiblaBearing,
  reteAngle,
  rotateClockwise,
  sampleCurve,
  azimuthCurve,
  plateGeometry,
  sunEquatorial,
  type AstroSection,
  type CityItem,
  type EqCoords,
  type Observer,
  type StarItem,
} from "@/lib/astro";
import { clamp01, easeInOutCubic, easeOutBack, easeOutCubic, easeSettle, lerp, segment, wrapPi } from "./anim";
import { DIMS, BOUNDS } from "./dims";
import type { EngraveFonts } from "./fonts";
import { glowTexture, makeGlow, qiblaMaterial, ribbon, TariqLayer } from "./fx";
import type { MediaManifest } from "./manifest";
import { AstrolabeModel } from "./model";
import { SkyLayer } from "./sky";

export type AstrolabeEventName =
  | "tick"
  | "plate"
  | "assemble"
  | "explode"
  | "flip"
  | "tariq"
  | "tariq-knock"
  | "tariq-pierce"
  | "qibla"
  | "select"
  | "scramble"
  | "unlock";

export interface EngineCallbacks {
  onEvent?: (name: AstrolabeEventName) => void;
  onStarSelect?: (id: string) => void;
  onSectionSelect?: (id: string) => void;
  onTimeChange?: (date: Date, isNow: boolean) => void;
}

export interface EngineInit {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  dom: HTMLCanvasElement;
  invalidate: () => void;
  fonts: EngraveFonts;
  manifest: MediaManifest;
  stars: readonly StarItem[];
  cities: readonly CityItem[];
  sections: readonly AstroSection[];
  city: CityItem;
  observer?: Observer | null;
  texSize: number;
  anisotropy: number;
  pixelRatio: number;
  initialState: "assembled" | "exploded" | "hidden";
  /** Margini liberi attorno allo strumento, in frazioni del contenitore. */
  framing: { top: number; bottom: number; side: number };
  callbacks: EngineCallbacks;
}

type PartKey = "mater" | "kursi" | "plate" | "rete" | "rule" | "pin" | "horse" | "alidade";

interface PartPose {
  x: number;
  y: number;
  z: number;
  rz: number;
  opacity: number;
}

const ZERO: PartPose = { x: 0, y: 0, z: 0, rz: 0, opacity: 1 };

/** Pose dello strumento esploso: le parti si separano lungo l'asse. */
const EXPLODED: Record<PartKey, PartPose> = {
  alidade: { x: 0, y: 0, z: -0.55, rz: 0, opacity: 1 },
  mater: { x: 0, y: 0, z: 0, rz: 0, opacity: 1 },
  kursi: { x: 0, y: 0, z: 0, rz: 0, opacity: 1 },
  plate: { x: 0, y: 0, z: 0.5, rz: 0, opacity: 1 },
  rete: { x: 0, y: 0, z: 1.0, rz: 0, opacity: 1 },
  rule: { x: 0, y: 0, z: 1.45, rz: 0, opacity: 1 },
  pin: { x: 0, y: 0, z: 1.85, rz: 0, opacity: 1 },
  horse: { x: 0.28, y: 0, z: 2.1, rz: 0, opacity: 1 },
};

/** Da dove arrivano le parti quando lo strumento si monta dal nulla (dopo l'intro). */
const ARRIVAL: Record<PartKey, PartPose> = {
  alidade: { x: 0, y: 0, z: -0.4, rz: 0, opacity: 0 },
  mater: { x: 0, y: 0, z: 0, rz: 0, opacity: 0 },
  kursi: { x: 0, y: -0.32, z: -0.03, rz: 0, opacity: 0 },
  plate: { x: 0, y: 0, z: 1.7, rz: 0.55, opacity: 0 },
  rete: { x: 0, y: 0, z: 2.4, rz: -2.4, opacity: 0 },
  rule: { x: 0, y: 0, z: 2.8, rz: 1.3, opacity: 0 },
  pin: { x: 0, y: 0, z: 1.3, rz: 0, opacity: 0 },
  horse: { x: 0.55, y: 0, z: 0.05, rz: 0, opacity: 0 },
};

const PART_KEYS: PartKey[] = ["alidade", "mater", "kursi", "plate", "rete", "rule", "pin", "horse"];

interface Tween {
  start: number;
  dur: number;
  update: (t: number) => void;
  done?: () => void;
}

export class AstrolabeEngine {
  readonly model: AstrolabeModel;
  readonly sky: SkyLayer;
  readonly tariq: TariqLayer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private dom: HTMLCanvasElement;
  private invalidate: () => void;
  private cb: EngineCallbacks;
  private framing: EngineInit["framing"];

  // tempo
  private timeOffset = 0; // ms rispetto all'orologio vero
  private nowMode = true;
  private velocity = 0; // rad/s della rete, positivo in senso orario
  private lastHourIndex = 0;
  private lastTickAt = 0;
  private sunCache: { t: number; eq: EqCoords } | null = null;
  private moonCache: { t: number; eq: EqCoords; key: string } | null = null;
  private lastTimeEmit = 0;

  // luogo
  city: CityItem;
  private observer: Observer | null;
  private plateLat: number;
  private cityBlend: { from: CityItem; t: number } | null = null;

  // pose
  private pose: Record<PartKey, PartPose>;
  private rootRotY = 0;
  private rootRotX = 0;
  private rootLift = 0;
  private rootScale = 1;
  private flipped = false;
  private exploded = false;
  private hidden = false;
  private codeZoom = 0; // 0..1: avvicinamento al codice inciso sul retro
  private ringSwing = 0;
  private ruleMode: "sun" | "qibla" = "sun";
  private ruleAngle = 0;
  private ruleQiblaBlend = 0;
  private qiblaBearingDeg = 0;
  private alidadeAngle = 0;
  private plateSwap = 0; // 0..1 durante il cambio di piastra (sollevamento della rete)

  // rompicapo degli anelli
  private scrambled = false;
  private layers = { inner: 0, outer: 0, limb: 0 };
  private lift = 0; // rete e regola sollevate durante il rompicapo
  private secret = false;

  // selezione e luci
  private selectedStar: string | null = null;
  private selectGlow: THREE.Sprite;
  private selectPulse = 0;
  private sectionGlow: THREE.Sprite;
  private sectionPulse = 0;
  private qiblaLine: THREE.Mesh | null = null;
  private qiblaMat: THREE.ShaderMaterial;
  private kaabaMark: THREE.Sprite;
  private envIntensity = 1;

  private tweens = new Map<string, Tween>();
  private clock = 0;
  private sections: readonly AstroSection[];
  private cities: readonly CityItem[];
  private stars: readonly StarItem[];

  // gesti
  private drag: {
    id: number;
    kind: "rete" | "layer" | "alidade";
    layer?: "inner" | "outer" | "limb";
    lastAngle: number;
    startX: number;
    startY: number;
    startTime: number;
    moved: boolean;
    samples: { t: number; a: number }[];
    onKursi: boolean;
  } | null = null;
  private longPress: ReturnType<typeof setTimeout> | null = null;
  private listeners: [string, EventListener, AddEventListenerOptions | undefined][] = [];
  private nowTimer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;

  constructor(init: EngineInit) {
    this.scene = init.scene;
    this.camera = init.camera;
    this.dom = init.dom;
    this.invalidate = init.invalidate;
    this.cb = init.callbacks;
    this.framing = init.framing;
    this.city = init.city;
    this.observer = init.observer ?? null;
    this.plateLat = init.city.lat;
    this.sections = init.sections;
    this.cities = init.cities;
    this.stars = init.stars;

    this.model = new AstrolabeModel({
      fonts: init.fonts,
      texSize: init.texSize,
      manifest: init.manifest,
      stars: init.stars,
      cities: init.cities,
      sections: init.sections,
      anisotropy: init.anisotropy,
    });
    this.sky = new SkyLayer(init.pixelRatio);
    this.tariq = new TariqLayer();
    this.scene.add(this.sky.group, this.model.root, this.tariq.mesh);

    // luci di scena
    this.selectGlow = makeGlow(0.16);
    this.selectGlow.visible = false;
    this.model.reteSpin.add(this.selectGlow);
    this.sectionGlow = makeGlow(0.2, "#fff1cc");
    this.sectionGlow.visible = false;
    this.model.limb.add(this.sectionGlow);
    this.qiblaMat = qiblaMaterial();
    this.kaabaMark = makeGlow(0.09, "#fff6dc");
    this.kaabaMark.visible = false;
    this.model.fx.add(this.kaabaMark);
    void glowTexture;

    this.pose = {} as Record<PartKey, PartPose>;
    const start = init.initialState === "exploded" ? EXPLODED : init.initialState === "hidden" ? ARRIVAL : null;
    for (const k of PART_KEYS) this.pose[k] = { ...(start ? start[k] : ZERO) };
    if (init.initialState === "exploded") {
      this.exploded = true;
      this.rootRotY = -0.62;
      this.rootRotX = 0.22;
      this.rootScale = 0.78;
    }
    this.hidden = init.initialState === "hidden";

    this.model.paintPlate(0, this.city).then(() => this.invalidate());
    this.lastHourIndex = Math.floor(this.simTime() / 3600000);
    this.bindEvents();
    this.nowTimer = setInterval(() => {
      if (this.nowMode) this.invalidate();
    }, 15000);
    this.applyAll();
  }

  // ------------------------------------------------------------------ tempo

  simTime(): number {
    return Date.now() + this.timeOffset;
  }

  simDate(): Date {
    return new Date(this.simTime());
  }

  isNow(): boolean {
    return this.nowMode;
  }

  private sunEq(t: number): EqCoords {
    if (!this.sunCache || Math.abs(this.sunCache.t - t) > 10 * 60000) this.sunCache = { t, eq: sunEquatorial(new Date(t)) };
    return this.sunCache.eq;
  }

  private moonEq(t: number, lat: number, lon: number): EqCoords {
    const key = `${lat},${lon}`;
    if (!this.moonCache || this.moonCache.key !== key || Math.abs(this.moonCache.t - t) > 4 * 60000)
      this.moonCache = { t, eq: moonEquatorial(new Date(t), lat, lon), key };
    return this.moonCache.eq;
  }

  /** L'angolo della rete adesso (radianti, in senso orario), per la città della piastra. */
  private currentReteAngle(): number {
    const d = this.simDate();
    const a = reteAngle(d, this.city.lon);
    if (this.cityBlend) {
      const a0 = reteAngle(d, this.cityBlend.from.lon);
      return a0 + wrapPi(a - a0) * this.cityBlend.t;
    }
    return a;
  }

  // ------------------------------------------------------------------ API

  setTime(date: Date, animate = true) {
    const target = date.getTime() - Date.now();
    this.velocity = 0;
    this.animateOffset(target, animate, false);
  }

  resetNow(animate = true) {
    this.velocity = 0;
    this.animateOffset(0, animate, true);
    if (this.ruleMode === "qibla") this.pointQibla(false);
  }

  private animateOffset(target: number, animate: boolean, toNow: boolean) {
    const from = this.timeOffset;
    this.nowMode = false;
    if (!animate) {
      this.timeOffset = target;
      this.nowMode = toNow;
      this.emitTime(true);
      this.invalidate();
      return;
    }
    const turns = Math.abs(target - from) / 86164090.5;
    const dur = Math.min(1.8, 0.55 + Math.sqrt(turns) * 0.5);
    this.tween("time", dur, (t) => {
      this.timeOffset = lerp(from, target, easeInOutCubic(t));
    }, () => {
      this.timeOffset = target;
      this.nowMode = toNow;
      this.emitTime(true);
    });
  }

  setCity(city: CityItem) {
    if (city.id === this.city.id && !this.secret) return;
    this.swapPlate(city, false);
  }

  setObserver(o: Observer | null) {
    this.observer = o;
    if (this.ruleMode === "qibla") this.pointQibla(true);
  }

  setSections(sections: readonly AstroSection[]) {
    this.sections = sections;
    this.model.repaintLimb(sections);
    this.invalidate();
  }

  setFraming(f: EngineInit["framing"]) {
    this.framing = f;
    this.invalidate();
  }

  /** Il cambio di piastra: la rete si solleva, la vecchia piastra esce, la nuova entra e si assesta. */
  private async swapPlate(city: CityItem, secret: boolean) {
    const from = this.city;
    const next = 1 - this.model.activePlate;
    await this.model.paintPlate(next, secret ? null : city, secret);
    if (this.disposed) return;
    const oldSlot = this.model.plates[this.model.activePlate];
    const newSlot = this.model.plates[next];
    newSlot.group.visible = true;
    // la nuova piastra parte allineata: niente anelli scombinati
    newSlot.inner.rotation.z = 0;
    newSlot.outer.rotation.z = 0;
    this.emit("plate");
    if (!secret) {
      this.city = city;
      this.cityBlend = { from, t: 0 };
    }
    this.secret = secret;
    this.model.activePlate = next;
    const dur = 1.45;
    this.tween("plate", dur, (t) => {
      // rete e regola salgono e poi tornano
      this.plateSwap = Math.sin(Math.PI * clamp01(t / 0.92));
      if (this.cityBlend) this.cityBlend.t = easeInOutCubic(segment(t, 0.2, 0.6));
      // la vecchia piastra: su, poi giù fuori dalla madre
      const o = segment(t, 0.08, 0.42);
      oldSlot.group.position.z = 0.22 * easeOutCubic(clamp01(o * 2.2));
      oldSlot.group.position.y = -2.9 * easeInOutCubic(clamp01((o - 0.25) / 0.75));
      oldSlot.group.rotation.z = -0.25 * easeInOutCubic(o);
      // la nuova: entra dall'alto e scende nel suo alloggio
      const n = segment(t, 0.42, 0.5);
      newSlot.group.position.y = 2.9 * (1 - easeOutCubic(clamp01(n / 0.62)));
      newSlot.group.position.z = 0.22 * (1 - easeSettle(clamp01((n - 0.5) / 0.5)));
      newSlot.group.rotation.z = 0.2 * (1 - easeOutCubic(n));
      this.plateLat = n > 0.3 ? (secret ? this.plateLat : city.lat) : this.plateLat;
    }, () => {
      oldSlot.group.visible = false;
      oldSlot.group.position.set(0, 0, 0);
      oldSlot.group.rotation.set(0, 0, 0);
      newSlot.group.position.set(0, 0, 0);
      newSlot.group.rotation.set(0, 0, 0);
      this.plateSwap = 0;
      this.cityBlend = null;
      if (!secret) this.plateLat = city.lat;
      this.emit("tick");
      if (this.ruleMode === "qibla") this.updateQiblaLine(true);
    });
    if (this.ruleMode === "qibla") this.updateQiblaLine(false);
  }

  assemble() {
    this.emit("assemble");
    const fromPose = {} as Record<PartKey, PartPose>;
    for (const k of PART_KEYS) fromPose[k] = { ...this.pose[k] };
    const fromRot = { y: this.rootRotY, x: this.rootRotX, s: this.rootScale };
    const fromHidden = this.hidden;
    this.hidden = false;
    this.exploded = false;
    // ordine e tempi di montaggio
    const plan: Record<PartKey, [number, number]> = fromHidden
      ? { mater: [0, 0.55], alidade: [0, 0.5], kursi: [0.22, 0.75], plate: [0.55, 0.75], rete: [0.95, 0.95], rule: [1.5, 0.7], pin: [1.95, 0.45], horse: [2.25, 0.45] }
      : { alidade: [0.0, 0.7], mater: [0, 0.4], kursi: [0, 0.4], plate: [0.1, 0.8], rete: [0.4, 0.9], rule: [0.75, 0.75], pin: [1.05, 0.55], horse: [1.3, 0.55] };
    const total = fromHidden ? 3.0 : 2.1;
    const seated = new Set<PartKey>();
    this.setTransparent(true);
    this.tween("assemble", total, (tt) => {
      const T = tt * total;
      for (const k of PART_KEYS) {
        const [s, d] = plan[k];
        const t = clamp01((T - s) / d);
        const e = k === "kursi" ? easeOutBack(t, 1.1) : k === "mater" || k === "alidade" ? easeOutCubic(t) : easeSettle(t);
        const f = fromPose[k];
        this.pose[k] = {
          x: lerp(f.x, 0, e),
          y: lerp(f.y, 0, e),
          z: lerp(f.z, 0, e),
          rz: lerp(f.rz, 0, easeOutCubic(t)),
          opacity: lerp(f.opacity, 1, clamp01(t * 2.5)),
        };
        if (t >= 1 && !seated.has(k)) {
          seated.add(k);
          if (k === "plate" || k === "rete" || k === "rule" || k === "horse") this.emit("tick");
        }
      }
      const r = easeInOutCubic(clamp01((T - (fromHidden ? 0 : 0.2)) / (fromHidden ? 0.01 : 1.5)));
      this.rootRotY = lerp(fromRot.y, this.flipped ? Math.PI : 0, r);
      this.rootRotX = lerp(fromRot.x, 0, r);
      this.rootScale = lerp(fromRot.s, 1, r);
      // l'anello dondola quando tutto si è assestato
      const sw = T - (total - 0.75);
      this.ringSwing = sw > 0 ? 0.28 * Math.exp(-sw * 3.2) * Math.sin(sw * 9) : 0;
    }, () => {
      for (const k of PART_KEYS) this.pose[k] = { ...ZERO };
      this.ringSwing = 0;
      this.setTransparent(false);
    });
  }

  explode() {
    this.emit("explode");
    const fromPose = {} as Record<PartKey, PartPose>;
    for (const k of PART_KEYS) fromPose[k] = { ...this.pose[k] };
    const fromRot = { y: this.rootRotY, x: this.rootRotX, s: this.rootScale };
    const wasHidden = this.hidden;
    this.hidden = false;
    this.exploded = true;
    if (wasHidden) this.setTransparent(true);
    this.tween("assemble", 1.5, (t) => {
      const e = easeInOutCubic(t);
      for (const k of PART_KEYS) {
        const f = fromPose[k];
        const to = EXPLODED[k];
        this.pose[k] = {
          x: lerp(f.x, to.x, e),
          y: lerp(f.y, to.y, e),
          z: lerp(f.z, to.z, e),
          rz: lerp(f.rz, to.rz, e),
          opacity: lerp(f.opacity, 1, clamp01(t * 3)),
        };
      }
      this.rootRotY = lerp(fromRot.y, (this.flipped ? Math.PI : 0) - 0.62, e);
      this.rootRotX = lerp(fromRot.x, 0.22, e);
      this.rootScale = lerp(fromRot.s, 0.78, e);
    }, () => {
      if (wasHidden) this.setTransparent(false);
    });
  }

  flip() {
    if (this.exploded || this.hidden) return;
    this.flipped = !this.flipped;
    this.emit("flip");
    const from = this.rootRotY;
    const to = this.flipped ? Math.PI : 0;
    const zFrom = this.codeZoom;
    this.tween("flip", 1.25, (t) => {
      const e = easeInOutCubic(t);
      this.rootRotY = lerp(from, to, e);
      this.rootLift = Math.sin(Math.PI * t) * 0.55;
      this.rootRotX = Math.sin(Math.PI * t) * 0.12;
      // dopo il giro, ci si avvicina al codice inciso
      this.codeZoom = this.flipped ? easeInOutCubic(segment(t, 0.55, 0.45)) : zFrom * (1 - easeInOutCubic(segment(t, 0, 0.5)));
    }, () => {
      this.rootLift = 0;
      this.rootRotX = 0;
    });
  }

  isFlipped() {
    return this.flipped;
  }

  /** Punta la regola verso la qibla, per l'osservatore (o per la città della piastra). Ritorna l'azimut. */
  pointQibla(on = true): number {
    const o = this.observer ?? { lat: this.city.lat, lon: this.city.lon };
    this.qiblaBearingDeg = qiblaBearing(o.lat, o.lon);
    const from = this.ruleQiblaBlend;
    if (on) {
      this.ruleMode = "qibla";
      this.emit("qibla");
      this.updateQiblaLine(true);
      this.tween("qibla", 1.3, (t) => {
        this.ruleQiblaBlend = lerp(from, 1, easeSettle(t));
      }, () => this.emit("tick"));
    } else {
      this.ruleMode = "sun";
      this.tween("qibla", 0.9, (t) => {
        this.ruleQiblaBlend = lerp(from, 0, easeInOutCubic(t));
        this.qiblaMat.uniforms.uAlpha.value = 1 - t;
        this.kaabaMark.material.opacity = 1 - t;
      }, () => {
        if (this.qiblaLine) this.qiblaLine.visible = false;
        this.kaabaMark.visible = false;
      });
    }
    return this.qiblaBearingDeg;
  }

  /** Disegna la linea d'azimut della qibla sulla piastra, dallo zenit all'orizzonte. */
  private updateQiblaLine(show: boolean) {
    if (this.qiblaLine) {
      this.model.fx.remove(this.qiblaLine);
      this.qiblaLine.geometry.dispose();
      this.qiblaLine = null;
    }
    if (!show) {
      this.kaabaMark.visible = false;
      return;
    }
    const lat = this.secret ? this.city.lat : this.plateLat;
    const az = this.qiblaBearingDeg;
    const plate = plateGeometry(lat, { altStep: 30, azStep: 90 });
    const curve = azimuthCurve(az, lat);
    const h = horizonPoint(az, lat);
    const z = plate.zenith;
    let pts: { x: number; y: number }[] = [];
    if (curve && curve.kind === "circle") {
      // l'arco dal punto dell'orizzonte allo zenit, sul cerchio d'azimut
      const a0 = Math.atan2(h.y - curve.cy, h.x - curve.cx);
      const a1 = Math.atan2(z.y - curve.cy, z.x - curve.cx);
      let da = wrapPi(a1 - a0);
      // prendiamo l'arco che passa sopra l'orizzonte
      const mid = { x: curve.cx + curve.r * Math.cos(a0 + da / 2), y: curve.cy + curve.r * Math.sin(a0 + da / 2) };
      const midAbove = plate.horizon.kind === "circle" ? (Math.hypot(mid.x - plate.horizon.cx, mid.y - plate.horizon.cy) < plate.horizon.r) === plate.skyInside : true;
      if (!midAbove) da = da > 0 ? da - Math.PI * 2 : da + Math.PI * 2;
      for (let i = 0; i <= 64; i++) {
        const a = a0 + (da * i) / 64;
        pts.push({ x: curve.cx + curve.r * Math.cos(a), y: curve.cy + curve.r * Math.sin(a) });
      }
    } else {
      pts = [h, z];
    }
    pts = pts.filter((p) => Math.hypot(p.x, p.y) <= 1.0);
    if (pts.length < 2) return;
    const geo = ribbon(pts, 0.0065, DIMS.plateZ + DIMS.plateT + 0.0012);
    let length = 0;
    for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    this.qiblaMat.uniforms.uLength.value = length;
    this.qiblaMat.uniforms.uProgress.value = 0;
    this.qiblaMat.uniforms.uAlpha.value = 1;
    this.qiblaLine = new THREE.Mesh(geo, this.qiblaMat);
    this.qiblaLine.renderOrder = 5;
    this.model.fx.add(this.qiblaLine);
    const hp = Math.hypot(h.x, h.y) <= 1 ? h : pts[0];
    this.kaabaMark.position.set(hp.x, hp.y, DIMS.plateZ + DIMS.plateT + 0.004);
    this.kaabaMark.visible = true;
    this.kaabaMark.material.opacity = 1;
    this.tween("qiblaLine", 1.4, (t) => {
      this.qiblaMat.uniforms.uProgress.value = easeOutCubic(t);
    });
    void sampleCurve;
  }

  qiblaBearing(): number {
    const o = this.observer ?? { lat: this.city.lat, lon: this.city.lon };
    return qiblaBearing(o.lat, o.lon);
  }

  /** At-Tariq: tre colpi luminosi e poi un raggio che trafigge il buio. */
  triggerTariq() {
    const m = this.tariq.material.uniforms;
    const aspect = this.dom.clientWidth / Math.max(1, this.dom.clientHeight);
    m.uAspect.value = aspect;
    // la stella sta nel cielo sopra lo strumento (in verticale) o di lato (in orizzontale)
    m.uCenter.value.set(aspect < 1 ? 0.0 : 0.62, aspect < 1 ? 0.86 : 0.66);
    this.tariq.mesh.visible = true;
    this.emit("tariq");
    const knocks = [0.9, 1.75, 2.6];
    const pierce = 3.6;
    const total = 6.4;
    const fired = new Set<number>();
    const envFrom = this.envIntensity;
    this.tween("tariq", total, (tt) => {
      const T = tt * total;
      m.uDark.value = clamp01(T / 0.6) * (1 - clamp01((T - 5.2) / 1.2));
      m.uCore.value = clamp01((T - 0.3) / 0.5) * (1 - clamp01((T - 5.4) / 1.0));
      let flash = 0;
      let ringR = 0;
      let ringA = 0;
      knocks.forEach((k, i) => {
        const d = T - k;
        if (d >= 0 && !fired.has(i)) {
          fired.add(i);
          this.emit("tariq-knock");
        }
        if (d >= 0 && d < 0.9) {
          flash = Math.max(flash, Math.exp(-d * 7));
          ringR = d * 0.32;
          ringA = Math.max(ringA, (1 - d / 0.9) * 0.9);
        }
      });
      const p = T - pierce;
      if (p >= 0 && !fired.has(9)) {
        fired.add(9);
        this.emit("tariq-pierce");
      }
      m.uFlash.value = flash + (p > 0 ? Math.exp(-p * 2.2) : 0);
      m.uRing.value = ringR;
      m.uRingAlpha.value = ringA;
      m.uBeam.value = p > 0 ? easeOutCubic(clamp01(p / 0.35)) : 0;
      m.uBeamAlpha.value = p > 0 ? Math.exp(-Math.max(0, p - 0.4) * 1.1) : 0;
      // l'ottone si spegne un poco mentre la stella bussa, e brilla quando il raggio trafigge
      this.envIntensity = envFrom * (1 - 0.45 * m.uDark.value) + (p > 0 ? 0.9 * Math.exp(-p * 2.5) : 0);
    }, () => {
      this.tariq.mesh.visible = false;
      this.envIntensity = envFrom;
    });
  }

  selectStar(id: string | null) {
    this.selectedStar = id;
    const tip = id ? this.model.pointerTip(id) : null;
    if (tip) {
      this.selectGlow.position.copy(tip);
      this.selectGlow.position.z += 0.004;
      this.selectGlow.visible = true;
      this.tween("select", 1.1, (t) => {
        this.selectPulse = 1 + 1.6 * Math.exp(-t * 5) * Math.sin(t * Math.PI);
      }, () => (this.selectPulse = 1));
    } else {
      this.selectGlow.visible = false;
    }
    this.invalidate();
  }

  /** Scombina gli anelli come gli strati di un cubo di Rubik. */
  scramble() {
    if (this.scrambled || this.flipped || this.exploded || this.hidden) return;
    this.scrambled = true;
    this.emit("scramble");
    const pick = () => (1 + Math.floor(Math.random() * 7)) * (Math.PI / 4);
    const target = { inner: pick(), outer: pick(), limb: pick() };
    if (target.inner === target.outer) target.outer = wrapPi(target.outer + Math.PI / 2) + Math.PI * 2;
    const from = { ...this.layers };
    const liftFrom = this.lift;
    let ticks = 0;
    this.tween("scramble", 1.6, (t) => {
      this.lift = lerp(liftFrom, 1, easeInOutCubic(clamp01(t / 0.4)));
      const e = easeInOutCubic(segment(t, 0.3, 0.7));
      this.layers.limb = lerp(from.limb, target.limb, e);
      this.layers.outer = lerp(from.outer, -target.outer, e);
      this.layers.inner = lerp(from.inner, target.inner, e);
      const n = Math.floor(e * 6);
      if (n > ticks) {
        ticks = n;
        this.emit("tick");
      }
    });
  }

  /** Riallinea gli anelli: aprono la piastra segreta. */
  realign() {
    if (!this.scrambled) return;
    const from = { ...this.layers };
    const to = {
      inner: Math.round(from.inner / (Math.PI * 2)) * Math.PI * 2,
      outer: Math.round(from.outer / (Math.PI * 2)) * Math.PI * 2,
      limb: Math.round(from.limb / (Math.PI * 2)) * Math.PI * 2,
    };
    this.tween("realign", 1.0, (t) => {
      const e = easeInOutCubic(t);
      this.layers.inner = lerp(from.inner, to.inner, e);
      this.layers.outer = lerp(from.outer, to.outer, e);
      this.layers.limb = lerp(from.limb, to.limb, e);
    }, () => this.checkSolved());
  }

  isScrambled() {
    return this.scrambled;
  }

  private checkSolved() {
    const near = (a: number) => Math.abs(wrapPi(a)) < 0.02;
    if (this.scrambled && near(this.layers.inner) && near(this.layers.outer) && near(this.layers.limb)) {
      this.scrambled = false;
      this.layers = { inner: 0, outer: 0, limb: 0 };
      this.emit("unlock");
      this.swapPlate(this.city, true).then(() => {
        const liftFrom = this.lift;
        this.tween("lift", 1.1, (t) => {
          this.lift = lerp(liftFrom, 0, easeSettle(t));
        });
      });
    }
  }

  /** Il cerchio esterno del lembo sullo schermo, in pixel CSS rispetto al canvas: per l'intro. */
  getLimbScreenCircle(): { cx: number; cy: number; r: number } {
    this.model.root.updateMatrixWorld(true);
    const c = this.toScreen(new THREE.Vector3(0, 0, DIMS.limbTop));
    const e = this.toScreen(new THREE.Vector3(DIMS.mater, 0, DIMS.limbTop));
    const n = this.toScreen(new THREE.Vector3(0, DIMS.mater, DIMS.limbTop));
    return { cx: c.x, cy: c.y, r: (Math.hypot(e.x - c.x, e.y - c.y) + Math.hypot(n.x - c.x, n.y - c.y)) / 2 };
  }

  // ------------------------------------------------------------------ animazione

  private tween(name: string, dur: number, update: (t: number) => void, done?: () => void) {
    const prev = this.tweens.get(name);
    if (prev?.done) prev.done();
    this.tweens.set(name, { start: this.clock, dur, update, done });
    update(0);
    this.invalidate();
  }

  private setTransparent(on: boolean) {
    for (const mats of this.model.partMaterials.values()) {
      for (const m of mats) {
        if (m.transparent !== on) {
          m.transparent = on;
          m.needsUpdate = true;
        }
        if (!on) m.opacity = 1;
      }
    }
  }

  private emit(name: AstrolabeEventName) {
    try {
      this.cb.onEvent?.(name);
    } catch {
      /* il suono è facoltativo */
    }
  }

  private emitTime(force = false) {
    const now = performance.now();
    if (!force && now - this.lastTimeEmit < 120) return;
    this.lastTimeEmit = now;
    this.cb.onTimeChange?.(this.simDate(), this.nowMode);
  }

  /** Fotogrammi disegnati e ultimo dt, per il banco di prova. */
  stats = { frames: 0, lastDt: 0 };

  /** Avanza di dt secondi. Ritorna true se serve un altro fotogramma. */
  update(dt: number): boolean {
    if (this.disposed) return false;
    this.stats.frames++;
    this.stats.lastDt = dt;
    dt = Math.min(dt, 1 / 20);
    this.clock += dt;
    let animating = false;

    for (const [name, tw] of this.tweens) {
      const t = clamp01((this.clock - tw.start) / tw.dur);
      tw.update(t);
      if (t >= 1) {
        this.tweens.delete(name);
        tw.done?.();
      } else animating = true;
    }

    // inerzia della rete
    if (!this.drag && Math.abs(this.velocity) > 0.02) {
      this.advanceRete(this.velocity * dt);
      this.velocity *= Math.exp(-dt * 3.4);
      animating = true;
      if (Math.abs(this.velocity) <= 0.02) {
        this.velocity = 0;
        this.settleDetent();
      }
    }

    this.applyAll();
    this.emitTime();
    return animating || !!this.drag;
  }

  /** Gira la rete di `radians` in senso orario: il tempo scorre in avanti. */
  private advanceRete(radians: number) {
    this.nowMode = false;
    this.timeOffset += msForReteTurn(radians);
    const idx = Math.floor(this.simTime() / 3600000);
    if (idx !== this.lastHourIndex) {
      this.lastHourIndex = idx;
      const now = performance.now();
      if (now - this.lastTickAt > 45) {
        this.lastTickAt = now;
        this.emit("tick");
      }
    }
  }

  /** Scatto morbido: se ci si ferma vicino a un'ora intera, ci si appoggia sopra. */
  private settleDetent() {
    const t = this.simTime();
    const hour = 3600000;
    const nearest = Math.round(t / hour) * hour;
    if (Math.abs(nearest - t) < 7 * 60000) {
      const target = this.timeOffset + (nearest - t);
      const from = this.timeOffset;
      this.tween("detent", 0.35, (k) => {
        this.timeOffset = lerp(from, target, easeOutCubic(k));
      }, () => this.emitTime(true));
    } else this.emitTime(true);
  }

  private applyAll() {
    const m = this.model;
    const t = this.simTime();
    const date = new Date(t);

    // pose delle parti
    const parts: Record<PartKey, THREE.Object3D> = {
      mater: m.mater,
      kursi: m.kursi,
      plate: m.plates[m.activePlate].group,
      rete: m.rete,
      rule: m.rule,
      pin: m.pin,
      horse: m.horse,
      alidade: m.alidade,
    };
    for (const k of PART_KEYS) {
      const p = this.pose[k];
      const o = parts[k];
      if (k === "plate" && this.tweens.has("plate")) {
        // durante il cambio la piastra si muove da sola
      } else {
        o.position.set(p.x, p.y, p.z);
        if (k !== "plate") o.rotation.z = p.rz;
        else o.rotation.z = p.rz;
      }
      const mats = m.partMaterials.get(k === "plate" ? m.plates[m.activePlate].group : o);
      if (mats && (p.opacity < 1 || mats[0]?.transparent)) for (const mat of mats) mat.opacity = p.opacity;
      o.visible = p.opacity > 0.002 || (k === "plate" && this.tweens.has("plate"));
    }
    // il trono porta con sé anche il lembo (fa parte della madre): opacità condivisa
    const limbMats = m.partMaterials.get(m.limb);
    if (limbMats) for (const mat of limbMats) mat.opacity = this.pose.mater.opacity;

    // rete: ruota col tempo; si solleva durante il cambio di piastra e il rompicapo
    const lift = Math.max(this.plateSwap * 0.38, this.lift * 0.9);
    const reteRot = this.currentReteAngle();
    m.reteSpin.rotation.z = -reteRot;
    m.reteShadowSpin.rotation.z = -reteRot;
    m.rete.position.z += lift;
    m.rule.position.z += lift * 1.15;
    m.pin.position.z += lift * 1.3;
    m.horse.position.z += lift * 1.4;
    const liftFade = 1 - clamp01((this.lift - 0.4) / 0.6);
    for (const part of [m.rete, m.rule, m.pin, m.horse]) {
      if (this.lift > 0.001) {
        part.visible = liftFade > 0.01;
      }
    }

    // la regola segue il Sole sulla rete (così sul lembo si legge l'ora solare), o la qibla
    const sun = this.sunEq(t);
    const sunPos = rotateClockwise(projectOnRete(sun.ra, sun.dec), reteRot);
    const sunAngle = clockAngle(sunPos);
    let ruleTarget = sunAngle;
    if (this.ruleQiblaBlend > 0) {
      const lat = this.plateLat;
      const hp = horizonPoint(this.qiblaBearingDeg, lat);
      const qAngle = clockAngle(hp);
      ruleTarget = sunAngle + wrapPi(qAngle - sunAngle) * this.ruleQiblaBlend;
    }
    this.ruleAngle = ruleTarget;
    m.ruleSpin.rotation.z = -this.ruleAngle;
    m.ruleShadowSpin.rotation.z = -this.ruleAngle;
    // le ombre svaniscono quando i pezzi si sollevano o non sono al loro posto
    const seat = Math.min(1, Math.max(0, 1 - Math.abs(this.pose.rete.z) * 4)) * (1 - Math.min(1, lift * 3));
    const seatRule = Math.min(1, Math.max(0, 1 - Math.abs(this.pose.rule.z) * 4)) * (1 - Math.min(1, lift * 3));
    m.shadowMaterials[0].opacity = 0.36 * seat * this.pose.rete.opacity;
    m.shadowMaterials[1].opacity = 0.42 * seatRule * this.pose.rule.opacity;
    m.reteShadow.visible = seat > 0.01;
    m.ruleShadow.visible = seatRule > 0.01;
    m.alidadeSpin.rotation.z = this.alidadeAngle;

    // anelli del rompicapo
    const slot = m.plates[m.activePlate];
    if (!this.tweens.has("plate")) {
      slot.inner.rotation.z = this.layers.inner;
      slot.outer.rotation.z = this.layers.outer;
    }
    m.limb.rotation.z = this.layers.limb;

    // l'anello di sospensione
    m.ring.rotation.z = this.ringSwing;

    // tutto lo strumento: giro sul retro, esploso, sollevamento
    m.root.rotation.set(this.rootRotX, this.rootRotY, 0);
    m.root.scale.setScalar(this.rootScale);
    m.root.position.z = this.rootLift;

    // bagliori
    if (this.selectGlow.visible) this.selectGlow.scale.setScalar(0.15 * this.selectPulse);
    if (this.sectionGlow.visible) {
      this.sectionGlow.material.opacity = this.sectionPulse;
    }

    // luce dell'ambiente
    this.scene.environmentIntensity = this.envIntensity;

    // il cielo della città
    const lat = this.city.lat;
    const lon = this.city.lon;
    const sunH = horizontalOf(sun, date, lat, lon);
    const moonEq = this.moonEq(t, lat, lon);
    const moonH = horizontalOf(moonEq, date, lat, lon);
    const mi = this.moonPhaseAngle(t);
    this.sky.update({
      lst: reteRot,
      lat,
      sunEnu: new THREE.Vector3(sunH.east, sunH.north, sunH.up),
      sunAlt: sunH.alt,
      moonEnu: new THREE.Vector3(moonH.east, moonH.north, moonH.up),
      moonPhaseAngle: mi,
    });

    this.applyCamera();
  }

  private moonPhaseCache: { t: number; v: number } | null = null;
  private moonPhaseAngle(t: number): number {
    if (!this.moonPhaseCache || Math.abs(this.moonPhaseCache.t - t) > 30 * 60000) this.moonPhaseCache = { t, v: moonInfo(new Date(t)).phaseAngle };
    return this.moonPhaseCache.v;
  }

  /** Inquadra lo strumento nello spazio libero del contenitore; sul retro si avvicina al codice. */
  applyCamera() {
    const w = Math.max(1, this.dom.clientWidth);
    const h = Math.max(1, this.dom.clientHeight);
    const cam = this.camera;
    cam.aspect = w / h;
    const f = this.framing;
    const availW = w * (1 - 2 * f.side);
    const availH = h * (1 - f.top - f.bottom);
    const boxW = BOUNDS.maxX - BOUNDS.minX + 0.12;
    const boxH = BOUNDS.maxY - BOUNDS.minY + 0.12;
    const vfov = (cam.fov * Math.PI) / 180;
    const tanV = Math.tan(vfov / 2);
    // distanza perché il riquadro dello strumento stia nello spazio libero
    const distH = (boxH / 2) / (tanV * (availH / h));
    const distW = (boxW / 2) / (tanV * (w / h) * (availW / w));
    let dist = Math.max(distH, distW);
    // centro del riquadro nel mondo e spostamento per i margini asimmetrici
    const boxCy = (BOUNDS.maxY + BOUNDS.minY) / 2;
    const worldPerPx = (2 * dist * tanV) / h;
    // più margine sotto che sopra: lo strumento sale, quindi la camera guarda più in basso
    let cy = boxCy - ((f.bottom - f.top) * h * worldPerPx) / 2;
    let cx = 0;
    // sul retro: più vicino, centrato sul codice
    if (this.codeZoom > 0) {
      const codeW = 1.62;
      const pxPerUnit = h / (2 * dist * tanV);
      const want = Math.min(w * 0.94, 760);
      const zoom = Math.max(1, Math.min(2.3, want / (codeW * pxPerUnit)));
      const z = lerp(1, zoom, this.codeZoom);
      dist /= z;
      cy = lerp(cy, 0.36, this.codeZoom);
      cx = 0;
    }
    cam.position.set(cx, cy, dist);
    cam.lookAt(cx, cy, 0);
    cam.near = 0.05;
    cam.far = dist + 20;
    cam.updateProjectionMatrix();
    this.sky.setViewport(w, h, this.dom.width / w);
  }

  // ------------------------------------------------------------------ gesti

  private toScreen(local: THREE.Vector3): { x: number; y: number } {
    const v = local.clone();
    this.model.root.localToWorld(v);
    v.project(this.camera);
    return { x: ((v.x + 1) / 2) * this.dom.clientWidth, y: ((1 - v.y) / 2) * this.dom.clientHeight };
  }

  /** Dal punto dello schermo al piano dello strumento (z costante, coordinate locali della radice). */
  private toPlane(clientX: number, clientY: number, z: number): THREE.Vector3 | null {
    const rect = this.dom.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    this.model.root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.model.root.matrixWorld).invert();
    const o = ray.ray.origin.clone().applyMatrix4(inv);
    const d = ray.ray.direction.clone().transformDirection(inv);
    if (Math.abs(d.z) < 1e-6) return null;
    const t = (z - o.z) / d.z;
    if (t < 0) return null;
    return o.add(d.multiplyScalar(t));
  }

  /** Che cosa c'è sotto il dito: rete, lembo, trono o niente. */
  private hit(clientX: number, clientY: number): { r: number; p: THREE.Vector3; onKursi: boolean } | null {
    if (this.hidden) return null;
    const p = this.toPlane(clientX, clientY, this.flipped ? 0 : DIMS.limbTop);
    if (!p) return null;
    const r = Math.hypot(p.x, p.y);
    const onKursi = p.y > DIMS.mater * 0.75 && p.y < BOUNDS.maxY && Math.abs(p.x) < 0.9 && r > DIMS.mater * 0.96;
    if (r <= DIMS.mater * 1.02 || onKursi) return { r, p, onKursi };
    return null;
  }

  private bindEvents() {
    const el = this.dom;
    const on = (type: string, fn: EventListener, opts?: AddEventListenerOptions) => {
      el.addEventListener(type, fn, opts);
      this.listeners.push([type, fn, opts]);
    };
    // su touch: se il dito parte sullo strumento, la pagina non scorre; fuori, sì
    on(
      "touchstart",
      ((e: TouchEvent) => {
        const t = e.touches[0];
        if (t && this.hit(t.clientX, t.clientY) && e.cancelable) e.preventDefault();
      }) as EventListener,
      { passive: false },
    );
    on("pointerdown", ((e: PointerEvent) => this.onDown(e)) as EventListener);
    on("pointermove", ((e: PointerEvent) => this.onMove(e)) as EventListener);
    on("pointerup", ((e: PointerEvent) => this.onUp(e)) as EventListener);
    on("pointercancel", ((e: PointerEvent) => this.onUp(e, true)) as EventListener);
    on("pointerleave", ((e: PointerEvent) => {
      if (e.pointerType === "mouse" && !this.drag) el.style.cursor = "";
    }) as EventListener);
  }

  private angleAt(clientX: number, clientY: number): { a: number; r: number } | null {
    const p = this.toPlane(clientX, clientY, this.flipped ? 0 : DIMS.reteZ + DIMS.reteT);
    if (!p) return null;
    // sul retro lo strumento è girato: l'angolo in coordinate locali resta coerente
    return { a: Math.atan2(p.x, p.y), r: Math.hypot(p.x, p.y) };
  }

  private onDown(e: PointerEvent) {
    if (e.button !== undefined && e.button > 0) return;
    const h = this.hit(e.clientX, e.clientY);
    if (!h) return;
    const ang = this.angleAt(e.clientX, e.clientY);
    if (!ang) return;
    let kind: "rete" | "layer" | "alidade" = "rete";
    let layer: "inner" | "outer" | "limb" | undefined;
    if (this.flipped) kind = "alidade";
    else if (this.scrambled) {
      kind = "layer";
      layer = ang.r < 0.656 ? "inner" : ang.r < DIMS.limbIn ? "outer" : "limb";
    }
    this.velocity = 0;
    this.tweens.delete("detent");
    this.drag = {
      id: e.pointerId,
      kind,
      layer,
      lastAngle: ang.a,
      startX: e.clientX,
      startY: e.clientY,
      startTime: performance.now(),
      moved: false,
      samples: [{ t: performance.now(), a: 0 }],
      onKursi: h.onKursi,
    };
    try {
      this.dom.setPointerCapture(e.pointerId);
    } catch {
      /* niente */
    }
    if (h.onKursi) {
      this.longPress = setTimeout(() => {
        if (this.drag && !this.drag.moved) {
          this.drag = null;
          if (this.scrambled) this.realign();
          else this.scramble();
        }
      }, 650);
    }
    this.invalidate();
  }

  private onMove(e: PointerEvent) {
    if (!this.drag) {
      if (e.pointerType === "mouse") this.updateCursor(e);
      return;
    }
    if (e.pointerId !== this.drag.id) return;
    const d = this.drag;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 6) {
      d.moved = true;
      if (this.longPress) clearTimeout(this.longPress);
    }
    if (!d.moved || d.onKursi) return;
    const ang = this.angleAt(e.clientX, e.clientY);
    if (!ang) return;
    // vicino al perno l'angolo impazzisce: si ignora
    if (ang.r < 0.12) {
      d.lastAngle = ang.a;
      return;
    }
    let da = wrapPi(ang.a - d.lastAngle);
    d.lastAngle = ang.a;
    if (this.flipped) da = -da;
    if (d.kind === "rete") {
      this.advanceRete(da);
      const now = performance.now();
      d.samples.push({ t: now, a: da });
      while (d.samples.length > 2 && now - d.samples[0].t > 90) d.samples.shift();
    } else if (d.kind === "layer" && d.layer) {
      this.layers[d.layer] += da;
    } else if (d.kind === "alidade") {
      this.alidadeAngle -= da;
    }
    this.dom.style.cursor = "grabbing";
    this.invalidate();
  }

  private onUp(e: PointerEvent, cancelled = false) {
    if (this.longPress) {
      clearTimeout(this.longPress);
      this.longPress = null;
    }
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    this.drag = null;
    try {
      this.dom.releasePointerCapture(e.pointerId);
    } catch {
      /* niente */
    }
    if (!d.moved && !cancelled) {
      this.tap(e.clientX, e.clientY);
    } else if (d.kind === "rete") {
      const now = performance.now();
      const recent = d.samples.filter((s) => now - s.t < 100);
      const span = recent.length > 1 ? (now - recent[0].t) / 1000 : 0;
      const sum = recent.reduce((acc, s) => acc + s.a, 0);
      this.velocity = span > 0.01 ? Math.max(-14, Math.min(14, sum / span)) : 0;
      if (Math.abs(this.velocity) < 0.25) {
        this.velocity = 0;
        this.settleDetent();
      }
    } else if (d.kind === "layer" && d.layer) {
      const key = d.layer;
      const from = this.layers[key];
      const to = Math.round(from / (Math.PI / 4)) * (Math.PI / 4);
      this.emit("tick");
      this.tween("layer-" + key, 0.28, (t) => {
        this.layers[key] = lerp(from, to, easeOutCubic(t));
      }, () => this.checkSolved());
    }
    if (e.pointerType === "mouse") this.updateCursor(e);
    this.invalidate();
  }

  private updateCursor(e: PointerEvent) {
    const h = this.hit(e.clientX, e.clientY);
    if (!h) {
      this.dom.style.cursor = "";
      return;
    }
    const star = !this.flipped ? this.nearestStar(e.clientX, e.clientY) : null;
    const sec = !this.flipped ? this.nearestSection(e.clientX, e.clientY) : null;
    this.dom.style.cursor = star || sec ? "pointer" : h.onKursi ? "default" : "grab";
  }

  private nearestStar(clientX: number, clientY: number): string | null {
    const rect = this.dom.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let best: string | null = null;
    let bestD = Math.max(22, Math.min(30, rect.width * 0.06));
    this.model.root.updateMatrixWorld(true);
    for (const p of this.model.design.pointers) {
      const tip = new THREE.Vector3(p.tip.x, p.tip.y, DIMS.reteZ + DIMS.reteT);
      this.model.reteSpin.localToWorld(tip);
      tip.project(this.camera);
      const sx = ((tip.x + 1) / 2) * rect.width;
      const sy = ((1 - tip.y) / 2) * rect.height;
      const d = Math.hypot(sx - x, sy - y);
      if (d < bestD) {
        bestD = d;
        best = p.id;
      }
    }
    return best;
  }

  private nearestSection(clientX: number, clientY: number): AstroSection | null {
    const rect = this.dom.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let best: AstroSection | null = null;
    let bestD = 26;
    for (const s of this.sections) {
      const a = (s.angle * DEG) + this.layers.limb * -1;
      const rr = DIMS.mater - 0.04;
      const sp = this.toScreen(new THREE.Vector3(Math.sin(a) * rr, Math.cos(a) * rr, DIMS.limbTop));
      const d = Math.hypot(sp.x - x, sp.y - y);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  private tap(clientX: number, clientY: number) {
    if (this.flipped || this.scrambled) return;
    const star = this.nearestStar(clientX, clientY);
    if (star) {
      this.selectStar(star);
      this.emit("select");
      this.cb.onStarSelect?.(star);
      return;
    }
    const sec = this.nearestSection(clientX, clientY);
    if (sec) {
      const a = sec.angle * DEG;
      const rr = DIMS.mater - 0.04;
      this.sectionGlow.position.set(Math.sin(a) * rr, Math.cos(a) * rr, DIMS.limbTop + 0.004);
      this.sectionGlow.visible = true;
      this.tween("section", 0.9, (t) => {
        this.sectionPulse = Math.sin(Math.PI * t);
      }, () => (this.sectionGlow.visible = false));
      this.emit("select");
      this.cb.onSectionSelect?.(sec.id);
    }
  }

  /** Tastiera: frecce = un'ora (con Maiusc dieci minuti), Home = adesso. */
  key(e: KeyboardEvent): boolean {
    const step = e.shiftKey ? (10 / 60) * (Math.PI / 12) : Math.PI / 12;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      this.velocity = 0;
      this.advanceRete(step * 1.0027);
      this.invalidate();
      return true;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      this.velocity = 0;
      this.advanceRete(-step * 1.0027);
      this.invalidate();
      return true;
    }
    if (e.key === "Home") {
      this.resetNow();
      return true;
    }
    return false;
  }

  needsFrame(): boolean {
    return this.tweens.size > 0 || Math.abs(this.velocity) > 0.02 || !!this.drag;
  }

  dispose() {
    this.disposed = true;
    for (const [type, fn, opts] of this.listeners) this.dom.removeEventListener(type, fn, opts);
    this.listeners = [];
    if (this.nowTimer) clearInterval(this.nowTimer);
    if (this.longPress) clearTimeout(this.longPress);
    this.scene.remove(this.sky.group, this.model.root, this.tariq.mesh);
    this.model.dispose();
    this.sky.dispose();
    this.tariq.dispose();
    this.qiblaMat.dispose();
    this.qiblaLine?.geometry.dispose();
    for (const s of [this.selectGlow, this.sectionGlow, this.kaabaMark]) s.material.dispose();
  }
}
