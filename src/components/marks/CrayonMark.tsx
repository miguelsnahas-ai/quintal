// Filtro de textura "crayon" — renderizar <CrayonDefs /> uma vez por
// página antes de qualquer <CrayonMark />. Porta 1:1 do design system
// (quintal-design/components/marks/CrayonMark.jsx): mesma turbulência/
// deslocamento SVG, só reescrita como componente do projeto.
export function CrayonDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <filter id="q-crayon" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves={2} seed={4} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={2.2} xChannelSelector="R" yChannelSelector="G" result="d" />
          <feTurbulence type="fractalNoise" baseFrequency="2.4" numOctaves={1} seed={9} result="g" />
          <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.7" result="mask" />
          <feComposite in="d" in2="mask" operator="in" />
        </filter>
      </defs>
    </svg>
  );
}

type CrayonMarkName = "sun" | "sunrise" | "sprig" | "heart" | "arrow" | "grass";

const MARKS: Record<CrayonMarkName, { w: number; h: number; color: string; el: (c: string) => React.ReactNode }> = {
  sun: {
    w: 90,
    h: 90,
    color: "var(--color-accent)",
    el: (c) => (
      <g>
        <circle cx={45} cy={45} r={17} fill={c} />
        <path
          d="M45 16V6M45 84V74M16 45H6M84 45H74M24 24l-7-7M66 66l7 7M66 24l7-7M24 66l-7 7"
          stroke={c}
          strokeWidth={4}
          strokeLinecap="round"
        />
      </g>
    ),
  },
  sunrise: {
    w: 84,
    h: 40,
    color: "var(--color-accent)",
    el: (c) => (
      <g stroke={c} strokeWidth={4} strokeLinecap="round">
        <path d="M22 38a20 20 0 0 1 40 0" />
        <path d="M42 10V2M22 16l-5-6M62 16l5-6M8 30l-7-2M76 30l7-2" />
      </g>
    ),
  },
  sprig: {
    w: 70,
    h: 140,
    color: "var(--color-leaf)",
    el: (c) => (
      <g stroke={c} strokeWidth={3} strokeLinecap="round">
        <path d="M36 136C34 100 36 60 44 8" />
        <path d="M38 110c-12-4-20-14-22-26 12 2 20 12 22 26z" />
        <path d="M38 110c10-6 18-16 20-28-12 4-18 14-20 28z" />
        <path d="M39 78c-12-4-18-14-20-26 12 2 18 12 20 26z" />
        <path d="M40 78c10-6 16-16 18-28-12 4-18 14-18 28z" />
        <path d="M42 46c-10-4-16-12-16-22 10 2 16 10 16 22z" />
        <path d="M42 46c8-5 14-13 14-23-10 4-14 12-14 23z" />
      </g>
    ),
  },
  heart: {
    w: 60,
    h: 54,
    color: "var(--color-decorative)",
    el: (c) => (
      <path
        d="M30 50C14 38 4 28 4 17 4 9 10 4 17 4c6 0 10 4 13 9 3-5 7-9 13-9 7 0 13 5 13 13 0 11-10 21-26 33z"
        fill={c}
      />
    ),
  },
  arrow: {
    w: 50,
    h: 80,
    color: "var(--color-ink)",
    el: (c) => (
      <g stroke={c} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 4c18 14 24 36 18 66" />
        <path d="M20 60l10 12 8-14" />
      </g>
    ),
  },
  grass: {
    w: 140,
    h: 40,
    color: "var(--color-leaf)",
    el: (c) => (
      <g stroke={c} strokeWidth={3} strokeLinecap="round">
        <path d="M4 30c20-4 40-6 64-4s46 2 68-2" />
        <path d="M20 30l-4-12M34 28l2-14M52 28l-3-10M70 27l4-13M90 28l-2-11M108 27l3-12M124 27l-2-9" />
      </g>
    ),
  },
};

// Desenho de crayon — sol, sunrise, sprig, coração, flecha, grama. Dois
// ou três por tela, nunca atrás de texto (regra do design system).
export function CrayonMark({
  mark = "sun",
  color,
  scale = 1,
  style,
}: {
  mark?: CrayonMarkName;
  color?: string;
  scale?: number;
  style?: React.CSSProperties;
}) {
  const m = MARKS[mark];
  return (
    <svg
      width={m.w * scale}
      height={m.h * scale}
      viewBox={`0 0 ${m.w} ${m.h}`}
      fill="none"
      filter="url(#q-crayon)"
      aria-hidden="true"
      style={style}
    >
      {m.el(color || m.color)}
    </svg>
  );
}
