// Ícones coloridos dos cinco pilares do produto — porta do design system
// (components/icon/PillarIcon.jsx), usado pela primeira vez nesta
// refatoração do módulo Sono ("preservar ícones do pilar Sono", pedido
// explícito). Cores fixas por traço/preenchimento (iguais ao arquivo de
// origem): são a identidade visual de cada pilar, não cores de UI —
// mapeadas para os tokens do projeto onde batem exatamente, literais
// onde o pilar usa um tom próprio que não tem token equivalente (mesmo
// critério já usado em CrayonMark.tsx).
export type PillarName = "sono" | "alimentacao" | "desenvolvimento" | "rotina" | "brincar";

const PILLARS: Record<PillarName, React.ReactNode> = {
  sono: (
    <path
      d="M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5z"
      fill="none"
      stroke="var(--color-ink)"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  alimentacao: (
    <g fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h18a9 9 0 0 1-18 0z" fill="var(--color-sand)" stroke="var(--color-ink)" />
      <path d="M9 11c0-3 1-5 3-5M14 11l4-7" stroke="var(--color-accent)" />
      <circle cx={10} cy={9} r={1.2} fill="var(--color-leaf)" stroke="none" />
    </g>
  ),
  desenvolvimento: (
    <g strokeWidth={1.6} strokeLinecap="round" stroke="#c98e22">
      <rect x={5} y={17} width={14} height={4} rx={2} fill="var(--color-accent)" />
      <rect x={7} y={13} width={10} height={4} rx={2} fill="var(--color-sand)" />
      <rect x={9} y={9} width={6} height={4} rx={2} fill="var(--color-accent)" />
      <circle cx={12} cy={6} r={2} fill="var(--color-sand)" />
    </g>
  ),
  rotina: (
    <g fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 9L5 21l3-9 5-5z" fill="var(--color-accent)" stroke="var(--color-decorative)" />
      <path d="M16 8l3-3M16 5l1-2M19 8l2-1" stroke="var(--color-leaf)" />
    </g>
  ),
  brincar: (
    <path
      d="M12 20.5C6.5 16.4 3 13 3 9a4.5 4.5 0 0 1 9-1 4.5 4.5 0 0 1 9 1c0 4-3.5 7.4-9 11.5z"
      fill="#e9a07a"
      stroke="var(--color-decorative)"
      strokeWidth={1.6}
      strokeLinejoin="round"
    />
  ),
};

export function PillarIcon({ name, size = 40, style }: { name: PillarName; size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={style}>
      {PILLARS[name]}
    </svg>
  );
}
