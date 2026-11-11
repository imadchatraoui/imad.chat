// Gli id dei titoli dentro il foglio (per aria-labelledby). In un file a parte, così chi li usa
// non si porta dietro i pannelli.

export const titleIds = {
  menu: "sheet-title-sezioni",
  star: (id: string) => `sheet-title-star-${id}`,
  city: (id: string) => `sheet-title-city-${id}`,
  section: (id: string) => `sheet-title-section-${id}`,
} as const;
