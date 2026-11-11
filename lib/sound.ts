// Il suono di imad's world, con la Web Audio API.
//
// - È spento finché chi visita non lo accende; la scelta resta nel browser (localStorage).
// - Non suona mai prima di un gesto: il contesto audio nasce dentro un tocco, un clic o un tasto.
// - Se public/media/manifest.json elenca i campioni (sfx/S01…S11.mp3), suonano quelli;
//   altrimenti ogni suono è sintetizzato qui: scatti d'ottone (rumore filtrato e parziali inarmoniche),
//   un luccichio di seni, colpi profondi in un riverbero lungo.
// - Gli ambienti (amb/<luogo>.mp3) entrano e escono in dissolvenza, a volume molto basso.
//
//   import { getSound, useSound } from "@/lib/sound";
//   getSound().play("tick");                    // da qualunque evento dell'intro o dell'astrolabio
//   const { enabled, toggle } = useSound();     // in un componente
//
// Si possono inoltrare tutti gli eventi dell'astrolabio (onEvent={(n) => getSound().play(n)}):
// i doppioni (i colpi di at-Tariq, la frase di battitura del campione S08) vengono filtrati qui.

import { useSyncExternalStore } from "react";
import { amb as ambUrl, loadMedia, sfx as sfxUrl, type MediaIndex, type SfxId } from "./media";

export type SoundName =
  // l'intro
  | "type"
  | "backspace"
  | "dissolve"
  | "condense"
  | "circle"
  // l'astrolabio
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
  | "unlock"
  // la cornice
  | "open"
  | "close";

interface SampleSpec {
  id: SfxId;
  gain: number;
  /** Il campione contiene una frase intera: gli eventi che arrivano entro tanti ms dal precedente non lo ripetono. */
  phrase?: number;
  /** Eventi che il campione contiene già (non vanno sintetizzati mentre suona). */
  covers?: SoundName[];
}

const SAMPLES: Partial<Record<SoundName, SampleSpec>> = {
  type: { id: "S08", gain: 0.55, phrase: 1500 },
  backspace: { id: "S09", gain: 0.55, phrase: 1200 },
  dissolve: { id: "S10", gain: 0.45, phrase: 2400 },
  condense: { id: "S10", gain: 0.45, phrase: 2400 },
  circle: { id: "S10", gain: 0.4, phrase: 2400 },
  tick: { id: "S01", gain: 0.5 },
  plate: { id: "S04", gain: 0.6 },
  assemble: { id: "S05", gain: 0.6 },
  flip: { id: "S06", gain: 0.6 },
  tariq: { id: "S07", gain: 0.75, covers: ["tariq-knock", "tariq-pierce"] },
  open: { id: "S11", gain: 0.45 },
};

/** Intervallo minimo tra due suoni uguali sintetizzati, in ms (i tick della rete arrivano a raffica). */
const MIN_GAP: Partial<Record<SoundName, number>> = { tick: 38, type: 30, backspace: 30, select: 60, open: 250, close: 250 };

/** I tempi di at-Tariq nell'astrolabio: tre colpi e poi il raggio (secondi dall'inizio). */
const TARIQ_KNOCKS = [0.9, 1.75, 2.6];
const TARIQ_PIERCE = 3.6;
const TARIQ_TOTAL_MS = 6500;

const STORAGE_KEY = "imad.sound";
const MASTER = 0.9;
const AMB_GAIN = 0.13;
const AMB_FADE = 2.4;

export interface SoundState {
  /** La scelta di chi visita: suono acceso o spento. */
  enabled: boolean;
  /** Il contesto audio è partito (dopo un gesto). */
  running: boolean;
}

type AudioCtor = typeof AudioContext;

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeStored(on: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  } catch {
    // archiviazione bloccata: la scelta vale per questa visita
  }
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class SoundManager {
  private state: SoundState = { enabled: false, running: false };
  private listeners = new Set<() => void>();
  private initialized = false;
  private gestureSeen = false;

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private dry: GainNode | null = null;
  private wet: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  private index: MediaIndex | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();
  private lastAt = new Map<SoundName, number>();
  private coveredUntil = new Map<SoundName, number>();

  private ambWanted: string | null = null;
  private amb: { id: string; src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private ambToken = 0;

  // --- stato, per React -------------------------------------------------------------------

  subscribe = (cb: () => void) => {
    this.init();
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };

  getState = (): SoundState => {
    this.init();
    return this.state;
  };

  private set(patch: Partial<SoundState>) {
    const next = { ...this.state, ...patch };
    if (next.enabled === this.state.enabled && next.running === this.state.running) return;
    this.state = next;
    for (const l of this.listeners) l();
  }

  /** Legge la preferenza e si mette in ascolto del primo gesto. Solo nel browser. */
  private init() {
    if (this.initialized || typeof window === "undefined") return;
    this.initialized = true;
    this.state = { enabled: readStored(), running: false };
    const onGesture = () => {
      this.gestureSeen = true;
      if (this.state.enabled) this.start();
    };
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    // gli eventi che i browser considerano un'attivazione dell'utente
    for (const t of ["pointerup", "touchend", "keydown", "click"]) window.addEventListener(t, onGesture, opts);
    document.addEventListener("visibilitychange", () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend().catch(() => {});
      else if (this.state.enabled && this.gestureSeen) void this.ctx.resume().catch(() => {});
    });
  }

  get enabled() {
    return this.getState().enabled;
  }

  /** Accende o spegne. Va chiamato da un gesto (un clic), così il contesto audio può partire subito. */
  setEnabled = (on: boolean) => {
    this.init();
    if (typeof window === "undefined") return;
    writeStored(on);
    this.set({ enabled: on });
    if (on) {
      this.gestureSeen = true;
      this.start();
      // un piccolo scatto conferma che il suono c'è
      window.setTimeout(() => this.play("select"), 60);
    } else {
      this.stopAmbience(0.5);
      const ctx = this.ctx;
      if (ctx) window.setTimeout(() => void ctx.suspend().catch(() => {}), 650);
      this.set({ running: false });
    }
  };

  toggle = () => this.setEnabled(!this.getState().enabled);

  // --- contesto audio ----------------------------------------------------------------------

  private start() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
      const Ctor = w.AudioContext ?? w.webkitAudioContext;
      if (!Ctor) return;
      try {
        // su iOS rispetta l'interruttore del silenzioso e si mescola alla musica degli altri
        const nav = navigator as unknown as { audioSession?: { type: string } };
        if (nav.audioSession) nav.audioSession.type = "ambient";
      } catch {
        // non supportato
      }
      try {
        this.ctx = new Ctor({ latencyHint: "interactive" });
      } catch {
        return;
      }
      this.buildGraph(this.ctx);
      void loadMedia().then((index) => {
        this.index = index;
        this.preload();
        if (this.ambWanted) this.setAmbience(this.ambWanted);
      });
    }
    const ctx = this.ctx;
    if (ctx.state !== "running") {
      // Safari vecchi: un campione muto dentro il gesto sblocca l'uscita
      try {
        const b = ctx.createBuffer(1, 1, 22050);
        const s = ctx.createBufferSource();
        s.buffer = b;
        s.connect(ctx.destination);
        s.start(0);
      } catch {
        // niente
      }
      void ctx
        .resume()
        .then(() => this.set({ running: ctx.state === "running" }))
        .catch(() => {});
    } else {
      this.set({ running: true });
    }
    if (this.ambWanted && !this.amb) this.setAmbience(this.ambWanted);
  }

  private buildGraph(ctx: AudioContext) {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 3;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    comp.connect(ctx.destination);

    const master = ctx.createGain();
    master.gain.value = MASTER;
    master.connect(comp);

    const dry = ctx.createGain();
    dry.connect(master);

    // un riverbero generato: rumore che si spegne, come una sala di pietra
    const conv = ctx.createConvolver();
    conv.buffer = this.impulse(ctx, 2.8, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.32;
    wet.connect(conv);
    conv.connect(master);

    this.master = master;
    this.dry = dry;
    this.wet = wet;

    const len = Math.floor(ctx.sampleRate * 2);
    const noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = noise;
  }

  private impulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // rumore leggermente filtrato (le alte si spengono prima)
        lp += (Math.random() * 2 - 1 - lp) * (0.55 - 0.4 * t);
        d[i] = lp * Math.pow(1 - t, decay);
      }
    }
    return buf;
  }

  // --- campioni ----------------------------------------------------------------------------

  private preload() {
    const ids = new Set(Object.values(SAMPLES).map((s) => s!.id));
    for (const id of ids) void this.loadSample(id);
  }

  private loadSample(id: SfxId): Promise<AudioBuffer | null> {
    const url = this.index ? sfxUrl(id, this.index) : null;
    if (!url || !this.ctx) return Promise.resolve(null);
    return this.loadBuffer(url);
  }

  private loadBuffer(url: string): Promise<AudioBuffer | null> {
    const ctx = this.ctx;
    if (!ctx) return Promise.resolve(null);
    const hit = this.buffers.get(url);
    if (hit) return Promise.resolve(hit);
    let p = this.loading.get(url);
    if (!p) {
      p = fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then(
          (data) =>
            new Promise<AudioBuffer>((resolve, reject) => {
              // la forma con le callback funziona anche nei Safari che non restituiscono una Promise
              const ret = ctx.decodeAudioData(data, resolve, reject) as unknown;
              if (ret && typeof (ret as Promise<AudioBuffer>).then === "function") {
                (ret as Promise<AudioBuffer>).then(resolve, reject);
              }
            }),
        )
        .then((buf) => {
          this.buffers.set(url, buf);
          return buf;
        })
        .catch(() => null);
      this.loading.set(url, p);
    }
    return p;
  }

  private playBuffer(buf: AudioBuffer, gain: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(this.dry!);
    src.start();
  }

  // --- suonare -----------------------------------------------------------------------------

  /** Suona un evento. Non fa nulla se il suono è spento o se non c'è ancora stato un gesto. */
  play = (name: SoundName | string) => {
    this.init();
    const ctx = this.ctx;
    if (!this.state.enabled || !this.gestureSeen || !ctx || !this.dry) return;
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const key = name as SoundName;
    const now = performance.now();
    if ((this.coveredUntil.get(key) ?? 0) > now) return;
    const last = this.lastAt.get(key) ?? -1e9;
    this.lastAt.set(key, now);

    const spec = SAMPLES[key];
    const url = spec && this.index ? sfxUrl(spec.id, this.index) : null;
    const buf = url ? this.buffers.get(url) : undefined;
    if (spec && buf) {
      if (spec.phrase && now - last < spec.phrase) return;
      this.playBuffer(buf, spec.gain);
      if (spec.covers) for (const c of spec.covers) this.coveredUntil.set(c, now + buf.duration * 1000);
      return;
    }
    if (url) void this.loadBuffer(url); // la prossima volta suonerà il campione
    if (now - last < (MIN_GAP[key] ?? 0)) return;
    try {
      this.synth(key, ctx.currentTime + 0.005);
    } catch {
      // un nodo non supportato non deve rompere la pagina
    }
  };

  // --- sintesi -----------------------------------------------------------------------------

  private synth(name: SoundName, t: number) {
    switch (name) {
      case "tick":
        return this.brassClick(t, { base: rand(2150, 2450), gain: 0.05, decay: 0.07 });
      case "select":
        this.brassClick(t, { base: 2900, gain: 0.04, decay: 0.06 });
        return this.ring(t + 0.01, { base: 1318.5, decay: 0.55, gain: 0.012, wet: 0.5 });
      case "type":
        return this.keystroke(t, 1);
      case "backspace":
        return this.keystroke(t, 0.82);
      case "dissolve":
        return this.shimmer(t, { swell: false, gain: 0.011 });
      case "condense":
        return this.shimmer(t, { swell: true, gain: 0.012 });
      case "circle":
        this.shimmer(t, { swell: false, gain: 0.007 });
        return this.ring(t, { base: 523.25, decay: 2.6, gain: 0.03, wet: 0.7 });
      case "plate":
        this.whoosh(t, { from: 700, to: 2600, dur: 0.38, gain: 0.05, q: 1.6 });
        this.brassClick(t + 0.4, { base: 1480, gain: 0.06, decay: 0.32 });
        return this.ring(t + 0.4, { base: 740, decay: 0.9, gain: 0.014, wet: 0.4 });
      case "assemble":
        [0, 0.11, 0.2].forEach((d, i) => this.brassClick(t + d, { base: 2050 + i * 260, gain: 0.045, decay: 0.06 }));
        this.thud(t + 0.32, { from: 150, to: 82, gain: 0.12, decay: 0.28, wet: 0.25 });
        return this.ring(t + 0.34, { base: 392, decay: 2.2, gain: 0.022, wet: 0.6 });
      case "explode":
        this.whoosh(t, { from: 450, to: 1700, dur: 0.55, gain: 0.04, q: 0.9 });
        return [0.1, 0.24, 0.36].forEach((d) => this.brassClick(t + d, { base: rand(1900, 2600), gain: 0.03, decay: 0.05 }));
      case "flip":
        this.whoosh(t, { from: 1800, to: 420, dur: 0.5, gain: 0.06, q: 0.8 });
        return this.brassClick(t + 0.52, { base: 1250, gain: 0.06, decay: 0.12 });
      case "tariq":
        // la notte si fa più scura: un respiro basso; poi i tre colpi e il raggio, ai tempi dell'astrolabio
        this.drone(t, 4.6);
        TARIQ_KNOCKS.forEach((k) => this.knock(t + k));
        this.pierce(t + TARIQ_PIERCE);
        this.coveredUntil.set("tariq-knock", performance.now() + TARIQ_TOTAL_MS);
        this.coveredUntil.set("tariq-pierce", performance.now() + TARIQ_TOTAL_MS);
        return;
      case "tariq-knock":
        return this.knock(t);
      case "tariq-pierce":
        return this.pierce(t);
      case "qibla":
        return this.ring(t, { base: 330, decay: 1.8, gain: 0.03, wet: 0.6 });
      case "scramble":
        return [0, 0.07, 0.15, 0.21].forEach((d) => this.brassClick(t + d, { base: rand(1700, 2800), gain: 0.04, decay: 0.06 }));
      case "unlock":
        this.shimmer(t, { swell: true, gain: 0.012 });
        return this.ring(t + 0.5, { base: 392, decay: 2.8, gain: 0.025, wet: 0.7 });
      case "open":
        return this.rustle(t, 1);
      case "close":
        return this.rustle(t, 0.6);
      default:
        return;
    }
  }

  private gainAt(t: number, attack: number, peak: number, decay: number, dest: AudioNode): GainNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.00001, t + attack + decay);
    g.connect(dest);
    return g;
  }

  private noise(t: number, dur: number, dest: AudioNode, rate = 1) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = rate;
    src.connect(dest);
    src.start(t, Math.random() * Math.max(0, 1.9 - dur), dur + 0.05);
    return src;
  }

  private sine(t: number, freq: number, dur: number, dest: AudioNode) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(freq, t);
    o.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  /** Uno scatto d'ottone: un colpo di rumore filtrato e poche parziali inarmoniche che muoiono subito. */
  private brassClick(t: number, o: { base: number; gain: number; decay: number }) {
    const ctx = this.ctx!;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = o.base * 1.9;
    bp.Q.value = 1.3;
    bp.connect(this.gainAt(t, 0.0012, o.gain * 1.3, 0.016, this.dry!));
    this.noise(t, 0.03, bp);
    const ratios = [1, 1.593, 2.135, 2.917, 3.725];
    ratios.forEach((r, i) => {
      const g = this.gainAt(t, 0.001, (o.gain * 0.55) / (i + 1), o.decay * (1 - i * 0.13), this.dry!);
      this.sine(t, o.base * r * (1 + (Math.random() - 0.5) * 0.012), o.decay, g);
    });
  }

  /** Un tasto: un soffio corto e un colpo sordo. */
  private keystroke(t: number, tone: number) {
    const ctx = this.ctx!;
    const v = rand(0.85, 1.15);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2600 * tone * v;
    bp.Q.value = 0.9;
    bp.connect(this.gainAt(t, 0.002, 0.045, 0.028, this.dry!));
    this.noise(t, 0.04, bp);
    const g = this.gainAt(t, 0.002, 0.05, 0.04, this.dry!);
    const o = this.sine(t, 170 * tone * v, 0.05, g);
    o.frequency.exponentialRampToValueAtTime(95 * tone, t + 0.04);
  }

  /** Un luccichio di seni acuti, senza melodia; con swell sale invece di cadere. */
  private shimmer(t: number, o: { swell: boolean; gain: number }) {
    const pool = [1567.98, 1760, 2093, 2349.32, 2637.02, 3135.96, 3520, 4186.01];
    const n = 5;
    for (let i = 0; i < n; i++) {
      const f = pool[Math.floor(Math.random() * pool.length)] * (1 + (Math.random() - 0.5) * 0.006);
      const start = t + (o.swell ? i * 0.09 : i * 0.045) + Math.random() * 0.06;
      const attack = o.swell ? 0.55 + Math.random() * 0.25 : 0.012;
      const decay = o.swell ? 1.1 + Math.random() * 0.5 : 0.7 + Math.random() * 0.7;
      const g = this.gainAt(start, attack, o.gain, decay, this.dry!);
      g.connect(this.wet!);
      this.sine(start, f, attack + decay, g);
    }
    // un filo d'aria
    const ctx = this.ctx!;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    const air = this.gainAt(t, o.swell ? 0.6 : 0.05, o.gain * 0.5, 0.5, this.dry!);
    air.connect(this.wet!);
    hp.connect(air);
    this.noise(t, 1.2, hp);
  }

  /** Una nota d'ottone percossa: parziali di una barra metallica, lunghe e quiete. */
  private ring(t: number, o: { base: number; decay: number; gain: number; wet: number }) {
    const ratios = [1, 2.756, 5.404, 8.933];
    const amps = [1, 0.42, 0.2, 0.08];
    ratios.forEach((r, i) => {
      const g = this.gainAt(t, 0.002, o.gain * amps[i], o.decay * [1, 0.6, 0.35, 0.2][i], this.dry!);
      const send = this.ctx!.createGain();
      send.gain.value = o.wet;
      g.connect(send).connect(this.wet!);
      this.sine(t, o.base * r, o.decay, g);
      // un battimento lento sulla fondamentale, come nel metallo vero
      if (i === 0) this.sine(t, o.base * 1.0035, o.decay, g);
    });
  }

  /** Rumore che passa in un filtro che scorre: una lastra che scivola, un disco che gira. */
  private whoosh(t: number, o: { from: number; to: number; dur: number; gain: number; q: number }) {
    const ctx = this.ctx!;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = o.q;
    bp.frequency.setValueAtTime(o.from, t);
    bp.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.gain, t + o.dur * 0.4);
    g.gain.linearRampToValueAtTime(0, t + o.dur);
    g.connect(this.dry!);
    bp.connect(g);
    this.noise(t, o.dur, bp);
  }

  private thud(t: number, o: { from: number; to: number; gain: number; decay: number; wet: number }) {
    const ctx = this.ctx!;
    const g = this.gainAt(t, 0.003, o.gain, o.decay, this.dry!);
    const send = ctx.createGain();
    send.gain.value = o.wet;
    g.connect(send).connect(this.wet!);
    const osc = this.sine(t, o.from, o.decay + 0.1, g);
    osc.frequency.exponentialRampToValueAtTime(o.to, t + 0.12);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 520;
    lp.connect(this.gainAt(t, 0.002, o.gain * 0.5, 0.06, this.dry!));
    this.noise(t, 0.08, lp);
  }

  /** Un colpo profondo, come su una grande porta di legno sotto il cielo aperto. */
  private knock(t: number) {
    this.thud(t, { from: 118, to: 56, gain: 0.2, decay: 0.55, wet: 1.4 });
  }

  /** Un tono cristallino che sale, trafigge e si spegne piano. */
  private pierce(t: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.045, t + 0.28);
    g.gain.setValueAtTime(0.045, t + 0.9);
    g.gain.exponentialRampToValueAtTime(0.00001, t + 4.2);
    g.connect(this.dry!);
    const send = ctx.createGain();
    send.gain.value = 1.1;
    g.connect(send).connect(this.wet!);
    const o = this.sine(t, 1318.51, 4.3, g);
    o.frequency.exponentialRampToValueAtTime(1975.53, t + 0.45);
    const g2 = ctx.createGain();
    g2.gain.value = 0.18;
    g2.connect(g);
    const o2 = this.sine(t, 2637.02, 4.3, g2);
    o2.frequency.exponentialRampToValueAtTime(3951.07, t + 0.45);
  }

  /** Un respiro basso che si gonfia e si ritira. */
  private drone(t: number, dur: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.025, t + 0.8);
    g.gain.linearRampToValueAtTime(0, t + dur);
    g.connect(this.dry!);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 180;
    lp.connect(g);
    this.sine(t, 55, dur, lp);
    this.sine(t, 82.4, dur, lp);
  }

  /** Una pagina di manoscritto che si volta: piccoli fruscii. */
  private rustle(t: number, amount: number) {
    const ctx = this.ctx!;
    const n = 4;
    for (let i = 0; i < n; i++) {
      const s = t + i * 0.055 + Math.random() * 0.03;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = rand(2600, 5200);
      bp.Q.value = 0.8;
      bp.connect(this.gainAt(s, 0.008, 0.02 * amount * (1 - i * 0.15), 0.05, this.dry!));
      this.noise(s, 0.08, bp);
    }
  }

  // --- ambienti ----------------------------------------------------------------------------

  /** L'ambiente di un luogo (amb/<id>.mp3), in dissolvenza; null per il silenzio. */
  setAmbience = (id: string | null) => {
    this.init();
    this.ambWanted = id;
    const ctx = this.ctx;
    if (!this.state.enabled || !ctx || !this.master) return;
    if (this.amb?.id === id) return;
    const token = ++this.ambToken;
    this.stopAmbience(AMB_FADE);
    if (!id) return;
    void loadMedia().then((index) => {
      this.index = index;
      const url = ambUrl(id, index);
      if (!url) return;
      void this.loadBuffer(url).then((buf) => {
        if (!buf || token !== this.ambToken || !this.state.enabled || !this.ctx) return;
        const t = this.ctx.currentTime;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(AMB_GAIN, t + AMB_FADE);
        src.connect(gain).connect(this.master!);
        src.start(t, Math.random() * Math.max(0, buf.duration - 1));
        this.amb = { id, src, gain };
      });
    });
  };

  private stopAmbience(fade: number) {
    const a = this.amb;
    const ctx = this.ctx;
    this.amb = null;
    if (!a || !ctx) return;
    const t = ctx.currentTime;
    a.gain.gain.cancelScheduledValues(t);
    a.gain.gain.setValueAtTime(a.gain.gain.value, t);
    a.gain.gain.linearRampToValueAtTime(0, t + fade);
    try {
      a.src.stop(t + fade + 0.05);
    } catch {
      // già fermo
    }
  }
}

let singleton: SoundManager | null = null;

/** Il gestore del suono (uno per pagina). Sicuro da chiamare anche sul server: lì non fa nulla. */
export function getSound(): SoundManager {
  if (!singleton) {
    singleton = new SoundManager();
    // in sviluppo, per provare i suoni dalla console: __imadSound.play("tariq")
    if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
      (window as unknown as { __imadSound?: SoundManager }).__imadSound = singleton;
    }
  }
  return singleton;
}

const SERVER_STATE: SoundState = { enabled: false, running: false };

/** Hook: lo stato del suono e i comandi per un interruttore. */
export function useSound() {
  const s = getSound();
  const state = useSyncExternalStore(s.subscribe, s.getState, () => SERVER_STATE);
  return { enabled: state.enabled, running: state.running, toggle: s.toggle, setEnabled: s.setEnabled, play: s.play, setAmbience: s.setAmbience };
}
