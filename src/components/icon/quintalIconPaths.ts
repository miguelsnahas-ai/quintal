// Dados brutos dos traços — cada ícone é uma lista de "d" de <path>,
// desenhados à mão (curvas orgânicas, poucos elementos), viewBox 24x24.
// Não são ícones Lucide com stroke trocado: o ponto desta fase é
// exatamente esse — formas próprias, depois passadas pelo filtro de
// "giz" em QuintalIcon.tsx, que adiciona a imperfeição/variação de
// espessura por cima. Ver docs/design-system.md #Quintal Iconography.
export type QuintalIconName =
  | "moon"
  | "bed"
  | "nap"
  | "blocks"
  | "ball"
  | "box"
  | "plate"
  | "spoon"
  | "cup"
  | "sprout"
  | "growth"
  | "book"
  | "drop"
  | "bath"
  | "toothbrush"
  | "house"
  | "calendar"
  | "cycle";

export const QUINTAL_ICON_PATHS: Record<QuintalIconName, string[]> = {
  // Sono
  moon: ["M14.5 4.2c-4.1.6-7.1 3.9-6.3 8.2.8 4.4 5.3 7.3 9.4 6.1-3-.3-5.6-2.8-6.1-6-.6-3.5 1.1-7 3-8.3z"],
  bed: [
    "M5 8v9.8",
    "M5 11.6c1.3-.8 2.6-1 3.8-.3 1-.6 2.1-.6 3.1 0 1-.6 2.1-.6 3.1 0 1.2-.7 2.6-.5 3.8.3",
    "M5 15.2h14",
    "M6.3 17.8v1.2",
    "M16.7 17.8v1.2",
  ],
  nap: ["M14.2 6.4h4.3l-4.3 4.4h4.3", "M17.9 4.4h2.7l-2.7 2.7h2.7"],

  // Brincar
  blocks: ["M4.8 10.1c2-.1 4-.1 6 0v5.9c-2 .1-4 .1-6 0z", "M12.6 11.3c2-.2 4.1-.1 6 .3v5.6c-1.9.2-4 .2-6 0z"],
  ball: [
    "M12 4.2c3.6-.2 7 2.4 7.6 6 .5 3.5-1.6 7.2-5.1 8.2-3.6 1-7.6-.8-8.9-4.2-1.3-3.3.2-7.4 3.4-9.2.6-.3 1.9-.7 3-.8z",
    "M6.3 9.4c3.8 1.8 7.6 1.8 11.4 0",
    "M7.6 16c2.9-1.7 5.9-1.7 8.8 0",
  ],
  box: [
    "M4.7 11c2.4-.3 4.9-.3 7.3-.2 2.4-.1 4.9-.1 7.3.2.3 2.6.3 5.2 0 7.8-2.4.3-4.9.3-7.3.2-2.4.1-4.9.1-7.3-.2-.3-2.6-.3-5.2 0-7.8z",
    "M5 11c1.2-2 2.6-3.3 4-3.6",
    "M19 11c-1.2-2-2.6-3.3-4-3.6",
  ],

  // Comer
  plate: [
    "M12 5c3.8 0 6.9 3.1 6.9 7s-3.1 7-6.9 7-6.9-3.1-6.9-7S8.2 5 12 5z",
    "M9 12.2c0-1.7 1.3-3 3-3s3 1.3 3 3-1.3 3-3 3-3-1.3-3-3z",
  ],
  spoon: [
    "M8.9 8c0-2.2 1.1-3.4 2.6-3.4s2.6 1.2 2.6 3.4-1.1 3.4-2.6 3.4-2.6-1.2-2.6-3.4z",
    "M11.5 11.4c-.3 2.9-.8 5.8-1.7 8.6",
  ],
  cup: ["M7.6 8.4h8.6l-1 10.2c-.1 1-.9 1.7-1.9 1.7h-2.8c-1 0-1.8-.7-1.9-1.7l-1-10.2z", "M8.3 11.6h7.2"],

  // Desenvolvimento
  sprout: ["M12 20c0-3.2.1-6.5.4-9.7", "M12.3 12.2c-1.2-2.2-1.9-4.6-1.4-7.1", "M12.4 11c1.7-1.9 2.8-4.1 2.6-6.6"],
  growth: ["M4.6 17.4c3-1 5.8-2.7 8.1-5 2-2 3.6-4.4 6.4-5.1", "M17.6 6.6l1.8.4-.3 1.9"],
  book: ["M12 7.4c-1.8-1-3.9-1.4-6-1.2v10.4c2.1-.2 4.2.2 6 1.2z", "M12 7.4c1.8-1 3.9-1.4 6-1.2v10.4c-2.1-.2-4.2.2-6 1.2z"],

  // Higiene
  drop: [
    "M12 4.6c2.3 3.4 4.6 6.8 4.6 9.7 0 2.8-2.1 5.1-4.6 5.1s-4.6-2.3-4.6-5.1c0-2.9 2.3-6.3 4.6-9.7z",
    "M10.3 15.2c-.2.7 0 1.4.5 1.9",
  ],
  bath: [
    "M4.6 14.4c0-1 .8-1.8 1.8-1.8h11.2c1 0 1.8.8 1.8 1.8 0 2.4-1.4 4.4-3.4 5.3H8c-2-.9-3.4-2.9-3.4-5.3z",
    "M6 19.9v1",
    "M18 19.9v1",
    "M16 9.6c.3-1.2 1.4-2 2.6-1.9",
  ],
  toothbrush: [
    "M6 19 15 9.4",
    "M14.3 8c.9-.8 2.2-.8 3 .1.8.9.7 2.1-.2 2.9l-2 1.8-2.8-3 2-1.8z",
    "M15.3 7.7l.9.9",
    "M16.3 6.8l.9.9",
    "M17.3 6l.8.8",
  ],

  // Rotina
  house: [
    "M4.4 11.2 12 4.9l7.6 6.3",
    "M6.4 10.4v8.8h11.2v-8.8",
    "M10.6 19.2v-4.3c0-.5.4-.9.9-.9h1c.5 0 .9.4.9.9v4.3",
  ],
  calendar: [
    "M4.6 7.4c0-.7.6-1.3 1.3-1.3h12.2c.7 0 1.3.6 1.3 1.3v11c0 .7-.6 1.3-1.3 1.3H5.9c-.7 0-1.3-.6-1.3-1.3z",
    "M8.4 4.8v3.4",
    "M15.6 4.8v3.4",
    "M4.8 10.8h14.3",
  ],
  cycle: [
    "M6 9.4c0-3 2.6-5.4 6-5.4s6 2.4 6 5.4",
    "M18 9.4l1.8-2.3",
    "M18 9.4l-2.4-1.1",
    "M18 14.6c0 3-2.6 5.4-6 5.4s-6-2.4-6-5.4",
    "M6 14.6l-1.8 2.3",
    "M6 14.6l2.4 1.1",
  ],
};

// Agrupamento por tema só para a página de demonstração — a decisão de
// qual tema cada ícone representa é de uso (quem chama QuintalIcon passa
// os dois props), não uma regra imposta pelos dados em si.
export const QUINTAL_ICON_GROUPS: Record<string, QuintalIconName[]> = {
  sleep: ["moon", "bed", "nap"],
  play: ["blocks", "ball", "box"],
  meal: ["plate", "spoon", "cup"],
  growth: ["sprout", "growth", "book"],
  hygiene: ["drop", "bath", "toothbrush"],
  routine: ["house", "calendar", "cycle"],
};
