// Curve di movimento. Meccaniche: arrivi decisi con un piccolo assestamento, mai rimbalzi gommosi.

export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number) => t * t * t;
export const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

/** Arrivo con un leggero sovrapasso e assestamento, come un pezzo d'ottone che si incastra. */
export const easeOutBack = (t: number, s = 1.25) => {
  const c3 = s + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
};

/** Assestamento meccanico: corsa veloce, piccola oscillazione smorzata in fondo. */
export const easeSettle = (t: number) => {
  if (t >= 1) return 1;
  const base = easeOutCubic(Math.min(1, t / 0.72));
  const tail = t > 0.72 ? Math.sin(((t - 0.72) / 0.28) * Math.PI * 2) * 0.012 * (1 - (t - 0.72) / 0.28) : 0;
  return base + tail;
};

/** Parte di una timeline: quanto è avanzato un segmento [start, start+dur] al tempo t. */
export const segment = (t: number, start: number, dur: number) => clamp01((t - start) / dur);

/** Angolo ridotto a (-π, π]. */
export const wrapPi = (a: number) => {
  const t = Math.PI * 2;
  let x = (a + Math.PI) % t;
  if (x < 0) x += t;
  return x - Math.PI;
};

/** Smorzamento esponenziale indipendente dal frame rate. */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));
