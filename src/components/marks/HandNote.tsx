const TONES = {
  areia: "var(--color-sand)",
  sage: "var(--color-tertiary)",
  pessego: "var(--color-peach)",
  none: "transparent",
} as const;

// Nota manuscrita na margem — Caveat, inclinada 2–4°, nunca texto
// corrido (regra do design system). Porta 1:1 de
// quintal-design/components/marks/HandNote.jsx.
export function HandNote({
  tone = "areia",
  tilt = -3,
  size = 24,
  children,
  style,
}: {
  tone?: keyof typeof TONES;
  tilt?: number;
  size?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const sticky = tone !== "none";
  return (
    <span
      className="q-hand inline-block leading-[1.1]"
      style={{
        fontSize: size,
        background: TONES[tone],
        padding: sticky ? "12px 18px" : 0,
        borderRadius: sticky ? "6px" : 0,
        boxShadow: sticky ? "0 2px 8px rgba(34,64,44,0.08)" : "none",
        transform: `rotate(${tilt}deg)`,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

// Traço de crayon amber sob as palavras que carregam o título — um por
// tela. Precisa de <CrayonDefs /> (ver CrayonMark.tsx) renderizado antes.
export function Underline({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span className="relative inline-block" style={style}>
      {children}
      <svg
        width="100%"
        height="10"
        viewBox="0 0 120 10"
        preserveAspectRatio="none"
        fill="none"
        filter="url(#q-crayon)"
        aria-hidden="true"
        className="absolute bottom-[-0.2em] left-0"
      >
        <path d="M3 6C40 3 80 3 117 5" stroke="var(--color-accent)" strokeWidth={4} strokeLinecap="round" />
      </svg>
    </span>
  );
}
