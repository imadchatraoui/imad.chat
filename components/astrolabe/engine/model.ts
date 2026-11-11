// Il modello 3D dell'astrolabio: madre con lembo e trono, piastra, rete traforata, regola,
// perno e cavallo davanti; alidada con le pinnule dietro. Geometrie modeste, una texture
// incisa per faccia, ottone fisico (MeshPhysicalMaterial) con rugosità che cresce nei solchi.

import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  RETE_SOURCE,
  reteDesign,
  toDateCoordsMany,
  type AstroSection,
  type CityItem,
  type ReteDesign,
  type StarItem,
} from "@/lib/astro";
import { SunPosition } from "astronomy-engine";
import { Burin, makeCanvas } from "./canvas";
import { silhouetteToLoops, type ShapeLoops } from "./contours";
import { DIMS } from "./dims";
import type { EngraveFonts } from "./fonts";
import type { MediaManifest } from "./manifest";
import { loadImage } from "./manifest";
import * as P from "./paint";

export interface ModelOptions {
  fonts: EngraveFonts;
  /** Lato delle texture principali: 2048 su schermi grandi, 1024 sui telefoni. */
  texSize: number;
  manifest: MediaManifest;
  stars: readonly StarItem[];
  cities: readonly CityItem[];
  sections: readonly AstroSection[];
  anisotropy: number;
}

// ---------- materiali ----------

let roughnessTex: THREE.Texture | null = null;

/** Variazione di rugosità che si ripete: l'ottone non è mai lucido allo stesso modo ovunque. */
function sharedRoughness(): THREE.Texture {
  if (roughnessTex) return roughnessTex;
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "rgb(222,222,222)";
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  let s = 12345;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let i = 0; i < size * size; i++) {
    const v = 200 + rnd() * 50;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  // ammorbidisce: macchie, non sale e pepe
  ctx.filter = "blur(2px)";
  ctx.drawImage(c, 0, 0);
  ctx.filter = "none";
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 5);
  t.colorSpace = THREE.NoColorSpace;
  roughnessTex = t;
  return t;
}

let anisoTex: THREE.Texture | null = null;

/** La spazzolatura al tornio: direzione tangente ai cerchi, per i pezzi tondi (piastre, lembo, retro). */
function sharedAnisotropy(): THREE.Texture {
  if (anisoTex) return anisoTex;
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const dx = (i + 0.5) / size - 0.5;
      const dy = 0.5 - (j + 0.5) / size;
      const r = Math.hypot(dx, dy) || 1e-6;
      const tx = -dy / r;
      const ty = dx / r;
      const k = (j * size + i) * 4;
      img.data[k] = Math.round((tx * 0.5 + 0.5) * 255);
      img.data[k + 1] = Math.round((ty * 0.5 + 0.5) * 255);
      img.data[k + 2] = Math.round(Math.min(1, r / 0.06) * 255);
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  anisoTex = t;
  return t;
}

export interface BrassOptions {
  /** Spazzolatura concentrica (0..1), per i pezzi tondi. */
  turned?: number;
  map?: THREE.Texture | null;
  roughness?: number;
  color?: THREE.ColorRepresentation;
  bump?: number;
  clearcoat?: number;
  env?: number;
}

/** Ottone: metallo pieno, rugosità media, una velatura di lacca. Le linee incise sono più ruvide. */
export function brassMaterial(o: BrassOptions = {}): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    color: o.color ?? 0xffffff,
    metalness: 1,
    roughness: o.roughness ?? 0.44,
    map: o.map ?? null,
    bumpMap: o.map ?? null,
    bumpScale: o.bump ?? 0.3,
    roughnessMap: sharedRoughness(),
    clearcoat: o.clearcoat ?? 0.22,
    clearcoatRoughness: 0.32,
    envMapIntensity: o.env ?? 1,
  });
  if (o.turned) {
    m.anisotropy = o.turned;
    m.anisotropyMap = sharedAnisotropy();
  }
  if (o.map) {
    m.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
#ifdef USE_MAP
  float engr = 1.0 - smoothstep(0.035, 0.2, dot(sampledDiffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)));
  roughnessFactor = clamp(roughnessFactor + engr * 0.34, 0.0, 1.0);
#endif`,
      );
    };
    m.customProgramCacheKey = () => "brass-engraved";
  }
  return m;
}

function canvasTexture(c: HTMLCanvasElement, anisotropy: number): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// ---------- geometrie ----------

/** UV planari: (x, y) del pezzo → [0,1]² della sua texture, che copre [cx±half]×[cy±halfY]. */
function planarUV(g: THREE.BufferGeometry, cx: number, cy: number, half: number, halfY = half) {
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - cx) / (2 * half) + 0.5;
    uv[i * 2 + 1] = (pos.getY(i) - cy) / (2 * halfY) + 0.5;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

function loopsToShapes(loops: ShapeLoops[]): THREE.Shape[] {
  return loops.map((s) => {
    const shape = new THREE.Shape(s.outer.map(([x, y]) => new THREE.Vector2(x, y)));
    shape.holes = s.holes.map((h) => new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
    return shape;
  });
}

function extrude(shapes: THREE.Shape[], depth: number, bevel: number, segments = 2): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shapes, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelSegments: segments,
    curveSegments: 6,
    steps: 1,
  });
  toCreasedNormals(g, 0.33);
  return g;
}

/** Una parete di rivoluzione dal profilo (r, z), attorno all'asse z. */
function lathe(profile: [number, number][], segments: number): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(
    profile.map(([r, z]) => new THREE.Vector2(r, z)),
    segments,
  );
  g.rotateX(Math.PI / 2);
  return g;
}

function quarter(cx: number, cy: number, r: number, a0: number, a1: number, n = 6): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

/** Il silhouette di un pezzo traforato, dipinto e tracciato. */
function traceSilhouette(size: number, frame: { cx: number; cy: number; half: number }, paintFn: (b: Burin) => void, eps = 0.45, height = size): ShapeLoops[] {
  const c = makeCanvas(size, height);
  const b = new Burin(c, frame.half, frame.cx, frame.cy);
  paintFn(b);
  return silhouetteToLoops(c, (px, py) => [px / b.k - frame.half + frame.cx, frame.cy + b.halfY - py / b.k], eps);
}

/** Da un'immagine nero su bianco (ornamenti generati) a una sagoma: il nero è pieno. */
function silhouetteFromImage(img: HTMLImageElement, size: number, frame: { cx: number; cy: number; half: number }, fit: { x0: number; x1: number; y0: number; y1: number }): ShapeLoops[] {
  const c = makeCanvas(size);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const b = new Burin(c, frame.half, frame.cx, frame.cy);
  // disegna l'immagine adattata al riquadro e trasforma la luminanza in alfa
  const w = b.X(fit.x1) - b.X(fit.x0);
  const h = b.Y(fit.y0) - b.Y(fit.y1);
  const ar = img.width / img.height;
  let dw = w;
  let dh = w / ar;
  if (dh > h) {
    dh = h;
    dw = h * ar;
  }
  const dx = b.X((fit.x0 + fit.x1) / 2) - dw / 2;
  const dy = b.Y(fit.y0) - dh;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, dx, dy, dw, dh);
  const data = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < data.data.length; i += 4) {
    const lum = (data.data[i] + data.data[i + 1] + data.data[i + 2]) / 3;
    data.data[i + 3] = 255 - lum;
    data.data[i] = data.data[i + 1] = data.data[i + 2] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return silhouetteToLoops(c, (px, py) => [px / b.k - frame.half + frame.cx, frame.cy + b.halfY - py / b.k], 0.6);
}

// ---------- il modello ----------

export interface PlateSlot {
  group: THREE.Group;
  inner: THREE.Mesh;
  outer: THREE.Mesh;
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  materials: THREE.MeshPhysicalMaterial[];
  cityId: string | null;
}

export class AstrolabeModel {
  readonly root = new THREE.Group();
  /** Tutte le parti che si muovono durante montaggio ed esplosione. */
  readonly mater = new THREE.Group();
  readonly limb = new THREE.Group();
  readonly kursi = new THREE.Group();
  readonly ring = new THREE.Group();
  readonly plates: [PlateSlot, PlateSlot];
  activePlate = 0;
  readonly rete = new THREE.Group();
  readonly reteSpin = new THREE.Group();
  readonly rule = new THREE.Group();
  readonly ruleSpin = new THREE.Group();
  readonly pin = new THREE.Group();
  readonly horse = new THREE.Group();
  readonly alidade = new THREE.Group();
  readonly alidadeSpin = new THREE.Group();
  readonly fx = new THREE.Group();
  /** Ombre finte (niente ombre in tempo reale): la rete e la regola sulla piastra. */
  readonly reteShadow = new THREE.Group();
  readonly reteShadowSpin = new THREE.Group();
  readonly ruleShadow = new THREE.Group();
  readonly ruleShadowSpin = new THREE.Group();
  shadowMaterials: THREE.MeshBasicMaterial[] = [];
  design!: ReteDesign;
  /** Materiali per l'apparizione graduale delle parti. */
  readonly partMaterials = new Map<THREE.Object3D, THREE.Material[]>();
  private disposables: { dispose(): void }[] = [];
  private limbCanvas!: HTMLCanvasElement;
  private limbTexture!: THREE.CanvasTexture;
  private opts: ModelOptions;

  constructor(opts: ModelOptions) {
    this.opts = opts;
    this.root.name = "astrolabio";
    this.plates = [this.makePlateSlot(), this.makePlateSlot()];
    this.buildMater();
    this.buildKursi();
    this.buildRete();
    this.buildRule();
    this.buildPinAndHorse();
    this.buildAlidade();
    this.buildShadows();
    this.root.add(this.mater, this.kursi, this.plates[0].group, this.plates[1].group, this.reteShadow, this.ruleShadow, this.rete, this.rule, this.pin, this.horse, this.alidade, this.fx);
    this.plates[1].group.visible = false;
  }

  private track<T extends { dispose(): void }>(x: T): T {
    this.disposables.push(x);
    return x;
  }

  private register(part: THREE.Object3D, ...mats: THREE.Material[]) {
    const list = this.partMaterials.get(part) ?? [];
    list.push(...mats);
    this.partMaterials.set(part, list);
  }

  // ----- madre e lembo -----
  private buildMater() {
    const { texSize, fonts, anisotropy, cities } = this.opts;
    const R = DIMS.mater;
    const bev = 0.014;
    const top = DIMS.limbTop;
    const side = this.track(brassMaterial({ color: 0xb8924f, roughness: 0.4 }));

    // faccia del lembo, con la scala e i segni delle sezioni
    this.limbCanvas = makeCanvas(texSize);
    P.paintLimb(new Burin(this.limbCanvas, R), this.opts.sections, fonts);
    this.limbTexture = this.track(canvasTexture(this.limbCanvas, anisotropy));
    const limbMat = this.track(brassMaterial({ map: this.limbTexture, roughness: 0.4, turned: 0.55 }));
    const limbGeo = this.track(new THREE.RingGeometry(DIMS.limbIn + 0.006, R - bev, 192, 1));
    planarUV(limbGeo, 0, 0, R);
    const limbFace = new THREE.Mesh(limbGeo, limbMat);
    limbFace.position.z = top;
    this.limb.add(limbFace);

    // pareti: fuori un bordo arrotondato, dentro uno smusso
    const outer = lathe(
      [...quarter(R - bev, bev, bev, -Math.PI / 2, 0), ...quarter(R - bev, top - bev, bev, 0, Math.PI / 2)],
      192,
    );
    const inner = lathe(
      [
        [DIMS.limbIn + 0.006, top],
        [DIMS.limbIn + 0.002, top - 0.002],
        [DIMS.limbIn, top - 0.006],
        [DIMS.limbIn, DIMS.floor],
      ],
      160,
    );
    this.track(outer);
    this.track(inner);
    const walls = new THREE.Mesh(outer, side);
    const innerWall = new THREE.Mesh(inner, side);

    // il fondo, con il gazzettiere delle città
    const floorCanvas = makeCanvas(Math.max(512, texSize / 2));
    P.paintFloor(new Burin(floorCanvas, DIMS.limbIn), cities, fonts);
    const floorTex = this.track(canvasTexture(floorCanvas, anisotropy));
    const floorMat = this.track(brassMaterial({ map: floorTex, roughness: 0.5, turned: 0.5 }));
    const floorGeo = this.track(new THREE.CircleGeometry(DIMS.limbIn, 128));
    planarUV(floorGeo, 0, 0, DIMS.limbIn);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.z = DIMS.floor;

    // il retro, con le scale e il codice
    const backCanvas = makeCanvas(texSize);
    const year = new Date().getUTCFullYear();
    P.paintBack(new Burin(backCanvas, R), fonts, RETE_SOURCE, (day) => {
      const d = new Date(Date.UTC(year, 0, 1, 12) + day * 86400000);
      return SunPosition(d).elon;
    });
    const backTex = this.track(canvasTexture(backCanvas, anisotropy));
    const backMat = this.track(brassMaterial({ map: backTex, roughness: 0.42, turned: 0.5 }));
    const backGeo = this.track(new THREE.CircleGeometry(R - bev, 192));
    planarUV(backGeo, 0, 0, R);
    const back = new THREE.Mesh(backGeo, backMat);
    back.rotation.y = Math.PI;

    this.mater.add(this.limb, walls, innerWall, floor, back);
    this.register(this.mater, side, floorMat, backMat);
    this.register(this.limb, limbMat);
  }

  /** Ridipinge il lembo (per esempio quando cambiano le sezioni). */
  repaintLimb(sections: readonly AstroSection[]) {
    this.opts.sections = sections;
    P.paintLimb(new Burin(this.limbCanvas, DIMS.mater), sections, this.opts.fonts);
    this.limbTexture.needsUpdate = true;
  }

  // ----- trono, maniglia, anello -----
  private buildKursi() {
    const { texSize, anisotropy, manifest } = this.opts;
    const frame = P.KURSI_FRAME;
    const size = Math.max(512, texSize / 2);
    const loops = traceSilhouette(size, frame, (b) => P.paintKursiSilhouette(b));
    const tc = makeCanvas(size);
    P.paintKursiTexture(new Burin(tc, frame.half, frame.cx, frame.cy));
    const tex = this.track(canvasTexture(tc, anisotropy));
    const capMat = this.track(brassMaterial({ map: tex, roughness: 0.42 }));
    const sideMat = this.track(brassMaterial({ color: 0xb8924f, roughness: 0.4 }));
    const depth = DIMS.limbTop - 0.012;
    const geo = this.track(extrude(loopsToShapes(loops), depth, 0.005));
    planarUV(geo, frame.cx, frame.cy, frame.half);
    const mesh = new THREE.Mesh(geo, [capMat, sideMat]);
    mesh.position.z = 0.006;
    mesh.name = "kursi";
    this.kursi.add(mesh);
    this.register(this.kursi, capMat, sideMat);

    // se il manifesto ha una sagoma del trono, la usa al posto di quella procedurale
    const asset = manifest.first("orn/O01S.svg", "orn/O01P.png");
    if (asset) {
      loadImage(manifest.url(asset)).then((img) => {
        if (!img) return;
        try {
          const l2 = silhouetteFromImage(img, size, frame, { x0: -0.86, x1: 0.86, y0: 0.95, y1: DIMS.kursiTop + 0.36 });
          if (!l2.length) return;
          const g2 = extrude(loopsToShapes(l2), depth, 0.005);
          planarUV(g2, frame.cx, frame.cy, frame.half);
          mesh.geometry.dispose();
          mesh.geometry = g2;
          this.track(g2);
          this.ring.visible = false; // l'immagine porta già maniglia e anello
        } catch {
          /* resta il trono procedurale */
        }
      });
    }

    // la maniglia a bocciolo e l'anello di sospensione
    const bud = this.track(
      new THREE.LatheGeometry(
        [
          [0.0, 0.0],
          [0.016, 0.004],
          [0.024, 0.03],
          [0.026, 0.06],
          [0.02, 0.09],
          [0.024, 0.1],
          [0.024, 0.11],
          [0.016, 0.118],
          [0.014, 0.14],
          [0.0, 0.16],
        ].map(([r, y]) => new THREE.Vector2(r, y)),
        40,
      ),
    );
    const budMesh = new THREE.Mesh(bud, sideMat);
    budMesh.position.set(0, DIMS.kursiTop - 0.075, DIMS.limbTop / 2);
    this.kursi.add(budMesh);
    const torus = this.track(new THREE.TorusGeometry(DIMS.ringR, DIMS.ringTube, 20, 96));
    const ringMesh = new THREE.Mesh(torus, sideMat);
    // l'anello pende dalla maniglia: il perno del suo dondolio è in cima alla maniglia
    ringMesh.position.set(0, -DIMS.ringR + DIMS.ringTube * 0.4, 0);
    this.ring.add(ringMesh);
    this.ring.position.set(0, DIMS.kursiTop + 0.07, DIMS.limbTop / 2);
    this.ring.rotation.y = 0.42;
    this.kursi.add(this.ring);
  }

  // ----- piastre -----
  private makePlateSlot(): PlateSlot {
    const { texSize, anisotropy } = this.opts;
    const group = new THREE.Group();
    const canvas = makeCanvas(texSize);
    const texture = this.track(canvasTexture(canvas, anisotropy));
    const faceMat = this.track(brassMaterial({ map: texture, roughness: 0.44, bump: 0.3, turned: 0.6 }));
    const faceMat2 = this.track(brassMaterial({ map: texture, roughness: 0.44, bump: 0.3, turned: 0.6 }));
    const split = 0.656;
    const innerGeo = this.track(new THREE.CircleGeometry(split, 128));
    planarUV(innerGeo, 0, 0, DIMS.plate);
    const outerGeo = this.track(new THREE.RingGeometry(split, DIMS.plate - 0.004, 160, 2));
    planarUV(outerGeo, 0, 0, DIMS.plate);
    const inner = new THREE.Mesh(innerGeo, faceMat);
    const outer = new THREE.Mesh(outerGeo, faceMat2);
    const z = DIMS.plateZ + DIMS.plateT;
    inner.position.z = z;
    outer.position.z = z;
    const sideMat = this.track(brassMaterial({ color: 0xbd9853, roughness: 0.38 }));
    const edge = this.track(
      lathe(
        [
          [DIMS.plate - 0.004, DIMS.plateZ + DIMS.plateT],
          [DIMS.plate, DIMS.plateZ + DIMS.plateT - 0.004],
          [DIMS.plate, DIMS.plateZ],
        ],
        160,
      ),
    );
    const edgeMesh = new THREE.Mesh(edge, sideMat);
    group.add(inner, outer, edgeMesh);
    const slot: PlateSlot = { group, inner, outer, canvas, texture, materials: [faceMat, faceMat2, sideMat], cityId: null };
    this.register(group, faceMat, faceMat2, sideMat);
    return slot;
  }

  /** Dipinge una piastra nello slot indicato. */
  async paintPlate(slotIndex: number, city: CityItem | null, secret = false): Promise<void> {
    const slot = this.plates[slotIndex];
    const { fonts, manifest, cities } = this.opts;
    let bandImage: HTMLImageElement | null = null;
    const bandPath = secret ? "band/oliva.png" : city ? `band/${city.id}.png` : null;
    if (bandPath && manifest.has(bandPath)) bandImage = await loadImage(manifest.url(bandPath));
    P.paintPlate(new Burin(slot.canvas, DIMS.plate), {
      fonts,
      city: secret ? null : city,
      bandImage,
      horizonsOf: secret ? [...cities] : undefined,
      seed: (city?.id.length ?? 5) + (secret ? 17 : 0),
    });
    slot.texture.needsUpdate = true;
    slot.cityId = secret ? "__orizzonti" : (city?.id ?? null);
  }

  // ----- rete -----
  private buildRete() {
    const { texSize, anisotropy, fonts, stars } = this.opts;
    const now = new Date();
    const list = stars.filter((s) => s.pointer);
    const dated = toDateCoordsMany(
      list.map((s) => ({ ra: s.ra, dec: s.dec })),
      now,
    );
    this.design = reteDesign(
      list.map((s, i) => ({ id: s.id, ra: dated[i].ra, dec: dated[i].dec, mag: s.mag, special: !!s.quran })),
    );
    const frame = { cx: 0, cy: 0, half: P.RETE_HALF };
    const loops = traceSilhouette(texSize >= 2048 ? 1536 : 1024, frame, (b) => P.paintReteSilhouette(b, this.design), 0.4);
    const tc = makeCanvas(texSize);
    const names = new Map(list.map((s) => [s.id, s.translit || s.name || s.latin]));
    P.paintReteTexture(new Burin(tc, P.RETE_HALF), this.design, fonts, names);
    const tex = this.track(canvasTexture(tc, anisotropy));
    const capMat = this.track(brassMaterial({ map: tex, roughness: 0.3, bump: 0.22, clearcoat: 0.35, color: 0xfff4dc }));
    const sideMat = this.track(brassMaterial({ color: 0xd9b56a, roughness: 0.3 }));
    const geo = this.track(extrude(loopsToShapes(loops), DIMS.reteT - 0.004, 0.002));
    planarUV(geo, 0, 0, P.RETE_HALF);
    const mesh = new THREE.Mesh(geo, [capMat, sideMat]);
    mesh.position.z = DIMS.reteZ + 0.002;
    mesh.name = "rete";
    this.reteSpin.add(mesh);
    this.rete.add(this.reteSpin);
    this.register(this.rete, capMat, sideMat);
  }

  // ----- regola -----
  private buildRule() {
    const { texSize, anisotropy, fonts } = this.opts;
    const L = 1.13;
    const s = new THREE.Shape();
    const w = 0.03;
    const boss = 0.058;
    s.moveTo(-L, 0);
    s.lineTo(-L + 0.16, w);
    s.lineTo(-boss - 0.02, w);
    s.absarc(0, 0, boss, Math.PI - Math.asin(w / boss), Math.asin(w / boss), true);
    s.lineTo(L - 0.16, w);
    s.lineTo(L, 0);
    s.lineTo(L - 0.16, -w);
    s.lineTo(boss + 0.02, -w);
    s.absarc(0, 0, boss, -Math.asin(w / boss), Math.PI + Math.asin(w / boss), true);
    s.lineTo(-L + 0.16, -w);
    s.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, 0, DIMS.pinR + 0.002, 0, Math.PI * 2, false);
    s.holes.push(hole);
    const geo = this.track(extrude([s], DIMS.ruleT - 0.003, 0.0015, 1));
    const w2 = Math.max(1024, texSize);
    const rc = makeCanvas(w2, w2 / 16);
    const rb = new Burin(rc, 1.15);
    P.paintRule(rb, fonts);
    planarUV(geo, 0, 0, 1.15, rb.halfY);
    const tex = this.track(canvasTexture(rc, anisotropy));
    const capMat = this.track(brassMaterial({ map: tex, roughness: 0.36, clearcoat: 0.35 }));
    const sideMat = this.track(brassMaterial({ color: 0xc8a25d, roughness: 0.34 }));
    const mesh = new THREE.Mesh(geo, [capMat, sideMat]);
    mesh.position.z = DIMS.ruleZ + 0.0015;
    this.ruleSpin.add(mesh);
    this.rule.add(this.ruleSpin);
    this.register(this.rule, capMat, sideMat);
  }

  // ----- perno e cavallo -----
  private buildPinAndHorse() {
    const { texSize, anisotropy, manifest } = this.opts;
    const mat = this.track(brassMaterial({ color: 0xc9a35d, roughness: 0.32, clearcoat: 0.4 }));
    const len = 0.145;
    const pinGeo = this.track(new THREE.CylinderGeometry(DIMS.pinR, DIMS.pinR, len, 24));
    pinGeo.rotateX(Math.PI / 2);
    const pin = new THREE.Mesh(pinGeo, mat);
    pin.position.z = -0.035 + len / 2;
    // testa del perno sul retro: una cupola schiacciata
    const headGeo = this.track(new THREE.SphereGeometry(0.042, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2));
    headGeo.rotateX(-Math.PI / 2);
    headGeo.scale(1, 1, 0.55);
    const head = new THREE.Mesh(headGeo, mat);
    head.position.z = -0.03;
    this.pin.add(pin, head);
    this.register(this.pin, mat);

    const frame = P.HORSE_FRAME;
    const loops = traceSilhouette(512, frame, (b) => P.paintHorseSilhouette(b));
    const hc = makeCanvas(256);
    P.paintPlainBrass(new Burin(hc, frame.half, frame.cx, frame.cy), 91);
    const htex = this.track(canvasTexture(hc, anisotropy));
    const hcap = this.track(brassMaterial({ map: htex, roughness: 0.34, clearcoat: 0.4 }));
    const geo = this.track(extrude(loopsToShapes(loops), 0.008, 0.0018, 1));
    planarUV(geo, frame.cx, frame.cy, frame.half);
    const horse = new THREE.Mesh(geo, [hcap, mat]);
    horse.position.set(0.02, 0, DIMS.ruleZ + DIMS.ruleT + 0.0015);
    horse.rotation.z = 0;
    this.horse.add(horse);
    this.register(this.horse, hcap);
    void texSize;

    const asset = manifest.first("orn/O02S.svg", "orn/O02P.png");
    if (asset) {
      loadImage(manifest.url(asset)).then((img) => {
        if (!img) return;
        try {
          const l2 = silhouetteFromImage(img, 512, frame, { x0: -0.19, x1: 0.19, y0: -0.05, y1: 0.1 });
          if (!l2.length) return;
          const g2 = extrude(loopsToShapes(l2), 0.008, 0.0018, 1);
          planarUV(g2, frame.cx, frame.cy, frame.half);
          horse.geometry.dispose();
          horse.geometry = g2;
          this.track(g2);
        } catch {
          /* resta il cavallo procedurale */
        }
      });
    }
  }

  // ----- alidada con le pinnule, sul retro -----
  private buildAlidade() {
    const { texSize, anisotropy, fonts } = this.opts;
    const L = 1.2;
    const w = 0.036;
    const boss = 0.062;
    const s = new THREE.Shape();
    s.moveTo(-L, -w);
    s.lineTo(-L, w * 0.2);
    s.lineTo(-L + 0.06, w);
    s.lineTo(-boss - 0.02, w);
    s.absarc(0, 0, boss, Math.PI - Math.asin(w / boss), Math.asin(w / boss), true);
    s.lineTo(L - 0.06, w);
    s.lineTo(L, w * 0.2);
    s.lineTo(L, -w);
    s.lineTo(boss + 0.02, -w);
    s.absarc(0, 0, boss, -Math.asin(w / boss), Math.PI + Math.asin(w / boss), true);
    s.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, 0, DIMS.pinR + 0.002, 0, Math.PI * 2, false);
    s.holes.push(hole);
    const t = 0.012;
    const geo = this.track(extrude([s], t - 0.003, 0.0015, 1));
    const w2 = Math.max(1024, texSize);
    const ac = makeCanvas(w2, w2 / 16);
    const ab = new Burin(ac, 1.22);
    P.paintAlidade(ab, fonts);
    planarUV(geo, 0, 0, 1.22, ab.halfY);
    const tex = this.track(canvasTexture(ac, anisotropy));
    const capMat = this.track(brassMaterial({ map: tex, roughness: 0.38 }));
    const sideMat = this.track(brassMaterial({ color: 0xc29c56, roughness: 0.36 }));
    const bar = new THREE.Mesh(geo, [capMat, sideMat]);
    // il retro guarda verso -z: l'alidada sta appoggiata lì, faccia incisa verso fuori
    bar.rotation.y = Math.PI;
    bar.position.z = -0.0015;
    this.alidadeSpin.add(bar);

    // le pinnule: due piastrine ritte con un forellino, perpendicolari all'asse
    const vane = new THREE.Shape();
    const vw = 0.042;
    const vh = 0.085;
    vane.moveTo(-vw, 0);
    vane.lineTo(vw, 0);
    vane.lineTo(vw, vh * 0.7);
    vane.quadraticCurveTo(vw, vh, 0, vh);
    vane.quadraticCurveTo(-vw, vh, -vw, vh * 0.7);
    vane.closePath();
    const pinhole = new THREE.Path();
    pinhole.absarc(0, vh * 0.55, 0.009, 0, Math.PI * 2, false);
    vane.holes.push(pinhole);
    const vgeo = this.track(extrude([vane], 0.008, 0.0015, 1));
    planarUV(vgeo, 0, 0, 0.1);
    for (const sx of [-1, 1]) {
      const m = new THREE.Mesh(vgeo, sideMat);
      // la forma sta nel piano (y, -z): ruotiamo perché il suo "su" vada verso -z e lo spessore lungo x
      m.rotation.set(-Math.PI / 2, 0, 0);
      m.rotateY(Math.PI / 2);
      m.position.set(sx * 0.86, 0, -t);
      this.alidadeSpin.add(m);
    }
    this.alidade.add(this.alidadeSpin);
    this.register(this.alidade, capMat, sideMat);
  }

  // ----- ombre di contatto finte -----
  private shadowFrom(half: number, paintFn: (b: Burin) => void, blurPx: number, opacity: number): THREE.Mesh {
    const size = 512;
    const c = makeCanvas(size);
    const b = new Burin(c, half);
    paintFn(b);
    // sfoca rimpicciolendo e ringrandendo (funziona ovunque, anche dove ctx.filter non c'è)
    const small = makeCanvas(Math.max(16, Math.round(size / blurPx)));
    const sctx = small.getContext("2d")!;
    sctx.imageSmoothingEnabled = true;
    sctx.drawImage(c, 0, 0, small.width, small.height);
    const out = makeCanvas(size);
    const octx = out.getContext("2d")!;
    octx.fillStyle = "#000";
    octx.fillRect(0, 0, size, size);
    octx.imageSmoothingEnabled = true;
    octx.drawImage(small, 0, 0, size, size);
    const tex = this.track(new THREE.CanvasTexture(out));
    tex.colorSpace = THREE.NoColorSpace;
    const mat = this.track(
      new THREE.MeshBasicMaterial({ color: 0x0b0703, alphaMap: tex, transparent: true, opacity, depthWrite: false, toneMapped: false }),
    );
    this.shadowMaterials.push(mat);
    const geo = this.track(new THREE.PlaneGeometry(2 * half, 2 * half));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 1;
    return mesh;
  }

  private buildShadows() {
    const rete = this.shadowFrom(
      P.RETE_HALF,
      (b) => {
        P.paintReteSilhouette(b, this.design);
        // bianco pieno sul nero: diventa la maschera dell'ombra
      },
      7,
      0.36,
    );
    rete.position.z = DIMS.plateZ + DIMS.plateT + 0.0007;
    this.reteShadowSpin.add(rete);
    this.reteShadow.add(this.reteShadowSpin);
    // la luce viene dall'alto a sinistra: l'ombra cade un poco in basso a destra
    this.reteShadow.position.set(0.008, -0.011, 0);

    const rule = this.shadowFrom(
      1.16,
      (b) => {
        const c = b.ctx;
        c.fillStyle = "#fff";
        c.beginPath();
        const pts = [
          [-1.13, 0],
          [-0.97, 0.03],
          [0.97, 0.03],
          [1.13, 0],
          [0.97, -0.03],
          [-0.97, -0.03],
        ];
        pts.forEach(([x, y], i) => (i ? c.lineTo(b.X(x), b.Y(y)) : c.moveTo(b.X(x), b.Y(y))));
        c.closePath();
        c.fill();
        b.fillCircle(0, 0, 0.058);
      },
      5,
      0.42,
    );
    rule.position.z = DIMS.reteZ + DIMS.reteT + 0.0008;
    this.ruleShadowSpin.add(rule);
    this.ruleShadow.add(this.ruleShadowSpin);
    this.ruleShadow.position.set(0.012, -0.016, 0);
  }

  /** Il punto della punta di un puntatore, in coordinate della rete. */
  pointerTip(id: string): THREE.Vector3 | null {
    const p = this.design.pointers.find((x) => x.id === id);
    if (!p) return null;
    return new THREE.Vector3(p.tip.x, p.tip.y, DIMS.reteZ + DIMS.reteT);
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
  }
}
