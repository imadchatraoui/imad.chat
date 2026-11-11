// Le misure dello strumento, in unità di piastra (il tropico del Capricorno ha raggio 1).
// Un astrolabio vero di 15 cm di diametro ha la rete spessa poco più di un millimetro:
// le proporzioni qui sono le stesse, appena più generose per leggere bene sul telefono.

export const DIMS = {
  /** Raggio esterno della madre (il lembo). */
  mater: 1.27,
  /** Raggio interno del lembo: dentro stanno piastra e rete. */
  limbIn: 1.075,
  /** Spessore del fondo della madre: la faccia posteriore sta a z=0, il fondo della cavità a z=floor. */
  floor: 0.045,
  /** Altezza della faccia del lembo. */
  limbTop: 0.076,
  /** Raggio della piastra: oltre il Capricorno c'è una fascia ornata. */
  plate: 1.064,
  plateZ: 0.046,
  plateT: 0.012,
  reteZ: 0.0592,
  reteT: 0.018,
  ruleZ: 0.0785,
  ruleT: 0.011,
  /** Il perno. */
  pinR: 0.021,
  /** Il trono: sporge sopra il lembo. */
  kursiTop: 1.7,
  ringR: 0.15,
  ringTube: 0.021,
} as const;

/** Spazio occupato dallo strumento intero (per inquadrarlo): da sotto il lembo fino all'anello. */
export const BOUNDS = {
  minX: -DIMS.mater,
  maxX: DIMS.mater,
  minY: -DIMS.mater,
  maxY: DIMS.kursiTop + 0.4,
} as const;
